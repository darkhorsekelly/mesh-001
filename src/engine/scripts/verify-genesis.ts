// ===============================================
// GENESIS VERIFICATION SCRIPT
// ===============================================
// Validates the procedural content generation system.
// Run with: npx tsx src/engine/scripts/verify-genesis.ts

import { generateUniverse, isPositionSafe } from '../genesis/genesisService.js';
import { isWormhole, isSol, isPlanet, isMoon, isAsteroid } from '../primitive-types/semantic/celestial/celestial-types.js';
import { fromFP } from '../primitive-types/euclidean/euclidean-types.js';
import type { GameState } from '../state-types/state-types.js';

// -----------------------------------------------
// Test: Basic Generation
// -----------------------------------------------

function testBasicGeneration(): boolean {
    console.log('\n--- TEST: Basic Generation ---');

    const seed = 'test-seed-alpha';
    const playerIds = ['player-1', 'player-2'];

    const state = generateUniverse(seed, playerIds);

    console.log(`  Seed: ${state.seed}`);
    console.log(`  Systems: ${state.systems.length}`);
    console.log(`  Celestials: ${state.celestials.length}`);
    console.log(`  Entities: ${state.entities.length}`);

    // verify basic structure
    if (state.systems.length < 1) {
        console.log('  [FAIL] No star systems generated');
        return false;
    }
    if (state.celestials.length < 1) {
        console.log('  [FAIL] No celestials generated');
        return false;
    }
    if (state.entities.length < playerIds.length) {
        console.log('  [FAIL] Not all players spawned');
        return false;
    }

    console.log('  [PASS] Basic generation successful');
    return true;
}

// -----------------------------------------------
// Test: Celestial Types
// -----------------------------------------------

function testCelestialTypes(): boolean {
    console.log('\n--- TEST: Celestial Types ---');

    const state = generateUniverse('celestial-types-test', ['p1', 'p2']);

    const sols = state.celestials.filter(isSol);
    const planets = state.celestials.filter(isPlanet);
    const moons = state.celestials.filter(isMoon);
    const asteroids = state.celestials.filter(isAsteroid);
    const wormholes = state.celestials.filter(isWormhole);

    console.log(`  Sols: ${sols.length}`);
    console.log(`  Planets: ${planets.length}`);
    console.log(`  Moons: ${moons.length}`);
    console.log(`  Asteroids: ${asteroids.length}`);
    console.log(`  Wormholes: ${wormholes.length}`);

    // verify sols exist (one per system)
    if (sols.length !== state.systems.length) {
        console.log(`  [FAIL] Expected ${state.systems.length} sols, got ${sols.length}`);
        return false;
    }

    // verify at least some planets
    if (planets.length === 0) {
        console.log('  [FAIL] No planets generated');
        return false;
    }

    // verify at least some asteroids
    if (asteroids.length === 0) {
        console.log('  [FAIL] No asteroids generated');
        return false;
    }

    // verify wormhole exists when multiple systems
    if (state.systems.length >= 2 && wormholes.length === 0) {
        console.log('  [FAIL] No wormhole connecting systems');
        return false;
    }

    console.log('  [PASS] All celestial types present');
    return true;
}

// -----------------------------------------------
// Test: Wormhole Endpoints
// -----------------------------------------------

