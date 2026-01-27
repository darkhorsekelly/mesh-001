// ===============================================
// ENTITY TYPES
// =============================================== 

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';
import type { ZoomLevel } from '../../../state-types/state-types.js';

export type EntityZoomState = ZoomLevel;

interface BaseEntity {
    id: string;
    zoomState: EntityZoomState;
    position: Vector2FP;

    // Velocity is a vector of two fixed-point numbers
    velocity: Vector2FP;

    // If in ORBIT state, the ID of the celestial being orbited
    orbitTargetId?: string;
}

// TODO: Remove. 
// Keep this type for now, but entity types like this will not exist; 
// entities are property- and contextually-driven, not class- or type-driven
export interface PlayerShip extends BaseEntity {
    type: 'PLAYER_SHIP';
    playerId: string;
    
    // Angle in fixed-point (0-360000 for 0-360 degrees)
    heading: FP;          

    // Current thrust level
    thrust: FP;      
    fuel: FP;
}

export type Entity = PlayerShip;