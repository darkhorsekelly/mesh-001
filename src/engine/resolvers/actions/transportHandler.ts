// ===============================================
// TRANSPORT ACTION HANDLER
// ===============================================
// Handles entity transport to a destination coordinate.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the transport action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const transportValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have transport capability?
    // state: is the entity in a valid state for transport?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the transport action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const transportHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!transportValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
