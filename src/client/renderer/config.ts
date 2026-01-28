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
// Viewport
// -----------------------------------------------

export const VIEWPORT = {
    scale: 0.5,
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
