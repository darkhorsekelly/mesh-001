// ===============================================
// CELESTIAL TYPES
// ===============================================
// Defines all celestial body types in the universe.
// Celestials are gravitational anchors that entities orbit or interact with.

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';

// -----------------------------------------------
// Celestial Type Union
// -----------------------------------------------

export type CelestialType = 
    | 'SOL' 
    | 'PLANET' 
    | 'MOON' 
    | 'ASTEROID' 
    | 'WORMHOLE';

// -----------------------------------------------
// Base Celestial Interface
// -----------------------------------------------

interface BaseCelestialBody {
    id: string;
    name: string;
    position: Vector2FP;

    mass: FP;
    radius: FP;

    // capture radius: entities within this distance enter ORBIT state
    captureRadius: FP;

    // gravity well Z-axis value
    z: FP;
}

// -----------------------------------------------
// Sol (Star)
// -----------------------------------------------
// The gravitational and visual anchor of a star system.
// High-energy origin; renders as bright center point.

export interface Sol extends BaseCelestialBody {
    type: 'SOL';

    // luminosity affects visibility calculations (FP, 0-1000 scale)
    luminosity: FP;

    // unique identifier for the star system this sol anchors
    systemId: string;
}

// -----------------------------------------------
// Planet
// -----------------------------------------------

export interface Planet extends BaseCelestialBody {
    type: 'PLANET';
    planetType: 'TERRESTRIAL' | 'GAS_GIANT';

    // parent sol this planet orbits
    parentSolId: string;

    // between 0 and 1000; 0 = no atmosphere, 1000 = full atmosphere
    atmosphere: FP;

    // orbital distance from parent sol
    orbitRadius: FP;

    // current orbital angle (0-360000 for 0-360 degrees)
    orbitAngle: FP;

    // orbital speed (degrees per tick in FP)
    orbitSpeed: FP;
}

// -----------------------------------------------
// Moon
// -----------------------------------------------

export interface Moon extends BaseCelestialBody {
    type: 'MOON';
    parentPlanetId: string;

    // angle in fixed-point (0-360000 for 0-360 degrees)
    orbitAngle: FP; 

    orbitSpeed: FP;

    // between 0 and 1000; 0 = no atmosphere, 1000 = full atmosphere
    atmosphere: FP;

    // fixed rail orbit radius from parent planet center
    orbitRadius: FP;
}

// -----------------------------------------------
// Asteroid
// -----------------------------------------------
// Mobile celestial that can also serve as a RESOURCE_WELL.

export interface Asteroid extends BaseCelestialBody {
    type: 'ASTEROID';

    // asteroids have velocity (mobile celestials)
    velocity: Vector2FP;

    // optional: parent belt or cluster ID
    // TODO: implement belt or cluster ID
    beltId?: string;
}

// -----------------------------------------------
// Wormhole
// -----------------------------------------------
// Non-physical celestial connecting two points in space.
// Unique: has two endpoints instead of single position.

export interface Wormhole {
    id: string;
    name: string;
    type: 'WORMHOLE';

    // wormholes have two endpoints, not a single position
    endpoints: [Vector2FP, Vector2FP];

    // visual radius at each endpoint
    radius: FP;

    // capture radius: entities within this distance can traverse; same as radius
    captureRadius: FP;

    // which star systems this wormhole connects; can be intrasystem or intersystem
    systemIds: [string, string];

    // gravity well Z-axis value; typically same as space Z-axis value
    z: FP;
}

// -----------------------------------------------
// Celestial Body Union
// -----------------------------------------------

export type CelestialBody = Sol | Planet | Moon | Asteroid | Wormhole;

// -----------------------------------------------
// Type Guards
// -----------------------------------------------

export function isSol(celestial: CelestialBody): celestial is Sol {
    return celestial.type === 'SOL';
}

export function isPlanet(celestial: CelestialBody): celestial is Planet {
    return celestial.type === 'PLANET';
}

export function isMoon(celestial: CelestialBody): celestial is Moon {
    return celestial.type === 'MOON';
}

export function isAsteroid(celestial: CelestialBody): celestial is Asteroid {
    return celestial.type === 'ASTEROID';
}

export function isWormhole(celestial: CelestialBody): celestial is Wormhole {
    return celestial.type === 'WORMHOLE';
}

// -----------------------------------------------
// Utility: Get Position(s)
// -----------------------------------------------
// Handles the wormhole dual-position case.

export function getCelestialPosition(celestial: CelestialBody): Vector2FP {
    if (isWormhole(celestial)) {
        // return first endpoint as primary position
        return celestial.endpoints[0];
    }
    return celestial.position;
}

export function getCelestialPositions(celestial: CelestialBody): Vector2FP[] {
    if (isWormhole(celestial)) {
        return [celestial.endpoints[0], celestial.endpoints[1]];
    }
    return [celestial.position];
}