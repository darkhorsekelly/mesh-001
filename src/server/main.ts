// ===============================================
// MESH 95 - Server entry point
// ===============================================
// The bridge: Orchestrates client <-> engine <-> database
// Client is a terminal: asks for data, sends intents
// Server is the only entity that touches database and engine

import { createServer } from 'http';
import { Server } from 'socket.io';

// Engine imports
import { resolveTick } from '../engine/state-handlers/tickResolver.js';
import { GameStateRepository, type PlayerAction } from '../engine/data/gameStateRepository.js';
import { generateUniverse } from '../engine/genesis/genesisService.js';
import type { GameState } from '../engine/state-types/state-types.js';
import type { Action } from '../engine/primitive-types/semantic/action/action-types.js';
import { toFP } from '../engine/primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Configuration
// -----------------------------------------------

const PORT = process.env.PORT ?? 3000;
const DB_PATH = process.env.DB_PATH ?? './mesh.db';
const GENESIS_SEED = process.env.GENESIS_SEED ?? 'mesh-genesis-default';

// -----------------------------------------------
// Initial world state (Genesis PCG)
// -----------------------------------------------

/**
 * Create the initial universe using the Genesis service.
 * Generates a deterministic universe from the GENESIS_SEED.
 */
function createInitialState(): GameState {
    console.log(`[Genesis] Generating universe with seed: ${GENESIS_SEED}`);
    
    const state = generateUniverse(GENESIS_SEED, ['player-1', 'player-2'], {
        systemCount: 2,
        planetsPerSystem: [2, 4],
        moonsPerPlanet: [0, 2],
        asteroidsPerSystem: [3, 8],
        systemSpacing: toFP(10000000),
        playerStartingFuel: toFP(500),
        playerStartingMass: toFP(1000),
    });

    console.log(`[Genesis] Created ${state.systems.length} systems, ${state.celestials.length} celestials, ${state.entities.length} entities`);
    
    return state;
}

// -----------------------------------------------
// Server state
// -----------------------------------------------

let currentState: GameState;
const repo = new GameStateRepository(DB_PATH);

// -----------------------------------------------
// Composite payload type (state + pending actions)
// -----------------------------------------------

interface WorldStatePayload {
    state: GameState;
    pendingActions: PlayerAction[];
}

// -----------------------------------------------
// Socket event types
// -----------------------------------------------

// For sending events to the client
interface ServerToClientEvents {
    STATE_UPDATE: (payload: WorldStatePayload) => void;
    TICK_EXECUTED: (payload: WorldStatePayload) => void;
    PENDING_ACTIONS_UPDATE: (pendingActions: PlayerAction[]) => void;
    ERROR: (message: string) => void;
}

// For receiving events from the client
interface ClientToServerEvents {
    CMD_EXECUTE_TICK: () => void;
    CMD_QUEUE_ACTION: (action: PlayerAction) => void;
    CMD_REQUEST_STATE: () => void;
}

// -----------------------------------------------
// Server initialization
// -----------------------------------------------

function initializeState(): GameState {
    const latestTick = repo.getLatestTick();
    
    // Try to load existing state (tick 0 is valid)
    const loadedState = repo.loadState(latestTick);
    if (loadedState) {
        console.log(`[MESH] Loaded state from tick ${latestTick}`);
        return loadedState;
    }
    
    // No existing state - create the 0.0.0 triangle
    console.log('[MESH] No existing state found. Creating The Triangle...');
    const initialState = createInitialState();
    
    // Save initial state as tick 0
    repo.saveTick(initialState, []);
    console.log('[MESH] Initial state saved at tick 0');
    
    return initialState;
}

// -----------------------------------------------
// Action conversion
// -----------------------------------------------

/**
 * Convert PlayerAction to engine Action format
 */
function toEngineAction(playerAction: PlayerAction): Action {
    if (playerAction.action_type === 'THRUST') {
        const payload = playerAction.payload as { direction: { x: number; y: number }; magnitude: number };
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
// Main
// -----------------------------------------------

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Load or create initial state
currentState = initializeState();

// -----------------------------------------------
// Helper: build world state payload
// -----------------------------------------------

function buildWorldStatePayload(): WorldStatePayload {
    const nextTick = currentState.tick + 1;
    const pendingActions = repo.loadPendingActions(nextTick);
    
    return {
        state: currentState,
        pendingActions,
    };
}

// -----------------------------------------------
// Socket connection handling
// -----------------------------------------------

io.on('connection', (socket) => {
    console.log(`[MESH] Client connected: ${socket.id}`);
    
    // Send current state AND pending actions to newly connected client
    // This ensures ghosts appear immediately after browser refresh
    socket.emit('STATE_UPDATE', buildWorldStatePayload());
    
    // Handle explicit state request (for when client missed initial broadcast)
    socket.on('CMD_REQUEST_STATE', () => {
        console.log(`[MESH] State requested by: ${socket.id}`);
        socket.emit('STATE_UPDATE', buildWorldStatePayload());
    });
    
    // Handle action queueing - persist immediately, then broadcast
    socket.on('CMD_QUEUE_ACTION', (action: PlayerAction) => {
        const nextTick = currentState.tick + 1;
        
        console.log(`[MESH] Action queued for tick ${nextTick}: ${action.action_type} from ${action.controller_id}`);
        
        try {
            // Persist to database immediately (server-authoritative)
            repo.savePendingAction(nextTick, action);
            
            // Load fresh pending actions and broadcast to ALL clients
            const pendingActions = repo.loadPendingActions(nextTick);
            io.emit('PENDING_ACTIONS_UPDATE', pendingActions);
            
            console.log(`[MESH] Pending actions broadcast: ${pendingActions.length} total`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[MESH] Failed to queue action: ${message}`);
            socket.emit('ERROR', message);
        }
    });
    
    // Handle tick execution
    socket.on('CMD_EXECUTE_TICK', () => {
        const nextTick = currentState.tick + 1;
        console.log(`[MESH] Executing tick ${nextTick}...`);
        
        try {
            // Load pending actions from database (authoritative source)
            const pendingActions = repo.loadPendingActions(nextTick);
            
            // Convert to engine format
            const engineActions = pendingActions
                .map(toEngineAction)
                .filter((a): a is Action => a !== null);
            
            // Resolve the tick
            const nextState = resolveTick(currentState, engineActions);
            
            // Commit pending actions to historical record and clear pending
            repo.commitPendingActions(nextTick, nextState.tick);
            
            // Save state snapshot
            repo.saveTick(nextState, []);
            
            // Update current state
            currentState = nextState;
            
            console.log(`[MESH] Tick ${nextState.tick} resolved. ${pendingActions.length} actions processed.`);
            
            // Broadcast new state with fresh pending actions (for next tick)
            io.emit('TICK_EXECUTED', buildWorldStatePayload());
            
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[MESH] Tick execution failed: ${message}`);
            socket.emit('ERROR', message);
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`[MESH] Client disconnected: ${socket.id}`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`[MESH] Server running on port ${PORT}`);
    console.log(`[MESH] Database: ${DB_PATH}`);
    console.log(`[MESH] Current tick: ${currentState.tick}`);
    console.log(`[MESH] Entities: ${currentState.entities.length}`);
    console.log(`[MESH] Celestials: ${currentState.celestials.length}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[MESH] Shutting down...');
    repo.close();
    httpServer.close();
    process.exit(0);
});
