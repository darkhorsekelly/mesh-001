// ===============================================
// CONFLICT CLUSTER RESOLVER
// ===============================================
// Implements the "Unified Intent Theory" - a simultaneous constraint solver
// that maximizes player success by finding optimal action orderings.
//
// PHILOSOPHY:
// In a game where you act once every 24 hours, having your action fail
// because of an arbitrary ID sort is a player-retention disaster.
// Having it fail because you and another player entered a non-solvable physical
// stalemate over the same resource is a STORY.
//
// STALEMATE-FIRST ALGORITHM:
// 1. Cluster Identification: Group entangled actions
// 2. Mutual Exclusion Check: BEFORE permuting, detect stalemates
// 3. If stalemate found: Void ENTIRE cluster (no arbitrary winners)
// 4. If no stalemate: Find optimal order via permutation search
//
// ENTANGLEMENT RULES:
// - Shared Targets: Multiple actions target the same entity
// - Actor-Target Duality: An entity acts while being targeted
// - Containment/Weld Chains: Action targets child while another targets parent
// - Resource Contention: Multiple actions target same resource store
//
// STALEMATE EXAMPLES:
// - Two players LOAD the same MINERAL_STORE -> STALEMATE (neither wins)
// - One player WELDs while another UNWELDs same joint -> STALEMATE
// - WELD then THRUST -> NOT stalemate (solvable order: WELD first, then THRUST)

import type { GameState } from '../../state-types/state-types.js';
import type { Action, ActionType } from '../../primitive-types/semantic/action/action-types.js';
import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { TickContext, ActionValidator, ActionHandler } from '../../resolvers/actions/actionTypes.js';
import { actionRegistry } from '../../resolvers/actions/actionRegistry.js';

// -----------------------------------------------
// Types
// -----------------------------------------------

export interface ClusterResolutionResult {
    // the chosen execution order (may be empty if all voided)
    executionOrder: Action[];
    
    // actions that were voided due to stalemate
    voidedActions: Action[];
    
    // whether a stalemate occurred
    isStalemate: boolean;
    
    // diagnostic info for each action
    actionResults: ActionResolutionResult[];
}

export interface ActionResolutionResult {
    action: Action;
    valid: boolean;
    voidReason?: 'STALEMATE' | 'INVALID' | 'DEPENDENCY_FAILED';
}

export interface WaveResolutionMetrics {
    // number of conflict clusters identified
    clusterCount: number;
    
    // total permutations tested across all clusters
    permutationsTested: number;
    
    // actions voided due to stalemates
    stalemateCount: number;
    
    // actions that executed successfully
    successCount: number;
}

// -----------------------------------------------
// Entity ID Extraction
// -----------------------------------------------

/**
 * extracts all entity IDs that an action references.
 * includes actor, targets, containers, contents, origins, etc.
 */
function getActionEntityIds(action: Action): Set<string> {
    if (!action) return new Set();
    
    const ids = new Set<string>();
    
    // actor is always involved
    ids.add(action.entityId);
    
    // targetIds (WELD, UNWELD, VECTOR_LOCK, ENCOUNTER, etc.)
    if ('targetIds' in action && Array.isArray(action.targetIds)) {
        for (const id of action.targetIds) {
            ids.add(id);
        }
    }
    
    // contentIds (LOAD, UNLOAD)
    if ('contentIds' in action && Array.isArray(action.contentIds)) {
        for (const id of action.contentIds) {
            ids.add(id);
        }
    }
    
    // containerIds (LOAD)
    if ('containerIds' in action && Array.isArray(action.containerIds)) {
        for (const id of action.containerIds) {
            ids.add(id);
        }
    }
    
    // originIds (EXTRACT, TRANSFER_RESOURCE)
    if ('originIds' in action && Array.isArray(action.originIds)) {
        for (const id of action.originIds) {
            ids.add(id);
        }
    }
    
    // volatilesTargetIds, fuelTargetIds (REFINE)
    if ('volatilesTargetIds' in action && Array.isArray(action.volatilesTargetIds)) {
        for (const id of action.volatilesTargetIds) {
            ids.add(id);
        }
    }
    if ('fuelTargetIds' in action && Array.isArray(action.fuelTargetIds)) {
        for (const id of action.fuelTargetIds) {
            ids.add(id);
        }
    }
    
    // mineralTargetIds (MOD)
    if ('mineralTargetIds' in action && Array.isArray(action.mineralTargetIds)) {
        for (const id of action.mineralTargetIds) {
            ids.add(id);
        }
    }
    
    return ids;
}

