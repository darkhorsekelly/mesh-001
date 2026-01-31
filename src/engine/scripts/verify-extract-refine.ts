// ===============================================
// EXTRACT & REFINE VERIFICATION SCRIPT
// ===============================================
// Validates resource extraction and refining logic.
// Run with: npx tsx src/engine/scripts/verify-extract-refine.ts

import type { Entity, VisibilityLevel } from '../primitive-types/semantic/entity/entity-types.js';
import type { TickContext } from '../resolvers/actions/actionTypes.js';
import type { GameState } from '../state-types/state-types.js';
import { VECTOR_ZERO, toFP, fromFP } from '../primitive-types/euclidean/euclidean-types.js';
import { extractHandler, extractValidate } from '../resolvers/actions/extractHandler.js';
import { refineHandler, refineValidate } from '../resolvers/actions/refineHandler.js';
import { REFINE_EFFICIENCY, REFINE_MAX_BATCH } from '../config/engineConfig.js';

// -----------------------------------------------
// Test Entity Factories
// -----------------------------------------------

function createShip(overrides: Partial<Entity> = {}): Entity {
    return {
        id: 'ship-001',
        type: 'ENTITY',
        playerId: 'player-001',
        zoomState: 'SPACE',
        position: { x: toFP(0), y: toFP(0) },
        velocity: VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: toFP(500),
        mass: toFP(1000),
        volume: toFP(500),
        airlockSealed: true,
        volatilesMass: toFP(0),
        fuelMass: toFP(100),
        opticLevel: 0 as VisibilityLevel,
        ...overrides,
    };
}

// TODO: create a mineral store entity
function createResourceWell(overrides: Partial<Entity> = {}): Entity {
    return {
        id: 'well-001',
        type: 'RESOURCE_WELL',
        zoomState: 'SPACE',
        position: { x: toFP(100), y: toFP(0) },
        velocity: VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: toFP(0),

        // mass = mineral mass
        mass: toFP(50000),
        volume: toFP(100000),
        airlockSealed: false,
        volatilesMass: toFP(10000),
        fuelMass: toFP(0),
        opticLevel: 0 as VisibilityLevel,
        ...overrides,
    };
}

function createMockContext(tick: number, entities: Entity[]): TickContext {
    return {
        tick,
        entities,
        state: {
            tick,
            seed: 'test-seed',
            systems: [],
            entities,
            celestials: [],
        },
    };
}

// -----------------------------------------------
// Test: Extract Volatiles
// -----------------------------------------------

function testExtractVolatiles(): boolean {
    console.log('\n--- TEST: Extract Volatiles ---');

    const ship = createShip();
    const well = createResourceWell();
    const context = createMockContext(1, [ship, well]);

    const inputs = {
        resourceType: 'VOLATILES',
        rate: toFP(500),
    };

    // validation should pass
    const isValid = extractValidate(ship, [well], inputs);
    console.log(`  Validation: ${isValid ? 'PASS' : 'FAIL'}`);

    if (!isValid) {
        console.log('  [FAIL] Validation unexpectedly failed');
        return false;
    }

    // execute extraction
    const updates = extractHandler(ship, [well], inputs, context);
    console.log(`  Updates returned: ${updates.length}`);

    // verify updates
    const wellUpdate = updates.find(u => u.id === well.id);
    const shipUpdate = updates.find(u => u.id === ship.id);

    if (!wellUpdate || !shipUpdate) {
        console.log('  [FAIL] Missing expected updates');
        return false;
    }

    const wellNewVolatiles = wellUpdate.changes.volatilesMass;
    const shipNewVolatiles = shipUpdate.changes.volatilesMass;

    console.log(`  Well volatiles: ${fromFP(well.volatilesMass)} -> ${fromFP(wellNewVolatiles!)}`);
    console.log(`  Ship volatiles: ${fromFP(ship.volatilesMass)} -> ${fromFP(shipNewVolatiles!)}`);

    // well should decrease by 500, ship should increase by 500
    const expectedWellVolatiles = toFP(10000 - 500);
    const expectedShipVolatiles = toFP(0 + 500);

    if (wellNewVolatiles !== expectedWellVolatiles) {
        console.log(`  [FAIL] Well volatiles expected ${fromFP(expectedWellVolatiles)}, got ${fromFP(wellNewVolatiles!)}`);
        return false;
    }
    if (shipNewVolatiles !== expectedShipVolatiles) {
        console.log(`  [FAIL] Ship volatiles expected ${fromFP(expectedShipVolatiles)}, got ${fromFP(shipNewVolatiles!)}`);
        return false;
    }

    console.log('  [PASS] Volatiles extraction correct');
    return true;
}

