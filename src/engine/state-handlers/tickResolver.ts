// ===============================================
// TICK RESOLVER - The orchestrator
// ===============================================
// Pipeline of reducers: (State, Actions) -> NewState
// Each stage is an isolated system that transforms state
//
// Order of operations (invariants):
// 1. Process Input    - Actions -> Velocity/State changes
// 2. Physics          - Position += Velocity
// 3. Environment      - Distance checks / State transitions
//
// TODO: extend: add new system, insert into pipeline

import type { GameState } from '../state-types/state-types.js';
import type { Action } from '../primitive-types/semantic/action/action-types.js';

// Systems
import { applyActions, applyManeuver } from './state-systems/maneuverSystem.js';
import { applyZoomStateTransition } from './state-systems/zoomStateSystem.js';

/**
 * Core resolver: Pipeline of systems
 * Pure function - does not mutate input state
 * 
 * @param state - Current game state
 * @param actions - Player actions for this tick
 * @returns New game state after one tick
 */
export function resolveTick(state: GameState, actions: Action[] = []): GameState {
    // 1. Process Input (Actions -> Velocity changes)
    let nextState = applyActions(state, actions);
    
    // 2. Physics Translation (Position += Velocity)
    nextState = applyManeuver(nextState);
    
    // 3. Environmental Transitions (SPACE -> ORBIT, etc.)
    nextState = applyZoomStateTransition(nextState);
    
    // Advance tick counter
    return {
        ...nextState,
        tick: state.tick + 1,
    };
}
