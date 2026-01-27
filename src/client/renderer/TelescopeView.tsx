// ===============================================
// TelescopeView - Space viewport
// ===============================================
// Renders: circles for bodies, points for entities
// Style: Black and white

import { useRef, useEffect } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GameState } from '../../engine/state-types/state-types.js';
import { VIEWPORT, COLORS, SIZES, fpToScreen } from './config.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface TelescopeViewProps {
    gameState: GameState | null;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function TelescopeView({ gameState }: TelescopeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const graphicsRef = useRef<Graphics | null>(null);
    
    // Initialize PixiJS
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
                
                const graphics = new Graphics();
                app.stage.addChild(graphics);
                graphicsRef.current = graphics;
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
        };
    }, []);
    
    // Render game state
    useEffect(() => {
        const app = appRef.current;
        const graphics = graphicsRef.current;
        
        if (!app || !graphics || !gameState) return;
        
        const w = app.screen.width;
        const h = app.screen.height;
        const cx = w / 2;
        const cy = h / 2;
        
        graphics.clear();
        
        // Draw celestials
        for (const celestial of gameState.celestials) {
            const x = cx + fpToScreen(celestial.position.x) * VIEWPORT.scale;
            const y = cy - fpToScreen(celestial.position.y) * VIEWPORT.scale;
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
            const x = cx + fpToScreen(entity.position.x) * VIEWPORT.scale;
            const y = cy - fpToScreen(entity.position.y) * VIEWPORT.scale;
            
            graphics.circle(x, y, SIZES.point);
            graphics.fill({ color: COLORS.foreground });
        }
        
    }, [gameState]);
    
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
