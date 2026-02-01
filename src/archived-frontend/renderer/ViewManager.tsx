// ===============================================
// ViewManager - Manages viewport rendering
// ===============================================
// Handles switching between Telescope, Orbit, Surface views
// Selection is handled via inputEvents bus (no callback props)

import type { GameState } from '../../engine/state-types/state-types.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';
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
    selectedEntityId: string | null;
    actionQueue: Action[];
    hypotheticalAction: Action | null;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function ViewManager({ gameState, activeView, selectedEntityId, actionQueue, hypotheticalAction }: ViewManagerProps) {
    switch (activeView) {
        case 'TELESCOPE':
            return (
                <TelescopeView
                    gameState={gameState}
                    selectedEntityId={selectedEntityId}
                    actionQueue={actionQueue}
                    hypotheticalAction={hypotheticalAction}
                />
            );
        
        case 'ORBIT':
            // TODO: OrbitView
            return (
                <TelescopeView
                    gameState={gameState}
                    selectedEntityId={selectedEntityId}
                    actionQueue={actionQueue}
                    hypotheticalAction={hypotheticalAction}
                />
            );
        
        case 'SURFACE':
            // TODO: SurfaceView
            return (
                <TelescopeView
                    gameState={gameState}
                    selectedEntityId={selectedEntityId}
                    actionQueue={actionQueue}
                    hypotheticalAction={hypotheticalAction}
                />
            );
        
        default:
            return (
                <TelescopeView
                    gameState={gameState}
                    selectedEntityId={selectedEntityId}
                    actionQueue={actionQueue}
                    hypotheticalAction={hypotheticalAction}
                />
            );
    }
}
