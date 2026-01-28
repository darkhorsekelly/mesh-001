// ===============================================
// TelescopeView - Space viewport
// ===============================================
// Renders: circles for bodies, points for entities
// Style: Black and white
// Selection: emits to inputEvents bus (no callback props)
// Camera: Lock-on tracking when entity is selected
// Ghost: Always-on projection showing T+1
//
// Visual Encoding:
// - Authoritative Ghost (solid): velocity + server pending actions
// - Hypothetical Ghost (dashed): server actions + hover intent

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { Entity } from '../../engine/primitive-types/semantic/entity/entity-types.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';
import {
    projectEntity,
    projectCelestials,
    mergeActionsForProjection,
} from '../../engine/state-handlers/state-systems/projectionSystem.js';
import { VIEWPORT, COLORS, SIZES, fpToScreen, CLICK_RADIUS } from './config.js';
import { inputEvents } from '../events/inputEvents.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface TelescopeViewProps {
    gameState: GameState | null;
    selectedEntityId: string | null;
    actionQueue: Action[];
    hypotheticalAction: Action | null;
}

// -----------------------------------------------
// Focus box dimensions
// -----------------------------------------------

const FOCUS_BOX = {
    size: 24,
    cornerLength: 6,
    padding: 4,
};

// -----------------------------------------------
// Ghost visual constants
// -----------------------------------------------

const GHOST = {
    // Dash pattern for hypothetical ghost line
    dashLength: 4,
    gapLength: 4,
    
    // Dashed circle segments for hypothetical ghost point
    circleSegments: 8,
};

// -----------------------------------------------
// Helper: draw focus box (4 corner lines)
// -----------------------------------------------

function drawFocusBox(graphics: Graphics, x: number, y: number): void {
    const half = FOCUS_BOX.size / 2 + FOCUS_BOX.padding;
    const corner = FOCUS_BOX.cornerLength;
    
    // Top-left corner
    graphics.moveTo(x - half, y - half + corner);
    graphics.lineTo(x - half, y - half);
    graphics.lineTo(x - half + corner, y - half);
    
    // Top-right corner
    graphics.moveTo(x + half - corner, y - half);
    graphics.lineTo(x + half, y - half);
    graphics.lineTo(x + half, y - half + corner);
    
    // Bottom-right corner
    graphics.moveTo(x + half, y + half - corner);
    graphics.lineTo(x + half, y + half);
    graphics.lineTo(x + half - corner, y + half);
    
    // Bottom-left corner
    graphics.moveTo(x - half + corner, y + half);
    graphics.lineTo(x - half, y + half);
    graphics.lineTo(x - half, y + half - corner);
    
    graphics.stroke({ color: COLORS.foreground, width: 1 });
}

// -----------------------------------------------
// Helper: draw dashed line
// -----------------------------------------------

function drawDashedLine(
    graphics: Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    color: number,
    alpha: number
): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 1) return;
    
    const dashLen = GHOST.dashLength;
    const gapLen = GHOST.gapLength;
    const segmentLen = dashLen + gapLen;
    
    // Unit direction vector
    const ux = dx / dist;
    const uy = dy / dist;
    
    let pos = 0;
    while (pos < dist) {
        const dashEnd = Math.min(pos + dashLen, dist);
        
        graphics.moveTo(x1 + ux * pos, y1 + uy * pos);
        graphics.lineTo(x1 + ux * dashEnd, y1 + uy * dashEnd);
        
        pos += segmentLen;
    }
    
    graphics.stroke({ color, width: 1, alpha });
}

// -----------------------------------------------
// Helper: draw dashed circle (for hypothetical ghost)
// -----------------------------------------------

function drawDashedCircle(
    graphics: Graphics,
    x: number, y: number,
    radius: number,
    color: number,
    alpha: number
): void {
    const segments = GHOST.circleSegments;
    const angleStep = (2 * Math.PI) / segments;
    
    // Draw alternating segments (dash pattern around circle)
    for (let i = 0; i < segments; i += 2) {
        const startAngle = i * angleStep;
        const endAngle = (i + 1) * angleStep;
        
        graphics.moveTo(
            x + Math.cos(startAngle) * radius,
            y + Math.sin(startAngle) * radius
        );
        
        // Draw arc segment
        const steps = 8;
        for (let j = 1; j <= steps; j++) {
            const angle = startAngle + (endAngle - startAngle) * (j / steps);
            graphics.lineTo(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius
            );
        }
    }
    
    graphics.stroke({ color, width: 1, alpha });
}

// -----------------------------------------------
// Helper: check if point is within viewport bounds
// -----------------------------------------------

