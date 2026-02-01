// ===============================================
// UNWELD ACTION HANDLER
// ===============================================
// handles structural separation of welded entities.
// the separated entity inherits the structure's velocity at separation.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP } from '../../primitive-types/euclidean/euclidean-types.js';
import { fpSub, fpDistanceSquared, fpMul } from '../../primitive-types/euclidean/euclidean-types.js';

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
 * finds the weld parent entity.
 */
function findWeldParent(
    entity: Entity,
    entities: readonly Entity[]
): Entity | undefined {
    if (!entity.weldParentId) return undefined;
    return entities.find(e => e.id === entity.weldParentId);
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * validates the UNWELD action:
 * - target must have a weldParentId
 * - actor must be the weld parent OR have reach to the target
 */
export const unweldValidate: ActionValidator = (
    actor: Entity,
    targets: Entity[],
    _inputs: Record<string, unknown>
): boolean => {
    // must have at least one target
    if (targets.length === 0) return false;

    // validate each target
    for (const target of targets) {
        // target must be welded
        if (!target.weldParentId) return false;

        // actor must be the weld parent OR have reach to the target
        const isParent = target.weldParentId === actor.id;
        const hasReach = canReach(actor, target);

        if (!isParent && !hasReach) return false;
    }

    return true;
};

/**
 * extended validation with context to find weld parents.
 */
function validateWithContext(
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): { valid: boolean; parents: Map<string, Entity> } {
    const result = { valid: false, parents: new Map<string, Entity>() };

    if (!unweldValidate(actor, targets, inputs)) {
        return result;
    }

    // find and validate parents
    for (const target of targets) {
        if (!target.weldParentId) return result;

        const parent = context.entities.find(e => e.id === target.weldParentId);
        if (!parent) return result;

        result.parents.set(target.id, parent);
    }

    result.valid = true;
    return result;
}

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * executes the UNWELD action:
 * - clears target's weldParentId and relativeOffset
 * - target inherits the structure's velocity
 * - reduces parent's structural mass by target's mass
 */
export const unweldHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): EntityUpdate[] => {
    // validate with context
    const validation = validateWithContext(actor, targets, inputs, context);
    if (!validation.valid) {
        return [];
    }

    const updates: EntityUpdate[] = [];
    
    // track mass to remove from each parent
    const parentMassReduction = new Map<string, FP>();

    // process each target
    for (const target of targets) {
        const parent = validation.parents.get(target.id);
        if (!parent) continue;

        // accumulate mass to remove from parent
        const currentReduction = parentMassReduction.get(parent.id) ?? 0;
        parentMassReduction.set(parent.id, currentReduction + target.mass);

        // update target: clear weld, inherit velocity
        updates.push({
            id: target.id,
            changes: {
                weldParentId: undefined,
                relativeOffset: undefined,
                // inherit parent's velocity at separation
                velocity: { ...parent.velocity },
            },
        });
    }

    // update each parent's mass
    for (const [parentId, massReduction] of parentMassReduction) {
        const parentEntity = context.entities.find(e => e.id === parentId);
        if (!parentEntity) continue;

        updates.push({
            id: parentId,
            changes: {
                mass: fpSub(parentEntity.mass, massReduction),
            },
        });
    }

    return updates;
};
