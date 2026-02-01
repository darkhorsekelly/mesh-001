// ===============================================
// Entity - PixiJS stage element for game entities
// ===============================================
// TODO: Simple point rendering for entities, depending on:
// - Zoom level
// - Controller (corporate vs player)

import type { Entity } from '../../../engine/primitive-types/semantic/entity/entity-types.js';

/**
 * A placeholder
 */
export function createEntityRenderData(entity: Entity) {
    return {
        id: entity.id,
        // type: entity.type,
        controller: entity.playerId,
        zoomState: entity.zoomState,
    };
}
