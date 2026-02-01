// ===============================================
// TEST INVARIANTS
// ===============================================
// hard invariant checkers for mass conservation, reach validation,
// and other deterministic rules that must hold across all actions.

import type { Entity, EntityUpdate } from '../primitive-types/semantic/entity/entity-types.js';
import type { GameState } from '../state-types/state-types.js';
import { 
    fpDistanceSquared, 
    fpAdd, 
    fpMul,
    fromFP,
    type FP 
} from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Mass Conservation
// -----------------------------------------------

export interface MassConservationResult {
    passed: boolean;
    totalMassBefore: FP;
    totalMassAfter: FP;
    delta: FP;
    message: string;
}

/**
 * calculates total mass of an entity.
 * 
 * NOTE: in the MESH 95 engine model, `mass` represents the total entity mass.
 * the `fuelMass` and `volatilesMass` fields are component trackers that 
 * represent portions of the total mass, not additive values.
 * 
 * example: a ship with mass=1000, fuelMass=100, volatilesMass=50
 * has total mass of 1000, of which 100 is fuel and 50 is volatiles.
 * the remaining 850 is "dry" structural mass.
 */
export function getTotalEntityMass(entity: Entity): FP {
    // mass is the total - fuelMass and volatilesMass are subsets
    return entity.mass;
}

/**
 * checks if an entity is a root entity (not contained by another).
 */
export function isRootEntity(entity: Entity): boolean {
    return entity.parentId === undefined;
}

/**
 * checks if an entity is structurally independent (not contained or welded).
 */
export function isIndependentEntity(entity: Entity): boolean {
    return entity.parentId === undefined && entity.weldParentId === undefined;
}

/**
 * calculates total mass across all INDEPENDENT entities in a state.
 * 
 * CONTAINMENT MODEL: when an entity is loaded into a container:
 * - container.mass is increased to include content.mass (for Newtonian physics)
 * - content entity still exists in state.entities with its own mass
 * 
 * WELD MODEL: when an entity is welded to another:
 * - parent.mass is increased to include child.mass (for thrust calculations)
 * - child entity still exists with its own mass property
 * 
 * to avoid double-counting, we only sum mass of independent entities
 * (entities that are neither contained nor welded to another).
 */
export function getTotalStateMass(state: GameState): FP {
    return state.entities.reduce(
        (total, entity) => {
            // only count independent entities to avoid double-counting
            if (isIndependentEntity(entity)) {
                return fpAdd(total, getTotalEntityMass(entity));
            }
            return total;
        },
        0 as FP
    );
}

/**
 * calculates total mass using legacy method (all entities).
 * useful for debugging containment issues.
 */
export function getTotalStateMassRaw(state: GameState): FP {
    return state.entities.reduce(
        (total, entity) => fpAdd(total, getTotalEntityMass(entity)),
        0 as FP
    );
}

/**
 * finds all entities contained within a given container (recursively).
 */
export function findContainedEntities(
    containerId: string,
    entities: readonly Entity[]
): Entity[] {
    const contained: Entity[] = [];
    
    for (const entity of entities) {
        if (entity.parentId === containerId) {
            contained.push(entity);
            // recursively find nested contents
            contained.push(...findContainedEntities(entity.id, entities));
        }
    }
    
    return contained;
}

/**
 * calculates the "true" mass of a container including all nested contents.
 * useful for verifying the container's mass property is correctly maintained.
 */
export function calculateExpectedContainerMass(
    container: Entity,
    entities: readonly Entity[],
    baseMass: FP
): FP {
    const contained = findContainedEntities(container.id, entities);
    let totalContainedMass = baseMass;
    
    for (const content of contained) {
        totalContainedMass = fpAdd(totalContainedMass, content.mass);
    }
    
    return totalContainedMass;
}

/**
 * verifies mass conservation between two states.
 * allows for a configurable tolerance for refining waste, etc.
 */
export function assertMassConservation(
    before: GameState,
    after: GameState,
    allowedLoss: FP = 0
): MassConservationResult {
    const massBefore = getTotalStateMass(before);
    const massAfter = getTotalStateMass(after);
    const delta = massBefore - massAfter;

    // mass can only decrease (via waste), never increase out of nowhere
    const passed = delta >= 0 && delta <= allowedLoss;

    return {
        passed,
        totalMassBefore: massBefore,
        totalMassAfter: massAfter,
        delta,
        message: passed
            ? `Mass conservation OK: ${fromFP(massBefore)} -> ${fromFP(massAfter)} (loss: ${fromFP(delta)})`
            : `Mass conservation FAILED: ${fromFP(massBefore)} -> ${fromFP(massAfter)} (delta: ${fromFP(delta)}, allowed: ${fromFP(allowedLoss)})`,
    };
}

