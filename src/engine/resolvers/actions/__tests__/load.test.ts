// ===============================================
// LOAD ACTION TESTS
// ===============================================
// validates the LOAD action with Triad Validation:
// 1. Actor Reach - can actor reach both content and container?
// 2. Container Capability - does container have isContainer permission?
// 3. Volume Check - does container have remaining capacity?

import { describe, it, expect } from 'vitest';
import { 
    createShip, 
    createMineralStore, 
    createContainer, 
    createHauler,
    createTickContext, 
    createGameState 
} from '../../../test/factories.js';
import { testAction, testValidation, runTick, applyUpdatesToState } from '../../../test/SimRunner.js';
import { 
    assertMassConservation, 
    assertInReach, 
    assertOutOfReach,
    assertPositionBinding,
    assertVolumeConstraints,
    isRootEntity,
} from '../../../test/invariants.js';
import { loadHandler, loadValidate } from '../loadHandler.js';
import { toFP, fromFP, fpAdd } from '../../../primitive-types/euclidean/euclidean-types.js';
import type { LoadAction } from '../../../primitive-types/semantic/action/action-types.js';

describe('LOAD Action', () => {
    describe('Triad Validation', () => {
        describe('1. Actor Reach', () => {
            it('should fail if container is out of actor reach', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(100),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const content = createMineralStore({
                    id: 'content',
                    position: { x: toFP(50), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    position: { x: toFP(500), y: toFP(0) },
                });

                // verify container is out of reach
                expect(assertOutOfReach(actor, container).passed).toBe(true);

                const isValid = loadValidate(
                    actor,
                    [content, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(false);
            });

            it('should fail if content is out of actor reach', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(100),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const content = createMineralStore({
                    id: 'content',
                    position: { x: toFP(500), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    position: { x: toFP(50), y: toFP(0) },
                });

                // verify content is out of reach
                expect(assertOutOfReach(actor, content).passed).toBe(true);

                const isValid = loadValidate(
                    actor,
                    [content, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(false);
            });

            it('should pass when actor can reach both content and container', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const content = createMineralStore({
                    id: 'content',
                    position: { x: toFP(100), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    position: { x: toFP(200), y: toFP(0) },
                });

                // verify both in reach
                expect(assertInReach(actor, content).passed).toBe(true);
                expect(assertInReach(actor, container).passed).toBe(true);

                const isValid = loadValidate(
                    actor,
                    [content, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(true);
            });
        });

        describe('2. Container Capability', () => {
            it('should fail if target is not a container', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const content = createMineralStore({
                    id: 'content',
                    position: { x: toFP(100), y: toFP(0) },
                });
                // regular ship, not a container
                const notAContainer = createShip({
                    id: 'not-container',
                    position: { x: toFP(200), y: toFP(0) },
                    isContainer: false,
                });

                const isValid = loadValidate(
                    actor,
                    [content, notAContainer],
                    { contentIds: ['content'], containerId: 'not-container' }
                );

                expect(isValid).toBe(false);
            });

            it('should pass when target has isContainer=true', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const content = createMineralStore({
                    id: 'content',
                    position: { x: toFP(100), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    position: { x: toFP(200), y: toFP(0) },
                });

                const isValid = loadValidate(
                    actor,
                    [content, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(true);
            });
        });

        describe('3. Volume Check', () => {
            it('should fail if content volume exceeds container capacity', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const largeContent = createMineralStore({
                    id: 'content',
                    volume: toFP(10000),
                    position: { x: toFP(100), y: toFP(0) },
                });
                const smallContainer = createContainer({
                    id: 'container',
                    containerVolume: toFP(1000),
                    position: { x: toFP(200), y: toFP(0) },
                });

                const isValid = loadValidate(
                    actor,
                    [largeContent, smallContainer],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(false);
            });

            it('should pass when content fits in container', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const smallContent = createMineralStore({
                    id: 'content',
                    volume: toFP(100),
                    position: { x: toFP(100), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    containerVolume: toFP(5000),
                    position: { x: toFP(200), y: toFP(0) },
                });

                const isValid = loadValidate(
                    actor,
                    [smallContent, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(true);
            });
        });

        describe('Content State Checks', () => {
            it('should fail if content is already contained', () => {
                const actor = createShip({
                    id: 'actor',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });
                const alreadyContained = createMineralStore({
                    id: 'content',
                    parentId: 'some-other-container',
                    position: { x: toFP(100), y: toFP(0) },
                });
                const container = createContainer({
                    id: 'container',
                    position: { x: toFP(200), y: toFP(0) },
                });

                const isValid = loadValidate(
                    actor,
                    [alreadyContained, container],
                    { contentIds: ['content'], containerId: 'container' }
                );

                expect(isValid).toBe(false);
            });

            it('should fail if trying to load container into itself', () => {
                const actorContainer = createContainer({
                    id: 'actor-container',
                    reach: toFP(500),
                    position: { x: toFP(0), y: toFP(0) },
                });

                const isValid = loadValidate(
                    actorContainer,
                    [actorContainer],
                    { contentIds: ['actor-container'], containerId: 'actor-container' }
                );

                expect(isValid).toBe(false);
            });
        });
    });

    describe('Handler Execution', () => {
        it('should load content into actor (Actor == Container)', () => {
            const actorContainer = createContainer({
                id: 'actor',
                reach: toFP(500),
                mass: toFP(2000),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content = createMineralStore({
                id: 'content',
                mass: toFP(500),
                position: { x: toFP(100), y: toFP(0) },
            });

            const context = createTickContext(1, [actorContainer, content]);

            const updates = loadHandler(
                actorContainer,
                [content, actorContainer],
                { contentIds: ['content'], containerId: 'actor' },
                context
            );

            expect(updates.length).toBe(2);

            // content update
            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate).toBeDefined();
            expect(contentUpdate!.changes.parentId).toBe('actor');
            expect(contentUpdate!.changes.position).toEqual(actorContainer.position);

            // container mass update
            const containerUpdate = updates.find(u => u.id === 'actor');
            expect(containerUpdate).toBeDefined();
            expect(containerUpdate!.changes.mass).toBe(fpAdd(actorContainer.mass, content.mass));
        });

        it('should load content into nearby hauler (Actor != Container)', () => {
            const actor = createShip({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content = createMineralStore({
                id: 'content',
                mass: toFP(500),
                position: { x: toFP(100), y: toFP(0) },
            });
            const hauler = createHauler({
                id: 'hauler',
                mass: toFP(5000),
                position: { x: toFP(200), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, content, hauler]);

            const updates = loadHandler(
                actor,
                [content, hauler],
                { contentIds: ['content'], containerId: 'hauler' },
                context
            );

            expect(updates.length).toBe(2);

            // content should now be inside hauler
            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate).toBeDefined();
            expect(contentUpdate!.changes.parentId).toBe('hauler');
            expect(contentUpdate!.changes.position).toEqual(hauler.position);

            // hauler mass should increase
            const haulerUpdate = updates.find(u => u.id === 'hauler');
            expect(haulerUpdate).toBeDefined();
            expect(haulerUpdate!.changes.mass).toBe(fpAdd(hauler.mass, content.mass));
        });

        it('should load multiple items in single action', () => {
            const actor = createContainer({
                id: 'actor',
                reach: toFP(500),
                mass: toFP(2000),
                containerVolume: toFP(10000),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content1 = createMineralStore({
                id: 'content-1',
                mass: toFP(300),
                volume: toFP(100),
                position: { x: toFP(50), y: toFP(0) },
            });
            const content2 = createMineralStore({
                id: 'content-2',
                mass: toFP(400),
                volume: toFP(100),
                position: { x: toFP(100), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, content1, content2]);

            const updates = loadHandler(
                actor,
                [content1, content2, actor],
                { contentIds: ['content-1', 'content-2'], containerId: 'actor' },
                context
            );

            expect(updates.length).toBe(3);

            // both contents should be loaded
            const content1Update = updates.find(u => u.id === 'content-1');
            const content2Update = updates.find(u => u.id === 'content-2');
            expect(content1Update!.changes.parentId).toBe('actor');
            expect(content2Update!.changes.parentId).toBe('actor');

            // mass should include both
            const actorUpdate = updates.find(u => u.id === 'actor');
            expect(actorUpdate!.changes.mass).toBe(
                fpAdd(fpAdd(actor.mass, content1.mass), content2.mass)
            );
        });
    });

    describe('Mass Conservation', () => {
        it('should conserve total system mass after load', () => {
            const actor = createContainer({
                id: 'actor',
                reach: toFP(500),
                mass: toFP(2000),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content = createMineralStore({
                id: 'content',
                mass: toFP(500),
                position: { x: toFP(100), y: toFP(0) },
            });

            const state = createGameState({ entities: [actor, content] });
            const context = createTickContext(1, [actor, content]);

            const updates = loadHandler(
                actor,
                [content, actor],
                { contentIds: ['content'], containerId: 'actor' },
                context
            );

            const newState = applyUpdatesToState(state, updates);

            // mass conservation should pass (contained entities not double-counted)
            const massResult = assertMassConservation(state, newState, toFP(0));
            expect(massResult.passed).toBe(true);
        });
    });

    describe('Position Binding', () => {
        it('should bind content position to container position', () => {
            const actor = createContainer({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(100), y: toFP(200) },
            });
            const content = createMineralStore({
                id: 'content',
                position: { x: toFP(0), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, content]);

            const updates = loadHandler(
                actor,
                [content, actor],
                { contentIds: ['content'], containerId: 'actor' },
                context
            );

            const contentUpdate = updates.find(u => u.id === 'content');
            expect(contentUpdate!.changes.position).toEqual(actor.position);
        });
    });

    describe('Invariants', () => {
        it('should produce deterministic results', () => {
            const actor = createContainer({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });
            const content = createMineralStore({
                id: 'content',
                position: { x: toFP(100), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, content]);
            const inputs = { contentIds: ['content'], containerId: 'actor' };

            const updates1 = loadHandler(actor, [content, actor], inputs, context);
            const updates2 = loadHandler(actor, [content, actor], inputs, context);
            const updates3 = loadHandler(actor, [content, actor], inputs, context);

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
            const content = createMineralStore({
                id: 'content',
                position: { x: toFP(1000), y: toFP(0) },
            });
            const container = createContainer({
                id: 'container',
                position: { x: toFP(2000), y: toFP(0) },
            });

            const context = createTickContext(1, [actor, content, container]);

            const updates = loadHandler(
                actor,
                [content, container],
                { contentIds: ['content'], containerId: 'container' },
                context
            );

            expect(updates).toEqual([]);
        });

        it('should handle missing content gracefully', () => {
            const actor = createContainer({
                id: 'actor',
                reach: toFP(500),
                position: { x: toFP(0), y: toFP(0) },
            });

            const isValid = loadValidate(
                actor,
                [actor],
                { contentIds: ['nonexistent'], containerId: 'actor' }
            );

            expect(isValid).toBe(false);
        });
    });
});
