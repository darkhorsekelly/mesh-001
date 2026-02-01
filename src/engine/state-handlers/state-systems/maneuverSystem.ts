// ===============================================
// MANEUVER SYSTEM
// ===============================================
// Handles: Actions -> Velocity -> Position
// Pure system: (GameState, Actions) -> GameState
//
// CONTAINMENT MODEL (parentId):
// - Root entities (no parentId) translate normally: position += velocity
// - Contained entities (have parentId) are BOUND to their container's position
// - Post-translation pass snaps all contained entities to prevent "Ghost Trailing"
//
// WELD MODEL (weldParentId):
// - Root entities translate normally
// - Welded entities (have weldParentId) are positioned at parent.position + relativeOffset
// - Unlike containment, welded entities maintain a structural offset

// TODO: Decouple maneuvers (SURFACE) from thrust (ORBIT and SPACE)

import type { GameState } from '../../state-types/state-types.js';
import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { Action, ActionType } from '../../primitive-types/semantic/action/action-types.js';
import type { TickContext } from '../../resolvers/actions/actionTypes.js';
import { fpAddVector, fpAdd, type Vector2FP, type FP } from '../../primitive-types/euclidean/euclidean-types.js';
import { actionRegistry } from '../../resolvers/actions/actionRegistry.js';

/**
 * Apply Newtonian motion to a single ROOT entity.
 * Contained and welded entities are handled separately.
 */
function translateEntity(entity: Entity): Entity {
    // skip contained entities - they will be snapped to parent
    if (entity.parentId !== undefined) {
        return entity;
    }

    // skip welded entities - they will be positioned relative to parent
    if (entity.weldParentId !== undefined) {
        return entity;
    }

    return {
        ...entity,
        position: fpAddVector(entity.position, entity.velocity),
    };
}

/**
 * extracts target entity IDs from an action based on its type.
 */
function getTargetIds(action: Action): string[] {
    if (!action) return [];
    
    // actions with targetIds array (WELD, UNWELD)
    if ('targetIds' in action && Array.isArray(action.targetIds)) {
        return action.targetIds;
    }
    
    // LOAD action has contentIds and containerIds
    if (action.type === 'LOAD' && 'contentIds' in action) {
        const load = action as { contentIds?: string[]; containerIds?: string[] };
        return [...(load.contentIds ?? []), ...(load.containerIds ?? [])];
    }
    
    // UNLOAD action has contentIds
    if (action.type === 'UNLOAD' && 'contentIds' in action) {
        const unload = action as { contentIds?: string[] };
        return unload.contentIds ?? [];
    }
    
    // EXTRACT has originIds
    if (action.type === 'EXTRACT' && 'originIds' in action) {
        const extract = action as { originIds?: string[] };
        return extract.originIds ?? [];
    }
    
    // TRANSFER_RESOURCE has targetId
    if ('targetId' in action && typeof action.targetId === 'string') {
        return [action.targetId];
    }
    
    return [];
}

/**
 * extracts input parameters from an action (everything except type, entityId, and target IDs).
 */
function getActionInputs(action: Action): Record<string, unknown> {
    if (!action) return {};
    
    const inputs: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(action as unknown as Record<string, unknown>)) {
        // skip standard fields
        if (key === 'type' || key === 'entityId' || key === 'targetIds' || 
            key === 'targetId' || key === 'contentIds' || key === 'containerIds' ||
            key === 'originIds') {
            continue;
        }
        inputs[key] = value;
    }
    
    return inputs;
}

/**
 * applies entity updates to an entity map.
 */
function applyUpdates(
    entityMap: Map<string, Entity>,
    updates: EntityUpdate[]
): void {
    for (const update of updates) {
        const existing = entityMap.get(update.id);
        if (existing) {
            entityMap.set(update.id, { ...existing, ...update.changes } as Entity);
        } else {
            // new entity spawned by action (e.g., mineral store from EXTRACT)
            entityMap.set(update.id, update.changes as Entity);
        }
    }
}

/**
 * Process actions using the action registry.
 * Each action is resolved through its registered handler.
 */
export function applyActions(state: GameState, actions: Action[]): GameState {
    if (actions.length === 0) {
        return state;
    }

    // create entity map for efficient lookups and updates
    const entityMap = new Map(state.entities.map(e => [e.id, e]));
    
    // create tick context
    const context: TickContext = {
        tick: state.tick,
        entities: state.entities,
        state,
    };

    // process each action
    for (const action of actions) {
        if (!action || !action.entityId) continue;

        // get registration from registry
        const registration = actionRegistry[action.type as ActionType];
        if (!registration) continue;

        // find actor entity (use current state from map for sequential action resolution)
        const actor = entityMap.get(action.entityId);
        if (!actor) continue;

        // find target entities
        const targetIds = getTargetIds(action);
        const targets = targetIds
            .map(id => entityMap.get(id))
            .filter((e): e is Entity => e !== undefined);

        // extract inputs
        const inputs = getActionInputs(action);

        // create updated context with current entity states
        const currentContext: TickContext = {
            tick: state.tick,
            entities: Array.from(entityMap.values()),
            state: { ...state, entities: Array.from(entityMap.values()) },
        };

        // execute handler
        const updates = registration.handler(actor, targets, inputs, currentContext);

        // apply updates to entity map
        applyUpdates(entityMap, updates);
    }

    // check if anything changed
    const nextEntities = Array.from(entityMap.values());
    const changed = nextEntities.length !== state.entities.length ||
        nextEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? nextEntities : state.entities,
    };
}

