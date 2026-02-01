// ===============================================
// WELD ACTION TESTS
// ===============================================
// tests for the WELD action implementation:
// - structural fusion between entities
// - entities maintain relative offset (not shared position)
// - combined mass equals sum of individual masses
// - momentum is conserved

import { describe, it, expect } from 'vitest';
import { createShip, createTickContext, createGameState, createResourceWell } from '../../../test/factories.js';
import { testAction, testValidation, runTick, findEntity } from '../../../test/SimRunner.js';
import { assertMassConservation, assertInReach, assertWeldBinding } from '../../../test/invariants.js';
import { weldHandler, weldValidate } from '../weldHandler.js';
import { unweldHandler, unweldValidate } from '../unweldHandler.js';
import { toFP, fromFP, fpAdd, fpSub } from '../../../primitive-types/euclidean/euclidean-types.js';
import type { WeldAction, UnweldAction } from '../../../primitive-types/semantic/action/action-types.js';

describe('WELD Action', () => {
    // ===============================================
    // VALIDATION TESTS
    // ===============================================

    describe('Validation', () => {
        it('should reject welding when targets are out of reach', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(50),
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(1000), y: toFP(0) },
            });

            const isValid = weldValidate(
                shipA, 
                [shipB], 
                {}
            );

            expect(isValid).toBe(false);
        });

        it('should accept welding when targets are within reach', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
            });

            // verify reach
            const reachResult = assertInReach(shipA, shipB);
            expect(reachResult.passed).toBe(true);

            const isValid = weldValidate(
                shipA, 
                [shipB], 
                {}
            );

            expect(isValid).toBe(true);
        });

        it('should reject welding to self', () => {
            const ship = createShip({
                id: 'ship-a',
                reach: toFP(500),
            });

            const isValid = weldValidate(
                ship, 
                [ship],
                {}
            );

            expect(isValid).toBe(false);
        });

        it('should reject welding without airlock sealed', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                airlockSealed: false,
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = weldValidate(
                shipA, 
                [shipB], 
                {}
            );

            expect(isValid).toBe(false);
        });

        it('should reject welding celestials (RESOURCE_WELL)', () => {
            const ship = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const well = createResourceWell({
                id: 'well-a',
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = weldValidate(ship, [well], {});

            expect(isValid).toBe(false);
        });

        it('should reject welding already-welded entities', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            // shipB is already welded to something
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                }),
                weldParentId: 'some-other-ship',
            };

            const isValid = weldValidate(shipA, [shipB], {});

            expect(isValid).toBe(false);
        });

        it('should reject welding if actor is already welded', () => {
            // actor cannot be welded to something (must be root of structure)
            const shipA = {
                ...createShip({
                    id: 'ship-a',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                }),
                weldParentId: 'some-other-ship',
            };
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = weldValidate(shipA, [shipB], {});

            expect(isValid).toBe(false);
        });
    });

    // ===============================================
    // HANDLER TESTS
    // ===============================================

    describe('Handler', () => {
        it('should set weldParentId on secondary entity', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                mass: toFP(500),
            });
            const context = createTickContext(1, [shipA, shipB]);

            const updates = weldHandler(shipA, [shipB], {}, context);

            const updateB = updates.find(u => u.id === shipB.id);
            expect(updateB).toBeDefined();
            expect(updateB!.changes.weldParentId).toBe(shipA.id);
        });

        it('should record relative offset on secondary entity', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(50) },
                mass: toFP(500),
            });
            const context = createTickContext(1, [shipA, shipB]);

            const updates = weldHandler(shipA, [shipB], {}, context);

            const updateB = updates.find(u => u.id === shipB.id);
            expect(updateB).toBeDefined();
            // relativeOffset = secondary.position - primary.position
            expect(updateB!.changes.relativeOffset).toEqual({
                x: toFP(100),
                y: toFP(50),
            });
        });

        it('should combine masses on primary entity', () => {
            const massA = toFP(1000);
            const massB = toFP(500);
            
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                mass: massA,
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                mass: massB,
            });
            const context = createTickContext(1, [shipA, shipB]);

            const updates = weldHandler(shipA, [shipB], {}, context);

            const updateA = updates.find(u => u.id === shipA.id);
            expect(updateA).toBeDefined();
            expect(updateA!.changes.mass).toBe(fpAdd(massA, massB));
        });

        it('should merge velocities using momentum conservation', () => {
            const massA = toFP(1000);
            const massB = toFP(500);
            const velocityA = { x: toFP(10), y: toFP(0) };
            const velocityB = { x: toFP(0), y: toFP(20) };

            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: velocityA,
                mass: massA,
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                velocity: velocityB,
                mass: massB,
            });
            const context = createTickContext(1, [shipA, shipB]);

            const updates = weldHandler(shipA, [shipB], {}, context);

            // combined velocity = (m1*v1 + m2*v2) / (m1 + m2)
            const totalMass = fpAdd(massA, massB);
            const expectedVelocityX = ((fromFP(massA) * fromFP(velocityA.x)) + 
                                       (fromFP(massB) * fromFP(velocityB.x))) / 
                                       fromFP(totalMass);
            const expectedVelocityY = ((fromFP(massA) * fromFP(velocityA.y)) + 
                                       (fromFP(massB) * fromFP(velocityB.y))) / 
                                       fromFP(totalMass);

            const updateA = updates.find(u => u.id === shipA.id);
            const updateB = updates.find(u => u.id === shipB.id);
            
            expect(updateA).toBeDefined();
            expect(updateB).toBeDefined();
            
            // both should have the same combined velocity
            expect(fromFP(updateA!.changes.velocity!.x)).toBeCloseTo(expectedVelocityX, 1);
            expect(fromFP(updateA!.changes.velocity!.y)).toBeCloseTo(expectedVelocityY, 1);
            expect(updateA!.changes.velocity).toEqual(updateB!.changes.velocity);
        });

        it('should support welding multiple entities at once', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
                mass: toFP(500),
            });
            const shipC = createShip({
                id: 'ship-c',
                position: { x: toFP(-50), y: toFP(100) },
                mass: toFP(300),
            });
            const context = createTickContext(1, [shipA, shipB, shipC]);

            const updates = weldHandler(shipA, [shipB, shipC], {}, context);

            // should have updates for all three entities
            expect(updates.length).toBe(3);
            
            const updateA = updates.find(u => u.id === shipA.id);
            const updateB = updates.find(u => u.id === shipB.id);
            const updateC = updates.find(u => u.id === shipC.id);
            
            expect(updateA!.changes.mass).toBe(fpAdd(fpAdd(toFP(1000), toFP(500)), toFP(300)));
            expect(updateB!.changes.weldParentId).toBe(shipA.id);
            expect(updateC!.changes.weldParentId).toBe(shipA.id);
        });
    });

    // ===============================================
    // INTEGRATION TESTS
    // ===============================================

    describe('Integration', () => {
        it('should maintain weld binding invariant after tick', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(10), y: toFP(5) },
                mass: toFP(1000),
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(50) },
                velocity: { x: toFP(0), y: toFP(0) },
                mass: toFP(500),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const action: WeldAction = {
                type: 'WELD',
                entityId: shipA.id,
                targetIds: [shipB.id],
            };

            // run weld tick
            const result1 = runTick(state, [action]);
            expect(result1.success).toBe(true);

            // run another tick to verify weld binding holds
            const result2 = runTick(result1.nextState, []);
            expect(result2.success).toBe(true);

            // check weld binding invariant
            const bindingResult = assertWeldBinding(result2.nextState);
            expect(bindingResult.passed).toBe(true);
        });

        it('should maintain deterministic behavior', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({
                id: 'ship-b',
                position: { x: toFP(100), y: toFP(0) },
            });
            const context = createTickContext(1, [shipA, shipB]);

            const updates1 = weldHandler(shipA, [shipB], {}, context);
            const updates2 = weldHandler(shipA, [shipB], {}, context);
            const updates3 = weldHandler(shipA, [shipB], {}, context);

            expect(updates1).toEqual(updates2);
            expect(updates2).toEqual(updates3);
        });
    });
});

