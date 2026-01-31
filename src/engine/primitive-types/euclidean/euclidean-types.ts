// ===============================================
// EUCLIDEAN PRIMITIVES
// ===============================================

export interface Vector2FP {
    x: FP;
    y: FP;
}

// ===============================================
// FIXED-POINT MATH
// ===============================================
// Scaling factor of 1000 for cross-platform determinism

/** Fixed-point number type (scaled by FP_SCALING_FACTOR) */
export type FP = number;

/** Scaling factor for fixed-point arithmetic */
export const FP_SCALING_FACTOR = 1000;

/**
 * Convert a floating-point number to fixed-point
 */
export function toFP(n: number): FP {
    return Math.round(n * FP_SCALING_FACTOR);
}

/**
 * Convert a fixed-point number back to floating-point
 */
export function fromFP(fp: FP): number {
    return fp / FP_SCALING_FACTOR;
}

/**
 * Add two fixed-point numbers
 */
export function fpAdd(a: FP, b: FP): FP {
    return a + b;
}

/**
 * Subtract two fixed-point numbers
 */
export function fpSub(a: FP, b: FP): FP {
    return a - b;
}

/**
 * Multiply two fixed-point numbers
 * Note: Divides by scaling factor to account for double-scaling
 */
export function fpMul(a: FP, b: FP): FP {
    return Math.round((a * b) / FP_SCALING_FACTOR);
}

/**
 * Divide two fixed-point numbers
 * Note: Multiplies by scaling factor before division to maintain precision
 */
export function fpDiv(a: FP, b: FP): FP {
    return Math.round((a * FP_SCALING_FACTOR) / b);
}

// ===============================================
// VECTOR OPERATIONS
// ===============================================

/**
 * Add two FP vectors
 */
export function fpAddVector(a: Vector2FP, b: Vector2FP): Vector2FP {
    return {
        x: fpAdd(a.x, b.x),
        y: fpAdd(a.y, b.y),
    };
}

/**
 * Subtract two FP vectors (a - b)
 */
export function fpSubVector(a: Vector2FP, b: Vector2FP): Vector2FP {
    return {
        x: fpSub(a.x, b.x),
        y: fpSub(a.y, b.y),
    };
}

/**
 * Scale a vector by a fixed-point scalar
 */
export function fpScaleVector(v: Vector2FP, scalar: FP): Vector2FP {
    return {
        x: fpMul(v.x, scalar),
        y: fpMul(v.y, scalar),
    };
}

/**
 * Calculate squared distance between two points (avoids sqrt)
 */
export function fpDistanceSquared(a: Vector2FP, b: Vector2FP): FP {
    const dx = fpSub(a.x, b.x);
    const dy = fpSub(a.y, b.y);
    return fpAdd(fpMul(dx, dx), fpMul(dy, dy));
}

/**
 * Zero vector constant
 */
export const VECTOR_ZERO: Vector2FP = { x: 0, y: 0 };

/**
 * Pythagorean theorem to calculate speed from vector
 */
export const SPEED_FROM_VECTOR = (vector: Vector2FP): FP => {
    return Math.sqrt(fpAdd(fpMul(vector.x, vector.x), fpMul(vector.y, vector.y)));
};

// ===============================================
// TRIGONOMETRY (FP)
// ===============================================
// FP-safe trig functions for heading calculations.
// Heading is stored as FP degrees (0-360000 for 0-360°).

/**
 * Convert FP degrees to radians (floating-point for trig)
 */
export function fpDegreesToRadians(fpDegrees: FP): number {
    return fromFP(fpDegrees) * (Math.PI / 180);
}

/**
 * Compute cosine of an FP angle (in degrees)
 * Returns an FP value
 */
export function fpCos(fpDegrees: FP): FP {
    const radians = fpDegreesToRadians(fpDegrees);
    return toFP(Math.cos(radians));
}

/**
 * Compute sine of an FP angle (in degrees)
 * Returns an FP value
 */
export function fpSin(fpDegrees: FP): FP {
    const radians = fpDegreesToRadians(fpDegrees);
    return toFP(Math.sin(radians));
}

/**
 * Convert heading (FP degrees) and magnitude (FP) to a velocity vector.
 * Heading 0 = +X axis, 90 = +Y axis (standard mathematical convention)
 */
export function fpHeadingToVector(heading: FP, magnitude: FP): Vector2FP {
    const cosH = fpCos(heading);
    const sinH = fpSin(heading);
    return {
        x: fpMul(cosH, magnitude),
        y: fpMul(sinH, magnitude),
    };
}

/**
 * Clamp an FP value between min and max
 */
export function fpClamp(value: FP, min: FP, max: FP): FP {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Return the minimum of two FP values
 */
export function fpMin(a: FP, b: FP): FP {
    return a < b ? a : b;
}

/**
 * Return the maximum of two FP values
 */
export function fpMax(a: FP, b: FP): FP {
    return a > b ? a : b;
}