/**
 * verifies mass conservation for a set of entity updates.
 * useful for testing isolated action handlers.
 */
export function assertUpdateMassConservation(
    originalEntities: Entity[],
    updates: EntityUpdate[],
    allowedLoss: FP = 0
): MassConservationResult {
    // calculate original mass
    const massBefore = originalEntities.reduce(
        (total, e) => fpAdd(total, getTotalEntityMass(e)),
        0 as FP
    );

    // apply updates to calculate new mass
    let massAfter = massBefore;

    for (const update of updates) {
        const original = originalEntities.find(e => e.id === update.id);
        
        if (original) {
            // subtract original contribution
            massAfter -= getTotalEntityMass(original);

            // add updated contribution
            const updated: Entity = { ...original, ...update.changes } as Entity;
            massAfter += getTotalEntityMass(updated);
        } else {
            // new entity spawned - adds mass
            const newEntity = update.changes as Partial<Entity>;
            const newMass = fpAdd(
                fpAdd(
                    (newEntity.mass ?? 0) as FP,
                    (newEntity.fuelMass ?? 0) as FP
                ),
                (newEntity.volatilesMass ?? 0) as FP
            );
            massAfter += newMass;
        }
    }

    const delta = massBefore - massAfter;
    const passed = delta >= 0 && delta <= allowedLoss;

    return {
        passed,
        totalMassBefore: massBefore,
        totalMassAfter: massAfter,
        delta,
        message: passed
            ? `Mass conservation OK: ${fromFP(massBefore)} -> ${fromFP(massAfter)} (loss: ${fromFP(delta)})`
            : `Mass conservation FAILED: ${fromFP(massBefore)} -> ${fromFP(massAfter)} (delta: ${fromFP(delta)}, allowed: ${fromFP(allowedLoss)})`,
    };
}

// -----------------------------------------------
// Reach / Proximity Validation
// -----------------------------------------------

export interface ReachValidationResult {
    passed: boolean;
    distance: FP;
    actorReach: FP;
    message: string;
}

/**
 * verifies that an actor can reach a target based on actor's reach property.
 * uses squared distance to avoid sqrt.
 */
export function assertInReach(
    actor: Entity,
    target: Entity
): ReachValidationResult {
    const distanceSquared = fpDistanceSquared(actor.position, target.position);
    const reachSquared = fpMul(actor.reach, actor.reach);
    const passed = distanceSquared <= reachSquared;

    // approximate actual distance for reporting
    const distance = Math.round(Math.sqrt(distanceSquared)) as FP;

    return {
        passed,
        distance,
        actorReach: actor.reach,
        message: passed
            ? `Reach OK: distance ${fromFP(distance)} <= reach ${fromFP(actor.reach)}`
            : `Reach FAILED: distance ${fromFP(distance)} > reach ${fromFP(actor.reach)}`,
    };
}

/**
 * verifies that an actor is OUT of reach of a target.
 * useful for testing rejection of invalid actions.
 */
export function assertOutOfReach(
    actor: Entity,
    target: Entity
): ReachValidationResult {
    const result = assertInReach(actor, target);
    return {
        ...result,
        passed: !result.passed,
        message: result.passed
            ? `Out-of-reach FAILED: distance ${fromFP(result.distance)} <= reach ${fromFP(actor.reach)}`
            : `Out-of-reach OK: distance ${fromFP(result.distance)} > reach ${fromFP(actor.reach)}`,
    };
}

// -----------------------------------------------
// Resource Validation
// -----------------------------------------------

export interface ResourceValidationResult {
    passed: boolean;
    available: FP;
    required: FP;
    message: string;
}

/**
 * verifies that an entity has sufficient fuel for an action.
 */
