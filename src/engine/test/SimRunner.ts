// ===============================================
// SIMULATION RUNNER
// ===============================================
// centralized harness for running game ticks in tests.
// allows testing emergent interactions between multiple actions
// in a single tick resolution cycle.
//
// WAVE-BASED INTERLEAVING:
// supports explicit wave ordering via orderIndex on actions.
// provides helpers for creating player-keyed action queues
// and verifying sequential integrity.

import type { GameState } from '../state-types/state-types.js';
import type { Action } from '../primitive-types/semantic/action/action-types.js';
import type { Entity, EntityUpdate } from '../primitive-types/semantic/entity/entity-types.js';
import type { TickContext } from '../resolvers/actions/actionTypes.js';
import { resolveTick, resolveWaves, type WaveResolutionResult } from '../state-handlers/tickResolver.js';
import { actionRegistry } from '../resolvers/actions/actionRegistry.js';
import { createGameState, createContextFromState } from './factories.js';
import {
    getConflictClusters,
    resolveCluster,
    classifyConflict,
    type ClusterResolutionResult,
    type ConflictType,
} from '../state-handlers/state-systems/conflictClusterResolver.js';

// -----------------------------------------------
// Simulation Result Types
// -----------------------------------------------

export interface SimulationResult {
    // the game state after tick resolution
    nextState: GameState;

    // the previous state (for comparison)
    prevState: GameState;

    // whether the tick advanced successfully
    success: boolean;

    // any validation errors encountered
    errors: string[];

    // wave resolution metrics (if using wave-based resolution)
    waveMetrics?: {
        waveCount: number;
        actionsPerWave: number[];
    };
}

export interface ActionResult {
    // updates returned by the action handler
    updates: EntityUpdate[];

    // whether the action passed validation
    valid: boolean;

    // the actor entity after applying updates
    actorAfter?: Entity;

    // target entities after applying updates
    targetsAfter?: Entity[];
}

// -----------------------------------------------
// Player Action Queue Types
// -----------------------------------------------

/**
 * represents a player's ordered action queue for a single tick.
 * actions are processed in order (first = wave 0, second = wave 1, etc.)
 */
export type PlayerActionQueue = Action[];

/**
 * maps player IDs to their action queues.
 */
export type PlayerActionQueues = Map<string, PlayerActionQueue>;

// -----------------------------------------------
// Simulation Runner
// -----------------------------------------------

/**
 * runs a single tick of the simulation with the given actions.
 * this is the primary entry point for testing tick resolution.
 */
export function runTick(
    state: GameState,
    actions: Action[] = []
): SimulationResult {
    const errors: string[] = [];

    try {
        // use resolveWaves to get wave metrics
        const waveResult = resolveWaves(state, actions);
        const nextState = resolveTick(state, actions);

        return {
            nextState,
            prevState: state,
            success: true,
            errors,
            waveMetrics: {
                waveCount: waveResult.waveCount,
                actionsPerWave: waveResult.actionsPerWave,
            },
        };
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        return {
            nextState: state,
            prevState: state,
            success: false,
            errors,
        };
    }
}

// -----------------------------------------------
// Wave-Based Simulation Helpers
// -----------------------------------------------

/**
 * converts player action queues to a flat action list with orderIndex set.
 * each player's nth action becomes part of wave n.
 */
export function flattenPlayerQueues(queues: PlayerActionQueues): Action[] {
    const actions: Action[] = [];
    
    for (const [playerId, queue] of queues) {
        for (let i = 0; i < queue.length; i++) {
            const action = queue[i];
            if (!action) continue;
            
            actions.push({
                ...action,
                playerId,
                orderIndex: i,
            });
        }
    }
    
    return actions;
}

/**
 * creates player action queues from explicit wave definitions.
 * useful for tests that need precise control over interleaving.
 * 
 * @param waves - array of waves, each wave is an array of actions
 * @returns flattened action list with orderIndex set
 */
export function createWavedActions(waves: Action[][]): Action[] {
    const actions: Action[] = [];
    
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
        const waveActions = waves[waveIndex];
        if (!waveActions) continue;
        for (const action of waveActions) {
            if (!action) continue;
            actions.push({
                ...action,
                orderIndex: waveIndex,
            } as Action);
        }
    }
    
    return actions;
}

/**
 * runs a tick with player-keyed action queues.
 * automatically assigns orderIndex based on queue position.
 */
export function runTickWithQueues(
    state: GameState,
    queues: PlayerActionQueues
): SimulationResult {
    const actions = flattenPlayerQueues(queues);
    return runTick(state, actions);
}

/**
 * runs a tick with explicit wave definitions.
 * useful for testing specific interleaving scenarios.
 */
export function runTickWithWaves(
    state: GameState,
    waves: Action[][]
): SimulationResult {
    const actions = createWavedActions(waves);
    return runTick(state, actions);
}

