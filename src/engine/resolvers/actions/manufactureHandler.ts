// ===============================================
// MANUFACTURE ACTION HANDLER
// ===============================================
// Handles building components from blueprints.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the manufacture action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const manufactureValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have a fabrication bay?
    // state: does the entity have required refined materials?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the manufacture action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const manufactureHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!manufactureValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
