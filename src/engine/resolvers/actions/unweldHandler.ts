// ===============================================
// UNWELD ACTION HANDLER
// ===============================================
// Handles detaching entities from structural connections.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the unweld action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const unweldValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have cutting/unwelding equipment?
    // state: is the target actually welded to this entity?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the unweld action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const unweldHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!unweldValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