// -----------------------------------------------
// Test: Extract Minerals
// -----------------------------------------------

function testExtractMinerals(): boolean {
    console.log('\n--- TEST: Extract Minerals ---');

    const ship = createShip();
    const well = createResourceWell();
    const context = createMockContext(1, [ship, well]);

    const targetPosition = { x: toFP(50), y: toFP(50) };

    const inputs = {
        resourceType: 'MINERALS',
        rate: toFP(1000),
        mineralTargetPosition: [targetPosition],
    };

    // validation should pass
    const isValid = extractValidate(ship, [well], inputs);
    console.log(`  Validation: ${isValid ? 'PASS' : 'FAIL'}`);

    if (!isValid) {
        console.log('  [FAIL] Validation unexpectedly failed');
        return false;
    }

    // execute extraction
    const updates = extractHandler(ship, [well], inputs, context);
    console.log(`  Updates returned: ${updates.length}`);

    // verify updates
    const wellUpdate = updates.find(u => u.id === well.id);
    const mineralStore = updates.find(u => u.id.startsWith('mineral-store-'));

    if (!wellUpdate) {
        console.log('  [FAIL] Missing well update');
        return false;
    }
    if (!mineralStore) {
        console.log('  [FAIL] Missing mineral store spawn');
        return false;
    }

    console.log(`  Well mass: ${fromFP(well.mass)} -> ${fromFP(wellUpdate.changes.mass!)}`);
    console.log(`  Mineral store ID: ${mineralStore.id}`);
    console.log(`  Mineral store mass: ${fromFP(mineralStore.changes.mass!)}`);
    console.log(`  Mineral store position: (${fromFP(mineralStore.changes.position!.x)}, ${fromFP(mineralStore.changes.position!.y)})`);

    // verify mineral store spawned at correct position
    if (mineralStore.changes.position!.x !== targetPosition.x ||
        mineralStore.changes.position!.y !== targetPosition.y) {
        console.log('  [FAIL] Mineral store at wrong position');
        return false;
    }

    console.log('  [PASS] Minerals extraction correct');
    return true;
}

// -----------------------------------------------
// Test: Refine Volatiles
// -----------------------------------------------

