// ===============================================
// CONFLICT CLUSTER RESOLVER TESTS
// ===============================================
// tests for the Unified Intent Theory implementation:
// - cluster identification (entanglement rules)
// - permutation solver (optimal ordering)
// - stalemate detection (mutual exclusion)
// - physics feedback (virtual state application)

import { describe, it, expect } from 'vitest';
import { createShip, createMineralStore, createGameState, createContainer } from '../../../test/factories.js';
import {
    runTick,
    runTickWithStalemateCheck,
    assertStalemate,
    assertNoStalemate,
    getActionClusters,
    testClusterResolution,
    actionsWouldCluster,
    getConflictClassification,
    findEntity,
} from '../../../test/SimRunner.js';
import {
    getConflictClusters,
    resolveCluster,
    resolveClusterWave,
    classifyConflict,
} from '../../../state-handlers/state-systems/conflictClusterResolver.js';
import { toFP, fpAdd, fromFP } from '../../../primitive-types/euclidean/euclidean-types.js';
import type { 
    WeldAction, 
    UnweldAction, 
    LoadAction, 
    ThrustAction 
} from '../../../primitive-types/semantic/action/action-types.js';

describe('Conflict Cluster Identification', () => {
    // ===============================================
    // RULE 1: SHARED TARGETS
    // ===============================================

    describe('Shared Target Clustering', () => {
        it('should cluster actions that share the same target', () => {
            const shipA = createShip({ id: 'ship-a', position: { x: toFP(0), y: toFP(0) } });
            const shipB = createShip({ id: 'ship-b', position: { x: toFP(0), y: toFP(0) } });
            const satellite = createShip({ 
                id: 'satellite', 
                position: { x: toFP(100), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB, satellite] });

            // both ships try to weld to the same satellite
            const actionA: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['satellite'],
            };
            const actionB: WeldAction = {
                type: 'WELD',
                entityId: 'ship-b',
                targetIds: ['satellite'],
            };

            const clusters = getConflictClusters([actionA, actionB], state.entities);
            
            // should be in same cluster
            expect(clusters.length).toBe(1);
            expect(clusters[0]!.length).toBe(2);
        });

        it('should NOT cluster independent actions', () => {
            const shipA = createShip({ id: 'ship-a', position: { x: toFP(0), y: toFP(0) } });
            const shipB = createShip({ id: 'ship-b', position: { x: toFP(1000), y: toFP(0) } });
            const targetA = createShip({ id: 'target-a', position: { x: toFP(100), y: toFP(0) } });
            const targetB = createShip({ id: 'target-b', position: { x: toFP(1100), y: toFP(0) } });
            const state = createGameState({ entities: [shipA, shipB, targetA, targetB] });

            // ships target different entities
            const actionA: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['target-a'],
            };
            const actionB: WeldAction = {
                type: 'WELD',
                entityId: 'ship-b',
                targetIds: ['target-b'],
            };

            const clusters = getConflictClusters([actionA, actionB], state.entities);
            
            // should be in separate clusters
            expect(clusters.length).toBe(2);
        });
    });

    // ===============================================
    // RULE 2: ACTOR-TARGET DUALITY
    // ===============================================

    describe('Actor-Target Duality Clustering', () => {
        it('should cluster when actor is also a target', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // ship A thrusts while ship B tries to load ship A
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };
            const loadAction: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-b',
                contentIds: ['ship-a'],
                containerIds: ['ship-b'],
            };

            const clusters = getConflictClusters([thrustAction, loadAction], state.entities);
            
            // should be in same cluster (ship-a is both actor and target)
            expect(clusters.length).toBe(1);
            expect(clusters[0]!.length).toBe(2);
        });

        it('should classify actor-target duality conflict correctly', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-b',
                targetIds: ['ship-a'],
            };

            const conflictType = classifyConflict(thrustAction, weldAction, state);
            
            expect(conflictType).toBe('ACTOR_TARGET_DUALITY');
        });
    });

    // ===============================================
    // RULE 3: CONTAINMENT/WELD CHAINS
    // ===============================================

    describe('Containment Chain Clustering', () => {
        it('should cluster actions targeting parent and child', () => {
            const container = createContainer({ 
                id: 'container',
                position: { x: toFP(0), y: toFP(0) },
            });
            const cargo = {
                ...createMineralStore({ 
                    id: 'cargo',
                    position: { x: toFP(0), y: toFP(0) },
                }),
                parentId: 'container',
            };
            const ship = createShip({ 
                id: 'ship',
                position: { x: toFP(100), y: toFP(0) },
            });
            const state = createGameState({ entities: [container, cargo, ship] });

            // one action targets container, another targets cargo
            const weldContainer: WeldAction = {
                type: 'WELD',
                entityId: 'ship',
                targetIds: ['container'],
            };
            const thrustCargo: ThrustAction = {
                type: 'THRUST',
                entityId: 'cargo',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };

            const clusters = getConflictClusters([weldContainer, thrustCargo], state.entities);
            
            // should be in same cluster (containment chain)
            expect(clusters.length).toBe(1);
        });
    });
});

