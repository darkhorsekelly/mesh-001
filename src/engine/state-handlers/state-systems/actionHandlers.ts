// ===============================================
// ACTION HANDLERS
// ===============================================
// Atomic action handlers - resolver delegates to this map
// TODO: Easy to extend: add EXTRACT, SCAN, DOCK [MOON], etc.
// TODO: Handle target(s) entity IDs not just entity IDsfor certain actions
// TODO: Check for action validity per action type in the handler

import type { Entity } from '../../primitive-types/semantic/entity/entity-types.js';
import type { Action, ThrustAction } from '../../primitive-types/semantic/action/action-types.js';
import { fpAddVector, fpScaleVector } from '../../primitive-types/euclidean/euclidean-types.js';

/**
 * Handler signature: takes entity and action, returns transformed entity
 */
type ActionHandler<T extends Action> = (entity: Entity, action: T) => Entity;

/**
 * THRUST handler - applies thrust vector to entity velocity
 */
const handleThrust: ActionHandler<ThrustAction> = (entity, action) => {
    const thrustVector = fpScaleVector(action.direction, action.magnitude);
    return {
        ...entity,
        velocity: fpAddVector(entity.velocity, thrustVector),
    };
};

/**
 * Action handler registry
 * Maps action type -> handler function
 */
const ACTION_HANDLERS: Record<string, ActionHandler<any>> = {
    THRUST: handleThrust,
    // TODO: Add more action handles
    // Example: EXTRACT: handleExtract,
};

/**
 * Apply a single action to an entity
 * Returns unchanged entity if no handler exists
 */
export function applyAction(entity: Entity, action: Action): Entity {
    if (!action) return entity;
    
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) return entity;
    
    return handler(entity, action);
}

/**
 * Apply all actions for a specific entity
 */
export function applyActionsToEntity(entity: Entity, actions: Action[]): Entity {
    const entityActions = actions.filter(a => a?.entityId === entity.id);
    
    return entityActions.reduce(
        (e, action) => applyAction(e, action),
        entity
    );
}
