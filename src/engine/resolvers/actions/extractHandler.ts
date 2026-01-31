// ===============================================
// EXTRACT ACTION HANDLER
// ===============================================
// Handles resource extraction from a celestial or debris.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the extract action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const extractValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have extraction equipment?
    // state: is the entity in proximity to an extractable source?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the extract action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const extractHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!extractValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