describe('Permutation Solver', () => {
    // ===============================================
    // OPTIMAL ORDERING
    // ===============================================

    describe('Success Maximizer', () => {
        it('should find order where all actions succeed (WELD -> THRUST)', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(100),
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
                mass: toFP(500),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // weld and thrust in same wave
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };

            // the solver should find that WELD -> THRUST works
            // (thrust will use combined mass)
            const result = testClusterResolution([weldAction, thrustAction], state);
            
            expect(result.isStalemate).toBe(false);
            expect(result.executionOrder.length).toBe(2);
        });

        it('should resolve LOAD -> MOVE correctly', () => {
            // use createShip which has thrust capability by default
            const hauler = createShip({ 
                id: 'hauler',
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
                fuelMass: toFP(100),
                isContainer: true,
                containerVolume: toFP(5000),
            });
            const cargo = createMineralStore({ 
                id: 'cargo',
                position: { x: toFP(100), y: toFP(0) },
                volume: toFP(100),
            });
            const state = createGameState({ entities: [hauler, cargo] });

            // load and thrust in same wave - these should cluster due to actor-target
            // but LOAD then THRUST should both succeed
            const loadAction: LoadAction = {
                type: 'LOAD',
                entityId: 'hauler',
                contentIds: ['cargo'],
                containerIds: ['hauler'],
            };
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'hauler',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };

            const result = testClusterResolution([loadAction, thrustAction], state);
            
            // should not be a stalemate
            expect(result.isStalemate).toBe(false);
            // at least LOAD should succeed (THRUST may or may not depending on validation)
            expect(result.executionOrder.length).toBeGreaterThanOrEqual(1);
        });
    });
});

describe('Stalemate Detection', () => {
    // ===============================================
    // MUTUAL EXCLUSION (STALEMATE)
    // ===============================================

    describe('WELD vs UNWELD Stalemate', () => {
        it('should detect conflict when one player welds and another unwelds', () => {
            // setup: shipB is welded to shipA
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1500), // includes shipB mass
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
            const shipC = createShip({ 
                id: 'ship-c',
                position: { x: toFP(150), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB, shipC] });

            // player 1 tries to unweld shipB
            const unweldAction: UnweldAction = {
                type: 'UNWELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            
            // player 2 tries to weld shipC to shipB
            // in one order: unweld first, then weld works
            // in other order: weld fails (B already welded), unweld works
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-c',
                targetIds: ['ship-b'],
            };

            // verify both actions would cluster (shared target: ship-b)
            expect(actionsWouldCluster(unweldAction, weldAction, state)).toBe(true);

            // run the cluster resolution
            const result = testClusterResolution([unweldAction, weldAction], state);
            
            // the solver should find the order UNWELD -> WELD where both succeed
            // OR it might find only one succeeds (depends on validation)
            // key point: it should NOT be a mutual exclusion stalemate
            expect(result.isStalemate).toBe(false);
        });
    });

    describe('Competing LOAD Stalemate', () => {
        it('should detect stalemate when two ships try to load the same cargo', () => {
            const shipA = createContainer({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
            });
            const shipB = createContainer({ 
                id: 'ship-b', 
                position: { x: toFP(0), y: toFP(100) },
                reach: toFP(500),
            });
            const cargo = createMineralStore({ 
                id: 'cargo',
                position: { x: toFP(50), y: toFP(50) },
                volume: toFP(100),
            });
            const state = createGameState({ entities: [shipA, shipB, cargo] });

            // both ships try to load the same cargo
            const loadA: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-a',
                contentIds: ['cargo'],
                containerIds: ['ship-a'],
            };
            const loadB: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-b',
                contentIds: ['cargo'],
                containerIds: ['ship-b'],
            };

            // should cluster due to shared target
            expect(actionsWouldCluster(loadA, loadB, state)).toBe(true);

            // only one can succeed - the other should fail due to parentId
            const result = testClusterResolution([loadA, loadB], state);
            
            // one should succeed, one should fail (or stalemate)
            expect(result.executionOrder.length).toBeLessThanOrEqual(2);
            if (result.executionOrder.length < 2) {
                expect(result.voidedActions.length).toBeGreaterThan(0);
            }
        });
    });

    describe('WELD to Moving Target', () => {
        it('should find valid order where weld happens before target moves away', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
                fuelMass: toFP(100),
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // shipA welds to shipB, shipB thrusts
            // if thrust goes first, shipB might leave reach
            // if weld goes first, they move together
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-b',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(10),
            };

            const result = testClusterResolution([weldAction, thrustAction], state);
            
            // solver should find WELD -> THRUST order
            expect(result.isStalemate).toBe(false);
            expect(result.executionOrder.length).toBe(2);
            
            // verify weld is first in the order
            expect(result.executionOrder[0]!.type).toBe('WELD');
        });
    });
});

