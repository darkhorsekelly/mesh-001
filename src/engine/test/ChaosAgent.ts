// ===============================================
// CHAOS AGENT
// ===============================================
// deterministic random action generator for stress testing.
// given an entity and game state, generates plausible actions
// using a seeded RNG for 100% reproducibility.
//
// ARCHITECTURAL NOTE: this is a CONSUMER of the engine, not part of it.
// it does not modify entity types or the tick resolver.

import type { Entity } from '../primitive-types/semantic/entity/entity-types.js';
import type { GameState } from '../state-types/state-types.js';
import type { Action, ActionType } from '../primitive-types/semantic/action/action-types.js';
import type { FP, Vector2FP } from '../primitive-types/euclidean/euclidean-types.js';
import { SeededRNG } from '../genesis/genesisService.js';
import { toFP, fpDistanceSquared, fpMul } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Action Capability Checks
// -----------------------------------------------
// determines what actions an entity CAN perform based on its properties.

export interface ActionCapabilities {
    canThrust: boolean;
    canExtractVolatiles: boolean;
    canExtractMinerals: boolean;
    canRefine: boolean;
    canSealAirlock: boolean;
    canUnsealAirlock: boolean;
    canLoad: boolean;
    canUnload: boolean;
    canWeld: boolean;
    canUnweld: boolean;
}

/**
 * analyzes an entity's properties to determine what actions it can perform.
 */
export function getCapabilities(entity: Entity, state: GameState): ActionCapabilities {
    // find nearby resource wells within reach
    const nearbyWells = findNearbyResourceWells(entity, state);
    const hasVolatilesInReach = nearbyWells.some(w => w.volatilesMass > 0);
    const hasMineralsInReach = nearbyWells.some(w => w.mass > 0);

    // find loadable content (mineral stores) and containers in reach
    const loadableContent = findLoadableContent(entity, state);
    const nearbyContainers = findNearbyContainers(entity, state);
    const containedItems = findContainedItems(entity, state);

    // find weldable entities and welded children
    const weldableEntities = findWeldableEntities(entity, state);
    const weldedChildren = findWeldedChildren(entity, state);

    return {
        // thrust requires fuel
        canThrust: entity.fuelMass > 0,

        // extract requires reach and nearby wells with resources
        canExtractVolatiles: entity.reach > 0 && hasVolatilesInReach,
        canExtractMinerals: entity.reach > 0 && hasMineralsInReach,

        // refine requires volatiles on board
        canRefine: entity.volatilesMass > 0,

        // airlock operations
        canSealAirlock: !entity.airlockSealed,
        canUnsealAirlock: entity.airlockSealed,

        // load requires: actor has reach, nearby loadable content, and a container
        canLoad: entity.reach > 0 && 
                 loadableContent.length > 0 && 
                 (nearbyContainers.length > 0 || entity.isContainer === true),

        // unload requires: being a container with contents OR having container in reach with contents
        canUnload: containedItems.length > 0,

        // weld requires: reach, sealed airlock, not already welded, nearby weldable entities
        canWeld: entity.reach > 0 && 
                 entity.airlockSealed && 
                 entity.weldParentId === undefined &&
                 weldableEntities.length > 0,

        // unweld requires: has welded children
        canUnweld: weldedChildren.length > 0,
    };
}

/**
 * finds resource wells within an entity's reach.
 */
export function findNearbyResourceWells(entity: Entity, state: GameState): Entity[] {
    if (entity.reach <= 0) return [];

    const reachSquared = fpMul(entity.reach, entity.reach);

    return state.entities.filter(other => {
        if (other.type !== 'RESOURCE_WELL') return false;
        if (other.id === entity.id) return false;

        const distSquared = fpDistanceSquared(entity.position, other.position);
        return distSquared <= reachSquared;
    });
}

/**
 * finds loadable content (mineral stores, not already contained) within reach.
 */
export function findLoadableContent(entity: Entity, state: GameState): Entity[] {
    if (entity.reach <= 0) return [];

    const reachSquared = fpMul(entity.reach, entity.reach);

    return state.entities.filter(other => {
        // only mineral stores are loadable cargo
        if (other.type !== 'MINERAL_STORE') return false;
        // cannot load self
        if (other.id === entity.id) return false;
        // cannot load already-contained entities
        if (other.parentId !== undefined) return false;

        const distSquared = fpDistanceSquared(entity.position, other.position);
        return distSquared <= reachSquared;
    });
}

/**
 * finds containers within an entity's reach.
 */
