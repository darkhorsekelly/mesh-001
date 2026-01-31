// ===============================================
// LIBRARY VERIFICATION SCRIPT
// ===============================================
// Verifies that the engine library types and registry are correctly defined.
// Run with: npx ts-node src/engine/scripts/verify-library.ts

import type { Entity, EntityUpdate, VisibilityLevel } from '../primitive-types/semantic/entity/entity-types.js';
import type { ActionType } from '../primitive-types/semantic/action/action-types.js';
import type { TickContext } from '../resolvers/actions/actionTypes.js';
import { VECTOR_ZERO, toFP, fromFP } from '../primitive-types/euclidean/euclidean-types.js';
import { actionRegistry, isRegistered } from '../resolvers/actions/actionRegistry.js';
import { thrustHandler, thrustValidate } from '../resolvers/actions/thrustHandler.js';
import {
    FUEL_BURN_RATE,
    MASS_PROPULSION_LOSS,
    MINIMUM_FUEL_THRESHOLD,
    MAX_THRUST_PER_TICK,
} from '../config/engineConfig.js';

// -----------------------------------------------
// Test Entity Creation
// -----------------------------------------------

function createTestEntity(): Entity {
    const entity: Entity = {
        // core identity
        id: 'test-entity-001',
        type: 'TEST_SHIP',
        playerId: 'player-001',

        // spatial state
        zoomState: 'SPACE',
        position: { x: toFP(100), y: toFP(200) },
        velocity: VECTOR_ZERO,
        heading: toFP(0),
        thrust: toFP(0),
        reach: toFP(1000),

        // physical properties
        mass: toFP(1000),
        volume: toFP(500),

        // atmospheric / structural
        airlockSealed: true,

        // resource stores
        volatilesMass: toFP(100),
        fuelMass: toFP(250),

        // sensors
        opticLevel: 0 as VisibilityLevel,
    };

    return entity;
}

// -----------------------------------------------
// Verify Action Registry
// -----------------------------------------------

function verifyActionRegistry(): void {
    const actionTypes: ActionType[] = [
        'TRANSPORT',
        'MANEUVER',
        'THRUST',
        'LAUNCH',
        'EXTRACT',
        'REFINE',
        'MANUFACTURE',
        'WELD',
        'UNWELD',
        'MOD',
        'COMMIT',
        'SEAL_AIRLOCK',
        'UNSEAL_AIRLOCK',
        'LOAD',
        'UNLOAD',
        'VECTOR_LOCK',
        'MOVE_SCANNER',
        'SCAN',
        'ENCOUNTER',
    ];

    console.log('='.repeat(50));
    console.log('ACTION REGISTRY VERIFICATION');
    console.log('='.repeat(50));

    let allRegistered = true;

    for (const actionType of actionTypes) {
        const registered = isRegistered(actionType);
        const status = registered ? 'OK' : 'FAIL';
        
        if (status === 'FAIL') {
            allRegistered = false;
        }

        console.log(`[${status}] ${actionType}`);
    }

    console.log('-'.repeat(50));
    console.log(`Total actions: ${actionTypes.length}`);
    console.log(`Registry complete: ${allRegistered ? 'YES' : 'NO'}`);
}

// -----------------------------------------------
// Verify Entity Update Type
// -----------------------------------------------

function verifyEntityUpdate(): void {
    const update: EntityUpdate = {
        id: 'test-entity-001',
        changes: {
            velocity: { x: toFP(10), y: toFP(5) },
            fuelMass: toFP(240),
        },
    };

    console.log('\n' + '='.repeat(50));
    console.log('ENTITY UPDATE VERIFICATION');
    console.log('='.repeat(50));
    console.log('Sample update:', JSON.stringify(update, null, 2));
}

// -----------------------------------------------
// Verify Thrust Handler
// -----------------------------------------------

