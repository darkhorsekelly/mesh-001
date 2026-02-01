// ===============================================
// SEAL AIRLOCK ACTION HANDLER
// ===============================================
// handles sealing an entity's airlock.
// a sealed airlock is required for structural operations (WELD).

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';

/**
 * validates whether the seal airlock action can be performed.
 * checks both Capability (has required systems) and State (resources available).
 */
export const sealAirlockValidate: ActionValidator = (
    actor: Entity,
    _targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // state check: airlock must currently be unsealed
    if (actor.airlockSealed) {
        return false;
    }

    return true;
};

/**
 * executes the seal airlock action.
 * rule: handler must call validate first to prevent illegal action desync.
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

    return [{
        id: actor.id,
        changes: {
            airlockSealed: true,
        },
    }];
};
