// ===============================================
// TYPES
// ===============================================

export interface Vector2 {
    x: number;
    y: number;
}

export interface Entity {
    id: string;
    position: Vector2;
    velocity: Vector2;
    type: 'PLANET' | 'PLAYER';
}

export interface GameState {
    tick: number;
    entities: Entity[]
}

