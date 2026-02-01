// ===============================================
// GENESIS SERVICE
// ===============================================
// Procedural content generation for universe creation.
// Pure function: (seed, players) => GameState
//
// The Genesis algorithm creates a deterministic universe from a seed string.

import type { FP, Vector2FP } from '../primitive-types/euclidean/euclidean-types.js';
import type { 
    CelestialBody, 
    Sol, 
    Planet, 
    Moon, 
    Asteroid, 
    Wormhole 
} from '../primitive-types/semantic/celestial/celestial-types.js';
import type { Entity } from '../primitive-types/semantic/entity/entity-types.js';
import type { GameState, StarSystem, GenesisConfig } from '../state-types/state-types.js';
import { toFP, fpAdd, fpMul, fpDistanceSquared } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Seeded Random Number Generator
// -----------------------------------------------
// Deterministic PRNG using a simple hash-based approach.

export class SeededRNG {
    private seed: number;

    constructor(seedString: string) {
        // convert string to numeric seed via simple hash
        this.seed = this.hashString(seedString);
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            // REFERENCES: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash) || 1;
    }

    // returns 0-1
    next(): number {
        // This is a simple linear congruential generator; using three magic numbers and the seed
        // REFERENCES: https://en.wikipedia.org/wiki/Linear_congruential_generator
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    // returns integer in range [min, max] inclusive
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    // returns FP in range [min, max]
    nextFP(min: FP, max: FP): FP {
        const range = max - min;
        return min + Math.floor(this.next() * range) as FP;
    }

    // returns angle in FP degrees (0-360000)
    nextAngle(): FP {
        return toFP(this.next() * 360);
    }

    // returns boolean with given probability (0-1)
    nextBool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    // picks a random element from an array
    pick<T>(array: readonly T[]): T | undefined {
        if (array.length === 0) return undefined;
        const index = this.nextInt(0, array.length - 1);
        return array[index];
    }

    // shuffles an array in place (Fisher-Yates)
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            const temp = array[i];
            array[i] = array[j]!;
            array[j] = temp!;
        }
        return array;
    }
}

// -----------------------------------------------
// Default Genesis Configuration
// -----------------------------------------------

export const DEFAULT_GENESIS_CONFIG: GenesisConfig = {
    seed: 'mesh-genesis-default',
    playerIds: ['player-1', 'player-2'],
    systemCount: 2,
    planetsPerSystem: [2, 4],
    moonsPerPlanet: [0, 2],
    asteroidsPerSystem: [3, 8],
    systemSpacing: toFP(10000000),
    playerStartingFuel: toFP(500),
    playerStartingMass: toFP(1000),
};

// -----------------------------------------------
// ID Generators
// -----------------------------------------------

let idCounter = 0;

// TODO: use a better ID generator
// TODO: use a UUID generator
// TODO: use a hash function to generate the ID
// TODO: use a prefix to identify the type of entity
// TODO: use a suffix to identify the system ID
// TODO: use a separator to identify the type and system ID
// TODO: pull from a large library of names for celestial bodies and entities - keep deterministic
function generateId(prefix: string): string {
    idCounter++;
    return `${prefix}-${idCounter.toString().padStart(4, '0')}`;
}

function resetIdCounter(): void {
    idCounter = 0;
}

// -----------------------------------------------
// Create Star System
// -----------------------------------------------
// Generates a complete star system with sol, planets, moons, and asteroids.

