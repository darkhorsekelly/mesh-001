// ===============================================
// LOAD ACTION HANDLER
// ===============================================
// handles loading content entities into container entities.
// supports decoupled logistics: actor can load content into a different container
// if both are within the actor's reach.
//
// TRIAD VALIDATION:
// 1. Actor Reach - can actor reach both content and container?
// 2. Container Capability - does container have isContainer permission?
// 3. Volume Check - does container have remaining capacity?

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { ActionHandler, ActionValidator, TickContext } from './actionTypes.js';
import type { FP, Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import { fpDistanceSquared, fpMul, fpAdd, fpSub } from '../../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Input Extraction
// -----------------------------------------------

interface LoadInputs {
    contentIds: string[];
    containerId: string;
}

function getLoadInputs(inputs: Record<string, unknown>): LoadInputs | null {
    const contentIds = inputs['contentIds'];
    const containerId = inputs['containerId'];

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
        return null;
    }
    if (typeof containerId !== 'string') {
        return null;
    }

    return {
        contentIds: contentIds as string[],
        containerId,
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
 * calculates the total volume currently used in a container.
 * sums the volume of all entities with parentId === container.id
 */
function calculateUsedVolume(containerId: string, entities: readonly Entity[]): FP {
    let used: FP = 0;
    
    for (const entity of entities) {
        if (entity.parentId === containerId) {
            used = fpAdd(used, entity.volume);
        }
    }
    
    return used;
}

/**
 * calculates the total mass of contained entities.
 */
function calculateContainedMass(containerId: string, entities: readonly Entity[]): FP {
    let total: FP = 0;
    
    for (const entity of entities) {
        if (entity.parentId === containerId) {
            // include entity's total mass (mass + fuelMass + volatilesMass conceptually in mass)
            total = fpAdd(total, entity.mass);
        }
    }
    
    return total;
}

// -----------------------------------------------
// Validation
// -----------------------------------------------

/**
 * validates the LOAD action using the Triad Validation:
 * 1. Actor Reach - actor can reach both content and container
 * 2. Container Capability - container has isContainer permission
 * 3. Volume Check - container has sufficient remaining volume
 */
export const loadValidate: ActionValidator = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>
): boolean => {
    const loadInputs = getLoadInputs(inputs);
    if (!loadInputs) return false;

    // find container from targets
    const container = targets.find(t => t.id === loadInputs.containerId);
    if (!container) return false;

    // TRIAD CHECK 1: Actor Reach - can actor reach the container?
    // special case: actor IS the container (self-load)
    if (actor.id !== container.id && !canReach(actor, container)) {
        return false;
    }

    // TRIAD CHECK 2: Container Capability
    if (!container.isContainer) {
        return false;
    }

    // find all content entities
    const contents: Entity[] = [];
    for (const contentId of loadInputs.contentIds) {
        const content = targets.find(t => t.id === contentId);
        if (!content) return false;
        
        // TRIAD CHECK 1 (continued): Actor Reach - can actor reach each content?
        if (!canReach(actor, content)) {
            return false;
        }

        // verify content is not already contained
        if (content.parentId !== undefined) {
            return false;
        }

        // verify content is not the container itself
        if (content.id === container.id) {
            return false;
        }

        contents.push(content);
    }

    // TRIAD CHECK 3: Volume Check
    // note: we need context.entities for full volume calculation
    // this basic check ensures container has SOME capacity
    if (!container.containerVolume || container.containerVolume <= 0) {
        return false;
    }

    // sum volume of all content to be loaded
    let contentVolume: FP = 0;
    for (const content of contents) {
        contentVolume = fpAdd(contentVolume, content.volume);
    }

    // basic check - actual used volume check happens in handler with context
    if (contentVolume > container.containerVolume) {
        return false;
    }

    return true;
};

/**
 * extended validation with context for full volume check.
 */
function validateWithContext(
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): boolean {
    // first pass basic validation
    if (!loadValidate(actor, targets, inputs)) {
        return false;
    }

    const loadInputs = getLoadInputs(inputs);
    if (!loadInputs) return false;

    const container = targets.find(t => t.id === loadInputs.containerId);
    if (!container || !container.containerVolume) return false;

    // calculate currently used volume
    const usedVolume = calculateUsedVolume(container.id, context.entities);
    const remainingVolume = fpSub(container.containerVolume, usedVolume);

    // sum volume of content to be loaded
    let contentVolume: FP = 0;
    for (const contentId of loadInputs.contentIds) {
        const content = targets.find(t => t.id === contentId);
        if (content) {
            contentVolume = fpAdd(contentVolume, content.volume);
        }
    }

    // check if there's enough remaining volume
    if (contentVolume > remainingVolume) {
        return false;
    }

    return true;
}

// -----------------------------------------------
// Handler
// -----------------------------------------------

/**
 * executes the LOAD action:
 * - sets content.parentId = container.id
 * - sets content.position = container.position (position binding)
 * - updates container.mass to include content mass (for Newtonian physics)
 */
export const loadHandler: ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
): EntityUpdate[] => {
    // gate: full validation with context
    if (!validateWithContext(actor, targets, inputs, context)) {
        return [];
    }

    const loadInputs = getLoadInputs(inputs);
    if (!loadInputs) return [];

    const container = targets.find(t => t.id === loadInputs.containerId);
    if (!container) return [];

    const updates: EntityUpdate[] = [];

    // calculate total mass being loaded
    let loadedMass: FP = 0;

    // process each content entity
    for (const contentId of loadInputs.contentIds) {
        const content = targets.find(t => t.id === contentId);
        if (!content) continue;

        // add content's mass to total
        loadedMass = fpAdd(loadedMass, content.mass);

        // create update for content entity
        updates.push({
            id: content.id,
            changes: {
                parentId: container.id,
                position: { ...container.position },
            },
        });
    }

    // update container's mass to include loaded content mass
    // this ensures correct Newtonian delta-V calculations
    updates.push({
        id: container.id,
        changes: {
            mass: fpAdd(container.mass, loadedMass),
        },
    });

    return updates;
};
