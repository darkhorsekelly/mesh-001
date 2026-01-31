// ===============================================
// REFINE ACTION HANDLER
// ===============================================
// Handles processing raw resources into refined materials.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the refine action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const refineValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have a refinery module?
    // state: does the entity have raw resources to refine?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the refine action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const refineHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!refineValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
