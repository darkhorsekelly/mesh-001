import type { GameState } from './engine/types.js';
import { resolveTick } from './engine/resolver.js';

let state: GameState = {
    tick: 0,
    entities: [
        { 
            id: 'pioneer-1', 
            type: 'PLAYER', 
            position: { x: 0, y: 0 }, 
            velocity: { x: 10, y: 5 } 
          }
    ]
}

const player = state.entities[0];

if (player && player.position) {
    console.log(`Tick ${state.tick}: Player at ${player.position.x}, ${player.position.y}`);
} else {
    console.log(`Tick ${state.tick}: Player entity or position is undefined`);
}

// Sim 3 ticks
for (let i = 0; i < 3; i++) {
    state = resolveTick(state);

    const player = state.entities[0];
    const position = player?.position;
    const posx = position?.x;
    const posy = position?.y;
    console.log(`Tick ${state.tick}: Player at ${posx}, ${posy}`);
}