export function findNearbyContainers(entity: Entity, state: GameState): Entity[] {
    if (entity.reach <= 0) return [];

    const reachSquared = fpMul(entity.reach, entity.reach);

    return state.entities.filter(other => {
        if (!other.isContainer) return false;
        if (other.id === entity.id) return false;

        const distSquared = fpDistanceSquared(entity.position, other.position);
        return distSquared <= reachSquared;
    });
}

/**
 * finds items contained by the entity or by containers within reach.
 */
export function findContainedItems(entity: Entity, state: GameState): Entity[] {
    const items: Entity[] = [];

    // items in self (if actor is a container)
    if (entity.isContainer) {
        for (const other of state.entities) {
            if (other.parentId === entity.id) {
                items.push(other);
            }
        }
    }

    // items in nearby containers
    if (entity.reach > 0) {
        const reachSquared = fpMul(entity.reach, entity.reach);
        
        for (const container of state.entities) {
            if (!container.isContainer) continue;
            if (container.id === entity.id) continue;

            const distSquared = fpDistanceSquared(entity.position, container.position);
            if (distSquared > reachSquared) continue;

            // find items in this container
            for (const other of state.entities) {
                if (other.parentId === container.id) {
                    items.push(other);
                }
            }
        }
    }

    return items;
}

/**
 * finds entities within reach that can be welded.
 * excludes: self, celestials (RESOURCE_WELL), already welded entities, contained entities.
 */
export function findWeldableEntities(entity: Entity, state: GameState): Entity[] {
    if (entity.reach <= 0) return [];

    const reachSquared = fpMul(entity.reach, entity.reach);

    return state.entities.filter(other => {
        // cannot weld to self
        if (other.id === entity.id) return false;
        // cannot weld celestials
        if (other.type === 'RESOURCE_WELL') return false;
        // cannot weld already-welded entities
        if (other.weldParentId !== undefined) return false;
        // cannot weld contained entities
        if (other.parentId !== undefined) return false;

        const distSquared = fpDistanceSquared(entity.position, other.position);
        return distSquared <= reachSquared;
    });
}

/**
 * finds entities welded to this entity.
 */
export function findWeldedChildren(entity: Entity, state: GameState): Entity[] {
    return state.entities.filter(other => other.weldParentId === entity.id);
}

/**
 * checks if two entities have been "traveling together" - similar velocities.
 * used as a heuristic for when ChaosAgent should attempt to weld.
 * 
 * velocities are considered similar if each component differs by less than 10%.
 */
function areTravelingTogether(entityA: Entity, entityB: Entity): boolean {
    const threshold = toFP(100); // 0.1 in FP (scaled by 1000)
    
    const vxDiff = Math.abs(entityA.velocity.x - entityB.velocity.x);
    const vyDiff = Math.abs(entityA.velocity.y - entityB.velocity.y);
    
    // calculate relative difference
    const avgVx = (Math.abs(entityA.velocity.x) + Math.abs(entityB.velocity.x)) / 2;
    const avgVy = (Math.abs(entityA.velocity.y) + Math.abs(entityB.velocity.y)) / 2;
    
    // if both velocities are very small, consider them traveling together
    if (avgVx < threshold && avgVy < threshold) {
        return vxDiff < threshold && vyDiff < threshold;
    }
    
    // otherwise check relative difference
    const relDiffX = avgVx > 0 ? vxDiff / avgVx : 0;
    const relDiffY = avgVy > 0 ? vyDiff / avgVy : 0;
    
    return relDiffX < 0.1 && relDiffY < 0.1;
}

// -----------------------------------------------
// Action Generators
// -----------------------------------------------
// each function generates a specific action type with random parameters.

function generateThrustAction(
    entity: Entity,
    rng: SeededRNG
): Action {
    // random heading change or use current heading
    const useCurrentHeading = rng.nextBool(0.7);
    
    // generate thrust magnitude (up to half remaining fuel)
    const maxMagnitude = Math.min(entity.fuelMass / 2, toFP(50));
    const magnitude = rng.nextFP(toFP(1), maxMagnitude as FP);

    // calculate direction from heading
    const heading = useCurrentHeading 
        ? entity.heading 
        : rng.nextAngle();

    const radians = (heading / 1000) * (Math.PI / 180);
    const direction: Vector2FP = {
        x: toFP(Math.cos(radians)),
        y: toFP(Math.sin(radians)),
    };

    return {
        type: 'THRUST',
        entityId: entity.id,
        direction,
        magnitude,
    };
}

function generateExtractVolatilesAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    const wells = findNearbyResourceWells(entity, state)
        .filter(w => w.volatilesMass > 0);

    const targetWell = rng.pick(wells);
    if (!targetWell) return null;

    // random extraction rate (1-500 FP units)
    const maxRate = Math.min(targetWell.volatilesMass, toFP(500));
    const rate = rng.nextFP(toFP(1), maxRate as FP);

    return {
        type: 'EXTRACT',
        entityId: entity.id,
        resourceType: 'VOLATILES',
        originIds: [targetWell.id],
        rate,
    };
}

function generateExtractMineralsAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    const wells = findNearbyResourceWells(entity, state)
        .filter(w => w.mass > 0);

    const targetWell = rng.pick(wells);
    if (!targetWell) return null;

    // random extraction rate
    const maxRate = Math.min(targetWell.mass, toFP(500));
    const rate = rng.nextFP(toFP(1), maxRate as FP);

    // random target position near entity
    const offsetX = rng.nextFP(toFP(-100), toFP(100));
    const offsetY = rng.nextFP(toFP(-100), toFP(100));
    const targetPosition: Vector2FP = {
        x: (entity.position.x + offsetX) as FP,
        y: (entity.position.y + offsetY) as FP,
    };

    return {
        type: 'EXTRACT',
        entityId: entity.id,
        resourceType: 'MINERALS',
        originIds: [targetWell.id],
        mineralTargetPosition: [targetPosition],
        rate,
    };
}

function generateRefineAction(
    entity: Entity,
    rng: SeededRNG
): Action | null {
    if (entity.volatilesMass <= 0) return null;

    // refine between 10% and 50% of available volatiles
    const minAmount = Math.max(toFP(1), Math.floor(entity.volatilesMass * 0.1));
    const maxAmount = Math.floor(entity.volatilesMass * 0.5);
    
    if (maxAmount <= minAmount) {
        return {
            type: 'REFINE',
            entityId: entity.id,
            inputType: 'VOLATILES',
            volatilesTargetIds: [entity.id],
            fuelTargetIds: [entity.id],
            volatilesAmount: entity.volatilesMass,
        };
    }

    const amount = rng.nextFP(minAmount as FP, maxAmount as FP);

    return {
        type: 'REFINE',
        entityId: entity.id,
        inputType: 'VOLATILES',
        volatilesTargetIds: [entity.id],
        fuelTargetIds: [entity.id],
        volatilesAmount: amount,
    };
}

function generateSealAirlockAction(entity: Entity): Action {
    return {
        type: 'SEAL_AIRLOCK',
        entityId: entity.id,
    };
}

function generateUnsealAirlockAction(entity: Entity): Action {
    return {
        type: 'UNSEAL_AIRLOCK',
        entityId: entity.id,
    };
}

/**
 * generates a LOAD action to pick up mineral stores.
 * industrial clean-up: prioritizes finding loose mineral stores and loading them.
 */
function generateLoadAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    // find loadable content
    const loadableContent = findLoadableContent(entity, state);
    if (loadableContent.length === 0) return null;

    // find available containers (self or nearby)
    const containers: Entity[] = [];
    if (entity.isContainer && entity.containerVolume && entity.containerVolume > 0) {
        containers.push(entity);
    }
    containers.push(...findNearbyContainers(entity, state));

    if (containers.length === 0) return null;

    // pick a container
    const container = rng.pick(containers);
    if (!container) return null;

    // pick one or more content items to load
    // prioritize loading just one item at a time for simplicity
    const content = rng.pick(loadableContent);
    if (!content) return null;

    // basic volume check
    if (container.containerVolume && content.volume > container.containerVolume) {
        return null;
    }

    return {
        type: 'LOAD',
        entityId: entity.id,
        contentIds: [content.id],
        containerIds: [container.id],
    };
}

/**
 * generates an UNLOAD action to release cargo at a random position.
 * stochastic logistics: occasionally releases contained items.
 */
function generateUnloadAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    // find contained items
    const containedItems = findContainedItems(entity, state);
    if (containedItems.length === 0) return null;

    // pick an item to unload
    const content = rng.pick(containedItems);
    if (!content) return null;

    // generate a random position nearby
    const offsetX = rng.nextFP(toFP(-200), toFP(200));
    const offsetY = rng.nextFP(toFP(-200), toFP(200));
    const newPosition: Vector2FP = {
        x: (entity.position.x + offsetX) as FP,
        y: (entity.position.y + offsetY) as FP,
    };

    return {
        type: 'UNLOAD',
        entityId: entity.id,
        contentIds: [content.id],
        newPositions: [newPosition],
    };
}

