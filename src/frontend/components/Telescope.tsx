// ===============================================
// Telescope - Canvas-based spatial renderer
// ===============================================
// draws the game state using HTML5 canvas.
// supports camera pan/zoom and ghost projection rendering.

import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';
import type { CelestialBody } from '../../engine/primitive-types/semantic/celestial/celestial-types.js';
import type { Entity } from '../../engine/primitive-types/semantic/entity/entity-types.js';
import type { DraftResult } from '../../engine/draft/draftService.js';
import type { CameraState } from '../hooks/useCamera.js';
import { FP_SCALE } from '../utils/fpConvert.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface TelescopeProps {
    gameState: GameState;
    camera: CameraState;
    onPan: (dx: number, dy: number) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    draftResult: DraftResult | null;
}

// -----------------------------------------------
// Colors
// -----------------------------------------------

const COLORS = {
    background: '#000000',
    sol: '#FFD700',
    planet: '#4169E1',
    moon: '#808080',
    asteroid: '#8B4513',
    entity: '#FFFFFF',
    wormhole: '#FF00FF',
    ghost: 'rgba(255, 255, 255, 0.4)',
    ghostLine: 'rgba(255, 255, 255, 0.2)',
    captureRing: 'rgba(255, 255, 255, 0.15)',
    grid: 'rgba(255, 255, 255, 0.05)',
};

// -----------------------------------------------
// Coordinate Transformation
// -----------------------------------------------

function worldToScreen(
    worldPos: Vector2FP,
    camera: CameraState,
    canvasWidth: number,
    canvasHeight: number
): { x: number; y: number } {
    // convert FP world coordinates to screen pixels
    const worldX = worldPos.x / FP_SCALE;
    const worldY = worldPos.y / FP_SCALE;
    const offsetX = camera.offset.x / FP_SCALE;
    const offsetY = camera.offset.y / FP_SCALE;

    const screenX = (worldX - offsetX) * camera.zoom + canvasWidth / 2;
    const screenY = (worldY - offsetY) * camera.zoom + canvasHeight / 2;

    return { x: screenX, y: screenY };
}

// -----------------------------------------------
// Draw Functions
// -----------------------------------------------

function drawSol(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody & { type: 'SOL' },
    camera: CameraState,
    width: number,
    height: number
) {
    const pos = worldToScreen(celestial.position, camera, width, height);
    const radius = Math.max(8, (celestial.radius / FP_SCALE) * camera.zoom);

    // glow effect
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 2);
    gradient.addColorStop(0, COLORS.sol);
    gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // core
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sol;
    ctx.fill();
}

function drawPlanet(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody & { type: 'PLANET' },
    camera: CameraState,
    width: number,
    height: number
) {
    const pos = worldToScreen(celestial.position, camera, width, height);
    const radius = Math.max(4, (celestial.radius / FP_SCALE) * camera.zoom);
    const captureRadius = (celestial.captureRadius / FP_SCALE) * camera.zoom;

    // capture radius ring
    if (captureRadius > 2) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, captureRadius, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.captureRing;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // planet body
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.planet;
    ctx.fill();
}

function drawMoon(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody & { type: 'MOON' },
    camera: CameraState,
    width: number,
    height: number
) {
    const pos = worldToScreen(celestial.position, camera, width, height);
    const radius = Math.max(2, (celestial.radius / FP_SCALE) * camera.zoom);
    const captureRadius = (celestial.captureRadius / FP_SCALE) * camera.zoom;

    // capture radius ring
    if (captureRadius > 2) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, captureRadius, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.captureRing;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // moon body
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.moon;
    ctx.fill();
}

function drawAsteroid(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody & { type: 'ASTEROID' },
    camera: CameraState,
    width: number,
    height: number
) {
    const pos = worldToScreen(celestial.position, camera, width, height);
    const radius = Math.max(2, (celestial.radius / FP_SCALE) * camera.zoom);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.asteroid;
    ctx.fill();
}