export function createStarSystem(
    origin: Vector2FP,
    systemId: string,
    rng: SeededRNG,
    config: GenesisConfig
): { system: StarSystem; celestials: CelestialBody[]; resourceWells: Entity[] } {
    const celestials: CelestialBody[] = [];
    const resourceWells: Entity[] = [];

    // create the sol (star)
    const sol: Sol = {
        id: generateId('sol'),
        name: `Sol ${systemId}`,
        type: 'SOL',
        position: origin,
        mass: toFP(1000000000),
        radius: toFP(50000),
        captureRadius: toFP(100000),
        z: toFP(0),
        luminosity: toFP(1000),
        systemId,
    };
    celestials.push(sol);

    // create the star system record
    const system: StarSystem = {
        id: systemId,
        name: `System ${systemId}`,
        solId: sol.id,
        origin,
    };

    // generate planets
    const planetCount = rng.nextInt(config.planetsPerSystem[0], config.planetsPerSystem[1]);
    let orbitDistance = toFP(500000);

    for (let p = 0; p < planetCount; p++) {
        orbitDistance = fpAdd(orbitDistance, rng.nextFP(toFP(300000), toFP(800000)));

        const planet: Planet = {
            id: generateId('planet'),
            name: `Planet ${systemId}-${p + 1}`,
            type: 'PLANET',
            planetType: rng.next() > 0.3 ? 'TERRESTRIAL' : 'GAS_GIANT',
            parentSolId: sol.id,
            position: {
                x: fpAdd(origin.x, orbitDistance),
                y: origin.y,
            },
            mass: rng.nextFP(toFP(10000000), toFP(100000000)),
            radius: rng.nextFP(toFP(5000), toFP(20000)),
            captureRadius: rng.nextFP(toFP(30000), toFP(80000)),
            z: toFP(1),
            atmosphere: rng.nextFP(toFP(0), toFP(1000)),
            orbitRadius: orbitDistance,
            orbitAngle: rng.nextAngle(),
            orbitSpeed: rng.nextFP(toFP(1), toFP(10)),
        };
        celestials.push(planet);

        // create resource well for terrestrial planets
        if (planet.planetType === 'TERRESTRIAL') {
            const well = createResourceWell(planet.position, planet.id, 'PLANET', rng);
            resourceWells.push(well);
        }

        // generate moons for this planet
        const moonCount = rng.nextInt(config.moonsPerPlanet[0], config.moonsPerPlanet[1]);
        let moonOrbitDistance = fpAdd(planet.radius, toFP(10000));

        for (let m = 0; m < moonCount; m++) {
            moonOrbitDistance = fpAdd(moonOrbitDistance, rng.nextFP(toFP(5000), toFP(15000)));

            const moon: Moon = {
                id: generateId('moon'),
                name: `Moon ${planet.name}-${m + 1}`,
                type: 'MOON',
                parentPlanetId: planet.id,
                position: {
                    x: fpAdd(planet.position.x, moonOrbitDistance),
                    y: planet.position.y,
                },
                mass: rng.nextFP(toFP(100000), toFP(1000000)),
                radius: rng.nextFP(toFP(1000), toFP(5000)),
                captureRadius: rng.nextFP(toFP(5000), toFP(15000)),
                z: toFP(2),
                atmosphere: rng.nextFP(toFP(0), toFP(300)),
                orbitRadius: moonOrbitDistance,
                orbitAngle: rng.nextAngle(),
                orbitSpeed: rng.nextFP(toFP(5), toFP(20)),
            };
            celestials.push(moon);

            // create resource well for moon
            const moonWell = createResourceWell(moon.position, moon.id, 'MOON', rng);
            resourceWells.push(moonWell);
        }
    }

    // generate asteroids
    const asteroidCount = rng.nextInt(config.asteroidsPerSystem[0], config.asteroidsPerSystem[1]);
    const asteroidBeltRadius = fpAdd(orbitDistance, toFP(500000));

    for (let a = 0; a < asteroidCount; a++) {
        const angle = rng.nextAngle();
        const distance = fpAdd(asteroidBeltRadius, rng.nextFP(toFP(-100000), toFP(100000)));
        
        // convert polar to cartesian
        const radians = (angle / 1000) * (Math.PI / 180);
        const x = fpAdd(origin.x, toFP(Math.cos(radians) * (distance / 1000)));
        const y = fpAdd(origin.y, toFP(Math.sin(radians) * (distance / 1000)));

        const asteroid: Asteroid = {
            id: generateId('asteroid'),
            name: `Asteroid ${systemId}-${a + 1}`,
            type: 'ASTEROID',
            position: { x, y },
            velocity: {
                x: rng.nextFP(toFP(-10), toFP(10)),
                y: rng.nextFP(toFP(-10), toFP(10)),
            },
            mass: rng.nextFP(toFP(10000), toFP(500000)),
            radius: rng.nextFP(toFP(100), toFP(2000)),
            captureRadius: rng.nextFP(toFP(500), toFP(5000)),
            z: toFP(3),
            beltId: `belt-${systemId}`,
        };
        celestials.push(asteroid);

        // asteroids are also resource wells
        const asteroidWell = createResourceWell(asteroid.position, asteroid.id, 'ASTEROID', rng);
        resourceWells.push(asteroidWell);
    }

    return { system, celestials, resourceWells };
}

