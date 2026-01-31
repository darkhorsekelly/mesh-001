// ===============================================
// WELD ACTION HANDLER
// ===============================================
// Handles attaching entities together structurally.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the weld action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const weldValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have welding equipment?
    // state: is the entity in proximity to target and has materials?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the weld action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const weldHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!weldValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
