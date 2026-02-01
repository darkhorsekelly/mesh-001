// ===============================================
// THRUST ACTION TESTS
// ===============================================
// validates Newtonian thrust mechanics: delta-V application,
// fuel consumption, and mass loss from propellant ejection.

import { describe, it, expect, beforeEach } from 'vitest';
import { createShip, createTickContext, createGameState } from '../../../test/factories.js';
import { testAction, testValidation, runTick } from '../../../test/SimRunner.js';
import { assertMassConservation, assertSufficientFuel } from '../../../test/invariants.js';
import { thrustHandler, thrustValidate } from '../thrustHandler.js';
import { toFP, fromFP, type FP } from '../../../primitive-types/euclidean/euclidean-types.js';
import {
    FUEL_BURN_RATE,
    MASS_PROPULSION_LOSS,
    MAX_THRUST_PER_TICK,
} from '../../../config/engineConfig.js';
import type { ThrustAction } from '../../../primitive-types/semantic/action/action-types.js';

describe('THRUST Action', () => {
    describe('Validation', () => {
        it('should reject thrust with zero magnitude', () => {
            const ship = createShip({ fuelMass: toFP(100) });
            const isValid = testValidation('THRUST', ship, [], { magnitude: toFP(0) });
            
            expect(isValid).toBe(false);
        });

        it('should reject thrust with negative magnitude', () => {
            const ship = createShip({ fuelMass: toFP(100) });
            const isValid = testValidation('THRUST', ship, [], { magnitude: toFP(-10) });
            
            expect(isValid).toBe(false);
        });

        it('should reject thrust when fuel is depleted', () => {
            const ship = createShip({ fuelMass: toFP(0) });
            const isValid = testValidation('THRUST', ship, [], { magnitude: toFP(10) });
            
            expect(isValid).toBe(false);
        });

        it('should accept thrust with valid fuel and magnitude', () => {
            const ship = createShip({ fuelMass: toFP(100) });
            const isValid = testValidation('THRUST', ship, [], { magnitude: toFP(10) });
            
            expect(isValid).toBe(true);
        });
    });

    describe('Heading to Delta-V Conversion', () => {
        it('should apply thrust in +X direction at heading 0°', () => {
            const ship = createShip({
                heading: toFP(0),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude: toFP(10) }, context);
            
            expect(updates.length).toBe(1);
            const velocity = updates[0]!.changes.velocity!;
            
            // at heading 0, cos(0)=1, sin(0)=0 -> velocity in +X
            expect(fromFP(velocity.x)).toBeCloseTo(10, 1);
            expect(fromFP(velocity.y)).toBeCloseTo(0, 1);
        });

        it('should apply thrust in +Y direction at heading 90°', () => {
            const ship = createShip({
                heading: toFP(90),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude: toFP(10) }, context);
            
            expect(updates.length).toBe(1);
            const velocity = updates[0]!.changes.velocity!;
            
            // at heading 90, cos(90)≈0, sin(90)=1 -> velocity in +Y
            expect(Math.abs(fromFP(velocity.x))).toBeLessThan(0.1);
            expect(fromFP(velocity.y)).toBeCloseTo(10, 1);
        });

        it('should apply thrust in -X direction at heading 180°', () => {
            const ship = createShip({
                heading: toFP(180),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude: toFP(10) }, context);
            
            expect(updates.length).toBe(1);
            const velocity = updates[0]!.changes.velocity!;
            
            // at heading 180, cos(180)=-1, sin(180)≈0 -> velocity in -X
            expect(fromFP(velocity.x)).toBeCloseTo(-10, 1);
            expect(Math.abs(fromFP(velocity.y))).toBeLessThan(0.1);
        });

        it('should apply thrust diagonally at heading 45°', () => {
            const ship = createShip({
                heading: toFP(45),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude: toFP(10) }, context);
            
            expect(updates.length).toBe(1);
            const velocity = updates[0]!.changes.velocity!;
            
            // at heading 45, cos(45)=sin(45)≈0.707 -> equal X and Y
            const expectedComponent = 10 * Math.cos(Math.PI / 4);
            expect(fromFP(velocity.x)).toBeCloseTo(expectedComponent, 1);
            expect(fromFP(velocity.y)).toBeCloseTo(expectedComponent, 1);
        });
    });

    describe('Fuel Consumption', () => {
        it('should consume fuel proportional to magnitude', () => {
            const initialFuel = toFP(100);
            const magnitude = toFP(10);
            const ship = createShip({ fuelMass: initialFuel });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude }, context);
            
            expect(updates.length).toBe(1);
            const newFuel = updates[0]!.changes.fuelMass!;
            
            // fuel consumed = magnitude * FUEL_BURN_RATE
            const expectedFuel = initialFuel - (magnitude * fromFP(FUEL_BURN_RATE));
            expect(fromFP(newFuel)).toBeCloseTo(expectedFuel / 1000, 1);
        });

        it('should limit thrust when fuel is insufficient', () => {
            const lowFuel = toFP(5);
            const ship = createShip({ fuelMass: lowFuel });
            const context = createTickContext(1, [ship]);
            
            // request more thrust than fuel allows
            const updates = thrustHandler(ship, [], { magnitude: toFP(100) }, context);
            
            expect(updates.length).toBe(1);
            const newFuel = updates[0]!.changes.fuelMass!;
            
            // should burn all available fuel
            expect(fromFP(newFuel)).toBeLessThanOrEqual(0.1);
        });

        it('should clamp thrust to MAX_THRUST_PER_TICK', () => {
            const ship = createShip({ fuelMass: toFP(10000) });
            const context = createTickContext(1, [ship]);
            
            // request ridiculous thrust
            const updates = thrustHandler(ship, [], { magnitude: toFP(99999) }, context);
            
            expect(updates.length).toBe(1);
            
            // effective thrust should be clamped
            const thrust = updates[0]!.changes.thrust!;
            expect(thrust).toBeLessThanOrEqual(MAX_THRUST_PER_TICK);
        });
    });

    describe('Mass Loss (Propellant Ejection)', () => {
        it('should reduce entity mass when thrusting', () => {
            const initialMass = toFP(1000);
            const magnitude = toFP(10);
            const ship = createShip({ mass: initialMass, fuelMass: toFP(100) });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude }, context);
            
            expect(updates.length).toBe(1);
            const newMass = updates[0]!.changes.mass!;
            
            // mass lost = magnitude * MASS_PROPULSION_LOSS
            const expectedMass = initialMass - (magnitude * fromFP(MASS_PROPULSION_LOSS));
            expect(fromFP(newMass)).toBeCloseTo(expectedMass / 1000, 1);
        });
    });

    describe('Invariants', () => {
        it('should maintain mass + fuel consistency', () => {
            const ship = createShip({
                mass: toFP(1000),
                fuelMass: toFP(100),
                volatilesMass: toFP(0),
            });
            const state = createGameState({ entities: [ship] });
            
            // create thrust action
            const action: ThrustAction = {
                type: 'THRUST',
                entityId: ship.id,
                direction: { x: toFP(1), y: toFP(0) },
                magnitude: toFP(10),
            };
            
            const result = runTick(state, [action]);
            
            expect(result.success).toBe(true);
            
            // mass is lost through propellant ejection, so we allow that loss
            const massResult = assertMassConservation(
                state, 
                result.nextState, 
                toFP(20) // allow for fuel burn + mass loss
            );
            
            // mass should decrease but not go negative
            const shipAfter = result.nextState.entities.find(e => e.id === ship.id)!;
            expect(shipAfter.mass).toBeGreaterThan(0);
            expect(shipAfter.fuelMass).toBeGreaterThanOrEqual(0);
        });

        it('should produce deterministic results', () => {
            const ship = createShip({
                heading: toFP(45),
                fuelMass: toFP(100),
            });
            const context = createTickContext(1, [ship]);
            const inputs = { magnitude: toFP(10) };
            
            // run same action multiple times
            const updates1 = thrustHandler(ship, [], inputs, context);
            const updates2 = thrustHandler(ship, [], inputs, context);
            const updates3 = thrustHandler(ship, [], inputs, context);
            
            // results should be identical
            expect(updates1).toEqual(updates2);
            expect(updates2).toEqual(updates3);
        });
    });

    describe('Edge Cases', () => {
        it('should return empty updates when validation fails', () => {
            const ship = createShip({ fuelMass: toFP(0) });
            const context = createTickContext(1, [ship]);
            
            const updates = thrustHandler(ship, [], { magnitude: toFP(10) }, context);
            
            expect(updates).toEqual([]);
        });

        it('should handle minimum thrust values', () => {
            const ship = createShip({ fuelMass: toFP(100) });
            const context = createTickContext(1, [ship]);
            
            // minimum positive thrust
            const updates = thrustHandler(ship, [], { magnitude: toFP(0.001) }, context);
            
            expect(updates.length).toBe(1);
        });
    });
});
