// ===============================================
// useProjection - Deterministic ghost projection
// ===============================================
// Provides "zero-latency" predictive ghost positioning
// System Invariants:
// 1. Celestial Synchronization: advance celestials to T+1 before entity
// 2. Targeted Execution: only project selectedEntity (not full state)
// 3. Separate ghosts: authoritative (solid) vs hypothetical (dashed)

import { useMemo } from 'react';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';
import type { Entity } from '../../engine/primitive-types/semantic/entity/entity-types.js';
import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';
import type { CelestialBody } from '../../engine/primitive-types/semantic/celestial/celestial-types.js';
import {
    projectEntity,
    projectCelestials,
    mergeActionsForProjection,
} from '../../engine/state-handlers/state-systems/projectionSystem.js';

// -----------------------------------------------
// Types
// -----------------------------------------------

export interface ProjectionResult {
    // Authoritative ghost: current velocity + server pending actions
    // Visual: solid point/icon
    authoritativePosition: Vector2FP | null;
    authoritativeEntity: Entity | null;
    
    // Hypothetical ghost: server actions + hover intent
    // Visual: dashed point/icon (only when hovering)
    hypotheticalPosition: Vector2FP | null;
    hypotheticalEntity: Entity | null;
    
    // Whether the authoritative projection has server-pending actions
    hasServerActions: boolean;
    
    // Whether there's a hypothetical (hover) action being previewed
    isHovering: boolean;
    
    // T+1 celestials (for consistent rendering if needed)
    celestialsT1: CelestialBody[];
}

export interface UseProjectionProps {
    // Current game state from server
    gameState: GameState | null;
    
    // Currently selected entity ID
    selectedEntityId: string | null;
    
    // Server-confirmed pending actions for next tick
    serverPendingActions: Action[];
    
    // Client-side hypothetical action (hover intent)
    hypotheticalAction: Action | null;
}

// -----------------------------------------------
// Hook
// -----------------------------------------------

export function useProjection({
    gameState,
    selectedEntityId,
    serverPendingActions,
    hypotheticalAction,
}: UseProjectionProps): ProjectionResult {
    
    // Find the selected entity from game state
    const selectedEntity = useMemo((): Entity | null => {
        if (!gameState || !selectedEntityId) return null;
        return gameState.entities.find(e => e.id === selectedEntityId) ?? null;
    }, [gameState, selectedEntityId]);
    
    // INVARIANT 1: Project celestials to T+1 FIRST
    // This ensures capture/collision checks are deterministic
    const celestialsT1 = useMemo((): CelestialBody[] => {
        if (!gameState) return [];
        return projectCelestials(gameState.celestials);
    }, [gameState]);
    
    // Authoritative projection: velocity + server-pending actions
    // This is what WILL happen if the player does nothing more
    const authoritativeEntity = useMemo((): Entity | null => {
        if (!selectedEntity) return null;
        
        // Project with server actions only (authoritative)
        // Pass T+1 celestials for deterministic environment checks
        return projectEntity(selectedEntity, serverPendingActions, celestialsT1);
    }, [selectedEntity, serverPendingActions, celestialsT1]);
    
    // Hypothetical projection: authoritative + hover intent
    // Only calculated when hovering with a tool
    const hypotheticalEntity = useMemo((): Entity | null => {
        if (!selectedEntity || !hypotheticalAction) return null;
        
        // Merge server actions with hypothetical
        const combinedActions = mergeActionsForProjection(serverPendingActions, hypotheticalAction);
        
        // Project with combined actions
        return projectEntity(selectedEntity, combinedActions, celestialsT1);
    }, [selectedEntity, serverPendingActions, hypotheticalAction, celestialsT1]);
    
    // Extract positions for convenience
    const authoritativePosition = authoritativeEntity?.position ?? null;
    const hypotheticalPosition = hypotheticalEntity?.position ?? null;
    
    // Check if server has actions for this entity
    const hasServerActions = useMemo((): boolean => {
        if (!selectedEntity) return false;
        return serverPendingActions.some(a => a?.entityId === selectedEntity.id);
    }, [selectedEntity, serverPendingActions]);
    
    return {
        authoritativePosition,
        authoritativeEntity,
        hypotheticalPosition,
        hypotheticalEntity,
        hasServerActions,
        isHovering: hypotheticalAction !== null,
        celestialsT1,
    };
}
