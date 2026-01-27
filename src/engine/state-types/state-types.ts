// ===============================================
// STATE TYPES
// ===============================================

// -----------------------------------------------
// Import primitive-types (Discriminated union)
// -----------------------------------------------

// Import AI

// Import Euclidean types
import type { FP, Vector2FP } from '../primitive-types/euclidean/euclidean-types.js';

// Import Semantic types
import type { Action } from '../primitive-types/semantic/action/action-types.js';
import type { CelestialBody } from '../primitive-types/semantic/celestial/celestial-types.js';
import type { Entity } from '../primitive-types/semantic/entity/entity-types.js';

// -----------------------------------------------
// Core game state types
// -----------------------------------------------

export type ZoomLevel = 'SPACE' | 'ORBIT' | 'SURFACE';

// -----------------------------------------------
// Game State
// -----------------------------------------------

export interface GameState {
    tick: number;
    entities: Entity[];
    celestials: CelestialBody[];
}
