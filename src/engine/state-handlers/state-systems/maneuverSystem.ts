// ===============================================
// MANEUVER SYSTEM
// ===============================================
// Handles: Actions (THRUST) -> Velocity -> Position
// Pure system: (GameState, Actions) -> GameState

// TODO: Decouple maneuvers (SURFACE) from thrust (ORBIT and SPACE)

import type { GameState } from '../../state-types/state-types.js';
import type { Entity } from '../../primitive-types/semantic/entity/entity-types.js';
import type { Action } from '../../primitive-types/semantic/action/action-types.js';
import { fpAddVector } from '../../primitive-types/euclidean/euclidean-types.js';
import { applyActionsToEntity } from './actionHandlers.js';

/**
 * Apply Newtonian motion to a single entity
 * position += velocity
 */
function translateEntity(entity: Entity): Entity {
    return {
        ...entity,
        position: fpAddVector(entity.position, entity.velocity),
    };
}

/**
 * Process actions for all entities
 * Delegates to action handlers
 */
export function applyActions(state: GameState, actions: Action[]): GameState {
    const nextEntities = state.entities.map(entity =>
        applyActionsToEntity(entity, actions)
    );
    
    const changed = nextEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? nextEntities : state.entities,
    };
}

/**
 * Apply physics translation to all entities
 * position += velocity for each entity
 */
export function applyManeuver(state: GameState): GameState {
    const nextEntities = state.entities.map(translateEntity);
    
    // Always changes (unless all velocities are zero)
    const changed = nextEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? nextEntities : state.entities,
    };
}
