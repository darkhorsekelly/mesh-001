// ===============================================
// UNSEAL AIRLOCK ACTION HANDLER
// ===============================================
// Handles unsealing an entity's airlock.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the unseal airlock action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const unsealAirlockValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have an airlock?
    // state: is the airlock currently sealed?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the unseal airlock action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const unsealAirlockHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!unsealAirlockValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
