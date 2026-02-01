// ===============================================
// CONTAINMENT SYSTEM TESTS
// ===============================================
// validates the "no ghost trailing" position binding system.
// ensures contained entities move with their containers during tick resolution.

import { describe, it, expect } from 'vitest';
import { 
    createShip, 
    createMineralStore, 
    createContainer,
    createGameState,
    createContextFromState,
} from '../../../test/factories.js';
import { runTick, runTicks, applyUpdatesToState } from '../../../test/SimRunner.js';
import { 
    assertPositionBinding, 
    checkAllInvariants,
} from '../../../test/invariants.js';
import { loadHandler } from '../loadHandler.js';
import { toFP, fpAdd } from '../../../primitive-types/euclidean/euclidean-types.js';

describe('Containment System', () => {
    describe('Position Binding (Anti-Ghost-Trailing)', () => {
        it('should snap contained entity to container position after tick', () => {
            // set up a container with velocity and a contained item
            const container = createContainer({
                id: 'container',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(100), y: toFP(50) },
            });
            const content = createMineralStore({
                id: 'content',
                parentId: 'container',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
            });

            const state = createGameState({ entities: [container, content] });

            // run one tick - container should move, content should stay bound
            const result = runTick(state);
            const nextState = result.nextState;

            // container moved
            const nextContainer = nextState.entities.find(e => e.id === 'container');
            expect(nextContainer?.position.x).toBe(fpAdd(container.position.x, container.velocity.x));
            expect(nextContainer?.position.y).toBe(fpAdd(container.position.y, container.velocity.y));

            // content should have snapped to container's new position
            const nextContent = nextState.entities.find(e => e.id === 'content');
            expect(nextContent?.position.x).toBe(nextContainer?.position.x);
            expect(nextContent?.position.y).toBe(nextContainer?.position.y);

            // position binding invariant should pass
            const bindingResult = assertPositionBinding(nextState);
            expect(bindingResult.passed).toBe(true);
        });

        it('should maintain binding across multiple ticks', () => {
            const container = createContainer({
                id: 'container',
                position: { x: toFP(1000), y: toFP(2000) },
                velocity: { x: toFP(50), y: toFP(-30) },
            });
            const content1 = createMineralStore({
                id: 'content-1',
                parentId: 'container',
                position: { x: toFP(1000), y: toFP(2000) },
            });
            const content2 = createMineralStore({
                id: 'content-2',
                parentId: 'container',
                position: { x: toFP(1000), y: toFP(2000) },
            });

            const state = createGameState({ entities: [container, content1, content2] });

            // run 10 ticks
            const finalState = runTicks(state, [], 10);

            // position binding should pass
            const bindingResult = assertPositionBinding(finalState);
            expect(bindingResult.passed).toBe(true);

            // verify positions match
            const finalContainer = finalState.entities.find(e => e.id === 'container');
            const finalContent1 = finalState.entities.find(e => e.id === 'content-1');
            const finalContent2 = finalState.entities.find(e => e.id === 'content-2');

            expect(finalContent1?.position).toEqual(finalContainer?.position);
            expect(finalContent2?.position).toEqual(finalContainer?.position);

            // verify container moved
            expect(finalContainer?.position.x).toBe(toFP(1000 + 50 * 10));
            expect(finalContainer?.position.y).toBe(toFP(2000 + -30 * 10));
        });

        it('should not move contained entities independently', () => {
            // a contained entity with its own velocity should NOT move independently
            const container = createContainer({
                id: 'container',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(100), y: toFP(0) },
            });
            const contentWithVelocity = createMineralStore({
                id: 'content',
                parentId: 'container',
                position: { x: toFP(0), y: toFP(0) },
                // even if content has velocity, it should be ignored while contained
                velocity: { x: toFP(-500), y: toFP(-500) },
            });

            const state = createGameState({ entities: [container, contentWithVelocity] });
            const result = runTick(state);
            const nextState = result.nextState;

            // content should follow container, not its own velocity
            const nextContainer = nextState.entities.find(e => e.id === 'container');
            const nextContent = nextState.entities.find(e => e.id === 'content');

            expect(nextContent?.position).toEqual(nextContainer?.position);

            // content should NOT have moved by its own velocity
            expect(nextContent?.position.x).not.toBe(toFP(-500));
            expect(nextContent?.position.y).not.toBe(toFP(-500));
        });
    });

    describe('Load -> Move -> Unload Cycle', () => {
        it('should maintain position binding through full logistics cycle', () => {
            // actor loads content, moves, then unloads
            const actor = createContainer({
                id: 'actor',
                position: { x: toFP(0), y: toFP(0) },
                velocity: { x: toFP(0), y: toFP(0) },
                reach: toFP(500),
            });
            const content = createMineralStore({
                id: 'content',
                position: { x: toFP(100), y: toFP(0) },
            });

            let state = createGameState({ entities: [actor, content] });

            // step 1: load content
            const loadContext = createContextFromState(state);
            const loadUpdates = loadHandler(
                actor,
                [content, actor],
                { contentIds: ['content'], containerId: 'actor' },
                loadContext
            );
            state = applyUpdatesToState(state, loadUpdates);

            // verify content is now contained
            const loadedContent = state.entities.find(e => e.id === 'content');
            expect(loadedContent?.parentId).toBe('actor');
            expect(loadedContent?.position).toEqual(actor.position);

            // step 2: give actor velocity and run ticks
            const movingActor = state.entities.find(e => e.id === 'actor');
            state = {
                ...state,
                entities: state.entities.map(e => 
                    e.id === 'actor' 
                        ? { ...e, velocity: { x: toFP(200), y: toFP(100) } }
                        : e
                ),
            };

            // run 5 ticks
            const movedState = runTicks(state, [], 5);

            // verify position binding held throughout
            const bindingResult = assertPositionBinding(movedState);
            expect(bindingResult.passed).toBe(true);

            // verify content moved with container
            const movedActor = movedState.entities.find(e => e.id === 'actor');
            const movedContent = movedState.entities.find(e => e.id === 'content');
            expect(movedContent?.position).toEqual(movedActor?.position);

            // actor should have moved significantly
            expect(movedActor?.position.x).toBeGreaterThan(toFP(500));
        });
    });

    describe('Nested Containment', () => {
        it('should handle orphaned content gracefully', () => {
            // content references non-existent parent
            const orphanedContent = createMineralStore({
                id: 'orphan',
                parentId: 'nonexistent',
                position: { x: toFP(100), y: toFP(100) },
            });

            const state = createGameState({ entities: [orphanedContent] });
            
            // should not crash, orphan keeps its position
            const result = runTick(state);
            const nextState = result.nextState;
            
            const nextOrphan = nextState.entities.find(e => e.id === 'orphan');
            expect(nextOrphan?.position.x).toBe(toFP(100));
            expect(nextOrphan?.position.y).toBe(toFP(100));
        });
    });
});
