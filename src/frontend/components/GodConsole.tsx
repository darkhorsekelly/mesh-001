// ===============================================
// GodConsole - Control panel for God-View
// ===============================================
// provides genesis config, seed browser, seat switcher, entity registry,
// draft rail, and the BIG RED BUTTON for tick execution.

import { useState, useCallback, useMemo } from 'react';
import type { GameState, GenesisConfig } from '../../engine/state-types/state-types.js';
import type { Action, ThrustAction } from '../../engine/primitive-types/semantic/action/action-types.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';
import type { DraftResult } from '../../engine/draft/draftService.js';
import type { ActionQueue } from '../hooks/useGodState.js';
import { fpToDisplay, FP_SCALE } from '../utils/fpConvert.js';
import { getCelestialPosition } from '../../engine/primitive-types/semantic/celestial/celestial-types.js';

// -----------------------------------------------
// Props
// -----------------------------------------------

interface GodConsoleProps {
    gameState: GameState;
    genesisConfig: GenesisConfig;
    activePlayerId: string;
    playerIds: string[];
    actionQueue: ActionQueue;
    draftResult: DraftResult | null;
    onUpdateGenesisConfig: (updates: Partial<GenesisConfig>) => void;
    onGenerateUniverse: () => void;
    onSwitchSeat: (playerId: string) => void;
    onQueueAction: (action: Action) => void;
    onRemoveAction: (index: number) => void;
    onClearActions: () => void;
    onExecuteTick: () => void;
    onSlewTo: (position: Vector2FP) => void;
}

// -----------------------------------------------
// Styles
// -----------------------------------------------

const STYLES = {
    container: {
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
    } as React.CSSProperties,

    section: {
        borderBottom: '1px solid #333',
        paddingBottom: 10,
    } as React.CSSProperties,

    sectionTitle: {
        fontSize: 11,
        color: '#888',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1,
    } as React.CSSProperties,

    input: {
        width: '100%',
        padding: '4px 6px',
        background: '#111',
        border: '1px solid #333',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 11,
    } as React.CSSProperties,

    smallInput: {
        width: 60,
        padding: '3px 5px',
        background: '#111',
        border: '1px solid #333',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 10,
    } as React.CSSProperties,

    select: {
        width: '100%',
        padding: '4px 6px',
        background: '#111',
        border: '1px solid #333',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 11,
    } as React.CSSProperties,

    button: {
        padding: '6px 10px',
        background: '#222',
        border: '1px solid #444',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 10,
        cursor: 'pointer',
    } as React.CSSProperties,

    generateButton: {
        padding: '10px 16px',
        background: '#040',
        border: '2px solid #0a0',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 'bold',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: 1,
    } as React.CSSProperties,

    bigRedButton: {
        padding: '14px 20px',
        background: '#400',
        border: '2px solid #f00',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 'bold',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: 2,
    } as React.CSSProperties,

    list: {
        maxHeight: 150,
        overflow: 'auto',
        border: '1px solid #333',
        background: '#0a0a0a',
    } as React.CSSProperties,

    listItem: {
        padding: '4px 6px',
        borderBottom: '1px solid #222',
        fontSize: 10,
        cursor: 'pointer',
    } as React.CSSProperties,

    listItemHover: {
        background: '#1a1a1a',
    } as React.CSSProperties,

    row: {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        marginBottom: 4,
    } as React.CSSProperties,

    label: {
        width: 100,
        fontSize: 10,
        color: '#888',
    } as React.CSSProperties,

    rangeLabel: {
        width: 80,
        fontSize: 10,
        color: '#888',
    } as React.CSSProperties,

    flexGrow: {
        flex: 1,
    } as React.CSSProperties,

    tick: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    } as React.CSSProperties,

    info: {
        fontSize: 10,
        color: '#666',
    } as React.CSSProperties,

    actionItem: {
        padding: '4px 6px',
        borderBottom: '1px solid #222',
        fontSize: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    } as React.CSSProperties,

    removeButton: {
        padding: '2px 5px',
        background: '#300',
        border: '1px solid #600',
        color: '#f88',
        fontFamily: 'monospace',
        fontSize: 9,
        cursor: 'pointer',
    } as React.CSSProperties,

    searchInput: {
        width: '100%',
        padding: '4px 6px',
        background: '#111',
        border: '1px solid #333',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 10,
        marginBottom: 6,
    } as React.CSSProperties,

    configGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
    } as React.CSSProperties,

    configRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    } as React.CSSProperties,

    configLabel: {
        fontSize: 9,
        color: '#666',
        minWidth: 50,
    } as React.CSSProperties,
};

// -----------------------------------------------
// Helper Types
// -----------------------------------------------

interface RegistryItem {
    id: string;
    name: string;
    type: string;
    position: Vector2FP;
    isEntity: boolean;
}