export function assertSufficientFuel(
    entity: Entity,
    required: FP
): ResourceValidationResult {
    const passed = entity.fuelMass >= required;
    return {
        passed,
        available: entity.fuelMass,
        required,
        message: passed
            ? `Fuel OK: ${fromFP(entity.fuelMass)} >= ${fromFP(required)}`
            : `Fuel FAILED: ${fromFP(entity.fuelMass)} < ${fromFP(required)}`,
    };
}

/**
 * verifies that an entity has sufficient volatiles for an action.
 */
export function assertSufficientVolatiles(
    entity: Entity,
    required: FP
): ResourceValidationResult {
    const passed = entity.volatilesMass >= required;
    return {
        passed,
        available: entity.volatilesMass,
        required,
        message: passed
            ? `Volatiles OK: ${fromFP(entity.volatilesMass)} >= ${fromFP(required)}`
            : `Volatiles FAILED: ${fromFP(entity.volatilesMass)} < ${fromFP(required)}`,
    };
}

// -----------------------------------------------
// State Invariant Assertions
// -----------------------------------------------

/**
 * verifies that no entity has negative mass values.
 */
export function assertNoNegativeMass(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];

    for (const entity of state.entities) {
        if (entity.mass < 0) {
            violations.push(`${entity.id}: mass = ${fromFP(entity.mass)}`);
        }
        if (entity.fuelMass < 0) {
            violations.push(`${entity.id}: fuelMass = ${fromFP(entity.fuelMass)}`);
        }
        if (entity.volatilesMass < 0) {
            violations.push(`${entity.id}: volatilesMass = ${fromFP(entity.volatilesMass)}`);
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

// -----------------------------------------------
// Containment Invariants
// -----------------------------------------------

/**
 * verifies position binding: contained entities must have same position as container.
 */
export function assertPositionBinding(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];
    const entityMap = new Map(state.entities.map(e => [e.id, e]));

    for (const entity of state.entities) {
        if (entity.parentId) {
            const container = entityMap.get(entity.parentId);
            if (container) {
                if (entity.position.x !== container.position.x ||
                    entity.position.y !== container.position.y) {
                    violations.push(
                        `${entity.id} position (${fromFP(entity.position.x)}, ${fromFP(entity.position.y)}) ` +
                        `!= container ${container.id} position (${fromFP(container.position.x)}, ${fromFP(container.position.y)})`
                    );
                }
            } else {
                violations.push(`${entity.id} has parentId ${entity.parentId} but parent not found`);
            }
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

/**
 * verifies container volume constraints: used volume <= container volume.
 */
export function assertVolumeConstraints(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];

    // group entities by parent
    const contentsByParent = new Map<string, Entity[]>();
    for (const entity of state.entities) {
        if (entity.parentId) {
            const contents = contentsByParent.get(entity.parentId) ?? [];
            contents.push(entity);
            contentsByParent.set(entity.parentId, contents);
        }
    }

    // check each container
    for (const [containerId, contents] of contentsByParent) {
        const container = state.entities.find(e => e.id === containerId);
        if (!container) {
            violations.push(`Container ${containerId} not found but has contents`);
            continue;
        }

        if (!container.isContainer) {
            violations.push(`${containerId} has contents but isContainer=false`);
            continue;
        }

        const usedVolume = contents.reduce((sum, c) => fpAdd(sum, c.volume), 0 as FP);
        const capacity = container.containerVolume ?? 0;

        if (usedVolume > capacity) {
            violations.push(
                `${containerId}: used volume ${fromFP(usedVolume)} > capacity ${fromFP(capacity)}`
            );
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

/**
 * verifies no circular containment (entity cannot be its own ancestor).
 */
export function assertNoCircularContainment(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];
    const entityMap = new Map(state.entities.map(e => [e.id, e]));

    for (const entity of state.entities) {
        if (entity.parentId) {
            const visited = new Set<string>();
            let current: Entity | undefined = entity;

            while (current?.parentId) {
                if (visited.has(current.parentId)) {
                    violations.push(`Circular containment detected: ${entity.id}`);
                    break;
                }
                visited.add(current.parentId);
                current = entityMap.get(current.parentId);
            }
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

// -----------------------------------------------
// Weld Invariants
// -----------------------------------------------

/**
 * verifies weld position binding: welded entities must be at parent.position + relativeOffset.
 */
export function assertWeldBinding(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];
    const entityMap = new Map(state.entities.map(e => [e.id, e]));

    for (const entity of state.entities) {
        if (entity.weldParentId) {
            const parent = entityMap.get(entity.weldParentId);
            if (parent) {
                const offset = entity.relativeOffset ?? { x: 0 as FP, y: 0 as FP };
                const expectedX = fpAdd(parent.position.x, offset.x);
                const expectedY = fpAdd(parent.position.y, offset.y);

                if (entity.position.x !== expectedX ||
                    entity.position.y !== expectedY) {
                    violations.push(
                        `${entity.id} position (${fromFP(entity.position.x)}, ${fromFP(entity.position.y)}) ` +
                        `!= weld parent ${parent.id} position + offset ` +
                        `(${fromFP(expectedX)}, ${fromFP(expectedY)})`
                    );
                }
            } else {
                violations.push(`${entity.id} has weldParentId ${entity.weldParentId} but parent not found`);
            }
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

/**
 * verifies no circular weld (entity cannot be welded to its own descendant).
 */
export function assertNoCircularWeld(state: GameState): {
    passed: boolean;
    violations: string[];
} {
    const violations: string[] = [];
    const entityMap = new Map(state.entities.map(e => [e.id, e]));

    for (const entity of state.entities) {
        if (entity.weldParentId) {
            const visited = new Set<string>();
            let current: Entity | undefined = entity;

            while (current?.weldParentId) {
                if (visited.has(current.weldParentId)) {
                    violations.push(`Circular weld detected: ${entity.id}`);
                    break;
                }
                visited.add(current.weldParentId);
                current = entityMap.get(current.weldParentId);
            }
        }
    }

    return {
        passed: violations.length === 0,
        violations,
    };
}

/**
 * verifies that tick number advanced correctly.
 */
export function assertTickAdvanced(
    before: GameState,
    after: GameState
): boolean {
    return after.tick === before.tick + 1;
}

// -----------------------------------------------
// Wave-Based Invariants
// -----------------------------------------------
// these invariants ensure sequential integrity during wave-based resolution.

export interface NonTeleportationResult {
    passed: boolean;
    violations: Array<{
        entityId: string;
        distance: FP;
        maxAllowed: FP;
        message: string;
    }>;
}

/**
 * verifies that no entity moved further than physically possible.
 * an entity's position change should be <= velocity magnitude.
 * 
 * this prevents "teleportation" glitches from action resolution bugs.
 */
export function assertNonTeleportation(
    before: GameState,
    after: GameState,
    velocityMultiplier: number = 1.5 // allow some slack for accumulated velocity
): NonTeleportationResult {
    const violations: NonTeleportationResult['violations'] = [];
    
    const beforeMap = new Map(before.entities.map(e => [e.id, e]));
    
    for (const afterEntity of after.entities) {
        const beforeEntity = beforeMap.get(afterEntity.id);
        if (!beforeEntity) continue; // new entity spawned
        
        // skip contained/welded entities (they follow parents)
        if (afterEntity.parentId || afterEntity.weldParentId) continue;
        
        // calculate distance moved
        const dx = afterEntity.position.x - beforeEntity.position.x;
        const dy = afterEntity.position.y - beforeEntity.position.y;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy) as FP;
        
        // calculate max allowed (velocity magnitude * multiplier)
        const velocityMagnitude = Math.sqrt(
            beforeEntity.velocity.x * beforeEntity.velocity.x +
            beforeEntity.velocity.y * beforeEntity.velocity.y
        ) as FP;
        const maxAllowed = (velocityMagnitude * velocityMultiplier) as FP;
        
        // allow for minimum movement (very slow entities)
        const effectiveMax = Math.max(maxAllowed, 100) as FP; // 0.1 FP units minimum
        
        if (distanceMoved > effectiveMax) {
            violations.push({
                entityId: afterEntity.id,
                distance: distanceMoved,
                maxAllowed: effectiveMax,
                message: `Entity ${afterEntity.id} moved ${fromFP(distanceMoved)} units, max allowed ${fromFP(effectiveMax)}`,
            });
        }
    }
    
    return {
        passed: violations.length === 0,
        violations,
    };
}

export interface WaveMassConservationResult {
    passed: boolean;
    waveResults: MassConservationResult[];
    summary: string;
}

/**
 * verifies mass conservation at each wave boundary, not just at tick end.
 * this ensures settlement between waves doesn't create or destroy mass.
 * 
 * requires the intermediate states from wave resolution.
 */
export function assertWaveMassConservation(
    waveStates: GameState[],
    allowedLoss: FP = 0
): WaveMassConservationResult {
    const waveResults: MassConservationResult[] = [];
    let allPassed = true;
    
    for (let i = 1; i < waveStates.length; i++) {
        const result = assertMassConservation(
            waveStates[i - 1]!,
            waveStates[i]!,
            allowedLoss
        );
        waveResults.push(result);
        if (!result.passed) {
            allPassed = false;
        }
    }
    
    return {
        passed: allPassed,
        waveResults,
        summary: allPassed 
            ? `All ${waveResults.length} wave transitions conserved mass`
            : `Mass conservation failed in ${waveResults.filter(r => !r.passed).length} of ${waveResults.length} waves`,
    };
}

/**
 * verifies velocity continuity between waves.
 * no entity should have a sudden velocity spike unless a THRUST action was applied.
 */
export function assertVelocityContinuity(
    before: GameState,
    after: GameState,
    maxVelocityChange: FP = 1000 // 1.0 in FP units
): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    const beforeMap = new Map(before.entities.map(e => [e.id, e]));
    
    for (const afterEntity of after.entities) {
        const beforeEntity = beforeMap.get(afterEntity.id);
        if (!beforeEntity) continue;
        
        const dvx = Math.abs(afterEntity.velocity.x - beforeEntity.velocity.x);
        const dvy = Math.abs(afterEntity.velocity.y - beforeEntity.velocity.y);
        const dv = Math.sqrt(dvx * dvx + dvy * dvy) as FP;
        
        if (dv > maxVelocityChange) {
            violations.push(
                `${afterEntity.id}: velocity changed by ${fromFP(dv)}, max allowed ${fromFP(maxVelocityChange)}`
            );
        }
    }
    
    return {
        passed: violations.length === 0,
        violations,
    };
}

// -----------------------------------------------
// Composite Invariant Checker
// -----------------------------------------------

export interface InvariantCheckResult {
    passed: boolean;
    massConservation: MassConservationResult;
    noNegativeMass: { passed: boolean; violations: string[] };
    positionBinding: { passed: boolean; violations: string[] };
    weldBinding: { passed: boolean; violations: string[] };
    volumeConstraints: { passed: boolean; violations: string[] };
    noCircularContainment: { passed: boolean; violations: string[] };
    noCircularWeld: { passed: boolean; violations: string[] };
    tickAdvanced: boolean;
    summary: string;
}

/**
 * runs all standard invariant checks between two states.
 */
export function checkAllInvariants(
    before: GameState,
    after: GameState,
    allowedMassLoss: FP = 0
): InvariantCheckResult {
    const massConservation = assertMassConservation(before, after, allowedMassLoss);
    const noNegativeMass = assertNoNegativeMass(after);
    const positionBinding = assertPositionBinding(after);
    const weldBinding = assertWeldBinding(after);
    const volumeConstraints = assertVolumeConstraints(after);
    const noCircularContainment = assertNoCircularContainment(after);
    const noCircularWeld = assertNoCircularWeld(after);
    const tickAdvanced = assertTickAdvanced(before, after);

    const passed = 
        massConservation.passed && 
        noNegativeMass.passed && 
        positionBinding.passed &&
        weldBinding.passed &&
        volumeConstraints.passed &&
        noCircularContainment.passed &&
        noCircularWeld.passed &&
        tickAdvanced;

    const issues: string[] = [];
    if (!massConservation.passed) issues.push('Mass conservation failed');
    if (!noNegativeMass.passed) issues.push('Negative mass detected');
    if (!positionBinding.passed) issues.push('Position binding violated');
    if (!weldBinding.passed) issues.push('Weld binding violated');
    if (!volumeConstraints.passed) issues.push('Volume constraints violated');
    if (!noCircularContainment.passed) issues.push('Circular containment detected');
    if (!noCircularWeld.passed) issues.push('Circular weld detected');
    if (!tickAdvanced) issues.push('Tick did not advance');

    return {
        passed,
        massConservation,
        noNegativeMass,
        positionBinding,
        weldBinding,
        volumeConstraints,
        noCircularContainment,
        noCircularWeld,
        tickAdvanced,
        summary: passed ? 'All invariants passed' : `Failures: ${issues.join(', ')}`,
    };
}
