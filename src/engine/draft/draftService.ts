// ===============================================
// DRAFT SERVICE
// ===============================================
// client-side ghost projection service.
// mirrors the server's wave-based resolution logic to produce
// a "ghost state" showing where entities will be after the tick.
//
// ARCHITECTURAL NOTE:
// this is a CONSUMER of the engine, designed for client-side use.
// it uses the exact same resolveWaves logic as the server,
// ensuring the player's draft preview matches server resolution.
//
// CONFLICT DETECTION:
// the draft service can flag potential conflicts where:
// - an action depends on a target that might move
// - an action depends on state that another player might change
// - physics settlement between waves could invalidate an action

import type { GameState } from '../state-types/state-types.js';
import type { Action } from '../primitive-types/semantic/action/action-types.js';
import type { Entity } from '../primitive-types/semantic/entity/entity-types.js';
import { resolveWaves, type WaveResolutionResult } from '../state-handlers/tickResolver.js';
import { fpDistanceSquared, fpMul, type FP } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Draft Types
// -----------------------------------------------

export interface DraftConflict {
    // the wave index where the conflict might occur
    waveIndex: number;
    
    // the action that might be affected
    actionIndex: number;
    
    // type of potential conflict
    conflictType: 'TARGET_MOVED' | 'STATE_CHANGED' | 'REACH_INVALIDATED';
    
    // human-readable description
    message: string;
}

export interface DraftResult {
    // the projected "ghost" state after all waves
    ghostState: GameState;
    
    // wave resolution metrics
    waveCount: number;
    actionsPerWave: number[];
    
    // potential conflicts detected
    conflicts: DraftConflict[];
    
    // whether the draft is considered "safe" (no critical conflicts)
    isSafe: boolean;
}

export interface EntityProjection {
    // the entity in its current state
    current: Entity;
    
    // the entity in its projected state after the draft
    projected: Entity;
    
    // whether the entity was affected by draft actions
    changed: boolean;
}

// -----------------------------------------------
// Draft Service
// -----------------------------------------------

/**
 * projects the local player's action queue onto the current state.
 * produces a "ghost state" showing where entities will be.
 * 
 * @param currentState - the current authoritative game state
 * @param playerActions - the local player's ordered action queue
 * @returns draft result with ghost state and conflict analysis
 */
export function projectDraft(
    currentState: GameState,
    playerActions: Action[]
): DraftResult {
    // assign orderIndex based on queue position
    const indexedActions: Action[] = playerActions.map((action, index) => ({
        ...action,
        orderIndex: index,
    } as Action));
    
    // run wave resolution (without tick advancement)
    const waveResult = resolveWaves(currentState, indexedActions, true);
    
    // detect potential conflicts
    const conflicts = detectConflicts(currentState, indexedActions, waveResult);
    
    return {
        ghostState: waveResult.finalState,
        waveCount: waveResult.waveCount,
        actionsPerWave: waveResult.actionsPerWave,
        conflicts,
        isSafe: conflicts.length === 0,
    };
}

/**
 * projects state for a specific entity through the draft.
 * useful for rendering ghost projections in the UI.
 */
export function projectEntity(
    currentState: GameState,
    playerActions: Action[],
    entityId: string
): EntityProjection | null {
    const current = currentState.entities.find(e => e.id === entityId);
    if (!current) return null;
    
    const draftResult = projectDraft(currentState, playerActions);
    const projected = draftResult.ghostState.entities.find(e => e.id === entityId);
    
    if (!projected) return null;
    
    // check if entity changed
    const changed = JSON.stringify(current) !== JSON.stringify(projected);
    
    return {
        current,
        projected,
        changed,
    };
}

// -----------------------------------------------
// Conflict Detection
// -----------------------------------------------

/**
 * detects potential conflicts in the draft.
 * these are situations where the draft might not resolve as expected
 * due to other players' actions or physics settlement.
 */
function detectConflicts(
    initialState: GameState,
    actions: Action[],
    waveResult: WaveResolutionResult
): DraftConflict[] {
    const conflicts: DraftConflict[] = [];
    
    // track entity states through waves for conflict detection
    let currentState = initialState;
    const waves = groupActionsByWave(actions);
    
    for (let waveIndex = 0; waveIndex < waveResult.waveCount; waveIndex++) {
        const waveActions = waves.get(waveIndex) ?? [];
        
        for (let actionIndex = 0; actionIndex < waveActions.length; actionIndex++) {
            const action = waveActions[actionIndex];
            if (!action) continue;
            
            // check if action targets have moved since initial state
            const targetConflicts = checkTargetMoved(
                initialState,
                currentState,
                action,
                waveIndex,
                actionIndex
            );
            conflicts.push(...targetConflicts);
            
            // check if reach might be invalidated
            const reachConflicts = checkReachInvalidated(
                currentState,
                action,
                waveIndex,
                actionIndex
            );
            conflicts.push(...reachConflicts);
        }
        
        // advance state by resolving this wave (for next wave's conflict checks)
        const singleWaveActions = waveActions.map(a => ({ ...a, orderIndex: 0 }));
        const { finalState } = resolveWaves(currentState, singleWaveActions, true);
        currentState = finalState;
    }
    
    return conflicts;
}

