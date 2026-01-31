// ===============================================
// SCAN ACTION HANDLER
// ===============================================
// Handles active scanning at a specified intensity.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the scan action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const scanValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have active scanner array?
    // state: does the entity have power for the scan intensity?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the scan action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const scanHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!scanValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
