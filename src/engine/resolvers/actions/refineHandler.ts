// ===============================================
// REFINE ACTION HANDLER
// ===============================================
// Processes volatilesMass into fuelMass with efficiency loss.
// waste = input - output; total mass decreases by waste amount.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP } from '../../primitive-types/euclidean/euclidean-types.js';
import {
    fpSub,
    fpAdd,
    fpMul,
    fpMin,
} from '../../primitive-types/euclidean/euclidean-types.js';
import {
    REFINE_EFFICIENCY,
    REFINE_MAX_BATCH,
} from '../../config/engineConfig.js';

// -----------------------------------------------
// Input Extraction Helpers
// -----------------------------------------------

function getVolatilesAmount(inputs: Record<string, unknown>): FP {
    const amount = inputs['volatilesAmount'];
    if (typeof amount === 'number') {
        return amount as FP;
    }
    return 0;
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * Validates whether the refine action can be performed.
 * Checks:
 * - Actor has volatilesMass > 0
 * - Requested amount is positive
 */
export const refineValidate: ActionValidator = (
    actor: Entity,
    _targets: Entity[],
    inputs: Record<string, unknown>
): boolean => {
    // state: must have volatiles to refine
    if (actor.volatilesMass <= 0) {
        return false;
    }

    // input: must have positive amount
    const amount = getVolatilesAmount(inputs);
    if (amount <= 0) {
        return false;
    }

    return true;
};

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * Executes the refine action.
 * 
 * Process:
 * 1. Cap input by REFINE_MAX_BATCH and available volatilesMass
 * 2. fuelGenerated = amount * REFINE_EFFICIENCY
 * 3. waste = amount - fuelGenerated
 * 4. Update: volatilesMass -= amount, fuelMass += fuelGenerated, mass -= waste
 */
export const refineHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass
    if (!refineValidate(actor, targets, inputs)) {
        return [];
    }

    // determine actual amount to process
    let amount = getVolatilesAmount(inputs);
    
    // cap by max batch size
    amount = fpMin(amount, REFINE_MAX_BATCH);
    
    // cap by available volatiles
    amount = fpMin(amount, actor.volatilesMass);

    // calculate output fuel (efficiency applied)
    const fuelGenerated = fpMul(amount, REFINE_EFFICIENCY);

    // calculate waste (lost during refining)
    const waste = fpSub(amount, fuelGenerated);

    // compute new values
    const newVolatilesMass = fpSub(actor.volatilesMass, amount);
    const newFuelMass = fpAdd(actor.fuelMass, fuelGenerated);
    const newMass = fpSub(actor.mass, waste);

    return [{
        id: actor.id,
        changes: {
            volatilesMass: newVolatilesMass,
            fuelMass: newFuelMass,
            mass: newMass,
        },
    }];
};
