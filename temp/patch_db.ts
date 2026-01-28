// ===============================================
// Database Patch Script
// ===============================================
// Modify ship properties at specific ticks
// Usage: npx tsx temp/patch_db.ts

import Database from 'better-sqlite3';

// -----------------------------------------------
// CONFIGURATION - Edit these values
// -----------------------------------------------

// Target tick to modify
const TARGET_TICK = 150;

// Which ships to modify (by playerId, or 'all' for all ships)
const TARGET_PLAYER_ID: string | 'all' = 'all';

// Properties to patch (only include what you want to change)
// All values should be in Fixed-Point format (multiply by 1000)
const PATCH: Partial<{
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    heading: number;
    thrust: number;
    fuel: number;
    zoomState: 'SPACE' | 'ORBIT' | 'SURFACE';
}> = {
    // Examples (uncomment what you need):
    // position: { x: 200000, y: 100000 },   // world pos (200, 100)
    velocity: { x: 50000, y: 50000 },          // 5 units/tick in x and y
    // heading: 90000,                        // 90 degrees
    // thrust: 0,
    // fuel: 100000,                          // 100 fuel
    // zoomState: 'SPACE',
};

// -----------------------------------------------
// Script execution
// -----------------------------------------------

const db = new Database('mesh.db');

// Fetch the existing state
const row = db.prepare('SELECT data FROM state_snapshots WHERE tick_id = ?').get(TARGET_TICK) as { data: string } | undefined;

if (!row) {
    console.error(`[PATCH] Tick ${TARGET_TICK} not found in database.`);
    db.close();
    process.exit(1);
}

const state = JSON.parse(row.data);

// Count modifications
let modifiedCount = 0;

// Modify matching ships
state.entities = state.entities.map((entity: any) => {
    if (entity.type !== 'PLAYER_SHIP') {
        return entity;
    }
    
    // Check if this ship matches the target
    if (TARGET_PLAYER_ID !== 'all' && entity.playerId !== TARGET_PLAYER_ID) {
        return entity;
    }
    
    // Apply the patch
    const patched = { ...entity, ...PATCH };
    modifiedCount++;
    
    console.log(`[PATCH] Modified ${entity.playerId} (${entity.id.slice(0, 8)}...)`);
    
    // Log what changed
    for (const [key, value] of Object.entries(PATCH)) {
        console.log(`        ${key}: ${JSON.stringify(value)}`);
    }
    
    return patched;
});

if (modifiedCount === 0) {
    console.warn(`[PATCH] No ships matched criteria. No changes made.`);
    db.close();
    process.exit(0);
}

// Write it back inside a transaction
const update = db.prepare('UPDATE state_snapshots SET data = ? WHERE tick_id = ?');

const performUpdate = db.transaction((data: string, tickId: number) => {
    update.run(data, tickId);
});

performUpdate(JSON.stringify(state), TARGET_TICK);

console.log(`\n[PATCH] Success: ${modifiedCount} ship(s) updated at tick ${TARGET_TICK}.`);
db.close();
