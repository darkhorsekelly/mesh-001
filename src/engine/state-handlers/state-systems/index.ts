// ===============================================
// STATE SYSTEMS - Barrel export
// ===============================================

export { applyAction, applyActionsToEntity } from './actionHandlers.js';
export { applyActions, applyManeuver } from './maneuverSystem.js';
export { applyZoomStateTransition } from './zoomStateSystem.js';
export {
    projectEntity,
    projectCelestials,
    projectGameState,
    getProjectedPosition,
    getProjectedEntity,
    entityHasQueuedActions,
    mergeActionsForProjection,
} from './projectionSystem.js';