/**
 * gets target entity IDs specifically (not actor).
 * used for actor-target duality detection.
 */
function getActionTargetIds(action: Action): Set<string> {
    const ids = getActionEntityIds(action);
    ids.delete(action.entityId);
    return ids;
}

// -----------------------------------------------
// Containment/Weld Chain Resolution
// -----------------------------------------------

/**
 * builds a map of entity -> parent chain (both containment and weld).
 */
function buildParentChainMap(entities: readonly Entity[]): Map<string, Set<string>> {
    const chainMap = new Map<string, Set<string>>();
    const entityMap = new Map(entities.map(e => [e.id, e]));
    
    for (const entity of entities) {
        const ancestors = new Set<string>();
        let current: Entity | undefined = entity;
        
        // traverse containment chain
        while (current?.parentId) {
            ancestors.add(current.parentId);
            current = entityMap.get(current.parentId);
        }
        
        // traverse weld chain from original entity
        current = entity;
        while (current?.weldParentId) {
            ancestors.add(current.weldParentId);
            current = entityMap.get(current.weldParentId);
        }
        
        chainMap.set(entity.id, ancestors);
    }
    
    return chainMap;
}

/**
 * checks if two entity IDs share containment/weld ancestry.
 * returns true if one is an ancestor of the other or they share an ancestor.
 */
function sharesAncestry(
    id1: string,
    id2: string,
    chainMap: Map<string, Set<string>>
): boolean {
    const ancestors1 = chainMap.get(id1) ?? new Set();
    const ancestors2 = chainMap.get(id2) ?? new Set();
    
    // check if id1 is ancestor of id2 or vice versa
    if (ancestors1.has(id2) || ancestors2.has(id1)) {
        return true;
    }
    
    // check for shared ancestor
    for (const ancestor of ancestors1) {
        if (ancestors2.has(ancestor)) {
            return true;
        }
    }
    
    return false;
}

// -----------------------------------------------
// Cluster Identification
// -----------------------------------------------

/**
 * groups actions into conflict clusters based on entanglement rules.
 * 
 * actions are clustered if they:
 * 1. Share any target entity ID
 * 2. An actor is also a target of another action (actor-target duality)
 * 3. Target entities in the same containment/weld chain
 * 4. Target the same resource well or mineral store
 * 
 * uses union-find for efficient cluster merging.
 */
export function getConflictClusters(
    actions: Action[],
    entities: readonly Entity[]
): Action[][] {
    if (actions.length <= 1) {
        return actions.length === 1 ? [[actions[0]!]] : [];
    }
    
    // build parent chain map for ancestry checks
    const chainMap = buildParentChainMap(entities);
    
    // extract entity IDs for each action
    const actionEntityIds = actions.map(a => getActionEntityIds(a));
    const actionTargetIds = actions.map(a => getActionTargetIds(a));
    const actionActorIds = actions.map(a => a.entityId);
    
    // union-find structure
    const parent: number[] = actions.map((_, i) => i);
    
    function find(i: number): number {
        if (parent[i] !== i) {
            parent[i] = find(parent[i]!); // path compression
        }
        return parent[i]!;
    }
    
    function union(i: number, j: number): void {
        const pi = find(i);
        const pj = find(j);
        if (pi !== pj) {
            parent[pi] = pj;
        }
    }
    
    // check each pair of actions for entanglement
    for (let i = 0; i < actions.length; i++) {
        for (let j = i + 1; j < actions.length; j++) {
            if (find(i) === find(j)) continue; // already clustered
            
            // rule 1: shared targets
            const idsI = actionEntityIds[i]!;
            const idsJ = actionEntityIds[j]!;
            let hasSharedTarget = false;
            for (const id of idsI) {
                if (idsJ.has(id)) {
                    hasSharedTarget = true;
                    break;
                }
            }
            
            if (hasSharedTarget) {
                union(i, j);
                continue;
            }
            
            // rule 2: actor-target duality
            const actorI = actionActorIds[i]!;
            const actorJ = actionActorIds[j]!;
            const targetsI = actionTargetIds[i]!;
            const targetsJ = actionTargetIds[j]!;
            
            if (targetsJ.has(actorI) || targetsI.has(actorJ)) {
                union(i, j);
                continue;
            }
            
            // rule 3: containment/weld chains
            // check if any target in action i shares ancestry with any target in action j
            let sharesChain = false;
            for (const idI of idsI) {
                for (const idJ of idsJ) {
                    if (idI !== idJ && sharesAncestry(idI, idJ, chainMap)) {
                        sharesChain = true;
                        break;
                    }
                }
                if (sharesChain) break;
            }
            
            if (sharesChain) {
                union(i, j);
                continue;
            }
        }
    }
    
    // group actions by their cluster root
    const clusters = new Map<number, Action[]>();
    for (let i = 0; i < actions.length; i++) {
        const root = find(i);
        const cluster = clusters.get(root) ?? [];
        cluster.push(actions[i]!);
        clusters.set(root, cluster);
    }
    
    return Array.from(clusters.values());
}