/**
 * generates a WELD action to fuse with a nearby entity.
 * structural fusion: prioritizes entities traveling with similar velocities
 * (heuristic for "traveling together for more than 5 ticks").
 */
function generateWeldAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    // find weldable entities
    const weldableEntities = findWeldableEntities(entity, state);
    if (weldableEntities.length === 0) return null;

    // prioritize entities traveling together (similar velocities)
    // this serves as a heuristic for "traveling together for 5+ ticks"
    const travelingTogether = weldableEntities.filter(
        other => areTravelingTogether(entity, other)
    );

    // if we have entities traveling together, prefer them
    // otherwise, have a small chance (5%) to weld any nearby entity
    let target: Entity | undefined;
    
    if (travelingTogether.length > 0) {
        target = rng.pick(travelingTogether);
    } else if (rng.nextBool(0.05)) {
        // rare opportunistic weld
        target = rng.pick(weldableEntities);
    }

    if (!target) return null;

    return {
        type: 'WELD',
        entityId: entity.id,
        targetIds: [target.id],
    };
}

/**
 * generates an UNWELD action to separate a welded entity.
 * structural separation: releases welded children.
 */
function generateUnweldAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    // find entities welded to this entity
    const weldedChildren = findWeldedChildren(entity, state);
    if (weldedChildren.length === 0) return null;

    // pick a child to unweld
    const target = rng.pick(weldedChildren);
    if (!target) return null;

    return {
        type: 'UNWELD',
        entityId: entity.id,
        targetIds: [target.id],
    };
}

// -----------------------------------------------
// Main Chaos Agent Function
// -----------------------------------------------

/**
 * list of action types the chaos agent can generate.
 * as handlers are implemented, add them here.
 */
const IMPLEMENTED_ACTIONS: ActionType[] = [
    'THRUST',
    'EXTRACT',
    'REFINE',
    'SEAL_AIRLOCK',
    'UNSEAL_AIRLOCK',
    'LOAD',
    'UNLOAD',
    'WELD',
    'UNWELD',
];

/**
 * generates a random action for an entity based on its capabilities.
 * returns null if the entity cannot perform any action.
 * 
 * the action choice, target, and parameters are 100% deterministic
 * based on the RNG state.
 */
export function generateRandomAction(
    entity: Entity,
    state: GameState,
    rng: SeededRNG
): Action | null {
    // skip non-player entities (resource wells don't act)
    if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
        return null;
    }

    // determine what this entity can do
    const capabilities = getCapabilities(entity, state);

    // build list of possible actions
    const possibleActions: ActionType[] = [];

    if (capabilities.canThrust) {
        possibleActions.push('THRUST');
    }
    if (capabilities.canExtractVolatiles) {
        possibleActions.push('EXTRACT');
    }
    if (capabilities.canRefine) {
        possibleActions.push('REFINE');
    }
    if (capabilities.canSealAirlock) {
        possibleActions.push('SEAL_AIRLOCK');
    }
    if (capabilities.canUnsealAirlock) {
        possibleActions.push('UNSEAL_AIRLOCK');
    }
    if (capabilities.canLoad) {
        possibleActions.push('LOAD');
    }
    if (capabilities.canUnload) {
        possibleActions.push('UNLOAD');
    }
    if (capabilities.canWeld) {
        possibleActions.push('WELD');
    }
    if (capabilities.canUnweld) {
        possibleActions.push('UNWELD');
    }

    // filter to only implemented actions
    const availableActions = possibleActions.filter(a => 
        IMPLEMENTED_ACTIONS.includes(a)
    );

    if (availableActions.length === 0) {
        return null;
    }

    // randomly choose an action type
    const chosenType = rng.pick(availableActions);
    if (!chosenType) return null;

    // generate the specific action
    switch (chosenType) {
        case 'THRUST':
            return generateThrustAction(entity, rng);

        case 'EXTRACT':
            // randomly choose between volatiles and minerals if both available
            if (capabilities.canExtractVolatiles && capabilities.canExtractMinerals) {
                return rng.nextBool(0.7)
                    ? generateExtractVolatilesAction(entity, state, rng)
                    : generateExtractMineralsAction(entity, state, rng);
            }
            if (capabilities.canExtractVolatiles) {
                return generateExtractVolatilesAction(entity, state, rng);
            }
            if (capabilities.canExtractMinerals) {
                return generateExtractMineralsAction(entity, state, rng);
            }
            return null;

        case 'REFINE':
            return generateRefineAction(entity, rng);

        case 'SEAL_AIRLOCK':
            return generateSealAirlockAction(entity);

        case 'UNSEAL_AIRLOCK':
            return generateUnsealAirlockAction(entity);

        case 'LOAD':
            return generateLoadAction(entity, state, rng);

        case 'UNLOAD':
            return generateUnloadAction(entity, state, rng);

        case 'WELD':
            return generateWeldAction(entity, state, rng);

        case 'UNWELD':
            return generateUnweldAction(entity, state, rng);

        default:
            return null;
    }
}