/**
 * Post-translation pass: snap all contained entities to their parent's position.
 * Prevents "Ghost Trailing" where container moves but content stays behind.
 * 
 * This runs AFTER root entity translation, so parents have their new positions.
 */
function bindContainedPositions(entities: Entity[]): Entity[] {
    // build a map of entity positions for quick lookup
    const positionMap = new Map<string, Vector2FP>();
    for (const entity of entities) {
        positionMap.set(entity.id, entity.position);
    }

    // snap contained entities to their parent's position
    return entities.map(entity => {
        if (entity.parentId === undefined) {
            return entity;
        }

        const parentPosition = positionMap.get(entity.parentId);
        if (!parentPosition) {
            // orphaned content - parent not found, leave position unchanged
            return entity;
        }

        // check if position needs updating
        if (entity.position.x === parentPosition.x && 
            entity.position.y === parentPosition.y) {
            return entity;
        }

        // snap to parent position
        return {
            ...entity,
            position: { ...parentPosition },
        };
    });
}

/**
 * Post-translation pass: position welded entities at parent.position + relativeOffset.
 * Unlike containment, welded entities maintain a structural offset.
 */
function bindWeldedPositions(entities: Entity[]): Entity[] {
    // build a map of entity positions for quick lookup
    const positionMap = new Map<string, Vector2FP>();
    for (const entity of entities) {
        positionMap.set(entity.id, entity.position);
    }

    // position welded entities relative to their parent
    return entities.map(entity => {
        if (entity.weldParentId === undefined) {
            return entity;
        }

        const parentPosition = positionMap.get(entity.weldParentId);
        if (!parentPosition) {
            // orphaned weld - parent not found, leave position unchanged
            return entity;
        }

        // calculate expected position: parent.position + relativeOffset
        const offset = entity.relativeOffset ?? { x: 0 as FP, y: 0 as FP };
        const expectedPosition: Vector2FP = {
            x: fpAdd(parentPosition.x, offset.x),
            y: fpAdd(parentPosition.y, offset.y),
        };

        // check if position needs updating
        if (entity.position.x === expectedPosition.x && 
            entity.position.y === expectedPosition.y) {
            return entity;
        }

        // move to offset position
        return {
            ...entity,
            position: expectedPosition,
        };
    });
}

/**
 * Apply physics translation to all entities.
 * 
 * Three-phase process:
 * 1. Translate root entities (position += velocity)
 * 2. Bind contained entities to parent positions
 * 3. Bind welded entities to parent positions + offset
 */
export function applyManeuver(state: GameState): GameState {
    // phase 1: translate root entities
    const translatedEntities = state.entities.map(translateEntity);
    
    // phase 2: bind contained entities to parents
    const boundEntities = bindContainedPositions(translatedEntities);
    
    // phase 3: bind welded entities to parents with offset
    const weldedEntities = bindWeldedPositions(boundEntities);
    
    const changed = weldedEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? weldedEntities : state.entities,
    };
}

/**
 * Apply ONLY position binding without translation.
 * 
 * WAVE/SETTLEMENT BOUNDARY:
 * - Binding runs after EVERY wave (prevents teleportation)
 * - Translation runs ONCE per tick (at the end)
 * 
 * this function handles just the binding phases:
 * 1. Bind contained entities to parent positions
 * 2. Bind welded entities to parent positions + offset
 */
export function applyBinding(state: GameState): GameState {
    // phase 1: bind contained entities to parents
    const boundEntities = bindContainedPositions(state.entities);
    
    // phase 2: bind welded entities to parents with offset
    const weldedEntities = bindWeldedPositions(boundEntities);
    
    const changed = weldedEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? weldedEntities : state.entities,
    };
}

/**
 * Apply ONLY translation without binding.
 * 
 * WAVE/SETTLEMENT BOUNDARY:
 * - Translation runs ONCE per tick (at the end)
 * - Binding runs after EVERY wave
 * 
 * this function handles just the translation phase:
 * - Root entities: position += velocity
 * - Contained/welded entities: skip (handled by binding)
 */
export function applyTranslation(state: GameState): GameState {
    const translatedEntities = state.entities.map(translateEntity);
    
    const changed = translatedEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? translatedEntities : state.entities,
    };
}
