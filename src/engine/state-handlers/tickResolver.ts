// ===============================================
// TICK RESOLVER - The orchestrator
// ===============================================
// Pipeline of reducers: (State, Actions) -> NewState
// Each stage is an isolated system that transforms state
//
// WAVE-BASED INTERLEAVING:
// Actions are processed in "waves" based on orderIndex.
// Between each wave, physics "settles" so that Wave N+1 sees
// the physical reality created by Wave N.
//
// Example: If you WELD in Wave 0, you can THRUST the combined
// structure in Wave 1 of the same tick.
//
// UNIFIED INTENT THEORY (Conflict Cluster Resolution):
// Actions within a wave are grouped into "conflict clusters" based on
// entity entanglement. The solver finds the ordering that maximizes
// player success, falling back to "stalemate" only when two players
// have diametrically opposed physical goals.
//
// Wave Processing:
// 1. Group actions by orderIndex
// 2. For each wave (0, 1, 2, ...):
//    a. Identify conflict clusters (entangled actions)
//    b. Solve each cluster via permutation search
//    c. Execute actions in optimal order
//    d. Run physics settlement (maneuver, binding)
// 3. Run environmental transitions
// 4. Advance tick counter

import type { GameState } from '../state-types/state-types.js';
import type { Action } from '../primitive-types/semantic/action/action-types.js';

// systems
import { applyManeuver, applyBinding, applyTranslation } from './state-systems/maneuverSystem.js';
import { applyZoomStateTransition } from './state-systems/zoomStateSystem.js';
import { 
    resolveClusterWave, 
    type ClusterResolutionResult,
    type WaveResolutionMetrics,
} from './state-systems/conflictClusterResolver.js';

// -----------------------------------------------
// Wave Resolution Result
// -----------------------------------------------
// Returned by resolveWaves for debugging and testing

export interface WaveResolutionResult {
    // final state after all waves
    finalState: GameState;
    // number of waves processed
    waveCount: number;
    // actions processed per wave (for debugging)
    actionsPerWave: number[];
    // cluster resolution metrics per wave
    clusterMetrics?: WaveResolutionMetrics[];
    // actions voided due to stalemates
    stalemateActions?: Action[];
    // detailed results per cluster per wave (for debugging)
    clusterResults?: ClusterResolutionResult[][];
}

// -----------------------------------------------
// Wave Grouping
// -----------------------------------------------

/**
 * groups actions by their orderIndex (wave number).
 * actions without orderIndex default to wave 0.
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
 * gets the maximum wave index from a grouped action map.
 */
function getMaxWaveIndex(waves: Map<number, Action[]>): number {
    if (waves.size === 0) return -1;
    return Math.max(...waves.keys());
}

// -----------------------------------------------
// Wave Resolution (Shared Logic)
// -----------------------------------------------

/**
 * resolves all action waves with settlement between each.
 * this is the core interleaving algorithm used by both
 * the server tick resolver and the client draft service.
 * 
 * uses the Unified Intent Theory (Conflict Cluster Resolver) to:
 * 1. identify entangled actions within each wave
 * 2. find the optimal ordering that maximizes player success
 * 3. void actions in true stalemate situations
 * 
 * WAVE/SETTLEMENT BOUNDARY:
 * - Binding (snap children to parents) runs AFTER EVERY WAVE
 * - Translation (position += velocity) runs ONCE PER TICK (at the end)
 * 
 * this prevents the "5x velocity teleportation" bug where entities
 * move too far because translation ran after each wave.
 * 
 * pure function - does not mutate input state.
 * 
 * @param state - current game state
 * @param actions - all actions for this tick (with orderIndex)
 * @param skipFinalManeuver - if true, skips the final maneuver pass (for draft projection)
 * @returns resolution result with final state and wave metrics
 */
export function resolveWaves(
    state: GameState,
    actions: Action[],
    skipFinalManeuver: boolean = false
): WaveResolutionResult {
    // group actions by wave
    const waves = groupActionsByWave(actions);
    const maxWave = getMaxWaveIndex(waves);
    const actionsPerWave: number[] = [];
    const clusterMetrics: WaveResolutionMetrics[] = [];
    const clusterResults: ClusterResolutionResult[][] = [];
    const stalemateActions: Action[] = [];
    
    let currentState = state;
    
    // process each wave sequentially
    for (let waveIndex = 0; waveIndex <= maxWave; waveIndex++) {
        const waveActions = waves.get(waveIndex) ?? [];
        
        if (waveActions.length === 0) {
            actionsPerWave.push(0);
            continue;
        }
        
        // resolve this wave using the conflict cluster system
        const waveResult = resolveClusterWave(waveActions, currentState);
        
        // track metrics
        actionsPerWave.push(waveResult.executionOrder.length);
        clusterMetrics.push(waveResult.metrics);
        clusterResults.push(waveResult.clusterResults);
        
        // collect stalemate actions for reporting
        for (const clusterResult of waveResult.clusterResults) {
            if (clusterResult.isStalemate) {
                stalemateActions.push(...clusterResult.voidedActions);
            }
        }
        
        // apply the resolved state
        currentState = waveResult.finalState;
        
        // WAVE SETTLEMENT: binding only (snap children to parents)
        // translation happens ONCE at the end, not after each wave
        // this prevents the "5x velocity teleportation" bug
        currentState = applyBinding(currentState);
    }
    
    // TICK SETTLEMENT: translation (position += velocity) happens ONCE per tick
    // this ensures entities move at their velocity, not N * velocity
    if (!skipFinalManeuver) {
        // apply translation (position += velocity for root entities)
        currentState = applyTranslation(currentState);
        
        // final binding pass to snap children after translation
        currentState = applyBinding(currentState);
    }
    
    return {
        finalState: currentState,
        waveCount: maxWave + 1,
        actionsPerWave,
        clusterMetrics,
        stalemateActions: stalemateActions.length > 0 ? stalemateActions : undefined,
        clusterResults: clusterResults.length > 0 ? clusterResults : undefined,
    };
}

// -----------------------------------------------
// Main Tick Resolver
// -----------------------------------------------

/**
 * core resolver: wave-based pipeline of systems.
 * pure function - does not mutate input state.
 * 
 * order of operations:
 * 1. wave resolution (actions + settlement per wave)
 * 2. environmental transitions (SPACE -> ORBIT, etc.)
 * 3. advance tick counter
 * 
 * @param state - current game state
 * @param actions - player actions for this tick
 * @returns new game state after one tick
 */
export function resolveTick(state: GameState, actions: Action[] = []): GameState {
    // 1. resolve all action waves with inter-wave settlement
    const { finalState } = resolveWaves(state, actions);
    
    // 2. environmental transitions (SPACE -> ORBIT, etc.)
    let nextState = applyZoomStateTransition(finalState);
    
    // 3. advance tick counter
    return {
        ...nextState,
        tick: state.tick + 1,
    };
}

// -----------------------------------------------
// Legacy Compatibility
// -----------------------------------------------

/**
 * resolves a single wave of actions without tick advancement.
 * useful for draft projection and testing individual waves.
 */
export function resolveWave(state: GameState, actions: Action[]): GameState {
    const { finalState } = resolveWaves(state, actions, true);
    return finalState;
}
