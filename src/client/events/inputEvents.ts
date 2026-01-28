// ===============================================
// Input Events - Event bus for input orchestration
// ===============================================
// Decouples UI interactions from side effects (audio, camera, etc.)
// Pattern: UI emits events -> Listeners react (audio, state, etc.)

// -----------------------------------------------
// Event types
// -----------------------------------------------

export type InputEventType = 
    | 'INPUT_SELECT_ENTITY'
    | 'INPUT_DESELECT'
    | 'INPUT_CYCLE_NEXT'
    | 'INPUT_CYCLE_PREV'
    | 'INPUT_EXECUTE_TICK';

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
}

// Singleton instance
export const inputEvents = new InputEventBus();
