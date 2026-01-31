// ===============================================
// Celestial - PixiJS stage element for celestial bodies
// ===============================================
// Future: PIXI.Mesh with custom shaders
// - Planet: Rayleigh scattering, atmosphere glow
// - Moon: Surface detail, crater shadows
// - Asteroid: Point rendering for now

import type { CelestialBody } from '../../../engine/primitive-types/semantic/celestial/celestial-types.js';
import { getCelestialPosition, isWormhole } from '../../../engine/primitive-types/semantic/celestial/celestial-types.js';

/**
 * A placeholder
 * Placeholder for future PIXI.Mesh implementation
 */
export function createCelestialRenderData(celestial: CelestialBody) {
    // handle wormhole's dual-position case
    if (isWormhole(celestial)) {
        return {
            id: celestial.id,
            name: celestial.name,
            position: celestial.endpoints[0],
            radius: celestial.radius,
            mass: 0,
            z: celestial.z,
        };
    }

    return {
        id: celestial.id,
        name: celestial.name,
        position: celestial.position,
        radius: celestial.radius,
        mass: celestial.mass,
        z: celestial.z,
    };
}