// -----------------------------------------------
// Deep Clone Utilities
// -----------------------------------------------

/**
 * deep clones an entity, ensuring nested objects (position, velocity, etc.)
 * are fully copied to prevent mutation across permutation tests.
 */
function deepCloneEntity(entity: Entity): Entity {
    return {
        ...entity,
        position: { ...entity.position },
        velocity: { ...entity.velocity },
        relativeOffset: entity.relativeOffset 
            ? { ...entity.relativeOffset } 
            : undefined,
    };
}

/**
 * deep clones a game state for permutation testing.
 * ensures virtual state modifications don't affect the original.
 */
function deepCloneState(state: GameState): GameState {
    return {
        ...state,
        entities: state.entities.map(deepCloneEntity),
        // celestials and systems are read-only during tick resolution
        celestials: state.celestials,
        systems: state.systems,
    };
}

// -----------------------------------------------
// Virtual State Application
// -----------------------------------------------

/**
 * applies entity updates to create a virtual state.
 * uses deep cloning to ensure immutability for permutation testing.
 * 
 * CRITICAL: When a WELD increases mass in Step 1, the virtual THRUST in
 * Step 2 must use that updated mass for its Newtonian calculation (F/m).
 */
function applyVirtualUpdates(
    state: GameState,
    updates: EntityUpdate[]
): GameState {
    if (updates.length === 0) return state;
    
    // deep clone all entities to prevent mutation
    const entityMap = new Map(state.entities.map(e => [e.id, deepCloneEntity(e)]));
    
    for (const update of updates) {
        const existing = entityMap.get(update.id);
        if (existing) {
            // merge updates with deep cloning for nested objects
            const merged = { ...existing };
            
            for (const [key, value] of Object.entries(update.changes)) {
                // IMPORTANT: use hasOwnProperty to check if key exists, not value !== undefined
                // this allows setting properties to undefined (e.g., weldParentId: undefined for UNWELD)
                if (Object.prototype.hasOwnProperty.call(update.changes, key)) {
                    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                        // deep clone nested objects (position, velocity, etc.)
                        (merged as Record<string, unknown>)[key] = { ...value };
                    } else {
                        // for primitives and undefined, assign directly
                        (merged as Record<string, unknown>)[key] = value;
                    }
                }
            }
            
            entityMap.set(update.id, merged as Entity);
        } else {
            // new entity spawned - create with deep cloned position/velocity
            const newEntity = update.changes as Partial<Entity>;
            entityMap.set(update.id, {
                ...newEntity,
                position: newEntity.position ? { ...newEntity.position } : { x: 0, y: 0 },
                velocity: newEntity.velocity ? { ...newEntity.velocity } : { x: 0, y: 0 },
            } as Entity);
        }
    }
    
    return {
        ...state,
        entities: Array.from(entityMap.values()),
    };
}

/**
 * creates a tick context from a game state.
 */
function createContext(state: GameState): TickContext {
    return {
        tick: state.tick,
        entities: state.entities,
        state,
    };
}

// -----------------------------------------------
// Action Execution Helpers
// -----------------------------------------------

/**
 * extracts target entities from an action.
 */
function getTargetEntities(action: Action, entities: readonly Entity[]): Entity[] {
    const targetIds = getActionTargetIds(action);
    const targets: Entity[] = [];
    
    for (const entity of entities) {
        if (targetIds.has(entity.id)) {
            targets.push(entity);
        }
    }
    
    return targets;
}

