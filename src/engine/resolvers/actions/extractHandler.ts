// ===============================================
// EXTRACT ACTION HANDLER
// ===============================================
// Handles resource extraction from resource wells (celestials/debris).
// Volatiles flow into actor or target entity.
// Minerals spawn a new MINERAL_STORE entity at the specified position.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP, Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import {
    fpSub,
    fpAdd,
    fpMin,
    fpDistanceSquared,
    fpMul,
    VECTOR_ZERO,
    toFP,
} from '../../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Input Extraction Helpers
// -----------------------------------------------

function getResourceType(inputs: Record<string, unknown>): 'VOLATILES' | 'MINERALS' | null {
    const rt = inputs['resourceType'];
    if (rt === 'VOLATILES' || rt === 'MINERALS') {
        return rt;
    }
    return null;
}

function getRate(inputs: Record<string, unknown>): FP {
    const rate = inputs['rate'];
    if (typeof rate === 'number') {
        return rate as FP;
    }
    return 0;
}

function getMineralTargetPositions(inputs: Record<string, unknown>): Vector2FP[] {
    const positions = inputs['mineralTargetPosition'];
    if (Array.isArray(positions)) {
        return positions as Vector2FP[];
    }
    return [];
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * Validates whether the extract action can be performed.
 * Checks:
 * - Actor reach covers distance to all origins
 * - Origins have extractable mass (volatilesMass or mass properties)
 * - For MINERALS: mineralTargetPosition is provided and within reach
 */
export const extractValidate: ActionValidator = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>
): boolean => {
    const resourceType = getResourceType(inputs);
    const rate = getRate(inputs);

    // must have valid resource type and positive rate
    if (!resourceType || rate <= 0) {
        return false;
    }

    // must have at least one origin to extract from
    if (targets.length === 0) {
        return false;
    }

    // reach check: actor.reach squared for comparison (avoids sqrt)
    const reachSquared = fpMul(actor.reach, actor.reach);

    // verify all origins are within reach and have resources
    for (const origin of targets) {
        const distSq = fpDistanceSquared(actor.position, origin.position);
        if (distSq > reachSquared) {
            return false;
        }

        // check origin has the requested resource
        if (resourceType === 'VOLATILES' && origin.volatilesMass <= 0) {
            return false;
        }
        // minerals: we check mass > 0 as a proxy for mineral availability
        // (entities that are resource wells have mass representing mineral content)
        if (resourceType === 'MINERALS' && origin.mass <= 0) {
            return false;
        }
    }

    // for minerals: must have target positions within reach
    if (resourceType === 'MINERALS') {
        const positions = getMineralTargetPositions(inputs);
        if (positions.length === 0) {
            return false;
        }
        for (const pos of positions) {
            const distSq = fpDistanceSquared(actor.position, pos);
            if (distSq > reachSquared) {
                return false;
            }
        }
    }

    return true;
};

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * Executes the extract action.
 * 
 * VOLATILES: Transfers volatilesMass from origin to actor (or target if specified).
 * MINERALS: Reduces origin mass, spawns new MINERAL_STORE entity at target position.
 */
export const extractHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass
    if (!extractValidate(actor, targets, inputs)) {
        return [];
    }

    const resourceType = getResourceType(inputs)!;
    const rate = getRate(inputs);
    const updates: EntityUpdate[] = [];

    if (resourceType === 'VOLATILES') {
        // process each origin for volatiles extraction
        for (const origin of targets) {
            // extract up to rate, capped by available mass
            const extractAmount = fpMin(rate, origin.volatilesMass);

            // reduce origin volatiles
            updates.push({
                id: origin.id,
                changes: {
                    volatilesMass: fpSub(origin.volatilesMass, extractAmount),
                },
            });

            // increase actor volatiles (or target if specified via additional logic)
            updates.push({
                id: actor.id,
                changes: {
                    volatilesMass: fpAdd(actor.volatilesMass, extractAmount),
                },
            });
        }
    } else if (resourceType === 'MINERALS') {
        // minerals spawn new entities at target positions
        const positions = getMineralTargetPositions(inputs);

        for (let i = 0; i < targets.length && i < positions.length; i++) {
            const origin = targets[i];
            const targetPos = positions[i];

            // extract up to rate, capped by available mass
            const extractAmount = fpMin(rate, origin?.mass ?? 0);

            // reduce origin mass
            updates.push({
                id: origin?.id ?? '',
                changes: {
                    mass: fpSub(origin?.mass ?? 0, extractAmount),
                },
            });

            // spawn new MINERAL_STORE entity
            // TODO: the engine must support entity creation via special update
            // for now, we create an update with a generated ID
            const mineralStoreId = `mineral-store-${context.tick}-${i}`;
            updates.push({
                id: mineralStoreId,
                changes: {
                    position: targetPos,
                    velocity: VECTOR_ZERO,
                    mass: extractAmount,
                    volume: extractAmount,
                    fuelMass: toFP(0),
                    volatilesMass: toFP(0),
                    reach: toFP(0),
                    airlockSealed: false,
                    opticLevel: 0,
                    zoomState: actor.zoomState,
                    heading: toFP(0),
                    thrust: toFP(0),
                },
            });
        }
    }

    return updates;
};