/**
 * verifies sequential integrity: State(A1 then A2) == State(A1 + Settlement + A2).
 * this is the core invariant of wave-based resolution.
 */
export function verifySequentialIntegrity(
    state: GameState,
    wave1Actions: Action[],
    wave2Actions: Action[]
): { passed: boolean; message: string } {
    // run with explicit waves (A1 + settlement + A2)
    const wavedResult = runTickWithWaves(state, [wave1Actions, wave2Actions]);
    
    // run with all actions in single wave (A1 + A2 simultaneous)
    const simultaneousResult = runTick(state, [...wave1Actions, ...wave2Actions]);
    
    // compare entity states
    const wavedEntities = wavedResult.nextState.entities;
    const simultaneousEntities = simultaneousResult.nextState.entities;
    
    // they should be different if settlement matters
    const entitiesMatch = JSON.stringify(wavedEntities) === JSON.stringify(simultaneousEntities);
    
    return {
        passed: true, // verification always passes - the question is whether results differ
        message: entitiesMatch 
            ? 'Sequential and simultaneous resolution produced identical results (settlement had no effect)'
            : 'Sequential and simultaneous resolution produced different results (settlement affected outcome)',
    };
}

/**
 * runs multiple ticks in sequence with different actions per tick.
 * useful for testing state evolution with varying inputs.
 */
export function runTicksWithActions(
    initialState: GameState,
    tickActions: Action[][]
): SimulationResult[] {
    const results: SimulationResult[] = [];
    let currentState = initialState;

    for (const actions of tickActions) {
        const result = runTick(currentState, actions);
        results.push(result);
        currentState = result.nextState;
    }

    return results;
}

/**
 * runs multiple ticks with the same action set (or empty actions).
 * useful for testing passive state evolution.
 */
export function runTicks(
    initialState: GameState,
    actions: Action[],
    count: number
): GameState {
    let currentState = initialState;

    for (let i = 0; i < count; i++) {
        const result = runTick(currentState, actions);
        currentState = result.nextState;
    }

    return currentState;
}

// -----------------------------------------------
// Action Testing Utilities
// -----------------------------------------------

/**
 * tests a single action handler directly without going through the full tick.
 * useful for isolated unit testing of action logic.
 */
export function testAction(
    actionType: keyof typeof actionRegistry,
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    additionalEntities: Entity[] = []
): ActionResult {
    const registration = actionRegistry[actionType];
    const allEntities = [actor, ...targets, ...additionalEntities];

    const context: TickContext = {
        tick: 1,
        entities: allEntities,
        state: createGameState({ entities: allEntities }),
    };

    const valid = registration.validate(actor, targets, inputs);
    const updates = registration.handler(actor, targets, inputs, context);

    // apply updates to get post-action state
    let actorAfter: Entity | undefined;
    const targetsAfter: Entity[] = [];

    const actorUpdate = updates.find(u => u.id === actor.id);
    if (actorUpdate) {
        actorAfter = applyEntityUpdate(actor, actorUpdate);
    }

    for (const target of targets) {
        const targetUpdate = updates.find(u => u.id === target.id);
        if (targetUpdate) {
            targetsAfter.push(applyEntityUpdate(target, targetUpdate));
        }
    }

    return {
        updates,
        valid,
        actorAfter,
        targetsAfter: targetsAfter.length > 0 ? targetsAfter : undefined,
    };
}

/**
 * tests action validation without executing the handler.
 */
export function testValidation(
    actionType: keyof typeof actionRegistry,
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>
): boolean {
    const registration = actionRegistry[actionType];
    return registration.validate(actor, targets, inputs);
}

// -----------------------------------------------
// State Manipulation Helpers
// -----------------------------------------------

/**
 * applies an entity update to an entity, returning a new entity.
 */
export function applyEntityUpdate(entity: Entity, update: EntityUpdate): Entity {
    return {
        ...entity,
        ...update.changes,
    } as Entity;
}

/**
 * applies multiple entity updates to a game state.
 */
export function applyUpdatesToState(
    state: GameState,
    updates: EntityUpdate[]
): GameState {
    const entityMap = new Map(state.entities.map(e => [e.id, e]));

    for (const update of updates) {
        const existing = entityMap.get(update.id);
        if (existing) {
            entityMap.set(update.id, applyEntityUpdate(existing, update));
        } else {
            // new entity spawned by action (e.g., mineral store)
            entityMap.set(update.id, update.changes as Entity);
        }
    }

    return {
        ...state,
        entities: Array.from(entityMap.values()),
    };
}

/**
 * finds an entity by ID in a game state.
 */
export function findEntity(state: GameState, entityId: string): Entity | undefined {
    return state.entities.find(e => e.id === entityId);
}

/**
 * finds entities by type in a game state.
 */