// -----------------------------------------------
// Create Resource Well
// -----------------------------------------------

function createResourceWell(
    // TODO: Must be deterministic but different distribution for different wellOriginType, accounting for local factors
    // TODO: This is defined in the game design doc for 0.0.1
    position: Vector2FP,
    linkedCelestialId: string,
    wellOriginType: 'ASTEROID' | 'PLANET' | 'MOON',
    rng: SeededRNG
): Entity {
    return {
        id: generateId('well'),
        type: 'RESOURCE_WELL',
        position,
        velocity: { x: 0, y: 0 },
        zoomState: 'SPACE',
        mass: rng.nextFP(toFP(50000), toFP(500000)),
        volume: toFP(0),
        fuelMass: toFP(0),
        volatilesMass: rng.nextFP(toFP(10000), toFP(100000)),
        reach: toFP(0),
        airlockSealed: false,
        opticLevel: 0,
        heading: toFP(0),
        thrust: toFP(0),
        wellOriginType,
        linkedCelestialId,
    };
}

// -----------------------------------------------
// Create Wormhole
// -----------------------------------------------
// Links two star systems together.

function createWormhole(
    system1Origin: Vector2FP,
    system2Origin: Vector2FP,
    system1Id: string,
    system2Id: string,
    rng: SeededRNG
): Wormhole {
    // place endpoints offset from system centers
    const offset1 = rng.nextFP(toFP(1000000), toFP(2000000));
    const offset2 = rng.nextFP(toFP(1000000), toFP(2000000));
    const angle1 = rng.nextAngle();
    const angle2 = rng.nextAngle();

    const rad1 = (angle1 / 1000) * (Math.PI / 180);
    const rad2 = (angle2 / 1000) * (Math.PI / 180);

    const endpointA: Vector2FP = {
        x: fpAdd(system1Origin.x, toFP(Math.cos(rad1) * (offset1 / 1000))),
        y: fpAdd(system1Origin.y, toFP(Math.sin(rad1) * (offset1 / 1000))),
    };

    const endpointB: Vector2FP = {
        x: fpAdd(system2Origin.x, toFP(Math.cos(rad2) * (offset2 / 1000))),
        y: fpAdd(system2Origin.y, toFP(Math.sin(rad2) * (offset2 / 1000))),
    };

    return {
        id: generateId('wormhole'),
        name: `Wormhole ${system1Id}-${system2Id}`,
        type: 'WORMHOLE',
        endpoints: [endpointA, endpointB],
        radius: toFP(5000),
        captureRadius: toFP(20000),
        systemIds: [system1Id, system2Id],
        z: toFP(-1),
    };
}

// -----------------------------------------------
// Find Safe Spawn
// -----------------------------------------------
// Finds a coordinate that is NOT within any captureRadius of a celestial.

export function findSafeSpawn(
    celestials: CelestialBody[],
    systemOrigin: Vector2FP,
    rng: SeededRNG,
    maxAttempts: number = 100
): Vector2FP {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // generate random position within reasonable distance of system origin
        const distance = rng.nextFP(toFP(200000), toFP(800000));
        const angle = rng.nextAngle();
        const radians = (angle / 1000) * (Math.PI / 180);

        const candidate: Vector2FP = {
            x: fpAdd(systemOrigin.x, toFP(Math.cos(radians) * (distance / 1000))),
            y: fpAdd(systemOrigin.y, toFP(Math.sin(radians) * (distance / 1000))),
        };

        // check if candidate is safe (outside all capture radii)
        let isSafe = true;
        for (const celestial of celestials) {
            const positions = getCelestialPositionsForCheck(celestial);
            const captureRadius = getCaptureRadius(celestial);
            const captureRadiusSq = fpMul(captureRadius, captureRadius);

            for (const pos of positions) {
                const distSq = fpDistanceSquared(candidate, pos);
                if (distSq <= captureRadiusSq) {
                    isSafe = false;
                    break;
                }
            }
            if (!isSafe) break;
        }

        if (isSafe) {
            return candidate;
        }
    }

    // fallback: return a position far from origin if no safe spot found
    console.warn('Genesis: Could not find safe spawn after max attempts, using fallback');
    return {
        x: fpAdd(systemOrigin.x, toFP(3000000)),
        y: fpAdd(systemOrigin.y, toFP(3000000)),
    };
}

