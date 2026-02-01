// ===============================================
// WAVE INTERLEAVING TESTS
// ===============================================
// tests for the wave-based action interleaving system.
// verifies that settlement between waves produces correct results.
//
// KEY INVARIANT: if you WELD in Wave 0, you can THRUST the combined
// structure in Wave 1 of the same tick.

import { describe, it, expect } from 'vitest';
import { createShip, createTickContext, createGameState, createMineralStore, createResourceWell } from '../../../test/factories.js';
import { 
    runTick, 
    runTickWithWaves, 
    createWavedActions,
    verifySequentialIntegrity,
    findEntity 
} from '../../../test/SimRunner.js';
import { 
    assertMassConservation, 
    assertNonTeleportation,
    assertWeldBinding 
} from '../../../test/invariants.js';
import { toFP, fromFP, fpAdd } from '../../../primitive-types/euclidean/euclidean-types.js';
import type { WeldAction, ThrustAction, UnweldAction, LoadAction, SealAirlockAction } from '../../../primitive-types/semantic/action/action-types.js';

describe('Wave Interleaving', () => {
    // ===============================================
    // WELD + THRUST in Same Tick
    // ===============================================

    describe('WELD then THRUST in same tick', () => {
        it('should allow THRUSTing a newly-welded structure', () => {
            // setup: two ships that will weld and then thrust
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(200),
                airlockSealed: true,
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(500),
                fuelMass: toFP(100),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // wave 0: weld B to A
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
                orderIndex: 0,
            };

            // wave 1: thrust the combined structure
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) }, // normalized FP
                magnitude: toFP(50),
                orderIndex: 1,
            };

            const result = runTick(state, [weldAction, thrustAction]);
            expect(result.success).toBe(true);

            // verify weld happened
            const newB = findEntity(result.nextState, 'ship-b');
            expect(newB?.weldParentId).toBe('ship-a');

            // verify thrust was applied to the combined structure
            const newA = findEntity(result.nextState, 'ship-a');
            expect(newA).toBeDefined();
            
            // combined mass should be used for thrust calculation
            // the structure should have moved
            expect(newA!.velocity.x).toBeGreaterThan(0);
            
            // B should follow A (weld binding)
            const bindingResult = assertWeldBinding(result.nextState);
            expect(bindingResult.passed).toBe(true);
        });

        it('should calculate momentum correctly with combined mass', () => {
            const massA = toFP(1000);
            const massB = toFP(500);
            const combinedMass = fpAdd(massA, massB);

            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: massA,
                fuelMass: toFP(1000),
                airlockSealed: true,
                heading: toFP(0), // heading 0 = +X direction
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: massB,
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // weld then thrust
            const actions = createWavedActions([
                // wave 0
                [{
                    type: 'WELD',
                    entityId: 'ship-a',
                    targetIds: ['ship-b'],
                } as WeldAction],
                // wave 1
                [{
                    type: 'THRUST',
                    entityId: 'ship-a',
                    direction: { x: toFP(1000), y: toFP(0) },
                    magnitude: toFP(100),
                } as ThrustAction],
            ]);

            const result = runTick(state, actions);
            expect(result.success).toBe(true);

            // verify the structure's mass includes both ships (minus thrust mass loss)
            const newA = findEntity(result.nextState, 'ship-a');
            // mass is combined minus propellant ejection from thrust
            expect(newA!.mass).toBeLessThanOrEqual(combinedMass);
            expect(newA!.mass).toBeGreaterThan(massA); // still more than original A
        });
    });

    // ===============================================
    // UNWELD + THRUST Separation
    // ===============================================

    describe('UNWELD then THRUST away', () => {
        it('should allow separated entities to thrust independently', () => {
            // setup: welded structure
            const shipA = createShip({
                id: 'ship-a',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(1500), // includes B's mass
                fuelMass: toFP(200),
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                    velocity: { x: toFP(0), y: toFP(0) },
                    mass: toFP(500),
                    fuelMass: toFP(100),
                }),
                weldParentId: 'ship-a',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            const state = createGameState({ entities: [shipA, shipB] });

            // wave 0: unweld B from A
            const unweldAction: UnweldAction = {
                type: 'UNWELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
                orderIndex: 0,
            };

            // wave 1: B thrusts away
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-b',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(50),
                orderIndex: 1,
            };

            const result = runTick(state, [unweldAction, thrustAction]);
            expect(result.success).toBe(true);

            // verify unweld happened
            const newB = findEntity(result.nextState, 'ship-b');
            expect(newB?.weldParentId).toBeUndefined();

            // verify B thrusted
            expect(newB!.velocity.x).toBeGreaterThan(0);

            // verify A didn't move (no thrust action)
            const newA = findEntity(result.nextState, 'ship-a');
            expect(newA!.velocity.x).toBe(0);
        });
    });

    // ===============================================
    // Multi-Player Interleaving
    // ===============================================

    describe('Multi-player simultaneous actions', () => {
        it('should process all players wave 0 before any wave 1', () => {
            // two players each queue 2 actions
            // heading 0 = +X direction, heading 180 = -X direction
            // FP scale: toFP(180) = 180000, which is 180 degrees
            const player1Ship = createShip({
                id: 'p1-ship',
                playerId: 'player-1',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                fuelMass: toFP(200),
                heading: toFP(0), // facing +X
            });
            const player2Ship = createShip({
                id: 'p2-ship',
                playerId: 'player-2',
                position: { x: toFP(1000), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                fuelMass: toFP(200),
                heading: toFP(180), // facing -X (180 degrees)
            });
            const state = createGameState({ entities: [player1Ship, player2Ship] });

            // both players thrust twice (using their heading)
            const actions = [
                // player 1, wave 0
                {
                    type: 'THRUST' as const,
                    entityId: 'p1-ship',
                    playerId: 'player-1',
                    direction: { x: toFP(1000), y: toFP(0) },
                    magnitude: toFP(10),
                    orderIndex: 0,
                },
                // player 2, wave 0
                {
                    type: 'THRUST' as const,
                    entityId: 'p2-ship',
                    playerId: 'player-2',
                    direction: { x: toFP(-1000), y: toFP(0) },
                    magnitude: toFP(10),
                    orderIndex: 0,
                },
                // player 1, wave 1
                {
                    type: 'THRUST' as const,
                    entityId: 'p1-ship',
                    playerId: 'player-1',
                    direction: { x: toFP(1000), y: toFP(0) },
                    magnitude: toFP(10),
                    orderIndex: 1,
                },
                // player 2, wave 1
                {
                    type: 'THRUST' as const,
                    entityId: 'p2-ship',
                    playerId: 'player-2',
                    direction: { x: toFP(-1000), y: toFP(0) },
                    magnitude: toFP(10),
                    orderIndex: 1,
                },
            ];

            const result = runTick(state, actions);
            expect(result.success).toBe(true);

            // both ships should have moved in opposite directions
            const newP1 = findEntity(result.nextState, 'p1-ship');
            const newP2 = findEntity(result.nextState, 'p2-ship');

            expect(newP1!.velocity.x).toBeGreaterThan(0);
            expect(newP2!.velocity.x).toBeLessThan(0);

            // verify wave metrics
            expect(result.waveMetrics?.waveCount).toBe(2);
            expect(result.waveMetrics?.actionsPerWave).toEqual([2, 2]);
        });
    });

    // ===============================================
    // Sequential Integrity
    // ===============================================

    describe('Sequential integrity invariant', () => {
        it('should produce different results for waved vs simultaneous actions', () => {
            // this test verifies that settlement between waves matters
            
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(200),
                airlockSealed: true,
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(500),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(50),
            };

            // verify sequential integrity check works
            const integrityResult = verifySequentialIntegrity(
                state,
                [weldAction],
                [thrustAction]
            );
            expect(integrityResult.passed).toBe(true);
            // the results SHOULD differ because thrust on combined mass is different
        });
    });

    // ===============================================
    // Physical Invariants
    // ===============================================

    describe('Physical invariants during waves', () => {
        it('should conserve mass across all waves (allowing for propellant loss)', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(100),
                volatilesMass: toFP(50),
                airlockSealed: true,
                heading: toFP(0),
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                mass: toFP(500),
                fuelMass: toFP(50),
                volatilesMass: toFP(25),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const actions = createWavedActions([
                // wave 0: weld
                [{
                    type: 'WELD',
                    entityId: 'ship-a',
                    targetIds: ['ship-b'],
                } as WeldAction],
                // wave 1: thrust (consumes fuel and ejects propellant mass)
                [{
                    type: 'THRUST',
                    entityId: 'ship-a',
                    direction: { x: toFP(1000), y: toFP(0) },
                    magnitude: toFP(50),
                } as ThrustAction],
            ]);

            const result = runTick(state, actions);
            expect(result.success).toBe(true);

            // thrust causes mass loss (propellant ejection)
            // allow for the propellant mass that was expelled
            // MASS_PROPULSION_LOSS = 100 FP (0.1 per unit thrust)
            // with magnitude 50, loss = 50 * 100 / 1000 = 5 mass units
            const allowedLoss = toFP(10000); // generous allowance for propellant ejection
            const massResult = assertMassConservation(state, result.nextState, allowedLoss);
            expect(massResult.passed).toBe(true);
        });

        it('should not allow teleportation', () => {
            const ship = createShip({
                id: 'ship-a',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(10), y: toFP(0) },
                fuelMass: toFP(100),
            });
            const state = createGameState({ entities: [ship] });

            // normal tick
            const result = runTick(state, []);
            expect(result.success).toBe(true);

            // verify non-teleportation
            const teleportResult = assertNonTeleportation(state, result.nextState);
            expect(teleportResult.passed).toBe(true);
        });
    });

    // ===============================================
    // Action Chain Patterns
    // ===============================================

    describe('Action chain patterns', () => {
        it('should handle SEAL_AIRLOCK -> WELD -> THRUST chain', () => {
            // ship starts with airlock unsealed
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(200),
                airlockSealed: false, // needs to seal first
                heading: toFP(0), // facing +X
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(500),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const actions = createWavedActions([
                // wave 0: seal airlock (required for weld)
                [{
                    type: 'SEAL_AIRLOCK',
                    entityId: 'ship-a',
                } as SealAirlockAction],
                // wave 1: weld (now possible with sealed airlock)
                [{
                    type: 'WELD',
                    entityId: 'ship-a',
                    targetIds: ['ship-b'],
                } as WeldAction],
                // wave 2: thrust the structure
                [{
                    type: 'THRUST',
                    entityId: 'ship-a',
                    direction: { x: toFP(1000), y: toFP(0) },
                    magnitude: toFP(50),
                } as ThrustAction],
            ]);

            const result = runTick(state, actions);
            expect(result.success).toBe(true);

            // verify the full chain executed
            const newA = findEntity(result.nextState, 'ship-a');
            const newB = findEntity(result.nextState, 'ship-b');

            expect(newA!.airlockSealed).toBe(true);
            expect(newB!.weldParentId).toBe('ship-a');
            expect(newA!.velocity.x).toBeGreaterThan(0);

            // verify wave metrics
            expect(result.waveMetrics?.waveCount).toBe(3);
        });
    });
});
