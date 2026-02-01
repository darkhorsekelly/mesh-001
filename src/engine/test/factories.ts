// ===============================================
// TEST FACTORIES
// ===============================================
// single source of truth for test entity and state creation.
// all test files must use these factories to ensure consistency
// with the latest Entity and Celestial schemas.

import type { Entity, VisibilityLevel, EntityType } from '../primitive-types/semantic/entity/entity-types.js';
import type { CelestialBody, Sol, Planet, Moon, Asteroid } from '../primitive-types/semantic/celestial/celestial-types.js';
import type { GameState, StarSystem } from '../state-types/state-types.js';
import type { TickContext } from '../resolvers/actions/actionTypes.js';
import { VECTOR_ZERO, toFP, type FP, type Vector2FP } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Entity Factories
// -----------------------------------------------

export interface ShipOverrides {
    id?: string;
    playerId?: string;
    position?: Vector2FP;
    velocity?: Vector2FP;
    heading?: FP;
    thrust?: FP;
    reach?: FP;
    mass?: FP;
    volume?: FP;
    airlockSealed?: boolean;
    volatilesMass?: FP;
    fuelMass?: FP;
    opticLevel?: VisibilityLevel;
    // container properties
    parentId?: string;
    isContainer?: boolean;
    containerVolume?: FP;
}

/**
 * creates a player-controlled ship entity with sensible defaults.
 * use overrides to customize specific properties for test scenarios.
 * 
 * NOTE: ships are containers by default with modest cargo capacity.
 * this enables the ChaosAgent to test LOAD/UNLOAD cycles.
 */
export function createShip(overrides: ShipOverrides = {}): Entity {
    return {
        id: overrides.id ?? 'ship-001',
        type: 'ENTITY',
        playerId: overrides.playerId ?? 'player-001',
        zoomState: 'SPACE',
        position: overrides.position ?? { x: toFP(0), y: toFP(0) },
        velocity: overrides.velocity ?? VECTOR_ZERO,
        heading: overrides.heading ?? toFP(0),
        thrust: overrides.thrust ?? toFP(0),
        reach: overrides.reach ?? toFP(500),
        mass: overrides.mass ?? toFP(1000),
        volume: overrides.volume ?? toFP(500),
        airlockSealed: overrides.airlockSealed ?? true,
        volatilesMass: overrides.volatilesMass ?? toFP(0),
        fuelMass: overrides.fuelMass ?? toFP(100),
        opticLevel: overrides.opticLevel ?? (0 as VisibilityLevel),
        // container properties - ships are containers by default
        parentId: overrides.parentId,
        isContainer: overrides.isContainer ?? true,
        containerVolume: overrides.containerVolume ?? toFP(2000),
    };
}

export interface ResourceWellOverrides {
    id?: string;
    position?: Vector2FP;
    velocity?: Vector2FP;
    mass?: FP;
    volume?: FP;
    volatilesMass?: FP;
    linkedCelestialId?: string;
}

/**
 * creates a resource well entity for extraction tests.
 * wells are non-player entities that hold extractable resources.
 */
export function createResourceWell(overrides: ResourceWellOverrides = {}): Entity {
    return {
        id: overrides.id ?? 'well-001',
        type: 'RESOURCE_WELL',
        zoomState: 'SPACE',
        position: overrides.position ?? { x: toFP(100), y: toFP(0) },
        velocity: overrides.velocity ?? VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: toFP(0),
        mass: overrides.mass ?? toFP(50000),
        volume: overrides.volume ?? toFP(100000),
        airlockSealed: false,
        volatilesMass: overrides.volatilesMass ?? toFP(10000),
        fuelMass: toFP(0),
        opticLevel: 0 as VisibilityLevel,
        linkedCelestialId: overrides.linkedCelestialId,
    };
}

export interface MineralStoreOverrides {
    id?: string;
    position?: Vector2FP;
    velocity?: Vector2FP;
    mass?: FP;
    volume?: FP;
    parentId?: string;
}

/**
 * creates a mineral store entity (spawned by mineral extraction).
 * mineral stores are small and can be loaded into containers.
 */
export function createMineralStore(overrides: MineralStoreOverrides = {}): Entity {
    return {
        id: overrides.id ?? 'mineral-store-001',
        type: 'MINERAL_STORE',
        zoomState: 'SPACE',
        position: overrides.position ?? { x: toFP(0), y: toFP(0) },
        velocity: overrides.velocity ?? VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: toFP(0),
        mass: overrides.mass ?? toFP(1000),
        volume: overrides.volume ?? toFP(100),
        airlockSealed: false,
        volatilesMass: toFP(0),
        fuelMass: toFP(0),
        opticLevel: 0 as VisibilityLevel,
        parentId: overrides.parentId,
        isContainer: false,
        containerVolume: toFP(0),
    };
}

// -----------------------------------------------
// Container Entity Factory
// -----------------------------------------------

export interface ContainerOverrides {
    id?: string;
    playerId?: string;
    position?: Vector2FP;
    velocity?: Vector2FP;
    reach?: FP;
    mass?: FP;
    volume?: FP;
    containerVolume?: FP;
    inOpacity?: FP;
    fuelMass?: FP;
}

/**
 * creates a container entity (hauler, cargo bay, etc).
 * containers can hold other entities via the LOAD action.
 */
