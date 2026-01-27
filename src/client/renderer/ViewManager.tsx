// ===============================================
// ViewManager - Manages viewport rendering
// ===============================================
// Handles switching between Telescope, Orbit, Surface views
// For v0.0.0: Only TelescopeView is implemented

import type { GameState } from '../../engine/state-types/state-types.js';
import { TelescopeView } from './TelescopeView.js';

// -----------------------------------------------
// View types
// -----------------------------------------------

export type ViewType = 'TELESCOPE' | 'ORBIT' | 'SURFACE';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface ViewManagerProps {
    gameState: GameState | null;
    activeView: ViewType;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function ViewManager({ gameState, activeView }: ViewManagerProps) {
    switch (activeView) {
        case 'TELESCOPE':
            return <TelescopeView gameState={gameState} />;
        
        case 'ORBIT':
            // TODO: OrbitView
            return <TelescopeView gameState={gameState} />;
        
        case 'SURFACE':
            // TODO: SurfaceView
            return <TelescopeView gameState={gameState} />;
        
        default:
            return <TelescopeView gameState={gameState} />;
    }
}