// -----------------------------------------------
// Batch Action Generation
// -----------------------------------------------

export interface ChaosRoundResult {
    actions: Action[];
    entitiesProcessed: number;
    actionsGenerated: number;
}

/**
 * generates actions for all eligible entities in the game state.
 * each entity has a chance to act based on the activity probability.
 */
export function generateRoundActions(
    state: GameState,
    rng: SeededRNG,
    activityProbability: number = 0.5
): ChaosRoundResult {
    const actions: Action[] = [];
    let entitiesProcessed = 0;

    for (const entity of state.entities) {
        entitiesProcessed++;

        // skip inactive entities this round
        if (!rng.nextBool(activityProbability)) {
            continue;
        }

        const action = generateRandomAction(entity, state, rng);
        if (action) {
            actions.push(action);
        }
    }

    return {
        actions,
        entitiesProcessed,
        actionsGenerated: actions.length,
    };
}

// ===============================================
// STRATEGIST MODE - Action Chain Generation
// ===============================================
// instead of generating single actions, the strategist generates
// multi-step action chains that test wave-based interleaving.
//
// example chains:
// - [EXTRACT, LOAD, THRUST] - gather and go
// - [SEAL_AIRLOCK, WELD, THRUST] - secure and maneuver
// - [REFINE, THRUST, THRUST] - fuel up and burn

/**
 * predefined action chain patterns for strategist mode.
 * each pattern is a sequence of action types that form a logical workflow.
 */
export type ChainPattern = ActionType[];

export const CHAIN_PATTERNS: ChainPattern[] = [
    // gather and go: extract resources, load them, move
    ['EXTRACT', 'LOAD', 'THRUST'],
    
    // fuel cycle: extract volatiles, refine to fuel, thrust
    ['EXTRACT', 'REFINE', 'THRUST'],
    
    // structural maneuver: seal airlock, weld, thrust as unit
    ['SEAL_AIRLOCK', 'WELD', 'THRUST'],
    
    // separation maneuver: unweld, thrust away
    ['UNWELD', 'THRUST'],
    
    // double burn: two thrusts in sequence
    ['THRUST', 'THRUST'],
    
    // logistics: load, thrust, unload
    ['LOAD', 'THRUST', 'UNLOAD'],
    
    // refuel cycle: extract, refine, refine more
    ['EXTRACT', 'REFINE', 'REFINE'],
    
    // airlock dance: seal, do work, unseal
    ['SEAL_AIRLOCK', 'WELD', 'UNSEAL_AIRLOCK'],
];

export interface ActionChain {
    // the entity performing the chain
    entityId: string;
    
    // the actions in order (with orderIndex set)
    actions: Action[];
    
    // the pattern this chain was based on
    pattern: ChainPattern;
}

export interface StrategistRoundResult {
    // all action chains generated this round
    chains: ActionChain[];
    
    // flattened actions with orderIndex for tick resolution
    allActions: Action[];
    
    // metrics
    entitiesProcessed: number;
    chainsGenerated: number;
    totalActionsGenerated: number;
}

/**
 * attempts to generate an action chain for an entity following a pattern.
 * returns null if the entity cannot complete the pattern.
 * 
 * the chain is generated optimistically - we try each step assuming
 * the previous step succeeded. this tests the wave interleaving logic.
 */
