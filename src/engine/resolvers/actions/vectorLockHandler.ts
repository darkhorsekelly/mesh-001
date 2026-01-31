// ===============================================
// VECTOR LOCK ACTION HANDLER
// ===============================================
// Handles locking navigation onto a target entity.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the vector lock action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const vectorLockValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have navigation computer?
    // state: is the target visible and within sensor range?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the vector lock action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const vectorLockHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!vectorLockValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
