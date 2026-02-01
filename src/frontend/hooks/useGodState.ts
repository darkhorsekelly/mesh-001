// ===============================================
// useGodState - Local GameState management
// ===============================================
// manages game state locally for god-view exploration.
// no server round-trip needed - direct engine calls.

import { useState, useCallback, useMemo } from 'react';
import type { GameState, GenesisConfig } from '../../engine/state-types/state-types.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';
import { generateUniverse, DEFAULT_GENESIS_CONFIG } from '../../engine/genesis/genesisService.js';
import { resolveTick } from '../../engine/state-handlers/tickResolver.js';
import { projectDraft, type DraftResult } from '../../engine/draft/draftService.js';

// -----------------------------------------------
// Types
// -----------------------------------------------

export interface ActionQueue {
    // player ID -> list of actions
    [playerId: string]: Action[];
}

export interface UseGodStateReturn {
    // current game state
    gameState: GameState;
    // current genesis config
    genesisConfig: GenesisConfig;
    // active player for seat switching
    activePlayerId: string;
    // available player IDs
    playerIds: string[];
    // action queue per player
    actionQueue: ActionQueue;
    // draft projection result
    draftResult: DraftResult | null;
    // update genesis config (partial)
    updateGenesisConfig: (updates: Partial<GenesisConfig>) => void;
    // generate new universe with current config
    generateNewUniverse: () => void;
    // switch active player seat
    switchSeat: (playerId: string) => void;
    // queue an action for active player
    queueAction: (action: Action) => void;
    // remove action from active player's queue
    removeAction: (index: number) => void;
    // clear all actions for active player
    clearActions: () => void;
    // execute tick with all queued actions
    executeTick: () => void;
}

// -----------------------------------------------
// Hook
// -----------------------------------------------

export function useGodState(): UseGodStateReturn {
    // genesis configuration state
    const [genesisConfig, setGenesisConfig] = useState<GenesisConfig>(() => ({
        ...DEFAULT_GENESIS_CONFIG,
    }));

    // generate initial state
    const [gameState, setGameState] = useState<GameState>(() => 
        generateUniverse(
            genesisConfig.seed, 
            genesisConfig.playerIds, 
            genesisConfig
        )
    );
    const [activePlayerId, setActivePlayerId] = useState(genesisConfig.playerIds[0]!);
    const [actionQueue, setActionQueue] = useState<ActionQueue>({});

    // derive player IDs from entities with playerId
    const playerIds = useMemo(() => {
        const ids = new Set<string>();
        for (const entity of gameState.entities) {
            if (entity.playerId) {
                ids.add(entity.playerId);
            }
        }
        return Array.from(ids);
    }, [gameState.entities]);

    // compute draft projection
    const draftResult = useMemo(() => {
        const allActions: Action[] = [];
        for (const playerId of Object.keys(actionQueue)) {
            const playerActions = actionQueue[playerId];
            if (playerActions) {
                allActions.push(...playerActions);
            }
        }
        if (allActions.length === 0) return null;
        return projectDraft(gameState, allActions);
    }, [gameState, actionQueue]);

    // update genesis config (partial update)
    const updateGenesisConfig = useCallback((updates: Partial<GenesisConfig>) => {
        setGenesisConfig(prev => ({
            ...prev,
            ...updates,
        }));
    }, []);

    // generate new universe with current config
    const generateNewUniverse = useCallback(() => {
        const newState = generateUniverse(
            genesisConfig.seed,
            genesisConfig.playerIds,
            genesisConfig
        );
        setGameState(newState);
        setActionQueue({});
        // reset active player to first player
        if (genesisConfig.playerIds.length > 0) {
            setActivePlayerId(genesisConfig.playerIds[0]!);
        }
    }, [genesisConfig]);

    // switch seat
    const switchSeat = useCallback((playerId: string) => {
        if (playerIds.includes(playerId)) {
            setActivePlayerId(playerId);
        }
    }, [playerIds]);

    // queue action for active player
    const queueAction = useCallback((action: Action) => {
        setActionQueue(prev => {
            const playerActions = prev[activePlayerId] ?? [];
            return {
                ...prev,
                [activePlayerId]: [...playerActions, action],
            };
        });
    }, [activePlayerId]);

    // remove action by index
    const removeAction = useCallback((index: number) => {
        setActionQueue(prev => {
            const playerActions = prev[activePlayerId] ?? [];
            const newActions = playerActions.filter((_, i) => i !== index);
            return {
                ...prev,
                [activePlayerId]: newActions,
            };
        });
    }, [activePlayerId]);

    // clear all actions for active player
    const clearActions = useCallback(() => {
        setActionQueue(prev => ({
            ...prev,
            [activePlayerId]: [],
        }));
    }, [activePlayerId]);

    // execute tick with all queued actions
    const executeTick = useCallback(() => {
        const allActions: Action[] = [];
        for (const playerId of Object.keys(actionQueue)) {
            const playerActions = actionQueue[playerId];
            if (playerActions) {
                allActions.push(...playerActions);
            }
        }
        
        const nextState = resolveTick(gameState, allActions);
        setGameState(nextState);
        setActionQueue({});
    }, [gameState, actionQueue]);

    return {
        gameState,
        genesisConfig,
        activePlayerId,
        playerIds,
        actionQueue,
        draftResult,
        updateGenesisConfig,
        generateNewUniverse,
        switchSeat,
        queueAction,
        removeAction,
        clearActions,
        executeTick,
    };
}
