// ===============================================
// Celestial - PixiJS stage element for celestial bodies
// ===============================================
// Future: PIXI.Mesh with custom shaders
// - Planet: Rayleigh scattering, atmosphere glow
// - Moon: Surface detail, crater shadows
// - Asteroid: Point rendering for now

import type { CelestialBody } from '../../../engine/primitive-types/semantic/celestial/celestial-types.js';

/**
 * A placeholder
 * Placeholder for future PIXI.Mesh implementation
 */
export function createCelestialRenderData(celestial: CelestialBody) {
    return {
        id: celestial.id,
        // type: celestial.type,
        name: celestial.name,

        position: celestial.position,
        radius: celestial.radius,
        mass: celestial.mass,
        z: celestial.z,
    };
}

