// ===============================================
// UNLOAD ACTION TESTS
// ===============================================
// validates the UNLOAD action which removes content from containers
// and places it at a specified position.

import { describe, it, expect } from 'vitest';
import { 
    createShip, 
    createMineralStore, 
    createContainer, 
    createHauler,
    createTickContext, 
    createGameState 
} from '../../../test/factories.js';
import { testAction, testValidation, applyUpdatesToState } from '../../../test/SimRunner.js';
import { 
    assertMassConservation, 
    assertInReach, 
    assertOutOfReach,
    isRootEntity,
} from '../../../test/invariants.js';
import { unloadHandler, unloadValidate } from '../unloadHandler.js';
import { toFP, fromFP, fpSub } from '../../../primitive-types/euclidean/euclidean-types.js';

describe('UNLOAD Action', () => {
    describe('Validation', () => {
        it('should fail if content is not contained', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const notContained = createMineralStore({
                id: 'content',
                parentId: undefined,
                position: { x: toFP(100), y: toFP(0) },
            });

            const isValid = unloadValidate(
                actor,
                [notContained],
                { 
                    contentIds: ['content'], 
                    newPositions: [{ x: toFP(200), y: toFP(200) }],
                }
            );

            expect(isValid).toBe(false);
        });

        it('should fail if container is out of actor reach', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(100),
                position: { x: toFP(0), y: toFP(0) },
            });
            const farContainer = createContainer({
                id: 'container',
                position: { x: toFP(500), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'container',
                position: { x: toFP(500), y: toFP(0) },
            });

            // verify container is out of reach
            expect(assertOutOfReach(actor, farContainer).passed).toBe(true);

            const isValid = unloadValidate(
                actor,
                [containedContent, farContainer],
                { 
                    contentIds: ['content'], 
                    newPositions: [{ x: toFP(200), y: toFP(200) }],
                }
            );

            expect(isValid).toBe(false);
        });

        it('should pass when actor owns the container', () => {
            const actorContainer = createContainer({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const isValid = unloadValidate(
                actorContainer,
                [containedContent],
                { 
                    contentIds: ['content'], 
                    newPositions: [{ x: toFP(200), y: toFP(200) }],
                }
            );

            expect(isValid).toBe(true);
        });

        it('should pass when actor can reach the container', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const nearContainer = createContainer({
                id: 'container',
                position: { x: toFP(200), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'container',
                position: { x: toFP(200), y: toFP(0) },
            });

            // verify container is in reach
            expect(assertInReach(actor, nearContainer).passed).toBe(true);

            const isValid = unloadValidate(
                actor,
                [containedContent, nearContainer],
                { 
                    contentIds: ['content'], 
                    newPositions: [{ x: toFP(300), y: toFP(100) }],
                }
            );

            expect(isValid).toBe(true);
        });

        it('should fail if positions array length does not match content', () => {
            const actorContainer = createContainer({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content1 = createMineralStore({
                id: 'content-1',
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });
            const content2 = createMineralStore({
                id: 'content-2',
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const isValid = unloadValidate(
                actorContainer,
                [content1, content2],
                { 
                    contentIds: ['content-1', 'content-2'], 
                    newPositions: [{ x: toFP(100), y: toFP(100) }], // only one position
                }
            );

            expect(isValid).toBe(false);
        });
    });

    describe('Handler Execution', () => {
        it('should unload content from actor container', () => {
            const actorContainer = createContainer({
                id: 'actor',
                mass: toFP(3000),
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(10), y: toFP(5) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                mass: toFP(500),
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });
            const newPosition = { x: toFP(200), y: toFP(100) };

            const context = createTickContext(1, [actorContainer, containedContent]);

            const updates = unloadHandler(
                actorContainer,
                [containedContent],
                { contentIds: ['content'], newPositions: [newPosition] },
                context
            );

            expect(updates.length).toBe(2);

            // content update
            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate).toBeDefined();
            expect(contentUpdate!.changes.parentId).toBeUndefined();
            expect(contentUpdate!.changes.position).toEqual(newPosition);
            // should inherit container's velocity
            expect(contentUpdate!.changes.velocity).toEqual(actorContainer.velocity);

            // container mass update
            const containerUpdate = updates.find(u => u.id === 'actor');
            expect(containerUpdate).toBeDefined();
            expect(containerUpdate!.changes.mass).toBe(
                fpSub(actorContainer.mass, containedContent.mass)
            );
        });

        it('should unload content from nearby container', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const container = createContainer({
                id: 'container',
                mass: toFP(5000),
                position: { x: toFP(200), y: toFP(0) },
                velocity: { x: toFP(5), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                mass: toFP(500),
                parentId: 'container',
                position: { x: toFP(200), y: toFP(0) },
            });
            const newPosition = { x: toFP(100), y: toFP(50) };

            const context = createTickContext(1, [actor, container, containedContent]);

            const updates = unloadHandler(
                actor,
                [containedContent, container],
                { contentIds: ['content'], newPositions: [newPosition] },
                context
            );

            expect(updates.length).toBe(2);

            // content should be unloaded
            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate!.changes.parentId).toBeUndefined();
            expect(contentUpdate!.changes.position).toEqual(newPosition);
            // should inherit container's velocity
            expect(contentUpdate!.changes.velocity).toEqual(container.velocity);

            // container mass should decrease
            const containerUpdate = updates.find(u => u.id === 'container');
            expect(containerUpdate!.changes.mass).toBe(
                fpSub(container.mass, containedContent.mass)
            );
        });

        it('should unload multiple items', () => {
            const actorContainer = createContainer({
                id: 'actor',
                mass: toFP(5000),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content1 = createMineralStore({
                id: 'content-1',
                mass: toFP(300),
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });
            const content2 = createMineralStore({
                id: 'content-2',
                mass: toFP(400),
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const context = createTickContext(1, [actorContainer, content1, content2]);

            const updates = unloadHandler(
                actorContainer,
                [content1, content2],
                { 
                    contentIds: ['content-1', 'content-2'], 
                    newPositions: [
                        { x: toFP(100), y: toFP(0) },
                        { x: toFP(200), y: toFP(0) },
                    ],
                },
                context
            );

            expect(updates.length).toBe(3);

            // both contents unloaded
            const content1Update = updates.find(u => u.id === 'content-1');
            const content2Update = updates.find(u => u.id === 'content-2');
            expect(content1Update!.changes.parentId).toBeUndefined();
            expect(content2Update!.changes.parentId).toBeUndefined();

            // container mass decreases by both
            const containerUpdate = updates.find(u => u.id === 'actor');
            expect(containerUpdate!.changes.mass).toBe(
                fpSub(fpSub(actorContainer.mass, content1.mass), content2.mass)
            );
        });
    });

    describe('Mass Conservation', () => {
        it('should conserve total system mass after unload', () => {
            // note: container mass already includes content mass (from LOAD)
            const containerMass = toFP(3000);
            const contentMass = toFP(500);

            const actorContainer = createContainer({
                id: 'actor',
                mass: containerMass,
                position: { x: toFP(0), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                mass: contentMass,
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const state = createGameState({ entities: [actorContainer, containedContent] });
            const context = createTickContext(1, [actorContainer, containedContent]);

            const updates = unloadHandler(
                actorContainer,
                [containedContent],
                { contentIds: ['content'], newPositions: [{ x: toFP(100), y: toFP(0) }] },
                context
            );

            const newState = applyUpdatesToState(state, updates);

            // mass conservation should pass
            const massResult = assertMassConservation(state, newState, toFP(0));
            expect(massResult.passed).toBe(true);
        });
    });

    describe('Velocity Inheritance', () => {
        it('should give unloaded content the containers velocity', () => {
            const containerVelocity = { x: toFP(50), y: toFP(-30) };
            
            const actorContainer = createContainer({
                id: 'actor',
                velocity: containerVelocity,
                position: { x: toFP(0), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const context = createTickContext(1, [actorContainer, containedContent]);

            const updates = unloadHandler(
                actorContainer,
                [containedContent],
                { contentIds: ['content'], newPositions: [{ x: toFP(100), y: toFP(100) }] },
                context
            );

            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate!.changes.velocity).toEqual(containerVelocity);
        });
    });

    describe('Invariants', () => {
        it('should produce deterministic results', () => {
            const actorContainer = createContainer({
                id: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const context = createTickContext(1, [actorContainer, containedContent]);
            const inputs = { 
                contentIds: ['content'], 
                newPositions: [{ x: toFP(100), y: toFP(100) }],
            };

            const updates1 = unloadHandler(actorContainer, [containedContent], inputs, context);
            const updates2 = unloadHandler(actorContainer, [containedContent], inputs, context);
            const updates3 = unloadHandler(actorContainer, [containedContent], inputs, context);

            expect(updates1).toEqual(updates2);
            expect(updates2).toEqual(updates3);
        });
    });

    describe('Edge Cases', () => {
        it('should return empty updates when validation fails', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(10),
                position: { x: toFP(0), y: toFP(0) },
            });
            const farContainer = createContainer({
                id: 'container',
                position: { x: toFP(1000), y: toFP(0) },
            });
            const containedContent = createMineralStore({
                id: 'content',
                parentId: 'container',
                position: { x: toFP(1000), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, farContainer, containedContent]);

            const updates = unloadHandler(
                actor,
                [containedContent, farContainer],
                { contentIds: ['content'], newPositions: [{ x: toFP(100), y: toFP(100) }] },
                context
            );

            expect(updates).toEqual([]);
        });

        it('should handle missing content gracefully', () => {
            const actorContainer = createContainer({
                id: 'actor',
                position: { x: toFP(0), y: toFP(0) },
            });

            const isValid = unloadValidate(
                actorContainer,
                [],
                { contentIds: ['nonexistent'], newPositions: [{ x: toFP(100), y: toFP(100) }] }
            );

            expect(isValid).toBe(false);
        });
    });
});
