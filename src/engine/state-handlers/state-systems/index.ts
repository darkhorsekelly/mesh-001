// ===============================================
// STATE SYSTEMS - Barrel export
// ===============================================

export { applyAction, applyActionsToEntity } from './actionHandlers.js';
export { applyActions, applyManeuver, applyBinding, applyTranslation } from './maneuverSystem.js';
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
export {
    getConflictClusters,
    resolveCluster,
    resolveClusterWave,
    wouldCauseStalemate,
    classifyConflict,
    analyzeContestationRisk,
    findContestedEntities,
    type ClusterResolutionResult,
    type ClusterWaveResult,
    type WaveResolutionMetrics,
    type ConflictType,
    type ContestationRisk,
    type ContestationAnalysis,
} from './conflictClusterResolver.js';
