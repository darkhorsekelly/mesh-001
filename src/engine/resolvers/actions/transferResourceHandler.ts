// ===============================================
// TRANSFER RESOURCE ACTION HANDLER
// ===============================================
// Handles resource transfer (crude volatiles or refined fuel) between two entities

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the transfer action can be performed.
 * Checks both capability (has required systems) and state (resources available).
 */
export const transferResourceValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>

): boolean => {
    // capability: does the entity have fuelStore or volatilesStore capability?
    // state: are the origin and target entities in a valid state for transfer?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the transport action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const transferResourceHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!transferResourceValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
