// ===============================================
// STATE TYPES
// ===============================================
// Core game state structure and related types.

// -----------------------------------------------
// Imports
// -----------------------------------------------

import type { FP, Vector2FP } from '../primitive-types/euclidean/euclidean-types.js';
import type { CelestialBody, Wormhole } from '../primitive-types/semantic/celestial/celestial-types.js';
import type { Entity } from '../primitive-types/semantic/entity/entity-types.js';

// -----------------------------------------------
// Zoom Level
// -----------------------------------------------

export type ZoomLevel = 'SPACE' | 'ORBIT' | 'SURFACE';

// -----------------------------------------------
// Star System
// -----------------------------------------------
// A discrete region of space anchored by a Sol.

export interface StarSystem {
    id: string;
    name: string;

    // the sol that anchors this system
    solId: string;

    // center position of this system (usually the sol's position)
    origin: Vector2FP;
}

// -----------------------------------------------
// Game State
// -----------------------------------------------
// The complete state of the universe at a given tick.

export interface GameState {
    // current simulation tick
    tick: number;

    // PCG seed used to generate this universe
    seed: string;

    // all star systems in the universe
    systems: StarSystem[];

    // all celestial bodies (sols, planets, moons, asteroids, wormholes)
    celestials: CelestialBody[];

    // all entities (ships, platforms, resource wells, mineral stores)
    entities: Entity[];
}

// -----------------------------------------------
// Genesis Configuration
// -----------------------------------------------
// Parameters for universe generation.

export interface GenesisConfig {
    // random seed for deterministic generation
    seed: string;

    // player IDs to spawn
    playerIds: string[];

    // number of star systems to generate
    systemCount: number;

    // planets per system (min, max)
    planetsPerSystem: [number, number];

    // moons per planet (min, max)
    moonsPerPlanet: [number, number];

    // asteroids per system (min, max)
    asteroidsPerSystem: [number, number];

    // distance between star systems in FP units
    systemSpacing: FP;

    // starting fuel for player ships
    playerStartingFuel: FP;

    // starting mass for player ships
    playerStartingMass: FP;
}