function generateChainForPattern(
    entity: Entity,
    state: GameState,
    pattern: ChainPattern,
    rng: SeededRNG
): ActionChain | null {
    const actions: Action[] = [];
    let currentEntity = entity;
    let currentState = state;
    
    for (let i = 0; i < pattern.length; i++) {
        const actionType = pattern[i];
        
        // check if entity can perform this action type
        const capabilities = getCapabilities(currentEntity, currentState);
        
        // generate the action based on type
        let action: Action | null = null;
        
        switch (actionType) {
            case 'THRUST':
                if (capabilities.canThrust) {
                    action = generateThrustAction(currentEntity, rng);
                }
                break;
                
            case 'EXTRACT':
                if (capabilities.canExtractVolatiles) {
                    action = generateExtractVolatilesAction(currentEntity, currentState, rng);
                } else if (capabilities.canExtractMinerals) {
                    action = generateExtractMineralsAction(currentEntity, currentState, rng);
                }
                break;
                
            case 'REFINE':
                if (capabilities.canRefine) {
                    action = generateRefineAction(currentEntity, rng);
                }
                break;
                
            case 'SEAL_AIRLOCK':
                if (capabilities.canSealAirlock) {
                    action = generateSealAirlockAction(currentEntity);
                }
                break;
                
            case 'UNSEAL_AIRLOCK':
                if (capabilities.canUnsealAirlock) {
                    action = generateUnsealAirlockAction(currentEntity);
                }
                break;
                
            case 'LOAD':
                if (capabilities.canLoad) {
                    action = generateLoadAction(currentEntity, currentState, rng);
                }
                break;
                
            case 'UNLOAD':
                if (capabilities.canUnload) {
                    action = generateUnloadAction(currentEntity, currentState, rng);
                }
                break;
                
            case 'WELD':
                if (capabilities.canWeld) {
                    action = generateWeldAction(currentEntity, currentState, rng);
                }
                break;
                
            case 'UNWELD':
                if (capabilities.canUnweld) {
                    action = generateUnweldAction(currentEntity, currentState, rng);
                }
                break;
        }
        
        if (!action) {
            // cannot complete this step - abort the chain
            // but return partial chain if we generated at least one action
            if (actions.length > 0) {
                return {
                    entityId: entity.id,
                    actions,
                    pattern: pattern.slice(0, actions.length),
                };
            }
            return null;
        }
        
        // set orderIndex for wave-based processing
        action.orderIndex = i;
        actions.push(action);
        
        // optimistically update state for next step
        // this simulates what the entity "expects" to happen
        // note: we don't actually run the action, just assume it succeeds
        currentEntity = simulateActionEffect(currentEntity, action);
    }
    
    return {
        entityId: entity.id,
        actions,
        pattern,
    };
}

/**
 * simulates the effect of an action on an entity for chain planning.
 * this is a rough approximation - the real resolution happens in the tick.
 */
function simulateActionEffect(entity: Entity, action: Action): Entity {
    switch (action.type) {
        case 'SEAL_AIRLOCK':
            return { ...entity, airlockSealed: true };
            
        case 'UNSEAL_AIRLOCK':
            return { ...entity, airlockSealed: false };
            
        case 'THRUST':
            // assume some fuel is consumed
            return { 
                ...entity, 
                fuelMass: Math.max(0, entity.fuelMass - toFP(10)) as FP,
            };
            
        case 'REFINE':
            // assume volatiles converted to fuel
            return { 
                ...entity, 
                volatilesMass: Math.max(0, entity.volatilesMass - toFP(100)) as FP,
                fuelMass: (entity.fuelMass + toFP(80)) as FP,
            };
            
        case 'EXTRACT':
            // assume volatiles extracted
            return { 
                ...entity, 
                volatilesMass: (entity.volatilesMass + toFP(100)) as FP,
            };
            
        default:
            return entity;
    }
}

/**
 * generates action chains for all eligible entities using strategist mode.
 * each entity attempts to execute a random pattern from CHAIN_PATTERNS.
 */
export function generateStrategistRound(
    state: GameState,
    rng: SeededRNG,
    activityProbability: number = 0.5,
    maxChainDepth: number = 3
): StrategistRoundResult {
    const chains: ActionChain[] = [];
    const allActions: Action[] = [];
    let entitiesProcessed = 0;
    
    for (const entity of state.entities) {
        entitiesProcessed++;
        
        // skip non-player entities
        if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
            continue;
        }
        
        // skip inactive entities this round
        if (!rng.nextBool(activityProbability)) {
            continue;
        }
        
        // pick a random pattern
        const pattern = rng.pick(CHAIN_PATTERNS);
        if (!pattern) continue;
        
        // limit chain depth
        const limitedPattern = pattern.slice(0, maxChainDepth);
        
        // try to generate a chain for this pattern
        const chain = generateChainForPattern(entity, state, limitedPattern, rng);
        
        if (chain && chain.actions.length > 0) {
            chains.push(chain);
            allActions.push(...chain.actions);
        }
    }
    
    return {
        chains,
        allActions,
        entitiesProcessed,
        chainsGenerated: chains.length,
        totalActionsGenerated: allActions.length,
    };
}

/**
 * generates deep action chains for stress testing wave interleaving.
 * each entity generates chains up to maxDepth, pushing the settlement logic.
 */