export function createContainer(overrides: ContainerOverrides = {}): Entity {
    return {
        id: overrides.id ?? 'container-001',
        type: 'ENTITY',
        playerId: overrides.playerId,
        zoomState: 'SPACE',
        position: overrides.position ?? { x: toFP(0), y: toFP(0) },
        velocity: overrides.velocity ?? VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: overrides.reach ?? toFP(500),
        mass: overrides.mass ?? toFP(2000),
        volume: overrides.volume ?? toFP(1000),
        airlockSealed: true,
        volatilesMass: toFP(0),
        fuelMass: overrides.fuelMass ?? toFP(50),
        opticLevel: 0 as VisibilityLevel,
        // container-specific properties
        isContainer: true,
        containerVolume: overrides.containerVolume ?? toFP(5000),
        inOpacity: overrides.inOpacity ?? toFP(500),
    };
}

/**
 * creates a hauler entity specifically designed for cargo transport.
 * haulers have high container volume and moderate reach.
 */
export function createHauler(overrides: ContainerOverrides = {}): Entity {
    return createContainer({
        id: overrides.id ?? 'hauler-001',
        containerVolume: overrides.containerVolume ?? toFP(10000),
        mass: overrides.mass ?? toFP(5000),
        volume: overrides.volume ?? toFP(2000),
        reach: overrides.reach ?? toFP(300),
        ...overrides,
    });
}

// -----------------------------------------------
// Celestial Factories
// -----------------------------------------------

export interface SolOverrides {
    id?: string;
    name?: string;
    position?: Vector2FP;
    mass?: FP;
    radius?: FP;
    captureRadius?: FP;
    luminosity?: FP;
    systemId?: string;
}

/**
 * creates a sol (star) celestial body.
 */
export function createSol(overrides: SolOverrides = {}): Sol {
    return {
        id: overrides.id ?? 'sol-001',
        name: overrides.name ?? 'Test Sol',
        type: 'SOL',
        position: overrides.position ?? { x: toFP(0), y: toFP(0) },
        mass: overrides.mass ?? toFP(1000000),
        radius: overrides.radius ?? toFP(50000),
        captureRadius: overrides.captureRadius ?? toFP(100000),
        z: toFP(0),
        luminosity: overrides.luminosity ?? toFP(1000),
        systemId: overrides.systemId ?? 'system-001',
    };
}

export interface PlanetOverrides {
    id?: string;
    name?: string;
    position?: Vector2FP;
    mass?: FP;
    radius?: FP;
    captureRadius?: FP;
    parentSolId?: string;
    atmosphere?: FP;
    orbitRadius?: FP;
    orbitAngle?: FP;
    orbitSpeed?: FP;
}

/**
 * creates a planet celestial body.
 */
export function createPlanet(overrides: PlanetOverrides = {}): Planet {
    return {
        id: overrides.id ?? 'planet-001',
        name: overrides.name ?? 'Test Planet',
        type: 'PLANET',
        planetType: 'TERRESTRIAL',
        position: overrides.position ?? { x: toFP(500000), y: toFP(0) },
        mass: overrides.mass ?? toFP(100000),
        radius: overrides.radius ?? toFP(10000),
        captureRadius: overrides.captureRadius ?? toFP(20000),
        z: toFP(0),
        parentSolId: overrides.parentSolId ?? 'sol-001',
        atmosphere: overrides.atmosphere ?? toFP(500),
        orbitRadius: overrides.orbitRadius ?? toFP(500000),
        orbitAngle: overrides.orbitAngle ?? toFP(0),
        orbitSpeed: overrides.orbitSpeed ?? toFP(1),
    };
}

export interface AsteroidOverrides {
    id?: string;
    name?: string;
    position?: Vector2FP;
    velocity?: Vector2FP;
    mass?: FP;
    radius?: FP;
    captureRadius?: FP;
}

/**
 * creates an asteroid celestial body.
 */
export function createAsteroid(overrides: AsteroidOverrides = {}): Asteroid {
    return {
        id: overrides.id ?? 'asteroid-001',
        name: overrides.name ?? 'Test Asteroid',
        type: 'ASTEROID',
        position: overrides.position ?? { x: toFP(200000), y: toFP(100000) },
        velocity: overrides.velocity ?? VECTOR_ZERO,
        mass: overrides.mass ?? toFP(5000),
        radius: overrides.radius ?? toFP(500),
        captureRadius: overrides.captureRadius ?? toFP(1000),
        z: toFP(0),
    };
}

// -----------------------------------------------
// Game State Factory
// -----------------------------------------------

export interface GameStateOverrides {
    tick?: number;
    seed?: string;
    systems?: StarSystem[];
    celestials?: CelestialBody[];
    entities?: Entity[];
}

/**
 * creates a minimal game state for testing.
 * defaults to a single system with one sol.
 */
export function createGameState(overrides: GameStateOverrides = {}): GameState {
    const defaultSystem: StarSystem = {
        id: 'system-001',
        name: 'Test System',
        solId: 'sol-001',
        origin: { x: toFP(0), y: toFP(0) },
    };

    return {
        tick: overrides.tick ?? 0,
        seed: overrides.seed ?? 'test-seed',
        systems: overrides.systems ?? [defaultSystem],
        celestials: overrides.celestials ?? [createSol()],
        entities: overrides.entities ?? [],
    };
}

// -----------------------------------------------
// Context Factory
// -----------------------------------------------

/**
 * creates a tick context for action handler testing.
 * wraps a game state in a read-only context structure.
 */
export function createTickContext(
    tick: number,
    entities: Entity[],
    celestials: CelestialBody[] = []
): TickContext {
    const state: GameState = {
        tick,
        seed: 'test-seed',
        systems: [{
            id: 'system-001',
            name: 'Test System',
            solId: 'sol-001',
            origin: { x: toFP(0), y: toFP(0) },
        }],
        entities,
        celestials,
    };

    return {
        tick,
        entities,
        state,
    };
}

/**
 * creates a context from an existing game state.
 */
export function createContextFromState(state: GameState): TickContext {
    return {
        tick: state.tick,
        entities: state.entities,
        state,
    };
}
