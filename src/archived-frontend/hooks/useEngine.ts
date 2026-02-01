// ===============================================
// useEngine - Socket connection to the game server
// ===============================================
// The client is a terminal: asks for data, sends intents
// Server-authoritative: pending actions come FROM server, not local state
// Ghost projections use server-confirmed actions only

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { PlayerAction } from '../../engine/data/gameStateRepository.js';
import type { Action } from '../../engine/primitive-types/semantic/action/action-types.js';

// -----------------------------------------------
// Composite payload type (matches server)
// -----------------------------------------------

interface WorldStatePayload {
    state: GameState;
    pendingActions: PlayerAction[];
}

// -----------------------------------------------
// Socket event types (mirrors server)
// -----------------------------------------------

interface ServerToClientEvents {
    STATE_UPDATE: (payload: WorldStatePayload) => void;
    TICK_EXECUTED: (payload: WorldStatePayload) => void;
    PENDING_ACTIONS_UPDATE: (pendingActions: PlayerAction[]) => void;
    ERROR: (message: string) => void;
}

interface ClientToServerEvents {
    CMD_EXECUTE_TICK: () => void;
    CMD_QUEUE_ACTION: (action: PlayerAction) => void;
    CMD_REQUEST_STATE: () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// -----------------------------------------------
// Action conversion (PlayerAction -> Engine Action)
// Used for ghost projection calculation
// -----------------------------------------------

export function toEngineAction(playerAction: PlayerAction): Action | null {
    if (playerAction.action_type === 'THRUST') {
        const payload = playerAction.payload as { 
            direction: { x: number; y: number }; 
            magnitude: number;
        };
        return {
            type: 'THRUST',
            entityId: playerAction.entity_id,
            direction: payload.direction,
            magnitude: payload.magnitude,
        };
    }
    return null;
}

// -----------------------------------------------
// Singleton socket connection
// -----------------------------------------------

const SERVER_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL)
    ?? 'http://localhost:3000';

const socket: TypedSocket = io(SERVER_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

// Connection status logging
socket.on('connect', () => {
    console.log('[MESH] Socket connected');
});

socket.on('disconnect', () => {
    console.log('[MESH] Socket disconnected');
});

socket.on('connect_error', (err) => {
    console.error('[MESH] Socket connection error:', err.message);
});

// -----------------------------------------------
// Hook return type
// -----------------------------------------------

export interface UseEngineReturn {
    gameState: GameState | null;
    connected: boolean;
    error: string | null;
    executeTick: () => void;
    queueAction: (action: PlayerAction) => void;
    
    // Server-authoritative pending actions
    // Used for UI display and ghost projection
    pendingActions: PlayerAction[];
    
    // Converted to engine format for projection system
    pendingEngineActions: Action[];
    
    // Syncing state (between action submit and server confirmation)
    isSyncing: boolean;
}

// -----------------------------------------------
// The hook
// -----------------------------------------------

export function useEngine(): UseEngineReturn {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [connected, setConnected] = useState(socket.connected);
    const [error, setError] = useState<string | null>(null);
    
    // Server-authoritative pending actions
    const [pendingActions, setPendingActions] = useState<PlayerAction[]>([]);
    
    // Syncing state - true between submit and server confirmation
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Bind listeners for React state updates
    useEffect(() => {
        const onConnect = () => {
            setConnected(true);
            setError(null);
        };
        
        const onDisconnect = () => {
            setConnected(false);
        };
        
        // Full state update (initial connection or reconnection)
        const onStateUpdate = (payload: WorldStatePayload) => {
            console.log('[MESH] State update received:', payload.state.tick, 
                        `(${payload.pendingActions.length} pending actions)`);
            setGameState(payload.state);
            setPendingActions(payload.pendingActions);
            setIsSyncing(false);
        };
        
        // Tick executed - state advanced, pending actions for new tick
        const onTickExecuted = (payload: WorldStatePayload) => {
            console.log('[MESH] Tick executed:', payload.state.tick,
                        `(${payload.pendingActions.length} pending actions for next tick)`);
            setGameState(payload.state);
            setPendingActions(payload.pendingActions);
            setIsSyncing(false);
        };
        
        // Pending actions updated (after someone queues an action)
        const onPendingActionsUpdate = (actions: PlayerAction[]) => {
            console.log('[MESH] Pending actions updated:', actions.length);
            setPendingActions(actions);
            setIsSyncing(false);
        };
        
        const onError = (message: string) => {
            console.error('[MESH] Server error:', message);
            setError(message);
            setIsSyncing(false);
        };
        
        // Subscribe to events
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('STATE_UPDATE', onStateUpdate);
        socket.on('TICK_EXECUTED', onTickExecuted);
        socket.on('PENDING_ACTIONS_UPDATE', onPendingActionsUpdate);
        socket.on('ERROR', onError);
        
        // Sync initial connection state
        // If socket connected before React mounted, request state explicitly
        // (the server's initial STATE_UPDATE was missed)
        if (socket.connected) {
            setConnected(true);
            console.log('[MESH] Socket already connected, requesting state...');
            socket.emit('CMD_REQUEST_STATE');
        }
        
        // Cleanup: unbind listeners only, do NOT disconnect
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('STATE_UPDATE', onStateUpdate);
            socket.off('TICK_EXECUTED', onTickExecuted);
            socket.off('PENDING_ACTIONS_UPDATE', onPendingActionsUpdate);
            socket.off('ERROR', onError);
        };
    }, []);
    
    // Execute tick command
    const executeTick = useCallback(() => {
        if (socket.connected) {
            console.log('[MESH] Requesting tick execution');
            socket.emit('CMD_EXECUTE_TICK');
        } else {
            console.warn('[MESH] Cannot execute tick: not connected');
        }
    }, []);
    
    // Queue an action for next tick
    // Action is sent to server; ghost appears ONLY after server confirms
    const queueAction = useCallback((action: PlayerAction) => {
        if (socket.connected) {
            console.log('[MESH] Queueing action:', action.action_type);
            setIsSyncing(true);
            socket.emit('CMD_QUEUE_ACTION', action);
        } else {
            console.warn('[MESH] Cannot queue action: not connected');
        }
    }, []);
    
    // Convert pending actions to engine format for projection
    const pendingEngineActions: Action[] = pendingActions
        .map(toEngineAction)
        .filter((a): a is Action => a !== null);
    
    return {
        gameState,
        connected,
        error,
        executeTick,
        queueAction,
        pendingActions,
        pendingEngineActions,
        isSyncing,
    };
}

// -----------------------------------------------
// Direct socket access (for non-React code)
// -----------------------------------------------

export { socket };
