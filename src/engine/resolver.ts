import type { GameState, Entity } from './types.js';

/**
 * Core resolver: (State) -> NewState
 * Pure function
 */

export function resolveTick(currentState: GameState): GameState {
    const nextEntities = currentState.entities.map((entity: Entity)=> (
        {
            ...entity,
            position: {
                x: entity.position.x + entity.velocity.x,
                y: entity.position.y + entity.velocity.y,
            }
        }));
    return {
        tick: currentState.tick + 1,
        entities: nextEntities
    };
}