// ===============================================
// ZOOM STATE SYSTEM
// ===============================================
// Handles: Zoom level state transitions
// - SPACE -> ORBIT (when within planet capture radius)
// - TODO: Future: ORBIT -> SURFACE, etc.
// Pure system: (GameState) -> GameState

import type { GameState } from '../../state-types/state-types.js';
import type { Entity } from '../../primitive-types/semantic/entity/entity-types.js';
import type { Planet, CelestialBody } from '../../primitive-types/semantic/celestial/celestial-types.js';
import { fpDistanceSquared, fpMul, SPEED_FROM_VECTOR, VECTOR_ZERO } from '../../primitive-types/euclidean/euclidean-types.js';
import { ORBITAL_CONVERSION_CONSTANT } from '../../primitive-types/constant/constants.js';

/**
 * Find a planet that captures this entity (if any)
 * Uses squared distance to avoid sqrt
 */

// TODO: Check for capturing planet in a more efficient way (planets are static).
function findCapturingPlanet(entity: Entity, celestials: CelestialBody[]): Planet | null {
    for (const celestial of celestials) {
        if (celestial.type !== 'PLANET') continue;
        
        const distSq = fpDistanceSquared(entity.position, celestial.position);
        const captureRadiusSq = fpMul(celestial.orbitRadius, celestial.orbitRadius);
        
        if (distSq <= captureRadiusSq) {
            return celestial;
        }
    }
    return null;
}

/**
 * Check and apply SPACE -> ORBIT transition for a single entity
 */
function checkOrbitalCapture(entity: Entity, celestials: CelestialBody[]): Entity {
    // Only check entities in SPACE state
    if (entity.zoomState !== 'SPACE') {
        return entity;
    }
    
    const capturedBy = findCapturingPlanet(entity, celestials);
    if (!capturedBy) {
        return entity;
    }
    
    // Transition to ORBIT - snap to rail

    // if distance(entity, planet_center) ≤ R_capture:
// θentry = atan2(Pentity - planet_center)
// ωentry = |Ventity| × orbital_conversion_constant
// entity transitions to orbit state

    const thetaEntry = Math.atan2(entity.position.x - capturedBy.position.x, entity.position.y - capturedBy.position.y);
    const omegaEntry = fpMul(SPEED_FROM_VECTOR(entity.velocity), ORBITAL_CONVERSION_CONSTANT);

    return {
        ...entity,
        zoomState: 'ORBIT',
        orbitTargetId: capturedBy.id,

        // 
        velocity: VECTOR_ZERO,
    };
}

/**
 * Apply zoom level state transitions to all entities
 * Currently: SPACE -> ORBIT capture check
 * TODO: Implement ORBIT -> MOON; ORBIT -> PLANET; PLANET -> ORBIT; ORBIT -> SPACE
 */
export function applyZoomStateTransition(state: GameState): GameState {
    const nextEntities = state.entities.map(entity =>
        checkOrbitalCapture(entity, state.celestials)
    );
    
    const changed = nextEntities.some((e, i) => e !== state.entities[i]);
    
    return {
        ...state,
        entities: changed ? nextEntities : state.entities,
    };
}