function verifyThrustHandler(): void {
    console.log('\n' + '='.repeat(50));
    console.log('THRUST HANDLER VERIFICATION');
    console.log('='.repeat(50));

    // display engine config
    console.log('\nEngine Configuration:');
    console.log(`  FUEL_BURN_RATE: ${fromFP(FUEL_BURN_RATE)}`);
    console.log(`  MASS_PROPULSION_LOSS: ${fromFP(MASS_PROPULSION_LOSS)}`);
    console.log(`  MINIMUM_FUEL_THRESHOLD: ${fromFP(MINIMUM_FUEL_THRESHOLD)}`);
    console.log(`  MAX_THRUST_PER_TICK: ${fromFP(MAX_THRUST_PER_TICK)}`);

    // create test entity with known values
    const ship: Entity = {
        id: 'thrust-test-ship',
        type: 'TEST_SHIP',
        playerId: 'player-001',
        zoomState: 'SPACE',
        position: { x: toFP(0), y: toFP(0) },
        velocity: { x: toFP(0), y: toFP(0) },
        heading: toFP(0),
        thrust: toFP(0),
        mass: toFP(1000),
        volume: toFP(500),
        airlockSealed: true,
        volatilesMass: toFP(0),
        fuelMass: toFP(100),
        opticLevel: 0 as VisibilityLevel,
        reach: toFP(1000),
    };

    console.log('\nInitial Ship State:');
    console.log(`  mass: ${fromFP(ship.mass)}`);
    console.log(`  fuelMass: ${fromFP(ship.fuelMass)}`);
    console.log(`  velocity: (${fromFP(ship.velocity.x)}, ${fromFP(ship.velocity.y)})`);
    console.log(`  heading: ${fromFP(ship.heading)}°`);

    // create mock tick context
    const mockContext: TickContext = {
        tick: 1,
        entities: [ship],
        state: {
            tick: 1,
            entities: [ship],
            celestials: [],
        },
    };

    // test 1: validation with zero fuel
    console.log('\n--- Test 1: Validation with insufficient fuel ---');
    const emptyShip = { ...ship, fuelMass: toFP(0) };
    const validEmpty = thrustValidate(emptyShip, [], { magnitude: toFP(10) });
    console.log(`  Ship with 0 fuel, magnitude=10: validate=${validEmpty}`);
    console.log(`  Expected: false | Result: ${validEmpty === false ? 'PASS' : 'FAIL'}`);

    // test 2: validation with zero magnitude
    console.log('\n--- Test 2: Validation with zero magnitude ---');
    const validZeroMag = thrustValidate(ship, [], { magnitude: toFP(0) });
    console.log(`  Ship with fuel, magnitude=0: validate=${validZeroMag}`);
    console.log(`  Expected: false | Result: ${validZeroMag === false ? 'PASS' : 'FAIL'}`);

    // test 3: validation with valid inputs
    console.log('\n--- Test 3: Validation with valid inputs ---');
    const validGood = thrustValidate(ship, [], { magnitude: toFP(10) });
    console.log(`  Ship with fuel=100, magnitude=10: validate=${validGood}`);
    console.log(`  Expected: true | Result: ${validGood === true ? 'PASS' : 'FAIL'}`);

    // test 4: execute thrust (heading=0, magnitude=10)
    console.log('\n--- Test 4: Execute THRUST (heading=0°, magnitude=10) ---');
    const thrustMagnitude = toFP(10);
    const updates = thrustHandler(ship, [], { magnitude: thrustMagnitude }, mockContext);

    if (updates.length === 0) {
        console.log('  ERROR: No updates returned!');
        return;
    }

    const update = updates[0];
    console.log('\nEntity Update:');
    console.log(JSON.stringify(update, null, 2));

    // verify calculations
    // heading=0 means thrust in +X direction
    // deltaV.x = cos(0) * 10 = 10, deltaV.y = sin(0) * 10 = 0
    const expectedVelX = toFP(10);
    const expectedVelY = toFP(0);
    const expectedFuel = toFP(90);
    const expectedMass = toFP(990);

    console.log('\nAssertion Results:');
    
    const newVel = update?.changes.velocity;
    if (newVel) {
        const velXPass = Math.abs(newVel.x - expectedVelX) < toFP(0.01);
        const velYPass = Math.abs(newVel.y - expectedVelY) < toFP(0.01);
        console.log(`  velocity.x: expected=${fromFP(expectedVelX)}, actual=${fromFP(newVel.x)} | ${velXPass ? 'PASS' : 'FAIL'}`);
        console.log(`  velocity.y: expected=${fromFP(expectedVelY)}, actual=${fromFP(newVel.y)} | ${velYPass ? 'PASS' : 'FAIL'}`);
    }

    const newFuel = update?.changes.fuelMass;
    if (newFuel !== undefined) {
        const fuelPass = Math.abs(newFuel - expectedFuel) < toFP(0.01);
        console.log(`  fuelMass: expected=${fromFP(expectedFuel)}, actual=${fromFP(newFuel)} | ${fuelPass ? 'PASS' : 'FAIL'}`);
    }

    const newMass = update?.changes.mass;
    if (newMass !== undefined) {
        const massPass = Math.abs(newMass - expectedMass) < toFP(0.01);
        console.log(`  mass: expected=${fromFP(expectedMass)}, actual=${fromFP(newMass)} | ${massPass ? 'PASS' : 'FAIL'}`);
    }

    // test 5: thrust at 90 degrees
    console.log('\n--- Test 5: Execute THRUST (heading=90°, magnitude=5) ---');
    const ship90 = { ...ship, heading: toFP(90) };
    const updates90 = thrustHandler(ship90, [], { magnitude: toFP(5) }, mockContext);

    if (updates90.length > 0) {
        const update90 = updates90[0];
        const vel90 = update90?.changes.velocity;
        if (vel90) {
            // heading=90 means thrust in +Y direction
            // deltaV.x = cos(90) * 5 ≈ 0, deltaV.y = sin(90) * 5 = 5
            const velXPass90 = Math.abs(vel90.x) < toFP(0.1);
            const velYPass90 = Math.abs(vel90.y - toFP(5)) < toFP(0.1);
            console.log(`  velocity.x: expected≈0, actual=${fromFP(vel90.x)} | ${velXPass90 ? 'PASS' : 'FAIL'}`);
            console.log(`  velocity.y: expected≈5, actual=${fromFP(vel90.y)} | ${velYPass90 ? 'PASS' : 'FAIL'}`);
        }
    }

    // test 6: thrust exceeds fuel
    console.log('\n--- Test 6: Thrust exceeds available fuel ---');
    const lowFuelShip = { ...ship, fuelMass: toFP(5) };
    const updatesLowFuel = thrustHandler(lowFuelShip, [], { magnitude: toFP(100) }, mockContext);

    if (updatesLowFuel.length > 0) {
        const updateLF = updatesLowFuel[0];
        const fuelLF = updateLF?.changes.fuelMass;
        if (fuelLF !== undefined) {
            // should only burn available 5, not requested 100
            const fuelDepleted = fuelLF <= toFP(0.1);
            console.log(`  fuelMass after thrust: ${fromFP(fuelLF)} | ${fuelDepleted ? 'PASS (depleted as expected)' : 'FAIL'}`);
        }
    }
}

// -----------------------------------------------
// Main
// -----------------------------------------------

function main(): void {
    console.log('\n');
    console.log('#'.repeat(50));
    console.log('# MESH 95 ENGINE LIBRARY VERIFICATION');
    console.log('#'.repeat(50));

    // create and log test entity
    const testEntity = createTestEntity();
    
    console.log('\n' + '='.repeat(50));
    console.log('ENTITY PROPERTIES VERIFICATION');
    console.log('='.repeat(50));
    console.log('Test entity created successfully:');
    console.log(JSON.stringify(testEntity, null, 2));

    // verify action registry
    verifyActionRegistry();

    // verify entity update type
    verifyEntityUpdate();

    // verify thrust handler implementation
    verifyThrustHandler();

    console.log('\n' + '#'.repeat(50));
    console.log('# VERIFICATION COMPLETE');
    console.log('#'.repeat(50));
    console.log('\n');
}

main();
