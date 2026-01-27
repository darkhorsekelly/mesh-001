// ===============================================
// App - Main application shell
// ===============================================

import { useState } from 'react';
import { useEngine } from './hooks/useEngine.js';
import { ViewManager, type ViewType } from './renderer/ViewManager.js';

// -----------------------------------------------
// Component
// -----------------------------------------------

// TODO: Move to CSS module
export function App() {
    // Socket connection to the game server
    const { gameState, connected, error, executeTick } = useEngine();
    
    // Current view type
    const [activeView] = useState<ViewType>('TELESCOPE');
    
    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#000', color: '#fff', fontFamily: 'monospace', overflow: 'hidden' }}>
            {/* Viewport */}
            <div style={{ flex: 7, minWidth: 0, height: '100%', borderRight: '1px solid #333' }}>
                <ViewManager gameState={gameState} activeView={activeView} />
            </div>
            
            {/* Program */}
            <div style={{ flex: 3, minWidth: 0, height: '100%', padding: 16, overflow: 'auto' }}>
                <div style={{ marginBottom: 16 }}>
                    <div>MESH 95</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        {connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </div>
                    {error && <div style={{ fontSize: 11, color: '#f44' }}>{error}</div>}
                </div>
                
                <button
                    onClick={() => connected && executeTick()}
                    disabled={!connected}
                    style={{
                        padding: '12px 24px',
                        fontFamily: 'monospace',
                        background: connected ? '#222' : '#111',
                        color: connected ? '#fff' : '#444',
                        border: '1px solid #444',
                        cursor: connected ? 'pointer' : 'not-allowed',
                    }}
                >
                    EXECUTE TICK
                </button>
                
                {gameState && (
                    <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                        Tick: {gameState.tick}
                    </div>
                )}
                
                <pre style={{ marginTop: 16, fontSize: 10, color: '#666', overflow: 'auto', maxHeight: 400 }}>
                    {gameState ? JSON.stringify(gameState, null, 2) : 'No state'}
                </pre>
            </div>
        </div>
    );
}