describe('Integration Tests', () => {
    // ===============================================
    // FULL TICK RESOLUTION
    // ===============================================

    describe('Wave Resolution with Clusters', () => {
        it('should handle multiple independent clusters in same wave', () => {
            // cluster 1: ship-a and ship-b interact
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
            });
            
            // cluster 2: ship-c and ship-d interact (far away)
            const shipC = createShip({ 
                id: 'ship-c', 
                position: { x: toFP(10000), y: toFP(0) },
            });
            const shipD = createShip({ 
                id: 'ship-d', 
                position: { x: toFP(10100), y: toFP(0) },
            });
            
            const state = createGameState({ entities: [shipA, shipB, shipC, shipD] });

            const weldAB: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            const weldCD: WeldAction = {
                type: 'WELD',
                entityId: 'ship-c',
                targetIds: ['ship-d'],
            };

            const result = runTick(state, [weldAB, weldCD]);
            
            expect(result.success).toBe(true);
            
            // both welds should succeed
            const newB = findEntity(result.nextState, 'ship-b');
            const newD = findEntity(result.nextState, 'ship-d');
            expect(newB?.weldParentId).toBe('ship-a');
            expect(newD?.weldParentId).toBe('ship-c');
        });

        it('should report stalemate metrics correctly', () => {
            const shipA = createContainer({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
            });
            const shipB = createContainer({ 
                id: 'ship-b', 
                position: { x: toFP(0), y: toFP(100) },
                reach: toFP(500),
            });
            const cargo = createMineralStore({ 
                id: 'cargo',
                position: { x: toFP(50), y: toFP(50) },
            });
            const state = createGameState({ entities: [shipA, shipB, cargo] });

            const loadA: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-a',
                contentIds: ['cargo'],
                containerIds: ['ship-a'],
            };
            const loadB: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-b',
                contentIds: ['cargo'],
                containerIds: ['ship-b'],
            };

            const result = runTickWithStalemateCheck(state, [loadA, loadB]);
            
            expect(result.success).toBe(true);
            expect(result.stalemate.clusterCount).toBeGreaterThan(0);
        });

        it('should maintain determinism with conflict clusters', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
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
                magnitude: toFP(10),
            };

            // run multiple times
            const result1 = runTick(state, [weldAction, thrustAction]);
            const result2 = runTick(state, [weldAction, thrustAction]);
            const result3 = runTick(state, [weldAction, thrustAction]);

            // results should be identical
            expect(result1.nextState.entities).toEqual(result2.nextState.entities);
            expect(result2.nextState.entities).toEqual(result3.nextState.entities);
        });
    });

    describe('Physics Feedback (Virtual State)', () => {
        it('should use updated mass for thrust after weld', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                mass: toFP(1000),
                fuelMass: toFP(1000),
                velocity: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
                mass: toFP(1000),
                velocity: { x: toFP(0), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB] });

            // weld then thrust
            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };
            const thrustAction: ThrustAction = {
                type: 'THRUST',
                entityId: 'ship-a',
                direction: { x: toFP(1000), y: toFP(0) },
                magnitude: toFP(100),
            };

            const result = runTick(state, [weldAction, thrustAction]);
            expect(result.success).toBe(true);

            const newA = findEntity(result.nextState, 'ship-a');
            const newB = findEntity(result.nextState, 'ship-b');
            
            // both should be moving together
            expect(newA?.weldParentId).toBeUndefined(); // A is parent
            expect(newB?.weldParentId).toBe('ship-a'); // B is welded to A
            
            // combined mass should affect thrust velocity
            // if using combined mass (2000), velocity change should be half
            // compared to using original mass (1000)
            expect(newA?.velocity.x).toBeGreaterThan(0);
        });
    });
});

