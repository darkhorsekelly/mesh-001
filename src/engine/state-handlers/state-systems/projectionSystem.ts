// ===============================================
// PROJECTION SYSTEM
// ===============================================
// Deterministic sandbox for "Ghost" visualization
// Uses the SAME systems as tickResolver for 1:1 accuracy
// Pure engine logic - no UI dependencies, no state mutation
//
// System Invariants:
// 1. Celestial Synchronization: project celestials to T+1 before entity
// 2. Targeted Execution: optimize for single-entity projection
// 3. Deterministic: same input always produces same output

import type { Entity } from '../../primitive-types/semantic/entity/entity-types.js';
import type { Action } from '../../primitive-types/semantic/action/action-types.js';
import type { Vector2FP } from '../../primitive-types/euclidean/euclidean-types.js';
import type { GameState } from '../../state-types/state-types.js';
import type { CelestialBody, Moon, Asteroid } from '../../primitive-types/semantic/celestial/celestial-types.js';
import { fpAddVector, fpAdd, fpMul, toFP } from '../../primitive-types/euclidean/euclidean-types.js';
import { applyActionsToEntity } from './actionHandlers.js';

// -----------------------------------------------
// Internal: Celestial projection (mirrors future celestial systems)
// TODO: Fully implement celestial behavior in celestial system
// -----------------------------------------------

/**
 * Project a moon's orbital position to T+1
 * Advances orbitAngle by orbitSpeed
 */
function projectMoon(moon: Moon, parentPosition: Vector2FP): Moon {
    // Advance orbit angle by orbit speed
    const newOrbitAngle = fpAdd(moon.orbitAngle, moon.orbitSpeed);
    
    // Calculate new position based on orbit
    // position = parentPosition + (cos(angle), sin(angle)) * orbitRadius
    const angleRad = (newOrbitAngle / 1000) * (Math.PI / 180);
    const newX = fpAdd(parentPosition.x, toFP(Math.cos(angleRad) * (moon.orbitRadius / 1000)));
    const newY = fpAdd(parentPosition.y, toFP(Math.sin(angleRad) * (moon.orbitRadius / 1000)));
    
    return {
        ...moon,
        orbitAngle: newOrbitAngle,
        position: { x: newX, y: newY },
    };
}

/**
 * Project an asteroid's position to T+1
 * Applies linear velocity (position += velocity)
 */
function projectAsteroid(asteroid: Asteroid): Asteroid {
    return {
        ...asteroid,
        position: fpAddVector(asteroid.position, asteroid.velocity),
    };
}

/**
 * Project all celestials to T+1
 * - Planets: static (no change)
 * - Moons: orbital motion around parent
 * - Asteroids: linear velocity
 */
export function projectCelestials(celestials: CelestialBody[]): CelestialBody[] {
    // First pass: find planet positions (they don't move)
    const planetPositions = new Map<string, Vector2FP>();
    for (const body of celestials) {
        if (body.type === 'PLANET') {
            planetPositions.set(body.id, body.position);
        }
    }
    
    // Second pass: project each celestial
    return celestials.map(body => {
        switch (body.type) {
            case 'PLANET':
                // Planets are static
                return body;
            case 'MOON':
                // Moons orbit their parent planet
                const parentPos = planetPositions.get(body.parentPlanetId);
                return parentPos ? projectMoon(body, parentPos) : body;
            case 'ASTEROID':
                // Asteroids have linear velocity
                return projectAsteroid(body);
            default:
                return body;
        }
    });
}

// -----------------------------------------------
// Internal: Single-entity physics (mirrors maneuverSystem)
// -----------------------------------------------

/**
 * Apply Newtonian motion to an entity (position += velocity)
 * Mirrors the translateEntity in maneuverSystem.ts
 */
function translateEntity(entity: Entity): Entity {
    return {
        ...entity,
        position: fpAddVector(entity.position, entity.velocity),
    };
}

// -----------------------------------------------
// Core projection functions
// -----------------------------------------------

/**
 * Project a single entity forward one tick
 * 
 * INVARIANT: Celestials must be projected to T+1 BEFORE calling this
 * to ensure capture/collision checks are deterministic
 * 
 * Pipeline (mirrors tickResolver):
 * 1. Process Input (actions -> velocity changes)
 * 2. Physics (position += velocity)
 * 3. Environment checks (using T+1 celestials)
 * 
 * @param entity - the entity to project
 * @param actions - actions to apply (will filter to this entity)
 * @param celestialsT1 - celestials projected to T+1 (for environment checks)
 * @returns the projected entity state after one tick
 */
export function projectEntity(
    entity: Entity,
    actions: Action[] = [],
    celestialsT1?: CelestialBody[]
): Entity {
    // Step 1: apply actions (e.g. THRUST modifies velocity)
    let projected = applyActionsToEntity(entity, actions);
    
    // Step 2: apply physics (position += velocity)
    projected = translateEntity(projected);
    
    // Step 3: environment checks would go here (zoomState transitions)
    // Uses celestialsT1 (T+1 positions) for deterministic capture checks
    // Currently omitted for ghost rendering - we show destination, not state changes
    
    return projected;
}

/**
 * Get the projected position of an entity after one tick
 * Convenience wrapper when only position is needed
 * 
 * ALWAYS calculates projection based on current velocity
 * Ghost represents "The Destination" regardless of actions
 * 
 * @param entity - the entity to project
 * @param actions - optional actions to apply first
 * @returns the position after one tick simulation
 */
export function getProjectedPosition(
    entity: Entity,
    actions: Action[] = []
): Vector2FP {
    return projectEntity(entity, actions).position;
}

/**
 * Get the full projected entity state
 * Alias for projectEntity for backwards compatibility
 */
export function getProjectedEntity(
    entity: Entity,
    actions: Action[] = []
): Entity {
    return projectEntity(entity, actions);
}

// -----------------------------------------------
// Full state projection (for multi-entity scenarios)
// -----------------------------------------------

/**
 * Project the entire game state forward one tick
 * Dry-run simulation - does NOT mutate the input state
 * 
 * Uses the same pipeline as tickResolver:
 * 1. Process all actions
 * 2. Apply physics to all entities
 * 
 * @param state - current game state
 * @param actions - actions to apply
 * @returns projected game state (tick NOT incremented)
 */
export function projectGameState(
    state: GameState,
    actions: Action[] = []
): GameState {
    // Project each entity individually
    const projectedEntities = state.entities.map(entity =>
        projectEntity(entity, actions, state.celestials)
    );
    
    return {
        ...state,
        entities: projectedEntities,
        // Note: tick is NOT incremented - this is a preview, not a commit
    };
}

// -----------------------------------------------
// Utility functions
// -----------------------------------------------

/**
 * Check if an entity has any actions in the queue
 */
export function entityHasQueuedActions(
    entityId: string,
    actions: Action[]
): boolean {
    return actions.some(a => a?.entityId === entityId);
}

/**
 * Merge multiple action sources for projection
 * Combines server-pending actions with client hypothetical action
 * 
 * @param serverActions - confirmed pending actions from server
 * @param hypotheticalAction - optional client-side hover intent
 * @returns combined action array for projection
 */
export function mergeActionsForProjection(
    serverActions: Action[],
    hypotheticalAction: Action | null
): Action[] {
    if (!hypotheticalAction) {
        return serverActions;
    }
    return [...serverActions, hypotheticalAction];
}
