// ===============================================
// Renderer configuration
// ===============================================
// Central place for all graphics/visual constants

// -----------------------------------------------
// Fixed-point conversion
// -----------------------------------------------

// Mirror of engine constant - UI should not import from engine
export const FP_SCALE = 1000;

export function fpToScreen(fp: number): number {
    return fp / FP_SCALE;
}

// Inverse conversion: screen coordinates back to fixed-point
export function screenToFP(screen: number): number {
    return Math.round(screen * FP_SCALE);
}

// Click radius for entity selection (in screen pixels)
export const CLICK_RADIUS = 20;

// -----------------------------------------------
// Zoom Levels
// -----------------------------------------------
// Discrete magnification levels like a telescope.
// Each level has a semantic name and scale factor.

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

// Default zoom level index
export const DEFAULT_ZOOM_INDEX = 1; // SYSTEM

// Map celestial types to recommended zoom levels
export const CELESTIAL_ZOOM_MAP: Record<string, ZoomLevelId> = {
    'SOL': 'SYSTEM',
    'PLANET': 'PLANETARY',
    'MOON': 'LOCAL',
    'ASTEROID': 'LOCAL',
    'WORMHOLE': 'SYSTEM',
};

// Get zoom level by ID
export function getZoomLevel(id: ZoomLevelId): ZoomLevel {
    return ZOOM_LEVELS.find(z => z.id === id) ?? ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]!;
}

// Get zoom level by index (clamped to valid range)
export function getZoomByIndex(index: number): ZoomLevel {
    const clamped = Math.max(0, Math.min(index, ZOOM_LEVELS.length - 1));
    return ZOOM_LEVELS[clamped]!;
}

// Get zoom level index by ID
export function getZoomIndex(id: ZoomLevelId): number {
    const index = ZOOM_LEVELS.findIndex(z => z.id === id);
    return index >= 0 ? index : DEFAULT_ZOOM_INDEX;
}

// -----------------------------------------------
// Viewport
// -----------------------------------------------

export const VIEWPORT = {
    background: '#000000',
};

// -----------------------------------------------
// Colors (black and white only for v0.0.0)
// -----------------------------------------------

export const COLORS = {
    background: 0x000000,
    foreground: 0xffffff,
    dim: 0x808080,
};

// -----------------------------------------------
// Sizes
// -----------------------------------------------

export const SIZES = {
    point: 2,
    minRadius: 4,
};
