// ===============================================
// useEngine - This is the Socket connection to the game server
// ===============================================
// The client is a terminal: asks for data, sends intents
// The network is a long-lived service, not a UI side effect

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '../../engine/state-types/state-types.js';
import type { PlayerAction } from '../../engine/data/gameStateRepository.js';

// -----------------------------------------------
// Socket event types (to mirror the server)
// -----------------------------------------------

interface ServerToClientEvents {
    STATE_UPDATE: (state: GameState) => void;
    TICK_EXECUTED: (state: GameState) => void;
    ERROR: (message: string) => void;
}

interface ClientToServerEvents {
    CMD_EXECUTE_TICK: () => void;
    CMD_QUEUE_ACTION: (action: PlayerAction) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// -----------------------------------------------
// Singleton socket connection
// -----------------------------------------------

const SERVER_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL)
    ?? 'http://localhost:3000';

// Initialized once at module load, stays alive for app lifetime
const socket: TypedSocket = io(SERVER_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

// Connection status logging (runs once at module load)
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
}

// -----------------------------------------------
// The hook
// -----------------------------------------------

export function useEngine(): UseEngineReturn {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [connected, setConnected] = useState(socket.connected);
    const [error, setError] = useState<string | null>(null);
    
    // Bind listeners for React state updates
    useEffect(() => {
        // Connection state handlers
        const onConnect = () => {
            setConnected(true);
            setError(null);
        };
        
        const onDisconnect = () => {
            setConnected(false);
        };
        
        // Game state handlers
        const onStateUpdate = (state: GameState) => {
            console.log('[MESH] State update received:', state.tick);
            setGameState(state);
        };
        
        const onTickExecuted = (state: GameState) => {
            console.log('[MESH] Tick executed:', state.tick);
            setGameState(state);
        };
        
        const onError = (message: string) => {
            console.error('[MESH] Server error:', message);
            setError(message);
        };
        
        // Subscribe to events
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('STATE_UPDATE', onStateUpdate);
        socket.on('TICK_EXECUTED', onTickExecuted);
        socket.on('ERROR', onError);
        
        // Sync initial connection state
        if (socket.connected) {
            setConnected(true);
        }
        
        // Cleanup: unbind listeners only, do NOT disconnect
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('STATE_UPDATE', onStateUpdate);
            socket.off('TICK_EXECUTED', onTickExecuted);
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
    const queueAction = useCallback((action: PlayerAction) => {
        if (socket.connected) {
            console.log('[MESH] Queueing action:', action.action_type);
            socket.emit('CMD_QUEUE_ACTION', action);
        } else {
            console.warn('[MESH] Cannot queue action: not connected');
        }
    }, []);
    
    return {
        gameState,
        connected,
        error,
        executeTick,
        queueAction,
    };
}

// -----------------------------------------------
// Direct socket access (for non-React code)
// -----------------------------------------------

export { socket };
