// ===============================================
// THRUST ACTION HANDLER
// ===============================================
// Handles direct thrust application to an entity.
// Newtonian thrust: converts direction + magnitude into delta-V,
// consumes fuel, and reduces mass accordingly.
//
// Direction can come from:
// 1. Action's direction vector (if provided and non-zero)
// 2. Fallback: actor's heading (for backward compatibility)

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP, Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import {
    fpSub,
    fpMul,
    fpMin,
    fpClamp,
    fpScaleVector,
    fpAddVector,
    fpHeadingToVector,
} from '../../primitive-types/euclidean/euclidean-types.js';
import {
    FUEL_BURN_RATE,
    MASS_PROPULSION_LOSS,
    MINIMUM_FUEL_THRESHOLD,
    MAX_THRUST_PER_TICK,
} from '../../config/engineConfig.js';

/**
 * Extract magnitude from inputs, with type safety
 */
function getMagnitude(inputs: Record<string, unknown>): FP {
    const mag = inputs['magnitude'];
    if (typeof mag === 'number') {
        return mag as FP;
    }
    return 0;
}

/**
 * Extract direction vector from inputs, with type safety.
 * Returns null if no valid direction found (caller should use heading fallback).
 */
function getDirection(inputs: Record<string, unknown>): Vector2FP | null {
    const dir = inputs['direction'];
    if (dir && typeof dir === 'object' && 'x' in dir && 'y' in dir) {
        const d = dir as { x: unknown; y: unknown };
        if (typeof d.x === 'number' && typeof d.y === 'number') {
            const vec = { x: d.x as FP, y: d.y as FP };
            // only return if non-zero
            if (vec.x !== 0 || vec.y !== 0) {
                return vec;
            }
        }
    }
    return null;
}

/**
 * Validates whether the thrust action can be performed.
 * Checks both Capability (has required systems) and State (resources available).
 */
export const thrustValidate: ActionValidator = (
    actor: Entity,
    _targets: Entity[],
    inputs: Record<string, unknown>
): boolean => {
    // capability: for now, all entities can thrust (no component system yet)
    // future: check if actor has ENGINE component

    // state check 1: must have fuel above minimum threshold
    if (actor.fuelMass <= MINIMUM_FUEL_THRESHOLD) {
        return false;
    }

    // state check 2: magnitude must be positive
    const magnitude = getMagnitude(inputs);
    if (magnitude <= 0) {
        return false;
    }

    // direction can come from action or actor's heading - both are valid
    return true;
};

/**
 * Executes the thrust action.
 * Rule: handler must call validate first to prevent illegal action desync.
 *
 * Physics:
 * - Delta-V is derived from direction vector (or heading fallback) and magnitude
 * - Fuel consumed = magnitude * FUEL_BURN_RATE
 * - Mass lost = magnitude * MASS_PROPULSION_LOSS
 * - If requested magnitude exceeds available fuel, burn only what's available
 */
export const thrustHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass before any state mutation
    if (!thrustValidate(actor, targets, inputs)) {
        return [];
    }

    // extract magnitude
    let magnitude = getMagnitude(inputs);
    magnitude = fpClamp(magnitude, 0, MAX_THRUST_PER_TICK);

    // if requested magnitude exceeds available fuel, only burn what we have
    // effective magnitude is limited by fuel / burn rate
    const maxMagnitudeFromFuel = fpMul(actor.fuelMass, FUEL_BURN_RATE);
    const effectiveMagnitude = fpMin(magnitude, maxMagnitudeFromFuel);

    // compute delta-V
    // priority: use action's direction if provided, otherwise use actor's heading
    const actionDirection = getDirection(inputs);
    let deltaV: Vector2FP;
    
    if (actionDirection !== null) {
        // direction provided by action - scale by magnitude
        deltaV = fpScaleVector(actionDirection, effectiveMagnitude);
    } else {
        // fallback to actor's heading (for backward compatibility)
        deltaV = fpHeadingToVector(actor.heading, effectiveMagnitude);
    }

    // compute new velocity
    const newVelocity = fpAddVector(actor.velocity, deltaV);

    // compute fuel consumption
    const fuelConsumed = fpMul(effectiveMagnitude, FUEL_BURN_RATE);
    const newFuelMass = fpSub(actor.fuelMass, fuelConsumed);

    // compute mass loss (propellant ejection)
    const massLost = fpMul(effectiveMagnitude, MASS_PROPULSION_LOSS);
    const newMass = fpSub(actor.mass, massLost);

    // return the entity update
    return [{
        id: actor.id,
        changes: {
            velocity: newVelocity,
            fuelMass: newFuelMass,
            mass: newMass,
            thrust: effectiveMagnitude,
        },
    }];
};