/**
 * checks if action targets have moved since the initial state.
 */
function checkTargetMoved(
    initialState: GameState,
    currentState: GameState,
    action: Action,
    waveIndex: number,
    actionIndex: number
): DraftConflict[] {
    const conflicts: DraftConflict[] = [];
    
    // get target IDs from action
    const targetIds = getTargetIds(action);
    
    for (const targetId of targetIds) {
        const initial = initialState.entities.find(e => e.id === targetId);
        const current = currentState.entities.find(e => e.id === targetId);
        
        if (!initial || !current) continue;
        
        // check if position changed significantly
        if (initial.position.x !== current.position.x ||
            initial.position.y !== current.position.y) {
            conflicts.push({
                waveIndex,
                actionIndex,
                conflictType: 'TARGET_MOVED',
                message: `Target ${targetId} may have moved by wave ${waveIndex}`,
            });
        }
    }
    
    return conflicts;
}

/**
 * checks if actor's reach might be invalidated by prior waves.
 */
function checkReachInvalidated(
    currentState: GameState,
    action: Action,
    waveIndex: number,
    actionIndex: number
): DraftConflict[] {
    const conflicts: DraftConflict[] = [];
    
    // only check for actions that require reach
    const actor = currentState.entities.find(e => e.id === action.entityId);
    if (!actor || actor.reach <= 0) return conflicts;
    
    const targetIds = getTargetIds(action);
    const reachSquared = fpMul(actor.reach, actor.reach);
    
    for (const targetId of targetIds) {
        const target = currentState.entities.find(e => e.id === targetId);
        if (!target) continue;
        
        const distSquared = fpDistanceSquared(actor.position, target.position);
        
        if (distSquared > reachSquared) {
            conflicts.push({
                waveIndex,
                actionIndex,
                conflictType: 'REACH_INVALIDATED',
                message: `Target ${targetId} may be out of reach by wave ${waveIndex}`,
            });
        }
    }
    
    return conflicts;
}

// -----------------------------------------------
// Helpers
// -----------------------------------------------

/**
 * groups actions by their orderIndex (wave number).
 */
function groupActionsByWave(actions: Action[]): Map<number, Action[]> {
    const waves = new Map<number, Action[]>();
    
    for (const action of actions) {
        if (!action) continue;
        
        const waveIndex = action.orderIndex ?? 0;
        const waveActions = waves.get(waveIndex) ?? [];
        waveActions.push(action);
        waves.set(waveIndex, waveActions);
    }
    
    return waves;
}

/**
 * extracts target IDs from an action.
 */
function getTargetIds(action: Action): string[] {
    if (!action) return [];
    
    // actions with targetIds array
    if ('targetIds' in action && Array.isArray(action.targetIds)) {
        return action.targetIds;
    }
    
    // LOAD action
    if (action.type === 'LOAD' && 'contentIds' in action) {
        const load = action as { contentIds?: string[]; containerIds?: string[] };
        return [...(load.contentIds ?? []), ...(load.containerIds ?? [])];
    }
    
    // UNLOAD action
    if (action.type === 'UNLOAD' && 'contentIds' in action) {
        const unload = action as { contentIds?: string[] };
        return unload.contentIds ?? [];
    }
    
    // EXTRACT has originIds
    if (action.type === 'EXTRACT' && 'originIds' in action) {
        const extract = action as { originIds?: string[] };
        return extract.originIds ?? [];
    }
    
    return [];
}

// -----------------------------------------------
// Action Chain Builder
// -----------------------------------------------

/**
 * helper for building action chains with proper orderIndex.
 * used by both the draft service and ChaosAgent.
 */
export class ActionChainBuilder {
    private actions: Action[] = [];
    private currentWave: number = 0;
    
    /**
     * adds an action to the current wave.
     */
    add(action: Action): this {
        this.actions.push({
            ...action,
            orderIndex: this.currentWave,
        } as Action);
        return this;
    }
    
    /**
     * advances to the next wave.
     */
    nextWave(): this {
        this.currentWave++;
        return this;
    }
    
    /**
     * builds the final action array.
     */
    build(): Action[] {
        return [...this.actions];
    }
    
    /**
     * resets the builder.
     */
    reset(): this {
        this.actions = [];
        this.currentWave = 0;
        return this;
    }
}