function drawWormhole(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody & { type: 'WORMHOLE' },
    camera: CameraState,
    width: number,
    height: number
) {
    const radius = Math.max(4, (celestial.radius / FP_SCALE) * camera.zoom);

    // draw both endpoints
    for (const endpoint of celestial.endpoints) {
        const pos = worldToScreen(endpoint, camera, width, height);

        // outer ring
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.wormhole;
        ctx.lineWidth = 2;
        ctx.stroke();

        // inner ring
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.wormhole;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function drawEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    camera: CameraState,
    width: number,
    height: number,
    isGhost: boolean = false
) {
    const pos = worldToScreen(entity.position, camera, width, height);
    const size = 8;

    // calculate angle from velocity (or heading if stationary)
    let angle = 0;
    const vx = entity.velocity.x;
    const vy = entity.velocity.y;
    if (vx !== 0 || vy !== 0) {
        angle = Math.atan2(vy, vx);
    } else {
        // use heading (FP degrees to radians)
        angle = (entity.heading / FP_SCALE) * (Math.PI / 180);
    }

    // draw triangle pointing in direction of movement
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, -size * 0.5);
    ctx.lineTo(-size * 0.6, size * 0.5);
    ctx.closePath();

    ctx.fillStyle = isGhost ? COLORS.ghost : COLORS.entity;
    ctx.fill();

    // player indicator ring
    if (entity.playerId && !isGhost) {
        ctx.beginPath();
        ctx.arc(0, 0, size + 3, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.entity;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

function drawGhostLine(
    ctx: CanvasRenderingContext2D,
    fromPos: Vector2FP,
    toPos: Vector2FP,
    camera: CameraState,
    width: number,
    height: number
) {
    const from = worldToScreen(fromPos, camera, width, height);
    const to = worldToScreen(toPos, camera, width, height);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = COLORS.ghostLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawCelestial(
    ctx: CanvasRenderingContext2D,
    celestial: CelestialBody,
    camera: CameraState,
    width: number,
    height: number
) {
    switch (celestial.type) {
        case 'SOL':
            drawSol(ctx, celestial, camera, width, height);
            break;
        case 'PLANET':
            drawPlanet(ctx, celestial, camera, width, height);
            break;
        case 'MOON':
            drawMoon(ctx, celestial, camera, width, height);
            break;
        case 'ASTEROID':
            drawAsteroid(ctx, celestial, camera, width, height);
            break;
        case 'WORMHOLE':
            drawWormhole(ctx, celestial, camera, width, height);
            break;
    }
}

// -----------------------------------------------
// Render function
// -----------------------------------------------

function render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    gameState: GameState,
    camera: CameraState,
    draftResult: DraftResult | null
) {
    // clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // draw celestials (back to front)
    // wormholes first (background)
    for (const celestial of gameState.celestials) {
        if (celestial.type === 'WORMHOLE') {
            drawCelestial(ctx, celestial, camera, width, height);
        }
    }

    // then sols
    for (const celestial of gameState.celestials) {
        if (celestial.type === 'SOL') {
            drawCelestial(ctx, celestial, camera, width, height);
        }
    }

    // then planets and moons
    for (const celestial of gameState.celestials) {
        if (celestial.type === 'PLANET' || celestial.type === 'MOON') {
            drawCelestial(ctx, celestial, camera, width, height);
        }
    }

    // then asteroids
    for (const celestial of gameState.celestials) {
        if (celestial.type === 'ASTEROID') {
            drawCelestial(ctx, celestial, camera, width, height);
        }
    }

    // draw ghost entities and lines (if draft result exists)
    if (draftResult) {
        const ghostState = draftResult.ghostState;
        
        // draw ghost lines and ghost entities
        for (const ghostEntity of ghostState.entities) {
            // find matching current entity
            const currentEntity = gameState.entities.find(e => e.id === ghostEntity.id);
            if (currentEntity) {
                // check if position changed
                if (currentEntity.position.x !== ghostEntity.position.x ||
                    currentEntity.position.y !== ghostEntity.position.y) {
                    // draw line from current to ghost
                    drawGhostLine(ctx, currentEntity.position, ghostEntity.position, camera, width, height);
                    // draw ghost entity
                    drawEntity(ctx, ghostEntity, camera, width, height, true);
                }
            }
        }
    }

    // draw current entities
    for (const entity of gameState.entities) {
        // skip contained entities (inside other entities)
        if (entity.parentId) continue;
        drawEntity(ctx, entity, camera, width, height);
    }

    // draw HUD overlay
    ctx.fillStyle = '#666';
    ctx.font = '11px monospace';
    ctx.fillText(`Tick: ${gameState.tick}`, 10, 20);
    ctx.fillText(`Zoom: ${camera.zoomLevel.label} (${camera.zoom.toExponential(1)})`, 10, 35);
    ctx.fillText(`Offset: ${Math.round(camera.offset.x / FP_SCALE)}, ${Math.round(camera.offset.y / FP_SCALE)}`, 10, 50);
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function Telescope({
    gameState,
    camera,
    onPan,
    onZoomIn,
    onZoomOut,
    draftResult,
}: TelescopeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // resize observer - separate effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const updateSize = () => {
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                setCanvasSize({ width, height });
            }
        };

        // initial size
        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(canvas);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // render effect - runs when state or size changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvasSize;
        if (width === 0 || height === 0) return;

        render(ctx, width, height, gameState, camera, draftResult);
    }, [gameState, camera, draftResult, canvasSize]);

    // wheel event - attach with passive: false to allow preventDefault
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                onZoomIn();
            } else {
                onZoomOut();
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
        };
    }, [onZoomIn, onZoomOut]);

    // mouse event handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;
        
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        
        onPan(dx, dy);
    }, [onPan]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    // keyboard handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const panAmount = 50;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                onPan(0, panAmount);
                break;
            case 'ArrowDown':
            case 's':
                onPan(0, -panAmount);
                break;
            case 'ArrowLeft':
            case 'a':
                onPan(panAmount, 0);
                break;
            case 'ArrowRight':
            case 'd':
                onPan(-panAmount, 0);
                break;
            case '+':
            case '=':
                onZoomIn();
                break;
            case '-':
                onZoomOut();
                break;
        }
    }, [onPan, onZoomIn, onZoomOut]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                cursor: isDragging.current ? 'grabbing' : 'grab',
                display: 'block',
            }}
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleKeyDown}
        />
    );
}