function isInViewport(
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    margin: number = 50
): boolean {
    return (
        screenX >= -margin &&
        screenX <= width + margin &&
        screenY >= -margin &&
        screenY <= height + margin
    );
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function TelescopeView({ gameState, selectedEntityId, actionQueue, hypotheticalAction }: TelescopeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const graphicsRef = useRef<Graphics | null>(null);
    
    // Track when PixiJS is ready - triggers render effect after async init
    const [isAppReady, setIsAppReady] = useState(false);
    
    // Camera offset - persists when deselecting
    const cameraOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    
    // Store gameState in a ref for synchronous access in click handler
    // This avoids re-attaching the handler when gameState changes
    const gameStateRef = useRef<GameState | null>(gameState);
    gameStateRef.current = gameState;
    
    // Find entity at click position (in screen coordinates)
    // Uses current camera offset to map screen -> world
    const findEntityAtClick = useCallback((
        clickX: number,
        clickY: number,
        screenWidth: number,
        screenHeight: number
    ): Entity | null => {
        const state = gameStateRef.current;
        if (!state) return null;
        
        const cx = screenWidth / 2;
        const cy = screenHeight / 2;
        
        // Current camera offset
        const offsetX = cameraOffsetRef.current.x;
        const offsetY = cameraOffsetRef.current.y;
        
        let closestEntity: Entity | null = null;
        let closestDistSq = CLICK_RADIUS * CLICK_RADIUS;
        
        for (const entity of state.entities) {
            // Convert entity world position to screen position
            // Must match the rendering formula exactly
            const entityScreenX = cx + (fpToScreen(entity.position.x) * VIEWPORT.scale) - offsetX;
            const entityScreenY = cy - (fpToScreen(entity.position.y) * VIEWPORT.scale) - offsetY;
            
            // Distance squared from click to entity
            const dx = clickX - entityScreenX;
            const dy = clickY - entityScreenY;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < closestDistSq) {
                closestDistSq = distSq;
                closestEntity = entity;
            }
        }
        
        return closestEntity;
    }, []);
    
    // Initialize PixiJS and attach click handler
    // Handler is attached once and uses refs to access current state
    useEffect(() => {
        if (!containerRef.current) return;
        
        let cancelled = false;
        const app = new Application();
        
        const initApp = async () => {
            try {
                await app.init({
                    background: COLORS.background,
                    resizeTo: containerRef.current!,
                });
                
                // Abort if cleanup was called during async init
                if (cancelled) {
                    app.destroy(true, { children: true });
                    return;
                }
                
                containerRef.current?.appendChild(app.canvas);
                appRef.current = app;
                
                // Make stage interactive for click handling
                app.stage.eventMode = 'static';
                app.stage.hitArea = app.screen;
                
                // Attach click handler - uses refs so it always has current state
                app.stage.on('pointerdown', (event: PointerEvent) => {
                    const rect = app.canvas.getBoundingClientRect();
                    const clickX = event.clientX - rect.left;
                    const clickY = event.clientY - rect.top;
                    
                    const entity = findEntityAtClick(
                        clickX,
                        clickY,
                        app.screen.width,
                        app.screen.height
                    );
                    
                    // Emit to event bus - useInput subscribes and handles state
                    if (entity) {
                        inputEvents.selectEntity(entity.id);
                    } else {
                        inputEvents.deselect();
                    }
                });
                
                const graphics = new Graphics();
                app.stage.addChild(graphics);
                graphicsRef.current = graphics;
                
                // Signal that app is ready - triggers render effect
                setIsAppReady(true);
            } catch (e) {
                // Ignore errors if cancelled
                if (!cancelled) console.error('[MESH] PixiJS init error:', e);
            }
        };
        
        initApp();
        
        return () => {
            cancelled = true;
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
            }
            appRef.current = null;
            graphicsRef.current = null;
            setIsAppReady(false);
        };
    }, [findEntityAtClick]);
    
    // Render game state
    useEffect(() => {
        const app = appRef.current;
        const graphics = graphicsRef.current;
        
        if (!app || !graphics || !gameState) return;
        
        const w = app.screen.width;
        const h = app.screen.height;
        const cx = w / 2;
        const cy = h / 2;
        
        // Camera focus logic: if entity is selected, snap camera to it
        const selectedEntity = selectedEntityId
            ? gameState.entities.find((e) => e.id === selectedEntityId)
            : null;
        
        if (selectedEntity) {
            // Lock-on: offset so selected entity is at screen center
            cameraOffsetRef.current = {
                x: fpToScreen(selectedEntity.position.x) * VIEWPORT.scale,
                y: -fpToScreen(selectedEntity.position.y) * VIEWPORT.scale,
            };
        }
        // If deselected, camera offset stays at last known position (no reset)
        
        const offsetX = cameraOffsetRef.current.x;
        const offsetY = cameraOffsetRef.current.y;
        
        graphics.clear();
        
        // Draw celestials
        for (const celestial of gameState.celestials) {
            const x = cx + (fpToScreen(celestial.position.x) * VIEWPORT.scale) - offsetX;
            const y = cy - (fpToScreen(celestial.position.y) * VIEWPORT.scale) - offsetY;
            const r = Math.max(SIZES.minRadius, fpToScreen(celestial.radius) * VIEWPORT.scale);
            
            if (celestial.type === 'PLANET' || celestial.type === 'MOON') {
                // Circle with radius
                graphics.circle(x, y, r);
                graphics.stroke({ color: COLORS.foreground, width: 1 });
            } else {
                // Point
                graphics.circle(x, y, SIZES.point);
                graphics.fill({ color: COLORS.foreground });
            }
        }
        
        // Draw entities as points
        for (const entity of gameState.entities) {
            const x = cx + (fpToScreen(entity.position.x) * VIEWPORT.scale) - offsetX;
            const y = cy - (fpToScreen(entity.position.y) * VIEWPORT.scale) - offsetY;
            
            graphics.circle(x, y, SIZES.point);
            graphics.fill({ color: COLORS.foreground });
            
            // Draw focus box around selected entity
            if (entity.id === selectedEntityId) {
                drawFocusBox(graphics, x, y);
            }
        }
        
        // Ghost rendering for selected entity
        // INVARIANT: Project celestials to T+1 before entity projection
        if (selectedEntity) {
            // Current position for the trajectory line
            const currentX = cx + (fpToScreen(selectedEntity.position.x) * VIEWPORT.scale) - offsetX;
            const currentY = cy - (fpToScreen(selectedEntity.position.y) * VIEWPORT.scale) - offsetY;
            
            // DISPLAY LOGIC: Only calculate if entity is within viewport bounds
            if (!isInViewport(currentX, currentY, w, h)) {
                // Entity is off-screen, skip ghost calculation
                return;
            }
            
            // CELESTIAL SYNCHRONIZATION: Project celestials to T+1 first
            const celestialsT1 = projectCelestials(gameState.celestials);
            
            // AUTHORITATIVE GHOST: velocity + server pending actions
            // Visual: solid point with solid line
            const authEntity = projectEntity(selectedEntity, actionQueue, celestialsT1);
            const authX = cx + (fpToScreen(authEntity.position.x) * VIEWPORT.scale) - offsetX;
            const authY = cy - (fpToScreen(authEntity.position.y) * VIEWPORT.scale) - offsetY;
            
            const authMoved = Math.abs(authX - currentX) > 0.5 || Math.abs(authY - currentY) > 0.5;
            
            if (authMoved) {
                // Draw solid trajectory line
                graphics.moveTo(currentX, currentY);
                graphics.lineTo(authX, authY);
                graphics.stroke({ color: COLORS.dim, width: 1, alpha: 0.4 });
                
                // Draw solid ghost point (filled circle)
                graphics.circle(authX, authY, SIZES.point + 1);
                graphics.fill({ color: COLORS.dim, alpha: 0.6 });
            }
            
            // HYPOTHETICAL GHOST: server actions + hover intent
            // Visual: dashed point with dashed line (only when hovering)
            if (hypotheticalAction) {
                const combinedActions = mergeActionsForProjection(actionQueue, hypotheticalAction);
                const hypoEntity = projectEntity(selectedEntity, combinedActions, celestialsT1);
                const hypoX = cx + (fpToScreen(hypoEntity.position.x) * VIEWPORT.scale) - offsetX;
                const hypoY = cy - (fpToScreen(hypoEntity.position.y) * VIEWPORT.scale) - offsetY;
                
                // Only draw if different from authoritative position
                const hypoDifferent = Math.abs(hypoX - authX) > 0.5 || Math.abs(hypoY - authY) > 0.5;
                
                if (hypoDifferent) {
                    // Draw dashed trajectory line from authoritative to hypothetical
                    drawDashedLine(graphics, authX, authY, hypoX, hypoY, COLORS.foreground, 0.5);
                    
                    // Draw dashed circle at hypothetical position
                    drawDashedCircle(graphics, hypoX, hypoY, SIZES.point + 2, COLORS.foreground, 0.7);
                }
            }
        }
        
    }, [gameState, selectedEntityId, actionQueue, hypotheticalAction, isAppReady]);
    
    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                background: VIEWPORT.background,
            }}
        />
    );
}
