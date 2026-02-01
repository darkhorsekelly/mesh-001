// ===============================================
// FP Conversion Utilities
// ===============================================
// fixed-point to screen coordinate conversion.
// the UI speaks in screen pixels, the engine speaks in FP.

// -----------------------------------------------
// Constants
// -----------------------------------------------

export const FP_SCALE = 1000;

// -----------------------------------------------
// Zoom Levels
// -----------------------------------------------
// discrete magnification levels like a telescope.

export type ZoomLevelId = 'GALAXY' | 'SYSTEM' | 'PLANETARY' | 'LOCAL' | 'CLOSE';

export interface ZoomLevel {
    id: ZoomLevelId;
    scale: number;
    label: string;
}

export const ZOOM_LEVELS: ZoomLevel[] = [
    { id: 'GALAXY',    scale: 0.00001,  label: 'Galaxy' },
    { id: 'SYSTEM',    scale: 0.0001,   label: 'System' },
    { id: 'PLANETARY', scale: 0.001,    label: 'Planetary' },
    { id: 'LOCAL',     scale: 0.01,     label: 'Local' },
    { id: 'CLOSE',     scale: 0.1,      label: 'Close' },
];

export const DEFAULT_ZOOM_INDEX = 1;

// -----------------------------------------------
// Conversion Functions
// -----------------------------------------------

/**
 * convert fixed-point to screen units (divide by scale)
 */
export function fpToScreen(fp: number): number {
    return fp / FP_SCALE;
}

/**
 * convert screen units back to fixed-point
 */
export function screenToFP(screen: number): number {
    return Math.round(screen * FP_SCALE);
}

/**
 * format FP value for display with specified decimal places
 */
export function fpToDisplay(fp: number, decimals: number = 1): string {
    const value = fp / FP_SCALE;
    return value.toFixed(decimals);
}

/**
 * format position vector for display
 */
export function formatPosition(x: number, y: number): string {
    return `${fpToDisplay(x)}, ${fpToDisplay(y)}`;
}

/**
 * get zoom level by index (clamped to valid range)
 */
export function getZoomByIndex(index: number): ZoomLevel {
    const clamped = Math.max(0, Math.min(index, ZOOM_LEVELS.length - 1));
    return ZOOM_LEVELS[clamped]!;
}
