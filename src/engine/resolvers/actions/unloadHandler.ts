// ===============================================
// UNLOAD ACTION HANDLER
// ===============================================
// handles unloading content entities from containers.
// content is placed at a specified position and becomes a root entity again.
//
// VALIDATION:
// - content.parentId must match actor.id or another entity within actor's reach
// - content must exist and be contained
// - new position must be provided

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP, Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import { fpDistanceSquared, fpMul, fpSub } from '../../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Input Extraction
// -----------------------------------------------

interface UnloadInputs {
    contentIds: string[];
    newPositions: Vector2FP[];
}

function getUnloadInputs(inputs: Record<string, unknown>): UnloadInputs | null {
    const contentIds = inputs['contentIds'];
    const newPositions = inputs['newPositions'];

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
        return null;
    }
    if (!Array.isArray(newPositions) || newPositions.length === 0) {
        return null;
    }

    // validate position structure
    for (const pos of newPositions) {
        if (typeof pos !== 'object' || pos === null) return null;
        if (typeof (pos as Vector2FP).x !== 'number') return null;
        if (typeof (pos as Vector2FP).y !== 'number') return null;
    }

    return {
        contentIds: contentIds as string[],
        newPositions: newPositions as Vector2FP[],
    };
}

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
 * finds the container entity for a given content.
 */
function findContainer(content: Entity, entities: readonly Entity[]): Entity | undefined {
    if (!content.parentId) return undefined;
    return entities.find(e => e.id === content.parentId);
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * validates the UNLOAD action:
 * - content must be contained (have parentId)
 * - content's container must be the actor OR within actor's reach
 * - new position must be provided for each content
 */
export const unloadValidate: ActionValidator = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>
): boolean => {
    const unloadInputs = getUnloadInputs(inputs);
    if (!unloadInputs) return false;

    // must have same number of positions as content IDs
    if (unloadInputs.contentIds.length !== unloadInputs.newPositions.length) {
        return false;
    }

    // validate each content
    for (const contentId of unloadInputs.contentIds) {
        const content = targets.find(t => t.id === contentId);
        if (!content) return false;

        // content must be contained
        if (!content.parentId) {
            return false;
        }

        // find the container - check actor first, then targets
        let container: Entity | undefined;
        if (actor.id === content.parentId) {
            container = actor;
        } else {
            container = targets.find(t => t.id === content.parentId);
        }
        
        if (!container) return false;

        // container must be actor OR within actor's reach
        if (actor.id !== container.id && !canReach(actor, container)) {
            return false;
        }
    }

    return true;
};

/**
 * extended validation with context for looking up containers not in targets.
 */
function validateWithContext(
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): { valid: boolean; containers: Map<string, Entity> } {
    const result = { valid: false, containers: new Map<string, Entity>() };

    const unloadInputs = getUnloadInputs(inputs);
    if (!unloadInputs) return result;

    if (unloadInputs.contentIds.length !== unloadInputs.newPositions.length) {
        return result;
    }

    // validate each content and collect containers
    for (const contentId of unloadInputs.contentIds) {
        // find content in targets or context
        let content = targets.find(t => t.id === contentId);
        if (!content) {
            content = context.entities.find(e => e.id === contentId);
        }
        if (!content) return result;

        // content must be contained
        if (!content.parentId) {
            return result;
        }

        // find the container in targets or context
        let container = targets.find(t => t.id === content.parentId);
        if (!container) {
            container = context.entities.find(e => e.id === content.parentId);
        }
        if (!container) return result;

        // container must be actor OR within actor's reach
        if (actor.id !== container.id && !canReach(actor, container)) {
            return result;
        }

        // track container for mass update
        result.containers.set(container.id, container);
    }

    result.valid = true;
    return result;
}

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * executes the UNLOAD action:
 * - sets content.parentId = undefined
 * - sets content.position = newPosition
 * - updates original container's mass by subtracting content mass
 */
export const unloadHandler: ActionHandler = (
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

    const unloadInputs = getUnloadInputs(inputs);
    if (!unloadInputs) return [];

    const updates: EntityUpdate[] = [];
    
    // track mass to remove from each container
    const containerMassReduction = new Map<string, FP>();

    // process each content entity
    for (let i = 0; i < unloadInputs.contentIds.length; i++) {
        const contentId = unloadInputs.contentIds[i];
        const newPosition = unloadInputs.newPositions[i];
        
        if (!contentId || !newPosition) continue;

        // find content entity
        let content = targets.find(t => t.id === contentId);
        if (!content) {
            content = context.entities.find(e => e.id === contentId);
        }
        if (!content || !content.parentId) continue;

        const containerId = content.parentId;

        // accumulate mass to remove from this container
        const currentReduction = containerMassReduction.get(containerId) ?? 0;
        containerMassReduction.set(containerId, currentReduction + content.mass);

        // create update for content entity
        updates.push({
            id: content.id,
            changes: {
                parentId: undefined,
                position: { ...newPosition },
                // reset velocity to match former container's velocity
                // (inherits momentum when ejected)
                velocity: validation.containers.get(containerId)?.velocity ?? { x: 0, y: 0 },
            },
        });
    }

    // update each container's mass
    for (const [containerId, massReduction] of containerMassReduction) {
        const container = validation.containers.get(containerId);
        if (!container) continue;

        updates.push({
            id: containerId,
            changes: {
                mass: fpSub(container.mass, massReduction),
            },
        });
    }

    return updates;
};
