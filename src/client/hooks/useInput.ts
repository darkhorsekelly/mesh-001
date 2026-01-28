// ===============================================
// useInput - Input orchestrator for selection and focus
// ===============================================
// Single authority for selection state and hypothetical actions
// Subscribes to inputEvents bus for external events (clicks)
// Owns keyboard listener directly (internal state machine)
// Provides pre-calculated view models for UI components
// Manages hypotheticalAction for ghost preview (hover intents)

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { Entity } from '../../engine/primitive-types/semantic/entity/entity-types.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';
import { inputEvents, type InputEvent, type SelectEntityEvent } from '../events/inputEvents.js';

// -----------------------------------------------
// EntityViewModel - Pre-calculated display properties
// -----------------------------------------------

export interface EntityViewModel {
    id: string;
    type: string;
    
    // Pre-calculated state flags
    isSelected: boolean;
    isOwned: boolean;
    isSelectable: boolean;
    
    // Reference to raw entity for inspector
    entity: Entity;
}

// -----------------------------------------------
// Hook return type
// -----------------------------------------------

export interface UseInputReturn {
    selectedEntityId: string | null;
    
    // Pre-calculated view models
    allEntities: EntityViewModel[];
    controlledEntities: EntityViewModel[];
    selectedEntity: Entity | null;
    
    // Hypothetical action for ghost preview (hover intent)
    // Set this when user hovers with a tool (e.g., Thrust Vector)
    hypotheticalAction: Action | null;
    setHypotheticalAction: (action: Action | null) => void;
}

// -----------------------------------------------
// Hook
// -----------------------------------------------

export function useInput(
    gameState: GameState | null,
    localPlayerId: string | null
): UseInputReturn {
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    
    // Hypothetical action for ghost preview (set by hover tools)
    const [hypotheticalAction, setHypotheticalAction] = useState<Action | null>(null);
    
    // Build all entity view models with pre-calculated flags
    const allEntities = useMemo((): EntityViewModel[] => {
        if (!gameState) return [];
        
        return gameState.entities.map((entity) => ({
            id: entity.id,
            type: entity.type,
            isSelected: entity.id === selectedEntityId,
            isOwned: entity.playerId === localPlayerId,
            isSelectable: entity.playerId === localPlayerId,
            entity,
        }));
    }, [gameState, selectedEntityId, localPlayerId]);
    
    // Filter to only controlled entities (owned by local player)
    const controlledEntities = useMemo((): EntityViewModel[] => {
        return allEntities.filter((vm) => vm.isOwned);
    }, [allEntities]);
    
    // Extract selectable IDs for cycling (only owned entities)
    const selectableIds = useMemo((): string[] => {
        return controlledEntities.map((vm) => vm.id);
    }, [controlledEntities]);
    
    // Refs for synchronous access in event handlers
    // Updated synchronously in the same render pass via the ref assignment below
    const selectableIdsRef = useRef<string[]>(selectableIds);
    selectableIdsRef.current = selectableIds;
    
    // Get the currently selected entity
    const selectedEntity = useMemo((): Entity | null => {
        if (!selectedEntityId || !gameState) return null;
        return gameState.entities.find((e) => e.id === selectedEntityId) ?? null;
    }, [gameState, selectedEntityId]);
    
    // Cycle selection - direction: 1 for next, -1 for previous
    // Uses functional setState to get the LATEST selectedEntityId
    const cycleSelection = useCallback((direction: 1 | -1) => {
        const ids = selectableIdsRef.current;
        if (ids.length === 0) return;
        
        setSelectedEntityId((currentId) => {
            // Default index based on direction (first for next, last for prev)
            const defaultIndex = direction === 1 ? 0 : ids.length - 1;
            
            if (currentId === null) {
                return ids[defaultIndex] ?? null;
            }
            
            const currentIndex = ids.indexOf(currentId);
            if (currentIndex === -1) {
                return ids[defaultIndex] ?? null;
            }
            
            const nextIndex = (currentIndex + direction + ids.length) % ids.length;
            return ids[nextIndex] ?? null;
        });
    }, []);
    
    // Subscribe to input events from UI components (clicks)
    useEffect(() => {
        const unsubSelect = inputEvents.on('INPUT_SELECT_ENTITY', (event: InputEvent) => {
            const selectEvent = event as SelectEntityEvent;
            setSelectedEntityId(selectEvent.payload.entityId);
        });
        
        const unsubDeselect = inputEvents.on('INPUT_DESELECT', () => {
            setSelectedEntityId(null);
        });
        
        // Still support event bus for cycle events (e.g., from external controllers)
        const unsubCycleNext = inputEvents.on('INPUT_CYCLE_NEXT', () => cycleSelection(1));
        const unsubCyclePrev = inputEvents.on('INPUT_CYCLE_PREV', () => cycleSelection(-1));
        
        return () => {
            unsubSelect();
            unsubDeselect();
            unsubCycleNext();
            unsubCyclePrev();
        };
    }, [cycleSelection]);
    
    // Global keyboard listener - owned by this orchestrator
    // Handles: Tab, Shift+Tab, ArrowUp, ArrowDown, Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Tab / Shift+Tab - cycle selection
            if (e.key === 'Tab') {
                e.preventDefault();
                cycleSelection(e.shiftKey ? -1 : 1);
                return;
            }
            
            // Arrow keys - cycle selection
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                cycleSelection(1);
                return;
            }
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                cycleSelection(-1);
                return;
            }
            
            // Escape - deselect
            if (e.key === 'Escape') {
                setSelectedEntityId(null);
                return;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cycleSelection]);
    
    return {
        selectedEntityId,
        allEntities,
        controlledEntities,
        selectedEntity,
        hypotheticalAction,
        setHypotheticalAction,
    };
}