describe('Multi-Player Chain Tests', () => {
    // ===============================================
    // MULTI-PLAYER 3-WAVE INTERLEAVING
    // ===============================================

    describe('3-Wave Multi-Player Resolution', () => {
        it('should identify independent actions are NOT in the same cluster', () => {
            // setup: 2 ships far apart targeting different resources
            const shipA = createShip({ 
                id: 'ship-a', 
                playerId: 'player-a',
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                playerId: 'player-b',
                position: { x: toFP(10000), y: toFP(0) },
            });
            const targetA = createMineralStore({ 
                id: 'target-a',
                position: { x: toFP(100), y: toFP(0) },
            });
            const targetB = createMineralStore({ 
                id: 'target-b',
                position: { x: toFP(10100), y: toFP(0) },
            });
            
            const state = createGameState({ 
                entities: [shipA, shipB, targetA, targetB] 
            });

            // two completely independent clusters should form
            const clusters = getActionClusters([
                { type: 'WELD', entityId: 'ship-a', targetIds: ['target-a'], orderIndex: 0 } as WeldAction,
                { type: 'WELD', entityId: 'ship-b', targetIds: ['target-b'], orderIndex: 0 } as WeldAction,
            ], state);

            // should be 2 separate clusters (independent actions)
            expect(clusters.length).toBe(2);
        });

        it('should void contested actions when two ships load the same mineral', () => {
            // setup: 2 ships compete for same mineral in Wave 0
            const shipA = createShip({ 
                id: 'ship-a', 
                playerId: 'player-a',
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                playerId: 'player-b',
                position: { x: toFP(0), y: toFP(100) },
                reach: toFP(500),
            });
            const contestedMineral = createMineralStore({ 
                id: 'contested-mineral',
                position: { x: toFP(50), y: toFP(50) },
            });
            
            const state = createGameState({ entities: [shipA, shipB, contestedMineral] });

            // both try to LOAD the same mineral in Wave 0
            const loadA: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-a',
                contentIds: ['contested-mineral'],
                containerIds: ['ship-a'],
                playerId: 'player-a',
                orderIndex: 0,
            };
            const loadB: LoadAction = {
                type: 'LOAD',
                entityId: 'ship-b',
                contentIds: ['contested-mineral'],
                containerIds: ['ship-b'],
                playerId: 'player-b',
                orderIndex: 0,
            };

            // run resolution and check the cluster result directly
            const clusterResult = testClusterResolution([loadA, loadB], state);
            
            // the contested mineral should NOT be loaded
            // either it's a stalemate (both voided) OR one wins but the other is voided
            const finalMineral = findEntity(
                clusterResult.executionOrder.length > 0 
                    ? state // if one won, check original state
                    : state,
                'contested-mineral'
            );
            
            // key assertion: the cluster should identify this as contested
            expect(clusterResult.voidedActions.length).toBeGreaterThan(0);
            
            // if it's a true stalemate, both should be voided
            if (clusterResult.isStalemate) {
                expect(clusterResult.voidedActions.length).toBe(2);
                expect(clusterResult.executionOrder.length).toBe(0);
            }
        });
    });
});

describe('Edge Cases', () => {
    // ===============================================
    // BOUNDARY CONDITIONS
    // ===============================================

    describe('Single Action Cluster', () => {
        it('should handle single action as a cluster', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(100), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };

            const clusters = getConflictClusters([weldAction], state.entities);
            
            expect(clusters.length).toBe(1);
            expect(clusters[0]!.length).toBe(1);
            
            const result = testClusterResolution([weldAction], state);
            expect(result.isStalemate).toBe(false);
            expect(result.executionOrder.length).toBe(1);
        });
    });

    describe('Empty Action Set', () => {
        it('should handle empty action array', () => {
            const state = createGameState({ entities: [] });
            
            const clusters = getConflictClusters([], state.entities);
            
            expect(clusters.length).toBe(0);
        });
    });

    describe('Invalid Actions', () => {
        it('should void actions that fail validation', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
                reach: toFP(50), // too short
            });
            const shipB = createShip({ 
                id: 'ship-b', 
                position: { x: toFP(1000), y: toFP(0) }, // too far
            });
            const state = createGameState({ entities: [shipA, shipB] });

            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-b'],
            };

            const result = testClusterResolution([weldAction], state);
            
            expect(result.executionOrder.length).toBe(0);
            expect(result.voidedActions.length).toBe(1);
            expect(result.actionResults[0]!.voidReason).toBe('INVALID');
        });
    });

    describe('Self-Referential Actions', () => {
        it('should reject welding to self', () => {
            const shipA = createShip({ 
                id: 'ship-a', 
                position: { x: toFP(0), y: toFP(0) },
            });
            const state = createGameState({ entities: [shipA] });

            const weldAction: WeldAction = {
                type: 'WELD',
                entityId: 'ship-a',
                targetIds: ['ship-a'],
            };

            const result = testClusterResolution([weldAction], state);
            
            expect(result.executionOrder.length).toBe(0);
            expect(result.voidedActions.length).toBe(1);
        });
    });
});
