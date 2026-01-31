// ===============================================
// LAUNCH ACTION HANDLER
// ===============================================
// Handles launching an entity with a specified vector.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * Validates whether the launch action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const launchValidate: ActionValidator = (
    _actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // capability: does the entity have a launch mechanism?
    // state: is the entity in a launchable state (docked/grounded)?
    // stub: always returns false until implemented
    return false;
};

/**
 * Executes the launch action.
 * Rule: handler must call validate first to prevent illegal action desync.
 */
export const launchHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!launchValidate(actor, targets, inputs)) {
        return [];
    }

    // implementation goes here
    return [];
};
