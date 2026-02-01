// ===============================================
// Input Events - Event bus for input orchestration
// ===============================================
// Decouples UI interactions from side effects (audio, camera, etc.)
// Pattern: UI emits events -> Listeners react (audio, state, etc.)

import type { Vector2FP } from '../../engine/primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Event types
// -----------------------------------------------

export type InputEventType = 
    | 'INPUT_SELECT_ENTITY'
    | 'INPUT_DESELECT'
    | 'INPUT_CYCLE_NEXT'
    | 'INPUT_CYCLE_PREV'
    | 'INPUT_EXECUTE_TICK'
    | 'CAMERA_SLEW'
    | 'ZOOM_IN'
    | 'ZOOM_OUT'
    | 'ZOOM_SET';

export interface InputEvent {
    type: InputEventType;
    payload?: unknown;
    timestamp: number;
}

export interface SelectEntityEvent extends InputEvent {
    type: 'INPUT_SELECT_ENTITY';
    payload: { entityId: string };
}

export interface DeselectEvent extends InputEvent {
    type: 'INPUT_DESELECT';
}

export interface CameraSlewEvent extends InputEvent {
    type: 'CAMERA_SLEW';
    payload: { target: Vector2FP; name?: string; zoomLevel?: string };
}

export interface ZoomSetEvent extends InputEvent {
    type: 'ZOOM_SET';
    payload: { zoomIndex: number };
}

// -----------------------------------------------
// Event listener signature
// -----------------------------------------------

type InputEventListener = (event: InputEvent) => void;

// -----------------------------------------------
// Event bus singleton
// -----------------------------------------------

class InputEventBus {
    private listeners: Map<InputEventType, Set<InputEventListener>> = new Map();
    
    /**
     * Subscribe to an event type
     */
    on(eventType: InputEventType, listener: InputEventListener): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(listener);
        
        // Return unsubscribe function
        return () => {
            this.listeners.get(eventType)?.delete(listener);
        };
    }
    
    /**
     * Emit an event to all listeners
     */
    emit(event: InputEvent): void {
        const typeListeners = this.listeners.get(event.type);
        if (typeListeners) {
            typeListeners.forEach(listener => listener(event));
        }
    }
    
    /**
     * Helper to emit a select entity event
     */
    selectEntity(entityId: string): void {
        this.emit({
            type: 'INPUT_SELECT_ENTITY',
            payload: { entityId },
            timestamp: Date.now(),
        });
    }
    
    /**
     * Helper to emit a deselect event
     */
    deselect(): void {
        this.emit({
            type: 'INPUT_DESELECT',
            timestamp: Date.now(),
        });
    }
    
    /**
     * Helper to emit cycle next event
     */
    cycleNext(): void {
        this.emit({
            type: 'INPUT_CYCLE_NEXT',
            timestamp: Date.now(),
        });
    }
    
    /**
     * Helper to emit cycle prev event
     */
    cyclePrev(): void {
        this.emit({
            type: 'INPUT_CYCLE_PREV',
            timestamp: Date.now(),
        });
    }

    /**
     * Helper to emit camera slew event
     */
    cameraSlew(target: Vector2FP, name?: string, zoomLevel?: string): void {
        this.emit({
            type: 'CAMERA_SLEW',
            payload: { target, name, zoomLevel },
            timestamp: Date.now(),
        });
    }

    /**
     * Helper to emit zoom in event
     */
    zoomIn(): void {
        this.emit({
            type: 'ZOOM_IN',
            timestamp: Date.now(),
        });
    }

    /**
     * Helper to emit zoom out event
     */
    zoomOut(): void {
        this.emit({
            type: 'ZOOM_OUT',
            timestamp: Date.now(),
        });
    }

    /**
     * Helper to emit zoom set event
     */
    zoomSet(zoomIndex: number): void {
        this.emit({
            type: 'ZOOM_SET',
            payload: { zoomIndex },
            timestamp: Date.now(),
        });
    }
}

// Singleton instance
export const inputEvents = new InputEventBus();
