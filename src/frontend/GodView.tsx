// ===============================================
// GodView - Root component for the God-View Telescope
// ===============================================
// layout: Telescope viewport (left) | GodConsole (right)
// provides developer tools for exploring the FP universe.

import { useEffect, useRef } from 'react';
import { useGodState } from './hooks/useGodState.js';
import { useCamera } from './hooks/useCamera.js';
import { Telescope } from './components/Telescope.js';
import { GodConsole } from './components/GodConsole.js';

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
    } as React.CSSProperties,

    viewport: {
        flex: 7,
        minWidth: 0,
        height: '100%',
        borderRight: '1px solid #333',
        position: 'relative',
    } as React.CSSProperties,

    console: {
        flex: 3,
        minWidth: 300,
        maxWidth: 400,
        height: '100%',
        overflow: 'auto',
    } as React.CSSProperties,
};

// -----------------------------------------------
// Component
// -----------------------------------------------

export function GodView() {
    const godState = useGodState();
    const cameraState = useCamera();
    const hasInitialized = useRef(false);

    // auto-slew to first Sol on initial load
    useEffect(() => {
        if (hasInitialized.current) return;
        
        const firstSol = godState.gameState.celestials.find(c => c.type === 'SOL');
        if (firstSol && 'position' in firstSol) {
            cameraState.slewTo(firstSol.position);
            hasInitialized.current = true;
        }
    }, [godState.gameState.celestials, cameraState]);

    return (
        <div style={STYLES.root}>
            {/* Telescope Viewport */}
            <div style={STYLES.viewport}>
                <Telescope
                    gameState={godState.gameState}
                    camera={cameraState.camera}
                    onPan={cameraState.pan}
                    onZoomIn={cameraState.zoomIn}
                    onZoomOut={cameraState.zoomOut}
                    draftResult={godState.draftResult}
                />
            </div>

            {/* God Console */}
            <div style={STYLES.console}>
                <GodConsole
                    gameState={godState.gameState}
                    genesisConfig={godState.genesisConfig}
                    activePlayerId={godState.activePlayerId}
                    playerIds={godState.playerIds}
                    actionQueue={godState.actionQueue}
                    draftResult={godState.draftResult}
                    onUpdateGenesisConfig={godState.updateGenesisConfig}
                    onGenerateUniverse={godState.generateNewUniverse}
                    onSwitchSeat={godState.switchSeat}
                    onQueueAction={godState.queueAction}
                    onRemoveAction={godState.removeAction}
                    onClearActions={godState.clearActions}
                    onExecuteTick={godState.executeTick}
                    onSlewTo={cameraState.slewTo}
                />
            </div>
        </div>
    );
}