function testRefine(): boolean {
    console.log('\n--- TEST: Refine Volatiles ---');

    // ship with volatiles to refine
    const ship = createShip({
        volatilesMass: toFP(1000),
        fuelMass: toFP(100),
        mass: toFP(2000),
    });
    const context = createMockContext(2, [ship]);

    const inputs = {
        volatilesAmount: toFP(500),
    };

    // validation should pass
    const isValid = refineValidate(ship, [], inputs);
    console.log(`  Validation: ${isValid ? 'PASS' : 'FAIL'}`);

    if (!isValid) {
        console.log('  [FAIL] Validation unexpectedly failed');
        return false;
    }

    // execute refining
    const updates = refineHandler(ship, [], inputs, context);
    console.log(`  Updates returned: ${updates.length}`);

    const shipUpdate = updates.find(u => u.id === ship.id);
    if (!shipUpdate) {
        console.log('  [FAIL] Missing ship update');
        return false;
    }

    const newVolatiles = shipUpdate.changes.volatilesMass!;
    const newFuel = shipUpdate.changes.fuelMass!;
    const newMass = shipUpdate.changes.mass!;

    console.log(`  Config: REFINE_EFFICIENCY = ${fromFP(REFINE_EFFICIENCY)} (${fromFP(REFINE_EFFICIENCY) * 100}%)`);
    console.log(`  Config: REFINE_MAX_BATCH = ${fromFP(REFINE_MAX_BATCH)}`);
    console.log(`  Volatiles: ${fromFP(ship.volatilesMass)} -> ${fromFP(newVolatiles)}`);
    console.log(`  Fuel: ${fromFP(ship.fuelMass)} -> ${fromFP(newFuel)}`);
    console.log(`  Mass: ${fromFP(ship.mass)} -> ${fromFP(newMass)}`);

    // calculate expected values
    // input: 500 volatiles
    // output: 500 * 0.8 = 400 fuel
    // waste: 500 - 400 = 100 (lost from total mass)
    const expectedVolatiles = toFP(1000 - 500);
    const expectedFuel = toFP(100 + 400);
    const expectedMass = toFP(2000 - 100);

    if (newVolatiles !== expectedVolatiles) {
        console.log(`  [FAIL] Volatiles expected ${fromFP(expectedVolatiles)}, got ${fromFP(newVolatiles)}`);
        return false;
    }
    if (newFuel !== expectedFuel) {
        console.log(`  [FAIL] Fuel expected ${fromFP(expectedFuel)}, got ${fromFP(newFuel)}`);
        return false;
    }
    if (newMass !== expectedMass) {
        console.log(`  [FAIL] Mass expected ${fromFP(expectedMass)}, got ${fromFP(newMass)}`);
        return false;
    }

    console.log('  [PASS] Refining calculations correct');
    return true;
}

// -----------------------------------------------
// Test: Full Scenario (Extract -> Refine -> Extract Minerals)
// -----------------------------------------------

function testFullScenario(): boolean {
    console.log('\n--- TEST: Full Scenario ---');
    console.log('  1. Ship near Resource Well');
    console.log('  2. EXTRACT volatiles');
    console.log('  3. REFINE volatiles to fuel');
    console.log('  4. EXTRACT minerals to new position');

    // initial setup
    let ship = createShip({
        volatilesMass: toFP(0),
        fuelMass: toFP(50),
        mass: toFP(1000),
    });
    const well = createResourceWell({
        volatilesMass: toFP(5000),
        mass: toFP(20000),
    });

    // step 1: extract volatiles
    console.log('\n  Step 1: Extract Volatiles');
    let context = createMockContext(1, [ship, well]);
    let updates = extractHandler(ship, [well], { resourceType: 'VOLATILES', rate: toFP(1000) }, context);

    // apply updates to ship (simulated)
    const volUpdate = updates.find(u => u.id === ship.id);
    if (volUpdate?.changes.volatilesMass !== undefined) {
        ship = { ...ship, volatilesMass: volUpdate.changes.volatilesMass };
    }
    console.log(`    Ship volatiles after extract: ${fromFP(ship.volatilesMass)}`);

    // step 2: refine
    console.log('\n  Step 2: Refine Volatiles');
    context = createMockContext(2, [ship, well]);
    updates = refineHandler(ship, [], { volatilesAmount: toFP(1000) }, context);

    const refineUpdate = updates.find(u => u.id === ship.id);
    if (refineUpdate) {
        ship = {
            ...ship,
            volatilesMass: refineUpdate.changes.volatilesMass ?? ship.volatilesMass,
            fuelMass: refineUpdate.changes.fuelMass ?? ship.fuelMass,
            mass: refineUpdate.changes.mass ?? ship.mass,
        };
    }
    console.log(`    Ship fuel after refine: ${fromFP(ship.fuelMass)}`);
    console.log(`    Ship volatiles after refine: ${fromFP(ship.volatilesMass)}`);

    // step 3: extract minerals
    console.log('\n  Step 3: Extract Minerals');
    const mineralPosition = { x: toFP(200), y: toFP(100) };
    context = createMockContext(3, [ship, well]);
    updates = extractHandler(ship, [well], {
        resourceType: 'MINERALS',
        rate: toFP(500),
        mineralTargetPosition: [mineralPosition],
    }, context);

    const mineralStore = updates.find(u => u.id.startsWith('mineral-store-'));
    if (mineralStore) {
        console.log(`    Mineral store created: ${mineralStore.id}`);
        console.log(`    Position: (${fromFP(mineralStore.changes.position!.x)}, ${fromFP(mineralStore.changes.position!.y)})`);
        console.log(`    Mass: ${fromFP(mineralStore.changes.mass!)}`);
    }

    // assertions
    const passed = ship.fuelMass > toFP(50) && mineralStore !== undefined;

    if (passed) {
        console.log('\n  [PASS] Full scenario completed successfully');
        console.log(`    Final ship fuel: ${fromFP(ship.fuelMass)} (started at 50)`);
        console.log(`    Mineral store exists: YES`);
    } else {
        console.log('\n  [FAIL] Full scenario failed');
        return false;
    }

    return true;
}

