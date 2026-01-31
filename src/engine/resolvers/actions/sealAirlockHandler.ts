// ===============================================
// SEAL AIRLOCK ACTION HANDLER
// ===============================================
// Handles sealing an entity's airlock.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the seal airlock action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const sealAirlockValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have an airlock?
    // state: is the airlock currently unsealed?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the seal airlock action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const sealAirlockHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!sealAirlockValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
