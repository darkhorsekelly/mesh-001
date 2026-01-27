// ===============================================
// ACTION TYPES
// ===============================================

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';

export interface ThrustAction {
    type: 'THRUST';
    entityId: string;

    // Normalized direction vector in FP
    direction: Vector2FP;  

    // Thrust magnitude
    magnitude: FP;         
}

export type Action = ThrustAction | null;