/**
 * extracts input parameters from an action.
 * also handles field name transformations for handler compatibility:
 * - containerIds[0] -> containerId (for LOAD)
 */
function getActionInputs(action: Action): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(action as unknown as Record<string, unknown>)) {
        if (key === 'type' || key === 'entityId' || key === 'playerId' || key === 'orderIndex') {
            continue;
        }
        inputs[key] = value;
    }
    
    // transform containerIds to containerId for LOAD handler compatibility
    // the LOAD handler expects a single containerId, but the action type uses containerIds array
    if ('containerIds' in inputs && Array.isArray(inputs.containerIds) && inputs.containerIds.length > 0) {
        inputs.containerId = inputs.containerIds[0];
    }
    
    return inputs;
}

/**
 * validates an action against the current state.
 */
function validateAction(
    action: Action,
    state: GameState
): boolean {
    const registration = actionRegistry[action.type as ActionType];
    if (!registration) return false;
    
    const actor = state.entities.find(e => e.id === action.entityId);
    if (!actor) return false;
    
    const targets = getTargetEntities(action, state.entities);
    const inputs = getActionInputs(action);
    
    return registration.validate(actor, targets, inputs);
}

/**
 * executes an action and returns the updates.
 */
function executeAction(
    action: Action,
    state: GameState
): EntityUpdate[] {
    const registration = actionRegistry[action.type as ActionType];
    if (!registration) return [];
    
    const actor = state.entities.find(e => e.id === action.entityId);
    if (!actor) return [];
    
    const targets = getTargetEntities(action, state.entities);
    const inputs = getActionInputs(action);
    const context = createContext(state);
    
    return registration.handler(actor, targets, inputs, context);
}

// -----------------------------------------------
// Permutation Generation
// -----------------------------------------------

/**
 * generates all permutations of an array using Heap's algorithm.
 * for small arrays (N <= 7), this is efficient enough.
 * for larger clusters, we may want to add heuristics.
 */
function* generatePermutations<T>(arr: T[]): Generator<T[]> {
    if (arr.length <= 1) {
        yield [...arr];
        return;
    }
    
    const c = new Array(arr.length).fill(0);
    const result = [...arr];
    
    yield [...result];
    
    let i = 0;
    while (i < arr.length) {
        if (c[i]! < i) {
            if (i % 2 === 0) {
                [result[0], result[i]] = [result[i]!, result[0]!];
            } else {
                [result[c[i]!], result[i]] = [result[i]!, result[c[i]!]!];
            }
            yield [...result];
            c[i]!++;
            i = 0;
        } else {
            c[i] = 0;
            i++;
        }
    }
}

// -----------------------------------------------
// Permutation Solver
// -----------------------------------------------

interface PermutationResult {
    order: Action[];
    validCount: number;
    allValid: boolean;
    updates: EntityUpdate[];
    // tracks which specific actions were valid
    validActions: Set<number>;
}

/**
 * tests a single permutation and returns the result.
 * uses deep cloning to ensure each test is isolated.
 */
function testPermutation(
    actions: Action[],
    initialState: GameState
): PermutationResult {
    // deep clone state to ensure isolation between permutation tests
    let currentState = deepCloneState(initialState);
    let validCount = 0;
    const allUpdates: EntityUpdate[] = [];
    const validActions = new Set<number>();
    
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i]!;
        
        // validate against current (possibly modified) state
        const isValid = validateAction(action, currentState);
        
        if (isValid) {
            validCount++;
            validActions.add(i);
            
            // execute and apply virtual updates
            const updates = executeAction(action, currentState);
            allUpdates.push(...updates);
            currentState = applyVirtualUpdates(currentState, updates);
        }
    }
    
    return {
        order: actions,
        validCount,
        allValid: validCount === actions.length,
        updates: allUpdates,
        validActions,
    };
}

/**
 * checks if two actions target the same "unique" resource.
 * unique resources are entities that can only be claimed by one action
 * (e.g., MINERAL_STORE for LOAD, non-welded entity for WELD).
 */
