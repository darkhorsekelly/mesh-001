// ===============================================
// WELD ACTION HANDLER
// ===============================================
// handles structural fusion between entities.
// unlike LOAD (containment), welded entities maintain relative offsets
// and move as a rigid structure.
//
// PHYSICS:
// - momentum is conserved: p_total = m1*v1 + m2*v2
// - combined velocity = p_total / (m1 + m2)
// - primary entity holds the structural mass for thrust calculations

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP, Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import { 
    fpDistanceSquared, 
    fpMul, 
    fpAdd, 
    fpSub,
    fpDiv,
    toFP,
} from '../../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Helper Functions
// -----------------------------------------------

/**
 * checks if entity A can reach entity B (distance <= A.reach)
 */
function canReach(actor: Entity, target: Entity): boolean {
    if (actor.reach <= 0) return false;
    
    const distSquared = fpDistanceSquared(actor.position, target.position);
    const reachSquared = fpMul(actor.reach, actor.reach);
    
    return distSquared <= reachSquared;
}

/**
 * checks if an entity is a celestial (cannot be welded)
 */
function isCelestial(entity: Entity): boolean {
    return entity.type === 'RESOURCE_WELL';
}

/**
 * calculates conserved momentum velocity for combined structure.
 * v_combined = (m1*v1 + m2*v2) / (m1 + m2)
 */
function calculateMomentumVelocity(
    mass1: FP,
    velocity1: Vector2FP,
    mass2: FP,
    velocity2: Vector2FP
): Vector2FP {
    const totalMass = fpAdd(mass1, mass2);
    
    if (totalMass <= 0) {
        return { x: toFP(0), y: toFP(0) };
    }

    // momentum_x = m1*v1.x + m2*v2.x
    const momentumX = fpAdd(
        fpMul(mass1, velocity1.x),
        fpMul(mass2, velocity2.x)
    );
    
    // momentum_y = m1*v1.y + m2*v2.y
    const momentumY = fpAdd(
        fpMul(mass1, velocity1.y),
        fpMul(mass2, velocity2.y)
    );

    // v_combined = momentum / totalMass
    return {
        x: fpDiv(momentumX, totalMass),
        y: fpDiv(momentumY, totalMass),
    };
}

/**
 * calculates the relative offset of secondary from primary.
 */
function calculateRelativeOffset(
    primaryPosition: Vector2FP,
    secondaryPosition: Vector2FP
): Vector2FP {
    return {
        x: fpSub(secondaryPosition.x, primaryPosition.x),
        y: fpSub(secondaryPosition.y, primaryPosition.y),
    };
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * validates the WELD action:
 * - actor must have reach
 * - actor's airlock must be sealed (structural operation safety)
 * - target must be within reach
 * - target cannot be self
 * - target cannot be a celestial (resource well)
 * - target cannot already be welded to something else
 */
export const weldValidate: ActionValidator = (
    actor: Entity,
    targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // must have at least one target
    if (targets.length === 0) return false;

    // actor must have reach capability
    if (actor.reach <= 0) return false;

    // actor's airlock must be sealed for structural operations
    if (!actor.airlockSealed) return false;

    // validate each target
    for (const target of targets) {
        // cannot weld to self
        if (target.id === actor.id) return false;

        // cannot weld celestials
        if (isCelestial(target)) return false;

        // target must be within reach
        if (!canReach(actor, target)) return false;

        // target cannot already be welded to something
        if (target.weldParentId !== undefined) return false;

        // actor cannot be welded to something (must be root of structure)
        if (actor.weldParentId !== undefined) return false;
    }

    return true;
};

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * executes the WELD action:
 * - designates actor as primary, targets as secondary
 * - calculates combined momentum velocity
 * - records relative offsets
 * - updates primary's mass to include secondary masses
 */
export const weldHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    _context: TickContext
): EntityUpdate[] => {
    // gate: validation must pass
    if (!weldValidate(actor, targets, inputs)) {
        return [];
    }

    const updates: EntityUpdate[] = [];

    // calculate combined velocity using momentum conservation
    // start with actor's momentum
    let totalMass = actor.mass;
    let totalMomentumX = fpMul(actor.mass, actor.velocity.x);
    let totalMomentumY = fpMul(actor.mass, actor.velocity.y);

    // add each target's momentum
    for (const target of targets) {
        totalMass = fpAdd(totalMass, target.mass);
        totalMomentumX = fpAdd(totalMomentumX, fpMul(target.mass, target.velocity.x));
        totalMomentumY = fpAdd(totalMomentumY, fpMul(target.mass, target.velocity.y));
    }

    // combined velocity = total momentum / total mass
    const combinedVelocity: Vector2FP = totalMass > 0 
        ? {
            x: fpDiv(totalMomentumX, totalMass),
            y: fpDiv(totalMomentumY, totalMass),
        }
        : { x: toFP(0), y: toFP(0) };

    // calculate mass to add to primary
    let addedMass: FP = 0;
    for (const target of targets) {
        addedMass = fpAdd(addedMass, target.mass);
    }

    // update primary (actor): new mass and velocity
    updates.push({
        id: actor.id,
        changes: {
            mass: fpAdd(actor.mass, addedMass),
            velocity: combinedVelocity,
        },
    });

    // update each secondary (target): weldParentId, relativeOffset, velocity
    for (const target of targets) {
        const relativeOffset = calculateRelativeOffset(actor.position, target.position);

        updates.push({
            id: target.id,
            changes: {
                weldParentId: actor.id,
                relativeOffset,
                velocity: combinedVelocity,
            },
        });
    }

    return updates;
};