export function generateDeepChainRound(
    state: GameState,
    rng: SeededRNG,
    maxDepth: number = 5
): StrategistRoundResult {
    const chains: ActionChain[] = [];
    const allActions: Action[] = [];
    let entitiesProcessed = 0;
    
    for (const entity of state.entities) {
        entitiesProcessed++;
        
        // skip non-player entities
        if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
            continue;
        }
        
        // generate a chain of random actions up to maxDepth
        const chainActions: Action[] = [];
        let currentEntity = entity;
        let currentState = state;
        
        for (let depth = 0; depth < maxDepth; depth++) {
            const action = generateRandomAction(currentEntity, currentState, rng);
            if (!action) break;
            
            action.orderIndex = depth;
            chainActions.push(action);
            
            // simulate for next iteration
            currentEntity = simulateActionEffect(currentEntity, action);
        }
        
        if (chainActions.length > 0) {
            chains.push({
                entityId: entity.id,
                actions: chainActions,
                pattern: chainActions.map(a => a!.type) as ChainPattern,
            });
            allActions.push(...chainActions);
        }
    }
    
    return {
        chains,
        allActions,
        entitiesProcessed,
        chainsGenerated: chains.length,
        totalActionsGenerated: allActions.length,
    };
}

// ===============================================
// RESOURCE RUSH MODE - Stalemate Stress Testing
// ===============================================
// this mode intentionally creates contested scenarios to stress-test
// the stalemate logic. multiple agents rush for the same resources
// to verify that the conflict cluster resolver correctly voids
// contested clusters instead of picking arbitrary winners.

export interface ResourceRushResult {
    // all actions generated for the rush
    actions: Action[];
    
    // targets that were contested by multiple entities
    contestedTargets: string[];
    
    // expected stalemate count (for test assertions)
    expectedStalemateCount: number;
    
    // metrics
    rushersGenerated: number;
    actionsPerTarget: Map<string, number>;
}

/**
 * finds all MINERAL_STORE entities that can be loaded.
 * these are prime targets for resource rush scenarios.
 */
function findContestableResources(state: GameState): Entity[] {
    return state.entities.filter(e => 
        e.type === 'MINERAL_STORE' && 
        e.parentId === undefined  // not already contained
    );
}

/**
 * finds all entities that can reach a specific target.
 * used to identify potential contestants for a resource.
 */
function findEntitiesThatCanReach(
    targetId: string,
    state: GameState
): Entity[] {
    const target = state.entities.find(e => e.id === targetId);
    if (!target) return [];
    
    return state.entities.filter(entity => {
        // skip non-player entities
        if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
            return false;
        }
        // skip the target itself
        if (entity.id === targetId) return false;
        // must have reach
        if (entity.reach <= 0) return false;
        // must be a container
        if (!entity.isContainer) return false;
        
        // check if in reach
        const distSquared = fpDistanceSquared(entity.position, target.position);
        const reachSquared = fpMul(entity.reach, entity.reach);
        return distSquared <= reachSquared;
    });
}

/**
 * generates a LOAD action for an entity targeting a specific mineral store.
 */
function generateLoadActionForTarget(
    entity: Entity,
    targetId: string,
    playerId: string,
    orderIndex: number = 0
): Action {
    return {
        type: 'LOAD',
        entityId: entity.id,
        contentIds: [targetId],
        containerIds: [entity.id],
        playerId,
        orderIndex,
    };
}

/**
 * AGGRESSIVE RESOURCE RUSH MODE
 * 
 * this function intentionally creates scenarios where multiple agents
 * all try to LOAD the same MINERAL_STORE entities in Wave 0.
 * 
 * purpose: verify that the STALEMATE logic correctly voids these
 * contested clusters instead of allowing arbitrary winners.
 * 
 * usage in tests:
 * ```typescript
 * const rush = generateResourceRush(state, rng, { minContestants: 2 });
 * const result = runTick(state, rush.actions);
 * 
 * // verify stalemate logic worked
 * for (const targetId of rush.contestedTargets) {
 *     const mineral = findEntity(result.nextState, targetId);
 *     expect(mineral?.parentId).toBeUndefined(); // should NOT be loaded
 * }
 * ```
 */
