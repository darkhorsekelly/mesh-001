// -----------------------------------------------
// Celestial body types
// -----------------------------------------------

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';

interface BaseCelestialBody {
    id: string;
    name: string;
    position: Vector2FP;

    mass: FP;
    radius: FP;

    // Gravity well Z-axis value
    z: FP;
}

export interface Planet extends BaseCelestialBody {
    type: 'PLANET';
    planetType: 'TERRESTRIAL' | 'GAS_GIANT';

    // Between 0 and 1; 0 = no atmosphere, 1 = full atmosphere
    atmosphere: FP;

    // Fixed rail orbit radius from planet center; also the capture radius
    orbitRadius: FP;
}

export interface Moon extends BaseCelestialBody {
    type: 'MOON';
    parentPlanetId: string;
    radius: FP;

    // Angle in fixed-point (0-360000 for 0-360 degrees)
    orbitAngle: FP; 

    orbitSpeed: FP;

    // Between 0 and 1; 0 = no atmosphere, 1 = full atmosphere
    atmosphere: FP;

    // Fixed rail orbit radius from planet center, from parentPlanet's orbitRadius
    orbitRadius: FP;
}

export interface Asteroid extends BaseCelestialBody {
    type: 'ASTEROID';

    // Unique to asteroids
    velocity: Vector2FP;
}

export type CelestialBody = Planet | Moon | Asteroid;