function targetsSameUniqueResource(
    actionA: Action,
    actionB: Action
): boolean {
    // both LOAD actions targeting same content
    if (actionA.type === 'LOAD' && actionB.type === 'LOAD') {
        const contentA = 'contentIds' in actionA ? (actionA.contentIds as string[]) : [];
        const contentB = 'contentIds' in actionB ? (actionB.contentIds as string[]) : [];
        
        for (const id of contentA) {
            if (contentB.includes(id)) {
                return true;
            }
        }
    }
    
    // both WELD actions targeting same entity
    if (actionA.type === 'WELD' && actionB.type === 'WELD') {
        const targetsA = 'targetIds' in actionA ? (actionA.targetIds as string[]) : [];
        const targetsB = 'targetIds' in actionB ? (actionB.targetIds as string[]) : [];
        
        for (const id of targetsA) {
            if (targetsB.includes(id)) {
                return true;
            }
        }
    }
    
    // WELD vs UNWELD on same joint
    if ((actionA.type === 'WELD' && actionB.type === 'UNWELD') ||
        (actionA.type === 'UNWELD' && actionB.type === 'WELD')) {
        const targetsA = 'targetIds' in actionA ? (actionA.targetIds as string[]) : [];
        const targetsB = 'targetIds' in actionB ? (actionB.targetIds as string[]) : [];
        
        for (const id of targetsA) {
            if (targetsB.includes(id)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * checks if two actions are mutually exclusive (true stalemate).
 * 
 * STALEMATE-FIRST DEFINITION:
 * A and B are mutually exclusive if:
 * 1. Both are individually valid in the initial state
 * 2. Neither order (A->B or B->A) allows BOTH to succeed
 * 3. They target the same unique resource (contested)
 * 
 * this is the core "no arbitrary winners" rule.
 */
function areMutuallyExclusive(
    actionA: Action,
    actionB: Action,
    state: GameState
): boolean {
    // quick check: do they target the same unique resource?
    // if not, they might still be order-dependent but not a stalemate
    const contestsSameResource = targetsSameUniqueResource(actionA, actionB);
    
    // both must be valid individually
    const aValidAlone = validateAction(actionA, state);
    const bValidAlone = validateAction(actionB, state);
    
    if (!aValidAlone || !bValidAlone) {
        // if one is already invalid, it's not a stalemate - it's just invalid
        return false;
    }
    
    // test A -> B (does A completing invalidate B?)
    const resultAFirst = testPermutation([actionA, actionB], state);
    const bothValidAFirst = resultAFirst.validCount === 2;
    
    // test B -> A (does B completing invalidate A?)
    const resultBFirst = testPermutation([actionB, actionA], state);
    const bothValidBFirst = resultBFirst.validCount === 2;
    
    // mutual exclusion: neither order allows both to succeed
    // AND they contest the same unique resource
    if (!bothValidAFirst && !bothValidBFirst && contestsSameResource) {
        return true;
    }
    
    // special case: even if not targeting "unique" resource,
    // if neither order works and both are valid alone, it's still a stalemate
    // (this catches edge cases not covered by targetsSameUniqueResource)
    if (!bothValidAFirst && !bothValidBFirst) {
        // verify this is truly mutual - one action's execution blocks the other
        // and vice versa (not just both happen to fail for unrelated reasons)
        const aBlocksB = resultAFirst.validActions.has(0) && !resultAFirst.validActions.has(1);
        const bBlocksA = resultBFirst.validActions.has(0) && !resultBFirst.validActions.has(1);
        
        if (aBlocksB && bBlocksA) {
            return true;
        }
    }
    
    return false;
}

/**
 * finds ALL mutual exclusion pairs in a cluster.
 * if ANY pair is mutually exclusive, the ENTIRE cluster is a stalemate.
 * 
 * this is the STALEMATE-FIRST check that runs BEFORE permutation search.
 */
function findMutualExclusionPairs(
    actions: Action[],
    state: GameState
): [Action, Action][] {
    const pairs: [Action, Action][] = [];
    
    for (let i = 0; i < actions.length; i++) {
        for (let j = i + 1; j < actions.length; j++) {
            if (areMutuallyExclusive(actions[i]!, actions[j]!, state)) {
                pairs.push([actions[i]!, actions[j]!]);
            }
        }
    }
    
    return pairs;
}

// -----------------------------------------------
// Cluster Resolution
// -----------------------------------------------

/**
 * resolves a single conflict cluster using STALEMATE-FIRST logic.
 * 
 * ALGORITHM (strict order):
 * 1. STALEMATE CHECK: Identify mutually exclusive pairs FIRST
 * 2. If ANY mutual exclusion found: Void ENTIRE cluster (no winners)
 * 3. If no stalemate: Find optimal order via permutation search
 * 4. Execute in optimal order (e.g., WELD -> THRUST)
 * 
 * PHILOSOPHY: In a 24-hour tick game, contested unique targets
 * must result in zero successes, not arbitrary winners.
 */
export function resolveCluster(
    cluster: Action[],
    state: GameState
): ClusterResolutionResult {
    // single action cluster - just validate and execute
    if (cluster.length === 1) {
        const action = cluster[0]!;
        const isValid = validateAction(action, state);
        
        return {
            executionOrder: isValid ? [action] : [],
            voidedActions: isValid ? [] : [action],
            isStalemate: false,
            actionResults: [{
                action,
                valid: isValid,
                voidReason: isValid ? undefined : 'INVALID',
            }],
        };
    }
    
    // ===================================================
    // STEP 1: STALEMATE-FIRST CHECK (before permutation!)
    // ===================================================
    // check for mutual exclusion BEFORE trying any permutations.
    // if ANY pair of actions in the cluster are mutually exclusive,
    // the ENTIRE cluster is voided. no arbitrary winners.
    
    const mutuallyExclusivePairs = findMutualExclusionPairs(cluster, state);
    
    if (mutuallyExclusivePairs.length > 0) {
        // STALEMATE: void the ENTIRE cluster
        // no action in a contested cluster gets to succeed
        return {
            executionOrder: [],
            voidedActions: cluster,
            isStalemate: true,
            actionResults: cluster.map(a => ({
                action: a,
                valid: false,
                voidReason: 'STALEMATE' as const,
            })),
        };
    }
    
    // ===================================================
    // STEP 2: PERMUTATION SEARCH (only if no stalemate)
    // ===================================================
    // now that we know there's no stalemate, find the optimal
    // order where the most (ideally all) actions succeed.
    
    const MAX_PERMUTATIONS = 5040;
    const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);
    
    if (factorial(cluster.length) > MAX_PERMUTATIONS) {
        // for large clusters, use heuristic ordering
        // TODO: implement smarter heuristics based on action type priority
        console.warn(`Cluster size ${cluster.length} exceeds permutation limit, using greedy order`);
    }
    
    let bestResult: PermutationResult | null = null;
    let testedCount = 0;
    
    for (const permutation of generatePermutations(cluster)) {
        const result = testPermutation(permutation, state);
        testedCount++;
        
        // perfect order found - all actions valid
        if (result.allValid) {
            bestResult = result;
            break;
        }
        
        // track best so far (maximize valid count)
        if (!bestResult || result.validCount > bestResult.validCount) {
            bestResult = result;
        }
        
        if (testedCount >= MAX_PERMUTATIONS) break;
    }
    
    if (!bestResult) {
        // should never happen with non-empty cluster
        return {
            executionOrder: [],
            voidedActions: cluster,
            isStalemate: false,
            actionResults: cluster.map(a => ({
                action: a,
                valid: false,
                voidReason: 'INVALID' as const,
            })),
        };
    }
    
    // ===================================================
    // STEP 3: EXECUTE OPTIMAL ORDER
    // ===================================================
    
    if (bestResult.allValid) {
        // perfect order found - all actions succeed
        return {
            executionOrder: bestResult.order,
            voidedActions: [],
            isStalemate: false,
            actionResults: bestResult.order.map(a => ({
                action: a,
                valid: true,
            })),
        };
    }
    
    // some actions fail due to state (not stalemate, just dependency)
    // re-execute with deep clone to get final valid set
    const validSet = new Set<string>();
    let testState = deepCloneState(state);
    
    for (const action of bestResult.order) {
        if (validateAction(action, testState)) {
            validSet.add(action.entityId + ':' + action.type);
            const updates = executeAction(action, testState);
            testState = applyVirtualUpdates(testState, updates);
        }
    }
    
    const executionOrder: Action[] = [];
    const voidedActions: Action[] = [];
    const actionResults: ActionResolutionResult[] = [];
    
    for (const action of bestResult.order) {
        const key = action.entityId + ':' + action.type;
        const isValid = validSet.has(key);
        
        if (isValid) {
            executionOrder.push(action);
        } else {
            voidedActions.push(action);
        }
        
        actionResults.push({
            action,
            valid: isValid,
            voidReason: isValid ? undefined : 'DEPENDENCY_FAILED',
        });
    }
    
    return {
        executionOrder,
        voidedActions,
        isStalemate: false,
        actionResults,
    };
}

// -----------------------------------------------
// Wave Resolution with Clusters
// -----------------------------------------------

export interface ClusterWaveResult {
    // actions to execute in optimal order
    executionOrder: Action[];
    
    // final state after applying all valid actions
    finalState: GameState;
    
    // metrics for diagnostics
    metrics: WaveResolutionMetrics;
    
    // detailed results per cluster
    clusterResults: ClusterResolutionResult[];
}

/**
 * resolves a wave of actions using the conflict cluster system.
 * 
 * 1. identifies conflict clusters
 * 2. resolves each cluster independently
 * 3. merges results into optimal execution order
 * 4. applies all valid actions to produce final state
 */
export function resolveClusterWave(
    actions: Action[],
    state: GameState
): ClusterWaveResult {
    if (actions.length === 0) {
        return {
            executionOrder: [],
            finalState: state,
            metrics: {
                clusterCount: 0,
                permutationsTested: 0,
                stalemateCount: 0,
                successCount: 0,
            },
            clusterResults: [],
        };
    }
    
    // identify conflict clusters
    const clusters = getConflictClusters(actions, state.entities);
    
    // resolve each cluster
    const clusterResults: ClusterResolutionResult[] = [];
    let totalPermutations = 0;
    let stalemateCount = 0;
    let successCount = 0;
    
    for (const cluster of clusters) {
        const result = resolveCluster(cluster, state);
        clusterResults.push(result);
        
        // count permutations (approximate)
        const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);
        totalPermutations += Math.min(factorial(cluster.length), 5040);
        
        if (result.isStalemate) {
            stalemateCount += cluster.length;
        } else {
            successCount += result.executionOrder.length;
        }
    }
    
    // merge execution orders from all clusters
    // clusters are independent, so order between clusters doesn't matter
    const executionOrder: Action[] = [];
    for (const result of clusterResults) {
        executionOrder.push(...result.executionOrder);
    }
    
    // apply all valid actions to get final state
    let finalState = state;
    for (const action of executionOrder) {
        const updates = executeAction(action, finalState);
        finalState = applyVirtualUpdates(finalState, updates);
    }
    
    return {
        executionOrder,
        finalState,
        metrics: {
            clusterCount: clusters.length,
            permutationsTested: totalPermutations,
            stalemateCount,
            successCount,
        },
        clusterResults,
    };
}

// -----------------------------------------------
// Stalemate Detection Helpers
// -----------------------------------------------

/**
 * determines if an action pair would result in a stalemate.
 * useful for UI feedback before queueing actions.
 */
export function wouldCauseStalemate(
    newAction: Action,
    existingActions: Action[],
    state: GameState
): boolean {
    // check against each existing action
    for (const existing of existingActions) {
        // quick check: same targets?
        const newTargets = getActionEntityIds(newAction);
        const existingTargets = getActionEntityIds(existing);
        
        let hasOverlap = false;
        for (const id of newTargets) {
            if (existingTargets.has(id)) {
                hasOverlap = true;
                break;
            }
        }
        
        if (hasOverlap) {
            // detailed check: mutual exclusion?
            if (areMutuallyExclusive(newAction, existing, state)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * classifies the type of conflict between two actions.
 */
export type ConflictType = 
    | 'NONE'
    | 'SHARED_TARGET'
    | 'ACTOR_TARGET_DUALITY'
    | 'CONTAINMENT_CHAIN'
    | 'STALEMATE';

/**
 * risk level for contested targets.
 */
export type ContestationRisk = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * result of contested target analysis.
 */
export interface ContestationAnalysis {
    // overall risk level
    risk: ContestationRisk;
    
    // entity IDs that are contested
    contestedTargetIds: string[];
    
    // actions that could cause stalemate
    potentialStalemateActions: Action[];
    
    // human-readable message for UI
    message: string;
}

export function classifyConflict(
    actionA: Action,
    actionB: Action,
    state: GameState
): ConflictType {
    const idsA = getActionEntityIds(actionA);
    const idsB = getActionEntityIds(actionB);
    const targetsA = getActionTargetIds(actionA);
    const targetsB = getActionTargetIds(actionB);
    
    // check actor-target duality first (more specific)
    if (targetsB.has(actionA.entityId) || targetsA.has(actionB.entityId)) {
        // now check if it's a stalemate
        if (areMutuallyExclusive(actionA, actionB, state)) {
            return 'STALEMATE';
        }
        return 'ACTOR_TARGET_DUALITY';
    }
    
    // check shared targets
    for (const id of idsA) {
        if (idsB.has(id) && id !== actionA.entityId && id !== actionB.entityId) {
            if (areMutuallyExclusive(actionA, actionB, state)) {
                return 'STALEMATE';
            }
            return 'SHARED_TARGET';
        }
    }
    
    // check containment chains
    const chainMap = buildParentChainMap(state.entities);
    for (const idA of idsA) {
        for (const idB of idsB) {
            if (idA !== idB && sharesAncestry(idA, idB, chainMap)) {
                if (areMutuallyExclusive(actionA, actionB, state)) {
                    return 'STALEMATE';
                }
                return 'CONTAINMENT_CHAIN';
            }
        }
    }
    
    return 'NONE';
}

// -----------------------------------------------
// Draft UI Contested Target Analysis
// -----------------------------------------------

/**
 * analyzes a drafted action against existing queued actions to detect
 * potential stalemate risk. useful for UI feedback before committing.
 * 
 * DRAFT SERVICE INTEGRATION:
 * when a player drafts an action targeting a highly contested entity
 * (e.g., a mineral store with corporate biters nearby), the UI should
 * flag the draft as "Contested: High Stalemate Risk".
 */
export function analyzeContestationRisk(
    draftAction: Action,
    queuedActions: Action[],
    state: GameState
): ContestationAnalysis {
    const draftTargets = getActionTargetIds(draftAction);
    const contestedTargetIds: string[] = [];
    const potentialStalemateActions: Action[] = [];
    
    // check each queued action for conflicts
    for (const queued of queuedActions) {
        const queuedTargets = getActionTargetIds(queued);
        
        // find overlapping targets
        for (const targetId of draftTargets) {
            if (queuedTargets.has(targetId)) {
                if (!contestedTargetIds.includes(targetId)) {
                    contestedTargetIds.push(targetId);
                }
                
                // check if this would be a stalemate
                if (areMutuallyExclusive(draftAction, queued, state)) {
                    potentialStalemateActions.push(queued);
                }
            }
        }
    }
    
    // determine risk level
    let risk: ContestationRisk = 'NONE';
    let message = 'No contestation detected';
    
    if (potentialStalemateActions.length > 0) {
        risk = 'HIGH';
        message = `Contested: High Stalemate Risk - ${potentialStalemateActions.length} conflicting action(s)`;
    } else if (contestedTargetIds.length > 0) {
        risk = 'MEDIUM';
        message = `Contested: ${contestedTargetIds.length} target(s) also targeted by other actions`;
    }
    
    return {
        risk,
        contestedTargetIds,
        potentialStalemateActions,
        message,
    };
}

/**
 * finds all entities in the game state that are being targeted by multiple
 * different players' actions. useful for highlighting contested resources on the map.
 */
export function findContestedEntities(
    allActions: Action[],
    state: GameState
): Map<string, { entityId: string; playerIds: string[]; actionCount: number }> {
    const contested = new Map<string, { entityId: string; playerIds: string[]; actionCount: number }>();
    
    // group actions by target entity
    const targetToActions = new Map<string, Action[]>();
    
    for (const action of allActions) {
        const targets = getActionTargetIds(action);
        
        for (const targetId of targets) {
            const existing = targetToActions.get(targetId) ?? [];
            existing.push(action);
            targetToActions.set(targetId, existing);
        }
    }
    
    // find entities targeted by multiple different players
    for (const [entityId, actions] of targetToActions) {
        const playerIds = [...new Set(actions.map(a => a.playerId ?? a.entityId))];
        
        if (playerIds.length > 1 || actions.length > 1) {
            contested.set(entityId, {
                entityId,
                playerIds,
                actionCount: actions.length,
            });
        }
    }
    
    return contested;
}
