// ===============================================
// ENCOUNTER ACTION HANDLER
// ===============================================
// Handles initiating an encounter with another entity.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the encounter action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const encounterValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have docking/boarding capability?
    // state: is the entity in proximity and matching velocity?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the encounter action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const encounterHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!encounterValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