// helper to get positions for collision check
function getCelestialPositionsForCheck(celestial: CelestialBody): Vector2FP[] {
    if (celestial.type === 'WORMHOLE') {
        return celestial.endpoints;
    }
    return [celestial.position];
}

// helper to get capture radius
function getCaptureRadius(celestial: CelestialBody): FP {
    return celestial.captureRadius;
}

// -----------------------------------------------
// Create Player Ship
// -----------------------------------------------
// Player ships are containers with modest cargo capacity.
// This enables logistics operations (LOAD/UNLOAD mineral stores).

function createFirstPlayerEntity(
    playerId: string,
    position: Vector2FP,
    config: GenesisConfig
): Entity {
    return {
        id: generateId('player-entity'),
        type: 'ENTITY',
        playerId,
        position,
        velocity: { x: 0, y: 0 },
        zoomState: 'SPACE',
        mass: config.playerStartingMass,
        volume: toFP(100),
        fuelMass: config.playerStartingFuel,
        volatilesMass: toFP(0),
        reach: toFP(500),
        airlockSealed: true,
        opticLevel: 1,
        heading: toFP(0),
        thrust: toFP(0),
        // container properties - all player ships can hold cargo
        isContainer: true,
        containerVolume: toFP(2000),
        inOpacity: toFP(500),
    };
}

// -----------------------------------------------
// Generate Universe
// -----------------------------------------------
// Main entry point: (seed, players) => GameState

export function generateUniverse(
    seed: string,
    playerIds: string[],
    configOverrides: Partial<GenesisConfig> = {}
): GameState {
    // reset ID counter for deterministic generation
    resetIdCounter();

    const config: GenesisConfig = {
        ...DEFAULT_GENESIS_CONFIG,
        ...configOverrides,
        seed,
        playerIds,
    };

    const rng = new SeededRNG(seed);

    const systems: StarSystem[] = [];
    const celestials: CelestialBody[] = [];
    const entities: Entity[] = [];

    // generate star systems
    const systemOrigins: Vector2FP[] = [];

    for (let s = 0; s < config.systemCount; s++) {
        const origin: Vector2FP = {
            x: fpMul(toFP(s), config.systemSpacing),
            y: toFP(0),
        };
        systemOrigins.push(origin);

        const systemId = `system-${s + 1}`;
        const result = createStarSystem(origin, systemId, rng, config);

        systems.push(result.system);
        celestials.push(...result.celestials);
        entities.push(...result.resourceWells);
    }

    // create wormhole linking systems (if more than one system)
    if (config.systemCount >= 2 && systemOrigins.length >= 2 && systems.length >= 2) {
        const origin1 = systemOrigins[0];
        const origin2 = systemOrigins[1];
        const system1 = systems[0];
        const system2 = systems[1];

        if (origin1 && origin2 && system1 && system2) {
            const wormhole = createWormhole(
                origin1,
                origin2,
                system1.id,
                system2.id,
                rng
            );
            celestials.push(wormhole);
        }
    }

    // spawn players in safe zones
    for (let i = 0; i < playerIds.length; i++) {
        const playerId = playerIds[i];
        if (!playerId) continue;
        
        // distribute players across systems
        const systemIndex = i % config.systemCount;
        const systemOrigin = systemOrigins[systemIndex];
        if (!systemOrigin) continue;

        // find safe spawn location
        const spawnPosition = findSafeSpawn(celestials, systemOrigin, rng);

        // create player ship
        const playerShip = createFirstPlayerEntity(playerId, spawnPosition, config);
        entities.push(playerShip);
    }

    return {
        tick: 0,
        seed,
        systems,
        celestials,
        entities,
    };
}

// -----------------------------------------------
// Verification Helpers
// -----------------------------------------------
// Used by verification scripts.

// TODO: This is not efficient; we should use a more efficient algorithm / spatial index
export function isPositionSafe(
    position: Vector2FP,
    celestials: CelestialBody[]
): boolean {
    for (const celestial of celestials) {
        const positions = getCelestialPositionsForCheck(celestial);
        const captureRadius = getCaptureRadius(celestial);
        const captureRadiusSq = fpMul(captureRadius, captureRadius);

        for (const pos of positions) {
            const distSq = fpDistanceSquared(position, pos);
            if (distSq <= captureRadiusSq) {
                return false;
            }
        }
    }
    return true;
}
