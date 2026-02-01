// ===============================================
// EXTRACT ACTION TESTS
// ===============================================
// validates resource extraction: volatiles transfer and mineral spawning.
// enforces mass conservation and reach validation invariants.

import { describe, it, expect } from 'vitest';
import { createShip, createResourceWell, createTickContext, createGameState } from '../../../test/factories.js';
import { testAction, testValidation, applyEntityUpdate } from '../../../test/SimRunner.js';
import { 
    assertMassConservation, 
    assertInReach, 
    assertOutOfReach,
    assertUpdateMassConservation,
} from '../../../test/invariants.js';
import { extractHandler, extractValidate } from '../extractHandler.js';
import { toFP, fromFP, fpAdd, type FP } from '../../../primitive-types/euclidean/euclidean-types.js';

describe('EXTRACT Action', () => {
    describe('Validation', () => {
        it('should reject extraction when target is out of reach', () => {
            const ship = createShip({ 
                reach: toFP(50),
                position: { x: toFP(0), y: toFP(0) },
            });
            const farWell = createResourceWell({ 
                position: { x: toFP(1000), y: toFP(0) },
            });

            const isValid = extractValidate(
                ship, 
                [farWell], 
                { resourceType: 'VOLATILES', rate: toFP(100) }
            );

            expect(isValid).toBe(false);

            // verify with invariant helper
            const reachResult = assertOutOfReach(ship, farWell);
            expect(reachResult.passed).toBe(true);
        });

        it('should reject volatiles extraction when source has none', () => {
            const ship = createShip({ reach: toFP(500) });
            const emptyWell = createResourceWell({ 
                volatilesMass: toFP(0),
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = extractValidate(
                ship, 
                [emptyWell], 
                { resourceType: 'VOLATILES', rate: toFP(100) }
            );

            expect(isValid).toBe(false);
        });

        it('should reject minerals extraction without target position', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = extractValidate(
                ship, 
                [well], 
                { resourceType: 'MINERALS', rate: toFP(100) }
            );

            expect(isValid).toBe(false);
        });

        it('should accept valid volatiles extraction', () => {
            const ship = createShip({ 
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const well = createResourceWell({ 
                volatilesMass: toFP(10000),
                position: { x: toFP(100), y: toFP(0) },
            });

            // verify reach first
            const reachResult = assertInReach(ship, well);
            expect(reachResult.passed).toBe(true);

            const isValid = extractValidate(
                ship, 
                [well], 
                { resourceType: 'VOLATILES', rate: toFP(100) }
            );

            expect(isValid).toBe(true);
        });

        it('should accept valid minerals extraction with target position', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                mass: toFP(50000),
                position: { x: toFP(100), y: toFP(0) },
            });
            const targetPosition = { x: toFP(200), y: toFP(100) };

            const isValid = extractValidate(
                ship, 
                [well], 
                { 
                    resourceType: 'MINERALS', 
                    rate: toFP(100),
                    mineralTargetPosition: [targetPosition],
                }
            );

            expect(isValid).toBe(true);
        });
    });

    describe('Volatiles Extraction', () => {
        it('should transfer volatiles from well to ship', () => {
            const initialShipVolatiles = toFP(0);
            const initialWellVolatiles = toFP(10000);
            const extractionRate = toFP(500);

            const ship = createShip({ 
                volatilesMass: initialShipVolatiles,
                reach: toFP(500),
            });
            const well = createResourceWell({ 
                volatilesMass: initialWellVolatiles,
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { resourceType: 'VOLATILES', rate: extractionRate },
                context
            );

            expect(updates.length).toBe(2);

            const shipUpdate = updates.find(u => u.id === ship.id);
            const wellUpdate = updates.find(u => u.id === well.id);

            expect(shipUpdate).toBeDefined();
            expect(wellUpdate).toBeDefined();

            // verify volatiles transfer
            expect(fromFP(shipUpdate!.changes.volatilesMass!)).toBe(
                fromFP(fpAdd(initialShipVolatiles, extractionRate))
            );
            expect(fromFP(wellUpdate!.changes.volatilesMass!)).toBe(
                fromFP(initialWellVolatiles) - fromFP(extractionRate)
            );
        });

        it('should enforce mass conservation for volatiles', () => {
            const ship = createShip({ 
                volatilesMass: toFP(0),
                reach: toFP(500),
            });
            const well = createResourceWell({ 
                volatilesMass: toFP(10000),
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { resourceType: 'VOLATILES', rate: toFP(500) },
                context
            );

            // check mass conservation invariant
            const massResult = assertUpdateMassConservation([ship, well], updates, toFP(0));
            expect(massResult.passed).toBe(true);
            expect(massResult.delta).toBe(0);
        });

        it('should cap extraction at available volatiles', () => {
            const availableVolatiles = toFP(100);
            const requestedRate = toFP(500);

            const ship = createShip({ 
                volatilesMass: toFP(0),
                reach: toFP(500),
            });
            const well = createResourceWell({ 
                volatilesMass: availableVolatiles,
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { resourceType: 'VOLATILES', rate: requestedRate },
                context
            );

            const shipUpdate = updates.find(u => u.id === ship.id);
            const wellUpdate = updates.find(u => u.id === well.id);

            // should only extract what's available
            expect(fromFP(shipUpdate!.changes.volatilesMass!)).toBe(fromFP(availableVolatiles));
            expect(fromFP(wellUpdate!.changes.volatilesMass!)).toBe(0);
        });
    });

    describe('Minerals Extraction', () => {
        it('should spawn mineral store at target position', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                mass: toFP(50000),
                position: { x: toFP(100), y: toFP(0) },
            });
            const targetPosition = { x: toFP(200), y: toFP(100) };
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { 
                    resourceType: 'MINERALS', 
                    rate: toFP(1000),
                    mineralTargetPosition: [targetPosition],
                },
                context
            );

            // find mineral store spawn
            const mineralStore = updates.find(u => u.id.startsWith('mineral-store-'));
            expect(mineralStore).toBeDefined();
            expect(mineralStore!.changes.position!.x).toBe(targetPosition.x);
            expect(mineralStore!.changes.position!.y).toBe(targetPosition.y);
        });

        it('should reduce well mass when extracting minerals', () => {
            const initialWellMass = toFP(50000);
            const extractionRate = toFP(1000);

            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                mass: initialWellMass,
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { 
                    resourceType: 'MINERALS', 
                    rate: extractionRate,
                    mineralTargetPosition: [{ x: toFP(200), y: toFP(100) }],
                },
                context
            );

            const wellUpdate = updates.find(u => u.id === well.id);
            expect(wellUpdate).toBeDefined();
            expect(fromFP(wellUpdate!.changes.mass!)).toBe(
                fromFP(initialWellMass) - fromFP(extractionRate)
            );
        });

        it('should enforce mass conservation for minerals', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                mass: toFP(50000),
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);

            const updates = extractHandler(
                ship, 
                [well], 
                { 
                    resourceType: 'MINERALS', 
                    rate: toFP(1000),
                    mineralTargetPosition: [{ x: toFP(200), y: toFP(100) }],
                },
                context
            );

            // mass should be conserved: well loses mass, mineral store gains it
            const wellUpdate = updates.find(u => u.id === well.id);
            const mineralStore = updates.find(u => u.id.startsWith('mineral-store-'));

            expect(wellUpdate).toBeDefined();
            expect(mineralStore).toBeDefined();

            const wellMassLoss = well.mass - wellUpdate!.changes.mass!;
            const mineralStoreMass = mineralStore!.changes.mass!;

            expect(wellMassLoss).toBe(mineralStoreMass);
        });
    });

    describe('Reach Invariant', () => {
        it('should validate reach before extraction', () => {
            // ship at origin with short reach
            const ship = createShip({
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(50),
            });
            
            // well at various distances
            const nearWell = createResourceWell({
                position: { x: toFP(30), y: toFP(0) },
                volatilesMass: toFP(10000),
            });
            const farWell = createResourceWell({
                position: { x: toFP(200), y: toFP(0) },
                volatilesMass: toFP(10000),
            });

            // near well should be in reach
            expect(assertInReach(ship, nearWell).passed).toBe(true);
            expect(extractValidate(ship, [nearWell], { 
                resourceType: 'VOLATILES', 
                rate: toFP(100) 
            })).toBe(true);

            // far well should be out of reach
            expect(assertOutOfReach(ship, farWell).passed).toBe(true);
            expect(extractValidate(ship, [farWell], { 
                resourceType: 'VOLATILES', 
                rate: toFP(100) 
            })).toBe(false);
        });
    });

    describe('Determinism', () => {
        it('should produce identical results for same inputs', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                volatilesMass: toFP(10000),
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, well]);
            const inputs = { resourceType: 'VOLATILES', rate: toFP(500) };

            const updates1 = extractHandler(ship, [well], inputs, context);
            const updates2 = extractHandler(ship, [well], inputs, context);
            const updates3 = extractHandler(ship, [well], inputs, context);

            expect(updates1).toEqual(updates2);
            expect(updates2).toEqual(updates3);
        });
    });

    describe('Edge Cases', () => {
        it('should return empty updates when validation fails', () => {
            const ship = createShip({ reach: toFP(10) });
            const farWell = createResourceWell({ 
                position: { x: toFP(1000), y: toFP(0) },
            });
            const context = createTickContext(1, [ship, farWell]);

            const updates = extractHandler(
                ship, 
                [farWell], 
                { resourceType: 'VOLATILES', rate: toFP(100) },
                context
            );

            expect(updates).toEqual([]);
        });

        it('should handle zero extraction rate', () => {
            const ship = createShip({ reach: toFP(500) });
            const well = createResourceWell({ 
                volatilesMass: toFP(10000),
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = extractValidate(
                ship, 
                [well], 
                { resourceType: 'VOLATILES', rate: toFP(0) }
            );

            // zero rate should likely be invalid
            expect(isValid).toBe(false);
        });
    });
});