export function generateResourceRush(
    state: GameState,
    rng: SeededRNG,
    options: {
        // minimum entities that must contest a resource (default: 2)
        minContestants?: number;
        // maximum targets to contest (default: all available)
        maxTargets?: number;
        // whether to add padding actions (non-contested) for realism
        addPaddingActions?: boolean;
    } = {}
): ResourceRushResult {
    const {
        minContestants = 2,
        maxTargets = Infinity,
        addPaddingActions = false,
    } = options;
    
    const actions: Action[] = [];
    const contestedTargets: string[] = [];
    const actionsPerTarget = new Map<string, number>();
    let rushersGenerated = 0;
    
    // find all contestable resources
    const resources = findContestableResources(state);
    
    // shuffle resources for variety
    const shuffledResources = [...resources].sort(() => rng.next() - 0.5);
    
    // process each resource up to maxTargets
    let processedTargets = 0;
    
    for (const resource of shuffledResources) {
        if (processedTargets >= maxTargets) break;
        
        // find all entities that can reach this resource
        const contestants = findEntitiesThatCanReach(resource.id, state);
        
        // skip if not enough contestants
        if (contestants.length < minContestants) continue;
        
        processedTargets++;
        contestedTargets.push(resource.id);
        actionsPerTarget.set(resource.id, contestants.length);
        
        // generate LOAD actions for ALL contestants targeting this resource
        // this deliberately creates a stalemate scenario
        for (let i = 0; i < contestants.length; i++) {
            const contestant = contestants[i]!;
            const playerId = contestant.playerId ?? `player-${i}`;
            
            const loadAction = generateLoadActionForTarget(
                contestant,
                resource.id,
                playerId,
                0  // all in Wave 0 for maximum contention
            );
            
            actions.push(loadAction);
            rushersGenerated++;
        }
    }
    
    // optionally add padding actions that don't contest anything
    if (addPaddingActions) {
        for (const entity of state.entities) {
            if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
                continue;
            }
            
            // 20% chance to add a non-contested action
            if (rng.nextBool(0.2)) {
                const capabilities = getCapabilities(entity, state);
                
                // prefer actions that don't involve contested resources
                if (capabilities.canThrust) {
                    actions.push(generateThrustAction(entity, rng));
                } else if (capabilities.canSealAirlock) {
                    actions.push(generateSealAirlockAction(entity));
                } else if (capabilities.canUnsealAirlock) {
                    actions.push(generateUnsealAirlockAction(entity));
                }
            }
        }
    }
    
    return {
        actions,
        contestedTargets,
        expectedStalemateCount: contestedTargets.length,
        rushersGenerated,
        actionsPerTarget,
    };
}

/**
 * WELD CONTENTION MODE
 * 
 * creates scenarios where multiple entities try to WELD to the same target.
 * since only one entity can be welded at a time, this should trigger stalemates.
 */
export function generateWeldContention(
    state: GameState,
    rng: SeededRNG,
    options: {
        minContestants?: number;
        maxTargets?: number;
    } = {}
): ResourceRushResult {
    const {
        minContestants = 2,
        maxTargets = Infinity,
    } = options;
    
    const actions: Action[] = [];
    const contestedTargets: string[] = [];
    const actionsPerTarget = new Map<string, number>();
    let rushersGenerated = 0;
    
    // find all weldable targets (entities without weldParentId)
    const weldableTargets = state.entities.filter(e => 
        e.type !== 'RESOURCE_WELL' &&
        e.weldParentId === undefined &&
        e.parentId === undefined
    );
    
    // shuffle for variety
    const shuffledTargets = [...weldableTargets].sort(() => rng.next() - 0.5);
    
    let processedTargets = 0;
    
    for (const target of shuffledTargets) {
        if (processedTargets >= maxTargets) break;
        
        // find entities that can weld to this target
        const welders = state.entities.filter(entity => {
            if (entity.type === 'RESOURCE_WELL' || entity.type === 'MINERAL_STORE') {
                return false;
            }
            if (entity.id === target.id) return false;
            if (entity.reach <= 0) return false;
            if (!entity.airlockSealed) return false;
            if (entity.weldParentId !== undefined) return false;
            
            const distSquared = fpDistanceSquared(entity.position, target.position);
            const reachSquared = fpMul(entity.reach, entity.reach);
            return distSquared <= reachSquared;
        });
        
        if (welders.length < minContestants) continue;
        
        processedTargets++;
        contestedTargets.push(target.id);
        actionsPerTarget.set(target.id, welders.length);
        
        // generate WELD actions for all welders targeting this entity
        for (let i = 0; i < welders.length; i++) {
            const welder = welders[i]!;
            const playerId = welder.playerId ?? `player-${i}`;
            
            const weldAction: Action = {
                type: 'WELD',
                entityId: welder.id,
                targetIds: [target.id],
                playerId,
                orderIndex: 0,
            };
            
            actions.push(weldAction);
            rushersGenerated++;
        }
    }
    
    return {
        actions,
        contestedTargets,
        expectedStalemateCount: contestedTargets.length,
        rushersGenerated,
        actionsPerTarget,
    };
}
