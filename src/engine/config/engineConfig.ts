// ===============================================
// ENGINE CONFIGURATION
// ===============================================
// Centralized constants for all engine tuning parameters.
// All arbitrary multipliers, fuel-burn rates, and physical constraints live here.
//
// INVARIANT: Action handlers must NEVER use magic numbers.
// All tuning values must be imported from this file.

import { toFP, type FP } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Thrust Tuning
// -----------------------------------------------

/**
 * Multiplier for how much fuelMass is consumed per unit of thrust magnitude.
 * Default: 1.0 (1:1 ratio of magnitude to fuel consumed)
 */
export const FUEL_BURN_RATE: FP = toFP(1);

/**
 * Multiplier for how much total entity mass is lost per unit of thrust.
 * Represents propellant mass ejection.
 * Default: 1.0 (1:1 ratio of magnitude to mass lost)
 */
export const MASS_PROPULSION_LOSS: FP = toFP(1);

// -----------------------------------------------
// Safety Clamps
// -----------------------------------------------

/**
 * Minimum fuel threshold below which an engine sputters/fails.
 * Default: 0 (engine works until completely dry)
 */
export const MINIMUM_FUEL_THRESHOLD: FP = toFP(0);

/**
 * Global hard cap on delta-V that can be added in a single tick.
 * Prevents physics explosions from runaway thrust values.
 * Default: 100 units per tick
 */
export const MAX_THRUST_PER_TICK: FP = toFP(100);

// -----------------------------------------------
// Angular Constants (FP)
// -----------------------------------------------

/**
 * Full rotation in FP degrees (360 * 1000)
 */
export const FP_DEGREES_FULL: FP = toFP(360);

/**
 * Pi in fixed-point representation
 */
export const FP_PI: FP = toFP(Math.PI);

/**
 * 2 * Pi in fixed-point representation
 */
export const FP_TWO_PI: FP = toFP(2 * Math.PI);

/**
 * Degrees to radians conversion factor (PI / 180)
 */
export const FP_DEG_TO_RAD: FP = toFP(Math.PI / 180);
