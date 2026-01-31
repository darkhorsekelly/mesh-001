// ===============================================
// MANEUVER ACTION HANDLER
// ===============================================
// Handles entity maneuver toward a target velocity.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the maneuver action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const maneuverValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have maneuvering thrusters?
    // state: does the entity have sufficient fuel?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the maneuver action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const maneuverHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!maneuverValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