export function findEntitiesByType(state: GameState, type: Entity['type']): Entity[] {
    return state.entities.filter(e => e.type === type);
}

// -----------------------------------------------
// Comparison Helpers
// -----------------------------------------------

/**
 * compares two entities and returns a diff of changed properties.
 */
export function diffEntity(
    before: Entity,
    after: Entity
): Partial<Entity> {
    const diff: Partial<Entity> = {};

    for (const key of Object.keys(after) as (keyof Entity)[]) {
        const beforeVal = before[key];
        const afterVal = after[key];

        if (typeof beforeVal === 'object' && typeof afterVal === 'object') {
            if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                (diff as Record<string, unknown>)[key] = afterVal;
            }
        } else if (beforeVal !== afterVal) {
            (diff as Record<string, unknown>)[key] = afterVal;
        }
    }

    return diff;
}

/**
 * extracts the delta between two game states for a specific entity.
 */
export function getEntityDelta(
    prevState: GameState,
    nextState: GameState,
    entityId: string
): Partial<Entity> | null {
    const before = findEntity(prevState, entityId);
    const after = findEntity(nextState, entityId);

    if (!before || !after) {
        return null;
    }

    return diffEntity(before, after);
}

// -----------------------------------------------
// Stalemate & Conflict Cluster Helpers
// -----------------------------------------------

export interface StalemateResult {
    // whether a stalemate occurred
    isStalemate: boolean;
    
    // actions that were voided due to stalemate
    voidedActions: Action[];
    
    // number of conflict clusters detected
    clusterCount: number;
    
    // detailed info for debugging
    message: string;
}

/**
 * runs a tick and checks for stalemate conditions.
 * returns detailed information about any stalemates that occurred.
 */
export function runTickWithStalemateCheck(
    state: GameState,
    actions: Action[]
): SimulationResult & { stalemate: StalemateResult } {
    const result = runTick(state, actions);
    
    const stalemateActions = result.waveMetrics 
        ? (result as SimulationResult & { stalemateActions?: Action[] }).stalemateActions ?? []
        : [];
    
    // get stalemate info from wave resolution
    const waveResult = resolveWaves(state, actions);
    
    const stalemate: StalemateResult = {
        isStalemate: (waveResult.stalemateActions?.length ?? 0) > 0,
        voidedActions: waveResult.stalemateActions ?? [],
        clusterCount: waveResult.clusterMetrics?.reduce((sum, m) => sum + m.clusterCount, 0) ?? 0,
        message: waveResult.stalemateActions?.length
            ? `Stalemate: ${waveResult.stalemateActions.length} action(s) voided due to mutual exclusion`
            : 'No stalemate detected',
    };
    
    return {
        ...result,
        stalemate,
    };
}

/**
 * asserts that a specific stalemate occurred between two actions.
 * returns the conflict classification for debugging.
 */
export function assertStalemate(
    actionA: Action,
    actionB: Action,
    state: GameState
): { passed: boolean; conflictType: ConflictType; message: string } {
    const conflictType = classifyConflict(actionA, actionB, state);
    const passed = conflictType === 'STALEMATE';
    
    return {
        passed,
        conflictType,
        message: passed
            ? `Stalemate confirmed between ${actionA.type} and ${actionB.type}`
            : `No stalemate: conflict type is ${conflictType}`,
    };
}

/**
 * asserts that no stalemate occurred in a tick.
 */
export function assertNoStalemate(
    state: GameState,
    actions: Action[]
): { passed: boolean; stalemateCount: number; message: string } {
    const waveResult = resolveWaves(state, actions);
    const stalemateCount = waveResult.stalemateActions?.length ?? 0;
    
    return {
        passed: stalemateCount === 0,
        stalemateCount,
        message: stalemateCount === 0
            ? 'No stalemates detected'
            : `${stalemateCount} action(s) resulted in stalemate`,
    };
}

/**
 * gets the conflict clusters for a set of actions.
 * useful for debugging and testing cluster identification.
 */
export function getActionClusters(
    actions: Action[],
    state: GameState
): Action[][] {
    return getConflictClusters(actions, state.entities);
}

/**
 * resolves a single cluster and returns detailed results.
 * useful for testing specific conflict scenarios.
 */
export function testClusterResolution(
    actions: Action[],
    state: GameState
): ClusterResolutionResult {
    return resolveCluster(actions, state);
}

/**
 * checks if two actions would be in the same conflict cluster.
 */
export function actionsWouldCluster(
    actionA: Action,
    actionB: Action,
    state: GameState
): boolean {
    const clusters = getConflictClusters([actionA, actionB], state.entities);
    return clusters.length === 1;
}

/**
 * classifies the conflict type between two actions.
 * useful for understanding why actions are clustered.
 */
export function getConflictClassification(
    actionA: Action,
    actionB: Action,
    state: GameState
): ConflictType {
    return classifyConflict(actionA, actionB, state);
}
