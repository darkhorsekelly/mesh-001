// ===============================================
// GAME STATE REPOSITORY
// ===============================================
// Relational log architecture for 100% auditability
// Tables: ticks, actions, state_snapshots
// Every tick is a self-contained unit of history

import Database from 'better-sqlite3';
import type { GameState } from '../state-types/state-types.js';

// -----------------------------------------------
// Types for persistence
// -----------------------------------------------

/**
 * Player action with controller context for audit trail
 */
export interface PlayerAction {
    id: string;
    controller_id: string;
    entity_id: string;
    action_type: string;
    payload: unknown;
}

/**
 * Row shape for actions table
 */
interface ActionRow {
    id: string;
    tick_id: number;
    controller_id: string;
    entity_id: string;
    action_type: string;

    // JSON stringified
    payload: string;
}

/**
 * Row shape for state_snapshots table
 */
interface StateSnapshotRow {
    tick_id: number;

    // JSON stringified
    data: string;
}

// -----------------------------------------------
// Repository class
// -----------------------------------------------

export class GameStateRepository {
    private db: Database.Database;
    
    // Prepared statements (cached for performance)
    // Definite assignment: initialized in prepareStatements() called from constructor
    private stmtInsertTick!: Database.Statement;
    private stmtInsertAction!: Database.Statement;
    private stmtInsertSnapshot!: Database.Statement;
    private stmtGetLatestTick!: Database.Statement;
    private stmtLoadSnapshot!: Database.Statement;
    private stmtLoadActions!: Database.Statement;
    
    constructor(dbPath: string = ':memory:') {
        this.db = new Database(dbPath);
        
        // Initialize new database and prepare statements
        this.initializeDatabase();
        this.prepareStatements();
    }
    
    /**
     * Initialize database with WAL mode and create tables
     */
    private initializeDatabase(): void {
        // Enable WAL mode for performance
        this.db.pragma('journal_mode = WAL');
        
        // Create ticks table - the heartbeat
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ticks (
                id INTEGER PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create actions table - the paper trail
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS actions (
                id TEXT PRIMARY KEY,
                tick_id INTEGER NOT NULL,
                controller_id TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                FOREIGN KEY (tick_id) REFERENCES ticks(id)
            )
        `);
        
        // Create state_snapshots table - the frozen truth
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS state_snapshots (
                tick_id INTEGER PRIMARY KEY,
                data TEXT NOT NULL,
                FOREIGN KEY (tick_id) REFERENCES ticks(id)
            )
        `);
        
        // Index for faster action lookups by tick
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_actions_tick_id ON actions(tick_id)
        `);
    }
    
    /**
     * Prepare statements for reuse
     */
    private prepareStatements(): void {
        this.stmtInsertTick = this.db.prepare(`
            INSERT INTO ticks (id) VALUES (?)
        `);
        
        this.stmtInsertAction = this.db.prepare(`
            INSERT INTO actions (id, tick_id, controller_id, entity_id, action_type, payload)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        this.stmtInsertSnapshot = this.db.prepare(`
            INSERT INTO state_snapshots (tick_id, data) VALUES (?, ?)
        `);
        
        this.stmtGetLatestTick = this.db.prepare(`
            SELECT MAX(id) as latest FROM ticks
        `);
        
        this.stmtLoadSnapshot = this.db.prepare(`
            SELECT data FROM state_snapshots WHERE tick_id = ?
        `);
        
        this.stmtLoadActions = this.db.prepare(`
            SELECT id, tick_id, controller_id, entity_id, action_type, payload
            FROM actions WHERE tick_id = ?
        `);
    }
    
    /**
     * Save a tick atomically - state snapshot AND all actions
     * Wrapped in a SQL transaction for consistency
     */
    saveTick(state: GameState, actions: PlayerAction[]): void {
        const transaction = this.db.transaction(() => {
            // Insert tick record
            this.stmtInsertTick.run(state.tick);
            
            // Insert all actions for this tick
            for (const action of actions) {
                this.stmtInsertAction.run(
                    action.id,
                    state.tick,
                    action.controller_id,
                    action.entity_id,
                    action.action_type,
                    JSON.stringify(action.payload)
                );
            }
            
            // Insert state snapshot
            this.stmtInsertSnapshot.run(
                state.tick,
                JSON.stringify(state)
            );
        });
        
        transaction();
    }
    
    /**
     * Get the highest tick ID in the database
     * Returns 0 if no ticks exist
     */
    getLatestTick(): number {
        const row = this.stmtGetLatestTick.get() as { latest: number | null };
        return row.latest ?? 0;
    }
    
    /**
     * Load the state snapshot for a specific tick
     * Returns null if tick doesn't exist
     */
    loadState(tick: number): GameState | null {
        const row = this.stmtLoadSnapshot.get(tick) as StateSnapshotRow | undefined;
        if (!row) return null;
        return JSON.parse(row.data) as GameState;
    }
    
    /**
     * Load all actions for a specific tick
     * Useful for replay/debugging
     */
    loadActions(tick: number): PlayerAction[] {
        const rows = this.stmtLoadActions.all(tick) as ActionRow[];
        return rows.map(row => ({
            id: row.id,
            controller_id: row.controller_id,
            entity_id: row.entity_id,
            action_type: row.action_type,
            payload: JSON.parse(row.payload),
        }));
    }
    
    /**
     * Check if a specific tick exists
     */
    tickExists(tick: number): boolean {
        const row = this.db.prepare('SELECT 1 FROM ticks WHERE id = ?').get(tick);
        return row !== undefined;
    }
    
    /**
     * Close the database connection
     */
    close(): void {
        this.db.close();
    }
}

// -----------------------------------------------
// Singleton factory for default instance
// Ensures there is only one instance of the repository
// -----------------------------------------------

let defaultInstance: GameStateRepository | null = null;

/**
 * Get or create the default repository instance
 */
export function getRepository(dbPath?: string): GameStateRepository {
    if (!defaultInstance) {
        defaultInstance = new GameStateRepository(dbPath);
    }
    return defaultInstance;
}

/**
 * Reset the default instance (for testing)
 */
export function resetRepository(): void {
    if (defaultInstance) {
        defaultInstance.close();
        defaultInstance = null;
    }
}
