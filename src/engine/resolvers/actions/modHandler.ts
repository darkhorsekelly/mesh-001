// ===============================================
// MOD ACTION HANDLER
// ===============================================
// Handles applying modifications to entity properties.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the mod action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const modValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have modification tools?
    // state: is the modification type valid for the target?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the mod action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const modHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!modValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