describe('UNWELD Action', () => {
    // ===============================================
    // VALIDATION TESTS
    // ===============================================

    describe('Validation', () => {
        it('should reject unwelding entity without weldParentId', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
            });
            const shipB = createShip({
                id: 'ship-b',
            });

            const isValid = unweldValidate(shipA, [shipB], {});

            expect(isValid).toBe(false);
        });

        it('should accept unwelding when actor is the weld parent', () => {
            const shipA = createShip({
                id: 'ship-a',
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                }),
                weldParentId: 'ship-a',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };

            const isValid = unweldValidate(shipA, [shipB], {});

            expect(isValid).toBe(true);
        });

        it('should accept unwelding when actor has reach to target', () => {
            const shipA = createShip({
                id: 'ship-a',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                }),
                weldParentId: 'ship-c',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };

            const isValid = unweldValidate(shipA, [shipB], {});

            expect(isValid).toBe(true);
        });
    });

    // ===============================================
    // HANDLER TESTS
    // ===============================================

    describe('Handler', () => {
        it('should clear weldParentId on unwelded entity', () => {
            const shipA = createShip({
                id: 'ship-a',
                mass: toFP(1500),
                velocity: { x: toFP(10), y: toFP(5) },
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                    mass: toFP(500),
                    velocity: { x: toFP(10), y: toFP(5) },
                }),
                weldParentId: 'ship-a',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            const context = createTickContext(1, [shipA, shipB]);

            const updates = unweldHandler(shipA, [shipB], {}, context);

            const updateB = updates.find(u => u.id === shipB.id);
            expect(updateB).toBeDefined();
            expect(updateB!.changes.weldParentId).toBeUndefined();
            expect(updateB!.changes.relativeOffset).toBeUndefined();
        });

        it('should inherit parent velocity on separation', () => {
            const parentVelocity = { x: toFP(10), y: toFP(5) };
            const shipA = createShip({
                id: 'ship-a',
                mass: toFP(1500),
                velocity: parentVelocity,
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                    mass: toFP(500),
                    velocity: parentVelocity,
                }),
                weldParentId: 'ship-a',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            const context = createTickContext(1, [shipA, shipB]);

            const updates = unweldHandler(shipA, [shipB], {}, context);

            const updateB = updates.find(u => u.id === shipB.id);
            expect(updateB).toBeDefined();
            expect(updateB!.changes.velocity).toEqual(parentVelocity);
        });

        it('should reduce parent mass by unwelded entity mass', () => {
            const shipA = createShip({
                id: 'ship-a',
                mass: toFP(1500),
            });
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    position: { x: toFP(100), y: toFP(0) },
                    mass: toFP(500),
                }),
                weldParentId: 'ship-a',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            const context = createTickContext(1, [shipA, shipB]);

            const updates = unweldHandler(shipA, [shipB], {}, context);

            const updateA = updates.find(u => u.id === shipA.id);
            expect(updateA).toBeDefined();
            expect(updateA!.changes.mass).toBe(fpSub(toFP(1500), toFP(500)));
        });
    });

    // ===============================================
    // NESTED WELD (CHAIN OF COMMAND) TESTS
    // ===============================================

    describe('Nested Weld Structures', () => {
        it('should preserve sub-assembly when unwelding middle of chain', () => {
            // scenario: C (root) -> B -> A
            // when we unweld B from C, A should stay attached to B
            
            // ship C is the root with combined mass
            const shipC = createShip({
                id: 'ship-c',
                mass: toFP(3000), // C_orig + B_orig + A_orig = 1000 + 1200 + 800
                velocity: { x: toFP(5), y: toFP(0) },
                position: { x: toFP(0), y: toFP(0) },
            });
            
            // ship B is welded to C, has A's mass included
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    mass: toFP(2000), // B_orig + A_orig = 1200 + 800
                    position: { x: toFP(100), y: toFP(0) },
                    velocity: { x: toFP(5), y: toFP(0) },
                }),
                weldParentId: 'ship-c',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            
            // ship A is welded to B
            const shipA = {
                ...createShip({
                    id: 'ship-a',
                    mass: toFP(800),
                    position: { x: toFP(200), y: toFP(0) },
                    velocity: { x: toFP(5), y: toFP(0) },
                }),
                weldParentId: 'ship-b',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            
            const context = createTickContext(1, [shipA, shipB, shipC]);

            // unweld B from C
            const updates = unweldHandler(shipC, [shipB], {}, context);

            // B should be freed
            const updateB = updates.find(u => u.id === shipB.id);
            expect(updateB).toBeDefined();
            expect(updateB!.changes.weldParentId).toBeUndefined();
            
            // A should NOT be in the updates (stays attached to B)
            const updateA = updates.find(u => u.id === shipA.id);
            expect(updateA).toBeUndefined();
            
            // C's mass should be reduced by B's full mass (which includes A)
            const updateC = updates.find(u => u.id === shipC.id);
            expect(updateC).toBeDefined();
            expect(updateC!.changes.mass).toBe(fpSub(toFP(3000), toFP(2000))); // 1000
        });

        it('should maintain sub-assembly integrity through full tick', () => {
            // setup: C (root) -> B -> A
            const shipC = createShip({
                id: 'ship-c',
                mass: toFP(3000),
                velocity: { x: toFP(10), y: toFP(0) },
                position: { x: toFP(0), y: toFP(0) },
            });
            
            const shipB = {
                ...createShip({
                    id: 'ship-b',
                    mass: toFP(2000),
                    position: { x: toFP(100), y: toFP(0) },
                    velocity: { x: toFP(10), y: toFP(0) },
                }),
                weldParentId: 'ship-c',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            
            const shipA = {
                ...createShip({
                    id: 'ship-a',
                    mass: toFP(800),
                    position: { x: toFP(200), y: toFP(0) },
                    velocity: { x: toFP(10), y: toFP(0) },
                }),
                weldParentId: 'ship-b',
                relativeOffset: { x: toFP(100), y: toFP(0) },
            };
            
            const state = createGameState({ entities: [shipA, shipB, shipC] });

            // unweld B from C via full tick
            const action: UnweldAction = {
                type: 'UNWELD',
                entityId: shipC.id,
                targetIds: [shipB.id],
            };

            const result = runTick(state, [action]);
            expect(result.success).toBe(true);

            // verify B is now independent
            const newB = findEntity(result.nextState, 'ship-b');
            expect(newB).toBeDefined();
            expect(newB!.weldParentId).toBeUndefined();

            // verify A is STILL welded to B (sub-assembly preserved)
            const newA = findEntity(result.nextState, 'ship-a');
            expect(newA).toBeDefined();
            expect(newA!.weldParentId).toBe('ship-b');

            // verify C is alone
            const newC = findEntity(result.nextState, 'ship-c');
            expect(newC).toBeDefined();
            expect(newC!.mass).toBe(toFP(1000)); // original mass minus sub-assembly

            // run another tick to verify weld binding still works for sub-assembly
            const result2 = runTick(result.nextState, []);
            expect(result2.success).toBe(true);

            // A should still follow B
            const finalA = findEntity(result2.nextState, 'ship-a');
            const finalB = findEntity(result2.nextState, 'ship-b');
            expect(finalA!.weldParentId).toBe('ship-b');
            
            // verify A's position is B's position + offset
            expect(finalA!.position.x).toBe(fpAdd(finalB!.position.x, toFP(100)));
        });
    });
});
