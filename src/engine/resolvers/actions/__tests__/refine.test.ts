// ===============================================
// REFINE ACTION TESTS
// ===============================================
// validates the refining process: volatiles -> fuel conversion
// with efficiency loss and mass conservation enforcement.

import { describe, it, expect } from 'vitest';
import { createShip, createTickContext, createGameState } from '../../../test/factories.js';
import { testAction, testValidation, runTick } from '../../../test/SimRunner.js';
import { 
    assertMassConservation, 
    assertUpdateMassConservation,
    assertSufficientVolatiles,
} from '../../../test/invariants.js';
import { refineHandler, refineValidate } from '../refineHandler.js';
import { toFP, fromFP, fpMul, fpSub } from '../../../primitive-types/euclidean/euclidean-types.js';
import { REFINE_EFFICIENCY, REFINE_MAX_BATCH } from '../../../config/engineConfig.js';
import type { RefineAction } from '../../../primitive-types/semantic/action/action-types.js';

describe('REFINE Action', () => {
    describe('Configuration', () => {
        it('should use configured efficiency rate', () => {
            // REFINE_EFFICIENCY should be 80% (0.8)
            expect(fromFP(REFINE_EFFICIENCY)).toBeCloseTo(0.8, 2);
        });

        it('should have a max batch limit', () => {
            // REFINE_MAX_BATCH should be 5000
            expect(fromFP(REFINE_MAX_BATCH)).toBe(5000);
        });
    });

    describe('Validation', () => {
        it('should reject refining with no volatiles', () => {
            const ship = createShip({ volatilesMass: toFP(0) });
            const isValid = refineValidate(
                ship, 
                [], 
                { volatilesAmount: toFP(100) }
            );

            expect(isValid).toBe(false);
        });

        it('should accept and cap refining when requesting more than available', () => {
            // note: the handler gracefully caps to available rather than rejecting.
            // validation passes as long as SOME volatiles exist.
            const ship = createShip({ volatilesMass: toFP(100) });
            const isValid = refineValidate(
                ship, 
                [], 
                { volatilesAmount: toFP(500) }
            );

            // validation passes (handler will cap to 100)
            expect(isValid).toBe(true);

            // verify handler caps correctly
            const context = createTickContext(1, [ship]);
            const updates = refineHandler(
                ship,
                [],
                { volatilesAmount: toFP(500) },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;
            
            // should have consumed all 100 volatiles (not 500)
            expect(update.changes.volatilesMass).toBe(0);
        });

        it('should accept refining with sufficient volatiles', () => {
            const availableVolatiles = toFP(1000);
            const ship = createShip({ volatilesMass: availableVolatiles });
            
            // verify resource check
            const resourceCheck = assertSufficientVolatiles(ship, toFP(500));
            expect(resourceCheck.passed).toBe(true);

            const isValid = refineValidate(
                ship, 
                [], 
                { volatilesAmount: toFP(500) }
            );

            expect(isValid).toBe(true);
        });

        it('should reject zero volatiles amount', () => {
            const ship = createShip({ volatilesMass: toFP(1000) });
            const isValid = refineValidate(
                ship, 
                [], 
                { volatilesAmount: toFP(0) }
            );

            expect(isValid).toBe(false);
        });

        it('should reject negative volatiles amount', () => {
            const ship = createShip({ volatilesMass: toFP(1000) });
            const isValid = refineValidate(
                ship, 
                [], 
                { volatilesAmount: toFP(-100) }
            );

            expect(isValid).toBe(false);
        });
    });

    describe('Efficiency Calculations', () => {
        it('should convert volatiles to fuel at 80% efficiency', () => {
            const initialVolatiles = toFP(1000);
            const initialFuel = toFP(100);
            const refineAmount = toFP(500);

            const ship = createShip({
                volatilesMass: initialVolatiles,
                fuelMass: initialFuel,
                mass: toFP(2000),
            });
            const context = createTickContext(1, [ship]);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: refineAmount },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;

            // expected: 500 volatiles * 0.8 efficiency = 400 fuel
            const expectedFuelGain = fpMul(refineAmount, REFINE_EFFICIENCY);
            const expectedNewFuel = initialFuel + expectedFuelGain;

            expect(fromFP(update.changes.fuelMass!)).toBeCloseTo(
                fromFP(expectedNewFuel), 
                1
            );
        });

        it('should reduce volatiles by full input amount', () => {
            const initialVolatiles = toFP(1000);
            const refineAmount = toFP(500);

            const ship = createShip({
                volatilesMass: initialVolatiles,
                fuelMass: toFP(100),
                mass: toFP(2000),
            });
            const context = createTickContext(1, [ship]);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: refineAmount },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;

            // volatiles should decrease by full amount
            const expectedNewVolatiles = fpSub(initialVolatiles, refineAmount);
            expect(update.changes.volatilesMass).toBe(expectedNewVolatiles);
        });

        it('should reduce total mass by waste amount (20%)', () => {
            const initialMass = toFP(2000);
            const initialVolatiles = toFP(1000);
            const refineAmount = toFP(500);

            const ship = createShip({
                mass: initialMass,
                volatilesMass: initialVolatiles,
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: refineAmount },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;

            // waste = input - output = 500 - 400 = 100
            // new mass = 2000 - 100 = 1900
            const wasteAmount = fpSub(refineAmount, fpMul(refineAmount, REFINE_EFFICIENCY));
            const expectedNewMass = fpSub(initialMass, wasteAmount);

            expect(fromFP(update.changes.mass!)).toBeCloseTo(
                fromFP(expectedNewMass), 
                1
            );
        });
    });

    describe('Mass Conservation', () => {
        it('should account for waste in mass calculations', () => {
            const ship = createShip({
                mass: toFP(2000),
                volatilesMass: toFP(1000),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            const refineAmount = toFP(500);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: refineAmount },
                context
            );

            // calculate expected waste
            const expectedWaste = fpSub(refineAmount, fpMul(refineAmount, REFINE_EFFICIENCY));

            // mass conservation should allow for waste loss
            const massResult = assertUpdateMassConservation(
                [ship], 
                updates, 
                expectedWaste
            );

            expect(massResult.passed).toBe(true);
        });

        it('should have mass loss equal to refining waste', () => {
            const ship = createShip({
                mass: toFP(2000),
                volatilesMass: toFP(1000),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            const refineAmount = toFP(500);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: refineAmount },
                context
            );

            const update = updates[0]!;
            const massLoss = ship.mass - update.changes.mass!;
            const expectedWaste = fromFP(refineAmount) * (1 - fromFP(REFINE_EFFICIENCY));

            expect(fromFP(massLoss)).toBeCloseTo(expectedWaste, 1);
        });
    });

    describe('Batch Limits', () => {
        it('should cap refining at REFINE_MAX_BATCH', () => {
            const hugeVolatiles = toFP(100000);
            const ship = createShip({
                mass: toFP(200000),
                volatilesMass: hugeVolatiles,
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);

            // try to refine more than max batch
            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: toFP(50000) },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;

            // volatiles consumed should be capped at REFINE_MAX_BATCH
            const volatilesConsumed = ship.volatilesMass - update.changes.volatilesMass!;
            expect(volatilesConsumed).toBeLessThanOrEqual(REFINE_MAX_BATCH);
        });
    });

    describe('Full Tick Integration', () => {
        it('should process refine action through tick resolver', () => {
            const ship = createShip({
                id: 'refine-test-ship',
                mass: toFP(2000),
                volatilesMass: toFP(1000),
                fuelMass: toFP(100),
            });
            const state = createGameState({ entities: [ship] });

            const action: RefineAction = {
                type: 'REFINE',
                entityId: ship.id,
                inputType: 'VOLATILES',
                volatilesTargetIds: [ship.id],
                fuelTargetIds: [ship.id],
                volatilesAmount: toFP(500),
            };

            const result = runTick(state, [action]);

            expect(result.success).toBe(true);

            // calculate expected waste for conservation check
            const expectedWaste = toFP(500 * 0.2); // 20% waste
            const massResult = assertMassConservation(
                state, 
                result.nextState, 
                expectedWaste
            );

            expect(massResult.passed).toBe(true);
        });
    });

    describe('Determinism', () => {
        it('should produce identical results for same inputs', () => {
            const ship = createShip({
                mass: toFP(2000),
                volatilesMass: toFP(1000),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            const inputs = { volatilesAmount: toFP(500) };

            const updates1 = refineHandler(ship, [], inputs, context);
            const updates2 = refineHandler(ship, [], inputs, context);
            const updates3 = refineHandler(ship, [], inputs, context);

            expect(updates1).toEqual(updates2);
            expect(updates2).toEqual(updates3);
        });
    });

    describe('Edge Cases', () => {
        it('should return empty updates when validation fails', () => {
            const ship = createShip({ volatilesMass: toFP(0) });
            const context = createTickContext(1, [ship]);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: toFP(100) },
                context
            );

            expect(updates).toEqual([]);
        });

        it('should handle exact volatiles match', () => {
            const exactVolatiles = toFP(500);
            const ship = createShip({
                volatilesMass: exactVolatiles,
                fuelMass: toFP(100),
                mass: toFP(2000),
            });
            const context = createTickContext(1, [ship]);

            // refine exactly what we have
            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: exactVolatiles },
                context
            );

            expect(updates.length).toBe(1);
            const update = updates[0]!;

            // should end with zero volatiles
            expect(update.changes.volatilesMass).toBe(0);
        });

        it('should handle very small refine amounts', () => {
            const ship = createShip({
                volatilesMass: toFP(1000),
                fuelMass: toFP(100),
                mass: toFP(2000),
            });
            const context = createTickContext(1, [ship]);

            const updates = refineHandler(
                ship, 
                [], 
                { volatilesAmount: toFP(1) },
                context
            );

            expect(updates.length).toBe(1);
        });
    });

    describe('Multi-step Scenario', () => {
        it('should allow sequential refining operations', () => {
            let ship = createShip({
                id: 'sequential-ship',
                mass: toFP(5000),
                volatilesMass: toFP(3000),
                fuelMass: toFP(100),
            });

            // refine 1000 volatiles, three times
            for (let i = 0; i < 3; i++) {
                const context = createTickContext(i + 1, [ship]);
                const updates = refineHandler(
                    ship, 
                    [], 
                    { volatilesAmount: toFP(1000) },
                    context
                );

                expect(updates.length).toBe(1);
                
                // apply update for next iteration
                const update = updates[0]!;
                ship = {
                    ...ship,
                    volatilesMass: update.changes.volatilesMass ?? ship.volatilesMass,
                    fuelMass: update.changes.fuelMass ?? ship.fuelMass,
                    mass: update.changes.mass ?? ship.mass,
                };
            }

            // after 3 refines of 1000 each:
            // volatiles: 3000 - 3000 = 0
            // fuel: 100 + (1000 * 0.8 * 3) = 100 + 2400 = 2500
            // mass: 5000 - (1000 * 0.2 * 3) = 5000 - 600 = 4400

            expect(ship.volatilesMass).toBe(0);
            expect(fromFP(ship.fuelMass)).toBeCloseTo(2500, 1);
            expect(fromFP(ship.mass)).toBeCloseTo(4400, 1);
        });
    });
});
