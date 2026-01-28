// ===============================================
// Display utilities - Fixed-point to human-readable
// ===============================================
// All FP-to-display conversions happen here
// UI components should never do math on raw FP values

// -----------------------------------------------
// Fixed-point scale (mirror of engine constant)
// -----------------------------------------------

const FP_SCALE = 1000;

// -----------------------------------------------
// Coordinate formatting
// -----------------------------------------------

/**
 * Convert fixed-point to display number with specified decimal places
 */
export function fpToDisplay(fp: number, decimals: number = 1): string {
    const value = fp / FP_SCALE;
    return value.toFixed(decimals);
}

/**
 * Format a position vector for display
 */
export function formatPosition(x: number, y: number): string {
    return `${fpToDisplay(x)}, ${fpToDisplay(y)}`;
}

/**
 * Format a velocity vector for display (with units)
 */
export function formatVelocity(x: number, y: number): string {
    const vx = fpToDisplay(x, 2);
    const vy = fpToDisplay(y, 2);
    return `${vx}, ${vy} u/t`;
}

/**
 * Calculate and format speed from velocity vector
 */
export function formatSpeed(vx: number, vy: number): string {
    const speed = Math.sqrt((vx * vx + vy * vy)) / FP_SCALE;
    return `${speed.toFixed(2)} u/t`;
}

// -----------------------------------------------
// Angle formatting
// -----------------------------------------------

/**
 * Convert fixed-point heading to degrees
 * FP heading: 0-360000 maps to 0-360 degrees
 */
export function formatHeading(fp: number): string {
    const degrees = fp / FP_SCALE;
    return `${degrees.toFixed(0)}°`;
}

// -----------------------------------------------
// Resource formatting
// -----------------------------------------------

/**
 * Format fuel as percentage or absolute
 * TODO: This should be in the engine, not the client
 */
export function formatFuel(fp: number, maxFp?: number): string {
    const value = fp / FP_SCALE;
    if (maxFp !== undefined) {
        const max = maxFp / FP_SCALE;
        const percent = (value / max) * 100;
        return `${percent.toFixed(0)}%`;
    }
    return value.toFixed(1);
}

// -----------------------------------------------
// Entity type display names
// -----------------------------------------------

// TODO: Entity types are emergent not defined; they're driven by properties and context
const ENTITY_TYPE_NAMES: Record<string, string> = {
    'PLAYER_SHIP': 'Ship',
};

/**
 * Get human-readable entity type name
 */
export function formatEntityType(type: string): string {
    return ENTITY_TYPE_NAMES[type] ?? type;
}

// -----------------------------------------------
// ID formatting
// -----------------------------------------------

/**
 * Truncate UUID for display
 */
export function formatId(id: string, length: number = 8): string {
    return id.slice(0, length);
}