// -----------------------------------------------
// Component
// -----------------------------------------------

export function GodConsole({
    gameState,
    genesisConfig,
    activePlayerId,
    playerIds,
    actionQueue,
    draftResult,
    onUpdateGenesisConfig,
    onGenerateUniverse,
    onSwitchSeat,
    onQueueAction,
    onRemoveAction,
    onClearActions,
    onExecuteTick,
    onSlewTo,
}: GodConsoleProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [showGenesis, setShowGenesis] = useState(false);

    // thrust action form state
    const [thrustDirX, setThrustDirX] = useState('1000');
    const [thrustDirY, setThrustDirY] = useState('0');
    const [thrustMagnitude, setThrustMagnitude] = useState('100');

    // build registry of all entities and celestials
    const registry = useMemo<RegistryItem[]>(() => {
        const items: RegistryItem[] = [];

        // add celestials
        for (const celestial of gameState.celestials) {
            const pos = getCelestialPosition(celestial);
            items.push({
                id: celestial.id,
                name: celestial.name,
                type: celestial.type,
                position: pos,
                isEntity: false,
            });
        }

        // add entities
        for (const entity of gameState.entities) {
            items.push({
                id: entity.id,
                name: entity.playerId ? `${entity.playerId} Ship` : entity.id,
                type: entity.type,
                position: entity.position,
                isEntity: true,
            });
        }

        return items;
    }, [gameState]);

    // filter registry by search
    const filteredRegistry = useMemo(() => {
        if (!searchQuery) return registry;
        const query = searchQuery.toLowerCase();
        return registry.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.type.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query)
        );
    }, [registry, searchQuery]);

    // get active player's entity
    const activePlayerEntity = useMemo(() => {
        return gameState.entities.find(e => e.playerId === activePlayerId);
    }, [gameState.entities, activePlayerId]);

    // get current player's action queue
    const currentActions = actionQueue[activePlayerId] ?? [];

    // total actions across all players
    const totalActions = useMemo(() => {
        return Object.values(actionQueue).reduce((sum, actions) => sum + actions.length, 0);
    }, [actionQueue]);

    // handle slew to item
    const handleSlewTo = useCallback((item: RegistryItem) => {
        onSlewTo(item.position);
    }, [onSlewTo]);

    // handle thrust action
    const handleAddThrust = useCallback(() => {
        if (!activePlayerEntity) return;

        const dirX = parseInt(thrustDirX, 10) || 0;
        const dirY = parseInt(thrustDirY, 10) || 0;
        const mag = parseInt(thrustMagnitude, 10) || 0;

        const action: ThrustAction = {
            type: 'THRUST',
            entityId: activePlayerEntity.id,
            playerId: activePlayerId,
            direction: { x: dirX, y: dirY },
            magnitude: mag,
            orderIndex: currentActions.length,
        };

        onQueueAction(action);
    }, [activePlayerEntity, activePlayerId, thrustDirX, thrustDirY, thrustMagnitude, currentActions.length, onQueueAction]);

    // format action for display
    const formatAction = (action: Action): string => {
        switch (action.type) {
            case 'THRUST': {
                const thrust = action as ThrustAction;
                return `THRUST (${thrust.direction.x}, ${thrust.direction.y}) m=${thrust.magnitude}`;
            }
            default:
                return action.type;
        }
    };

    // genesis config update helpers
    const updateSeed = (value: string) => onUpdateGenesisConfig({ seed: value });
    const updateSystemCount = (value: number) => onUpdateGenesisConfig({ systemCount: value });
    const updatePlanetsMin = (value: number) => onUpdateGenesisConfig({ 
        planetsPerSystem: [value, genesisConfig.planetsPerSystem[1]] 
    });
    const updatePlanetsMax = (value: number) => onUpdateGenesisConfig({ 
        planetsPerSystem: [genesisConfig.planetsPerSystem[0], value] 
    });
    const updateMoonsMin = (value: number) => onUpdateGenesisConfig({ 
        moonsPerPlanet: [value, genesisConfig.moonsPerPlanet[1]] 
    });
    const updateMoonsMax = (value: number) => onUpdateGenesisConfig({ 
        moonsPerPlanet: [genesisConfig.moonsPerPlanet[0], value] 
    });
    const updateAsteroidsMin = (value: number) => onUpdateGenesisConfig({ 
        asteroidsPerSystem: [value, genesisConfig.asteroidsPerSystem[1]] 
    });
    const updateAsteroidsMax = (value: number) => onUpdateGenesisConfig({ 
        asteroidsPerSystem: [genesisConfig.asteroidsPerSystem[0], value] 
    });
    const updateSystemSpacing = (value: number) => onUpdateGenesisConfig({ 
        systemSpacing: value * FP_SCALE 
    });
    const updatePlayerFuel = (value: number) => onUpdateGenesisConfig({ 
        playerStartingFuel: value * FP_SCALE 
    });
    const updatePlayerMass = (value: number) => onUpdateGenesisConfig({ 
        playerStartingMass: value * FP_SCALE 
    });
    const updatePlayerIds = (value: string) => onUpdateGenesisConfig({ 
        playerIds: value.split(',').map(s => s.trim()).filter(s => s.length > 0)
    });

    return (
        <div style={STYLES.container}>
            {/* Header: Tick info */}
            <div style={STYLES.section}>
                <div style={STYLES.tick}>TICK {gameState.tick}</div>
                <div style={STYLES.info}>
                    {gameState.systems.length} systems, {gameState.celestials.length} celestials, {gameState.entities.length} entities
                </div>
            </div>

            {/* Genesis Configuration */}
            <div style={STYLES.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={STYLES.sectionTitle}>Genesis Config</div>
                    <button 
                        style={{ ...STYLES.button, fontSize: 9, padding: '2px 6px' }}
                        onClick={() => setShowGenesis(!showGenesis)}
                    >
                        {showGenesis ? 'Hide' : 'Show'}
                    </button>
                </div>

                {/* Seed - always visible */}
                <div style={STYLES.row}>
                    <span style={STYLES.label}>Seed:</span>
                    <input
                        type="text"
                        value={genesisConfig.seed}
                        onChange={(e) => updateSeed(e.target.value)}
                        style={{ ...STYLES.input, ...STYLES.flexGrow }}
                    />
                </div>

                {/* Expanded config options */}
                {showGenesis && (
                    <>
                        {/* Player IDs */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Players:</span>
                            <input
                                type="text"
                                value={genesisConfig.playerIds.join(', ')}
                                onChange={(e) => updatePlayerIds(e.target.value)}
                                style={{ ...STYLES.input, ...STYLES.flexGrow }}
                                placeholder="player-1, player-2"
                            />
                        </div>

                        {/* System Count */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Systems:</span>
                            <input
                                type="number"
                                value={genesisConfig.systemCount}
                                onChange={(e) => updateSystemCount(parseInt(e.target.value) || 1)}
                                style={STYLES.smallInput}
                                min={1}
                                max={10}
                            />
                        </div>

                        {/* Planets per System */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Planets:</span>
                            <input
                                type="number"
                                value={genesisConfig.planetsPerSystem[0]}
                                onChange={(e) => updatePlanetsMin(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                            <span style={{ fontSize: 10, color: '#666' }}>to</span>
                            <input
                                type="number"
                                value={genesisConfig.planetsPerSystem[1]}
                                onChange={(e) => updatePlanetsMax(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                        </div>

                        {/* Moons per Planet */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Moons:</span>
                            <input
                                type="number"
                                value={genesisConfig.moonsPerPlanet[0]}
                                onChange={(e) => updateMoonsMin(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                            <span style={{ fontSize: 10, color: '#666' }}>to</span>
                            <input
                                type="number"
                                value={genesisConfig.moonsPerPlanet[1]}
                                onChange={(e) => updateMoonsMax(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                        </div>

                        {/* Asteroids per System */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Asteroids:</span>
                            <input
                                type="number"
                                value={genesisConfig.asteroidsPerSystem[0]}
                                onChange={(e) => updateAsteroidsMin(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                            <span style={{ fontSize: 10, color: '#666' }}>to</span>
                            <input
                                type="number"
                                value={genesisConfig.asteroidsPerSystem[1]}
                                onChange={(e) => updateAsteroidsMax(parseInt(e.target.value) || 0)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                        </div>

                        {/* System Spacing */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Spacing:</span>
                            <input
                                type="number"
                                value={Math.round(genesisConfig.systemSpacing / FP_SCALE)}
                                onChange={(e) => updateSystemSpacing(parseInt(e.target.value) || 1000000)}
                                style={{ ...STYLES.smallInput, width: 80 }}
                                step={1000000}
                            />
                            <span style={{ fontSize: 9, color: '#666' }}>units</span>
                        </div>

                        {/* Player Starting Fuel */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Start Fuel:</span>
                            <input
                                type="number"
                                value={Math.round(genesisConfig.playerStartingFuel / FP_SCALE)}
                                onChange={(e) => updatePlayerFuel(parseInt(e.target.value) || 100)}
                                style={STYLES.smallInput}
                                min={0}
                            />
                        </div>

                        {/* Player Starting Mass */}
                        <div style={STYLES.row}>
                            <span style={STYLES.label}>Start Mass:</span>
                            <input
                                type="number"
                                value={Math.round(genesisConfig.playerStartingMass / FP_SCALE)}
                                onChange={(e) => updatePlayerMass(parseInt(e.target.value) || 100)}
                                style={STYLES.smallInput}
                                min={1}
                            />
                        </div>
                    </>
                )}

                {/* Generate Button */}
                <button style={STYLES.generateButton} onClick={onGenerateUniverse}>
                    Generate Universe
                </button>
            </div>

            {/* Seat Switcher */}
            <div style={STYLES.section}>
                <div style={STYLES.sectionTitle}>Seat Switcher</div>
                <select
                    value={activePlayerId}
                    onChange={(e) => onSwitchSeat(e.target.value)}
                    style={STYLES.select}
                >
                    {playerIds.map(id => (
                        <option key={id} value={id}>{id}</option>
                    ))}
                </select>
                {activePlayerEntity && (
                    <div style={{ ...STYLES.info, marginTop: 4 }}>
                        Pos: {fpToDisplay(activePlayerEntity.position.x)}, {fpToDisplay(activePlayerEntity.position.y)} | 
                        Vel: {fpToDisplay(activePlayerEntity.velocity.x)}, {fpToDisplay(activePlayerEntity.velocity.y)}
                    </div>
                )}
            </div>

            {/* Entity Registry (Slew Engine) */}
            <div style={{ ...STYLES.section, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={STYLES.sectionTitle}>Entity Registry</div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={STYLES.searchInput}
                    placeholder="Search..."
                />
                <div style={{ ...STYLES.list, flex: 1 }}>
                    {filteredRegistry.map(item => (
                        <div
                            key={item.id}
                            style={{
                                ...STYLES.listItem,
                                ...(hoveredItem === item.id ? STYLES.listItemHover : {}),
                            }}
                            onClick={() => handleSlewTo(item)}
                            onMouseEnter={() => setHoveredItem(item.id)}
                            onMouseLeave={() => setHoveredItem(null)}
                        >
                            <span style={{ color: item.isEntity ? '#4af' : '#fa4' }}>
                                [{item.type}]
                            </span>{' '}
                            {item.name}
                        </div>
                    ))}
                </div>
            </div>

            {/* Draft Rail */}
            <div style={STYLES.section}>
                <div style={STYLES.sectionTitle}>Draft Rail ({activePlayerId})</div>
                
                {currentActions.length > 0 ? (
                    <div style={{ ...STYLES.list, maxHeight: 80 }}>
                        {currentActions.map((action, index) => (
                            <div key={index} style={STYLES.actionItem}>
                                <span>{formatAction(action)}</span>
                                <button
                                    style={STYLES.removeButton}
                                    onClick={() => onRemoveAction(index)}
                                >
                                    X
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={STYLES.info}>No actions queued</div>
                )}

                {/* Thrust Action Builder */}
                {activePlayerEntity && (
                    <div style={{ marginTop: 6 }}>
                        <div style={STYLES.row}>
                            <span style={{ ...STYLES.label, width: 40 }}>Dir:</span>
                            <input
                                type="number"
                                value={thrustDirX}
                                onChange={(e) => setThrustDirX(e.target.value)}
                                style={STYLES.smallInput}
                                placeholder="X"
                            />
                            <input
                                type="number"
                                value={thrustDirY}
                                onChange={(e) => setThrustDirY(e.target.value)}
                                style={STYLES.smallInput}
                                placeholder="Y"
                            />
                            <span style={{ ...STYLES.label, width: 30 }}>Mag:</span>
                            <input
                                type="number"
                                value={thrustMagnitude}
                                onChange={(e) => setThrustMagnitude(e.target.value)}
                                style={STYLES.smallInput}
                            />
                            <button style={STYLES.button} onClick={handleAddThrust}>
                                +THRUST
                            </button>
                        </div>
                    </div>
                )}

                {currentActions.length > 0 && (
                    <button
                        style={{ ...STYLES.button, marginTop: 6 }}
                        onClick={onClearActions}
                    >
                        Clear Actions
                    </button>
                )}
            </div>

            {/* Draft Info */}
            {draftResult && (
                <div style={STYLES.section}>
                    <div style={STYLES.sectionTitle}>Draft Projection</div>
                    <div style={STYLES.info}>
                        Waves: {draftResult.waveCount} | Safe: {draftResult.isSafe ? 'Yes' : 'No'}
                    </div>
                    {draftResult.conflicts.length > 0 && (
                        <div style={{ ...STYLES.info, color: '#f88' }}>
                            Conflicts: {draftResult.conflicts.length}
                        </div>
                    )}
                </div>
            )}

            {/* BIG RED BUTTON */}
            <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                <button
                    style={STYLES.bigRedButton}
                    onClick={onExecuteTick}
                >
                    Execute Tick ({totalActions} actions)
                </button>
            </div>
        </div>
    );
}