function testWormholeEndpoints(): boolean {
    console.log('\n--- TEST: Wormhole Endpoints ---');

    const state = generateUniverse('wormhole-test', ['p1', 'p2']);
    const wormholes = state.celestials.filter(isWormhole);

    if (wormholes.length === 0) {
        console.log('  [SKIP] No wormholes in single-system universe');
        return true;
    }

    for (const wormhole of wormholes) {
        const [endpointA, endpointB] = wormhole.endpoints;

        console.log(`  Wormhole: ${wormhole.name}`);
        console.log(`    Endpoint A: (${fromFP(endpointA.x).toFixed(0)}, ${fromFP(endpointA.y).toFixed(0)})`);
        console.log(`    Endpoint B: (${fromFP(endpointB.x).toFixed(0)}, ${fromFP(endpointB.y).toFixed(0)})`);
        console.log(`    Systems: ${wormhole.systemIds.join(' <-> ')}`);

        // verify endpoints are distinct
        if (endpointA.x === endpointB.x && endpointA.y === endpointB.y) {
            console.log('  [FAIL] Wormhole endpoints are identical');
            return false;
        }

        // verify endpoint distance is significant (should be in different systems)
        const dx = fromFP(endpointA.x) - fromFP(endpointB.x);
        const dy = fromFP(endpointA.y) - fromFP(endpointB.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        console.log(`    Distance: ${distance.toFixed(0)} units`);

        if (distance < 1000000) {
            console.log('  [WARN] Wormhole endpoints are unusually close');
        }
    }

    console.log('  [PASS] Wormhole has distinct endpoints');
    return true;
}

// -----------------------------------------------
// Test: Player Safe Spawn
// -----------------------------------------------

function testPlayerSafeSpawn(): boolean {
    console.log('\n--- TEST: Player Safe Spawn ---');

    const state = generateUniverse('safe-spawn-test', ['player-1', 'player-2']);

    // find player ships
    const playerShips = state.entities.filter(e => e.type === 'ENTITY' && e.playerId);

    console.log(`  Player ships: ${playerShips.length}`);

    let allSafe = true;
    for (const ship of playerShips) {
        const isSafe = isPositionSafe(ship.position, state.celestials);

        console.log(`  ${ship.playerId}:`);
        console.log(`    Position: (${fromFP(ship.position.x).toFixed(0)}, ${fromFP(ship.position.y).toFixed(0)})`);
        console.log(`    Safe: ${isSafe ? 'YES' : 'NO'}`);

        if (!isSafe) {
            allSafe = false;
            console.log(`    [FAIL] Player spawned inside capture radius!`);
        }
    }

    if (!allSafe) {
        console.log('  [FAIL] Some players spawned in unsafe locations');
        return false;
    }

    console.log('  [PASS] All players spawned in safe locations');
    return true;
}

// -----------------------------------------------
// Test: Determinism
// -----------------------------------------------

function testDeterminism(): boolean {
    console.log('\n--- TEST: Determinism ---');

    const seed = 'determinism-test-seed';
    const playerIds = ['p1', 'p2'];

    // generate twice with same seed
    const state1 = generateUniverse(seed, playerIds);
    const state2 = generateUniverse(seed, playerIds);

    // compare key properties
    const checks = [
        {
            name: 'System count',
            match: state1.systems.length === state2.systems.length,
        },
        {
            name: 'Celestial count',
            match: state1.celestials.length === state2.celestials.length,
        },
        {
            name: 'Entity count',
            match: state1.entities.length === state2.entities.length,
        },
        {
            name: 'First sol position',
            match: (() => {
                const sol1 = state1.celestials.find(isSol);
                const sol2 = state2.celestials.find(isSol);
                return sol1 && sol2 && 
                    sol1.position.x === sol2.position.x && 
                    sol1.position.y === sol2.position.y;
            })(),
        },
        {
            name: 'First planet position',
            match: (() => {
                const planet1 = state1.celestials.find(isPlanet);
                const planet2 = state2.celestials.find(isPlanet);
                return planet1 && planet2 && 
                    planet1.position.x === planet2.position.x && 
                    planet1.position.y === planet2.position.y;
            })(),
        },
    ];

    let allMatch = true;
    for (const check of checks) {
        console.log(`  ${check.name}: ${check.match ? 'MATCH' : 'MISMATCH'}`);
        if (!check.match) allMatch = false;
    }

    if (!allMatch) {
        console.log('  [FAIL] Generation not deterministic');
        return false;
    }

    console.log('  [PASS] Generation is deterministic');
    return true;
}

// -----------------------------------------------
// Test: Resource Wells
// -----------------------------------------------

function testResourceWells(): boolean {
    console.log('\n--- TEST: Resource Wells ---');

    const state = generateUniverse('resource-well-test', ['p1']);

    const resourceWells = state.entities.filter(e => e.type === 'RESOURCE_WELL');

    console.log(`  Resource wells: ${resourceWells.length}`);

    if (resourceWells.length === 0) {
        console.log('  [FAIL] No resource wells generated');
        return false;
    }

    // check well types
    const asteroidWells = resourceWells.filter(w => w.wellOriginType === 'ASTEROID');
    const planetWells = resourceWells.filter(w => w.wellOriginType === 'PLANET');
    const moonWells = resourceWells.filter(w => w.wellOriginType === 'MOON');

    console.log(`    Asteroid wells: ${asteroidWells.length}`);
    console.log(`    Planet wells: ${planetWells.length}`);
    console.log(`    Moon wells: ${moonWells.length}`);

    // verify wells have resources
    let wellsWithResources = 0;
    for (const well of resourceWells) {
        if (well.volatilesMass > 0 || well.mass > 0) {
            wellsWithResources++;
        }
    }

    console.log(`  Wells with resources: ${wellsWithResources}/${resourceWells.length}`);

    if (wellsWithResources === 0) {
        console.log('  [FAIL] No wells have resources');
        return false;
    }

    console.log('  [PASS] Resource wells generated correctly');
    return true;
}

// -----------------------------------------------
// Test: Universe Stats
// -----------------------------------------------

function testUniverseStats(): void {
    console.log('\n--- Universe Stats (Informational) ---');

    const state = generateUniverse('stats-seed', ['p1', 'p2']);

    console.log('\n  Celestial Breakdown:');
    const celestialTypes: Record<string, number> = {};
    for (const c of state.celestials) {
        celestialTypes[c.type] = (celestialTypes[c.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(celestialTypes)) {
        console.log(`    ${type}: ${count}`);
    }

    console.log('\n  Entity Breakdown:');
    const entityTypes: Record<string, number> = {};
    for (const e of state.entities) {
        entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(entityTypes)) {
        console.log(`    ${type}: ${count}`);
    }

    console.log('\n  System Details:');
    for (const system of state.systems) {
        const sol = state.celestials.find(c => isSol(c) && c.id === system.solId);
        const planets = state.celestials.filter(c => isPlanet(c) && c.parentSolId === sol?.id);
        console.log(`    ${system.name}:`);
        console.log(`      Sol: ${sol?.name || 'NOT FOUND'}`);
        console.log(`      Planets: ${planets.length}`);
    }
}

// -----------------------------------------------
// Main Execution
// -----------------------------------------------

function main(): void {
    console.log('='.repeat(60));
    console.log('GENESIS VERIFICATION');
    console.log('='.repeat(60));

    const results: boolean[] = [];

    results.push(testBasicGeneration());
    results.push(testCelestialTypes());
    results.push(testWormholeEndpoints());
    results.push(testPlayerSafeSpawn());
    results.push(testDeterminism());
    results.push(testResourceWells());

    // informational only, not a pass/fail test
    testUniverseStats();

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`Tests passed: ${passed}/${total}`);

    if (passed === total) {
        console.log('\n[SUCCESS] All tests passed!');
    } else {
        console.log('\n[FAILURE] Some tests failed.');
        process.exit(1);
    }
}

main();