// -----------------------------------------------
// Test: Validation Edge Cases
// -----------------------------------------------

function testValidationEdgeCases(): boolean {
    console.log('\n--- TEST: Validation Edge Cases ---');

    const ship = createShip({ reach: toFP(50) });
    const farWell = createResourceWell({ position: { x: toFP(1000), y: toFP(0) } });
    const emptyWell = createResourceWell({ volatilesMass: toFP(0), mass: toFP(0) });

    let passed = true;

    // test: out of reach
    console.log('  Case 1: Well out of reach');
    let isValid = extractValidate(ship, [farWell], { resourceType: 'VOLATILES', rate: toFP(100) });
    if (isValid) {
        console.log('    [FAIL] Should have failed - well out of reach');
        passed = false;
    } else {
        console.log('    [PASS] Correctly rejected');
    }

    // test: empty resource
    console.log('  Case 2: Well has no volatiles');
    isValid = extractValidate(ship, [emptyWell], { resourceType: 'VOLATILES', rate: toFP(100) });
    if (isValid) {
        console.log('    [FAIL] Should have failed - no volatiles');
        passed = false;
    } else {
        console.log('    [PASS] Correctly rejected');
    }

    // test: refine with no volatiles
    console.log('  Case 3: Refine with no volatiles');
    const emptyShip = createShip({ volatilesMass: toFP(0) });
    isValid = refineValidate(emptyShip, [], { volatilesAmount: toFP(100) });
    if (isValid) {
        console.log('    [FAIL] Should have failed - no volatiles to refine');
        passed = false;
    } else {
        console.log('    [PASS] Correctly rejected');
    }

    // test: minerals without target position
    console.log('  Case 4: Minerals extraction without target position');
    const nearWell = createResourceWell({ position: { x: toFP(10), y: toFP(0) } });
    isValid = extractValidate(ship, [nearWell], { resourceType: 'MINERALS', rate: toFP(100) });
    if (isValid) {
        console.log('    [FAIL] Should have failed - no mineral target position');
        passed = false;
    } else {
        console.log('    [PASS] Correctly rejected');
    }

    return passed;
}

// -----------------------------------------------
// Main Execution
// -----------------------------------------------

function main(): void {
    console.log('='.repeat(60));
    console.log('EXTRACT & REFINE VERIFICATION');
    console.log('='.repeat(60));

    const results: boolean[] = [];

    results.push(testExtractVolatiles());
    results.push(testExtractMinerals());
    results.push(testRefine());
    results.push(testFullScenario());
    results.push(testValidationEdgeCases());

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
