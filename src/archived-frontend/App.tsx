// ===============================================
// App - Main application shell
// ===============================================
// Layout: Viewport (70%) | Program Sidebar (30%)
// Program: Header -> Entity Navigator -> Inspector
// Selection: all input emits to inputEvents bus, useInput subscribes

import { useState, useCallback } from 'react';
import { useEngine } from './hooks/useEngine.js';
import { useInput } from './hooks/useInput.js';
import { useSensors } from './hooks/useSensors.js';
import { ViewManager, type ViewType } from './renderer/ViewManager.js';
import { EntityList } from './ui/EntityList.js';
import { EntityInspector } from './ui/EntityInspector.js';
import { NavList } from './ui/NavList.js';
import { inputEvents } from './events/inputEvents.js';

// -----------------------------------------------
// Constants
// -----------------------------------------------

// TODO: Get from auth/session. Hardcoded for development
const LOCAL_PLAYER_ID = 'player-1';

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    root: {
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'monospace',
        overflow: 'hidden',
    },
    
    viewport: {
        flex: 7,
        minWidth: 0,
        height: '100%',
        borderRight: '1px solid #333',
    },
    
    sidebar: {
        flex: 3,
        minWidth: 0,
        height: '100%',
        padding: 16,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column' as const,
    },
    
    header: {
        marginBottom: 16,
    },
    
    title: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    
    status: {
        fontSize: 11,
        marginTop: 4,
    },
    
    statusConnected: {
        color: '#4f4',
    },
    
    statusDisconnected: {
        color: '#f44',
    },
    
    error: {
        fontSize: 11,
        color: '#f44',
        marginTop: 4,
    },
    
    tickInfo: {
        marginTop: 12,
        fontSize: 11,
        color: '#666',
    },
    
    tickNumber: {
        color: '#fff',
        fontSize: 13,
    },
    
    executeButton: {
        padding: '10px 20px',
        fontFamily: 'monospace',
        fontSize: 11,
        border: '1px solid #444',
        cursor: 'pointer',
        marginTop: 8,
    },
    
    executeButtonEnabled: {
        background: '#222',
        color: '#fff',
    },
    
    executeButtonDisabled: {
        background: '#111',
        color: '#444',
        cursor: 'not-allowed',
    },
};

// -----------------------------------------------
// Component
// -----------------------------------------------

export function App() {
    // Socket connection to the game server
    // pendingEngineActions comes from server (authoritative)
    const { gameState, connected, error, executeTick, pendingEngineActions, isSyncing } = useEngine();
    
    // Input/selection state with pre-calculated view models
    // useInput subscribes to inputEvents bus - it's the single authority for selection
    // hypotheticalAction is set when hovering with a tool (e.g., Thrust Vector)
    const {
        selectedEntityId,
        allEntities,
        selectedEntity,
        hypotheticalAction,
    } = useInput(gameState, LOCAL_PLAYER_ID);

    // Sensor data for navigation
    const { celestialsBySystem } = useSensors(gameState);
    
    // Current view type
    const [activeView] = useState<ViewType>('TELESCOPE');
    
    // Sidebar empty-click deselect handler
    // Clicking empty space in sidebar deselects (child clicks stopPropagation)
    const handleSidebarClick = useCallback(() => {
        inputEvents.deselect();
    }, []);
    
    // Button click handler - stopPropagation so it doesn't trigger sidebar deselect
    const handleExecuteClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (connected) {
            executeTick();
        }
    }, [connected, executeTick]);
    
    // Button style based on connection state
    const buttonStyle = {
        ...STYLES.executeButton,
        ...(connected ? STYLES.executeButtonEnabled : STYLES.executeButtonDisabled),
    };
    
    return (
        <div style={STYLES.root}>
            {/* Viewport */}
            <div style={STYLES.viewport}>
                <ViewManager
                    gameState={gameState}
                    activeView={activeView}
                    selectedEntityId={selectedEntityId}
                    actionQueue={pendingEngineActions}
                    hypotheticalAction={hypotheticalAction}
                />
            </div>
            
            {/* Program sidebar - clicking empty space deselects */}
            <div style={STYLES.sidebar} onClick={handleSidebarClick}>
                {/* Header: title, connection status, tick info */}
                {/* stopPropagation so clicks don't trigger sidebar deselect */}
                <div style={STYLES.header} onClick={(e) => e.stopPropagation()}>
                    <div style={STYLES.title}>MESH 95</div>
                    <div style={{
                        ...STYLES.status,
                        ...(connected ? STYLES.statusConnected : STYLES.statusDisconnected),
                    }}>
                        {connected ? '● CONNECTED' : '○ DISCONNECTED'}
                    </div>
                    {error && <div style={STYLES.error}>{error}</div>}
                    
                    {gameState && (
                        <div style={STYLES.tickInfo}>
                            Tick: <span style={STYLES.tickNumber}>{gameState.tick}</span>
                            {pendingEngineActions.length > 0 && (
                                <span style={{ marginLeft: 8, color: '#888' }}>
                                    ({pendingEngineActions.length} queued)
                                </span>
                            )}
                            {isSyncing && (
                                <span style={{ marginLeft: 8, color: '#ff0' }}>
                                    syncing...
                                </span>
                            )}
                        </div>
                    )}
                    
                    <button
                        onClick={handleExecuteClick}
                        disabled={!connected}
                        style={buttonStyle}
                    >
                        EXECUTE TICK
                    </button>
                </div>
                
                {/* Entity navigator - selection emits to event bus */}
                <EntityList
                    entities={allEntities}
                    title="Entities (Tab to cycle)"
                />
                
                {/* Inspector for selected entity */}
                <EntityInspector entity={selectedEntity} />

                {/* Navigation - celestial targets */}
                <NavList celestialsBySystem={celestialsBySystem} />
            </div>
        </div>
    );
}
