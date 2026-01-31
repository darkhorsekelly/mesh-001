// ===============================================
// ACTION REGISTRY
// ===============================================
// Central registry for all action handlers in the engine.
// Each handler is a pure function that computes entity updates.

import type { ActionType } from '../../primitive-types/semantic/action/action-types.js';
import type { ActionHandler, ActionValidator, ActionRegistration } from './actionTypes.js';

// re-export types for consumers
export type { TickContext, ActionHandler, ActionValidator, ActionRegistration } from './actionTypes.js';

// -----------------------------------------------
// Import all action handlers
// -----------------------------------------------

import { transportHandler, transportValidate } from './transportHandler.js';
import { maneuverHandler, maneuverValidate } from './maneuverHandler.js';
import { thrustHandler, thrustValidate } from './thrustHandler.js';
import { launchHandler, launchValidate } from './launchHandler.js';
import { extractHandler, extractValidate } from './extractHandler.js';
import { refineHandler, refineValidate } from './refineHandler.js';
import { manufactureHandler, manufactureValidate } from './manufactureHandler.js';
import { weldHandler, weldValidate } from './weldHandler.js';
import { unweldHandler, unweldValidate } from './unweldHandler.js';
import { modHandler, modValidate } from './modHandler.js';
import { commitHandler, commitValidate } from './commitHandler.js';
import { sealAirlockHandler, sealAirlockValidate } from './sealAirlockHandler.js';
import { unsealAirlockHandler, unsealAirlockValidate } from './unsealAirlockHandler.js';
import { loadHandler, loadValidate } from './loadHandler.js';
import { unloadHandler, unloadValidate } from './unloadHandler.js';
import { vectorLockHandler, vectorLockValidate } from './vectorLockHandler.js';
import { moveScannerHandler, moveScannerValidate } from './moveScannerHandler.js';
import { scanHandler, scanValidate } from './scanHandler.js';
import { transferResourceHandler, transferResourceValidate } from './transferResourceHandler.js';
import { encounterHandler, encounterValidate } from './encounterHandler.js';

// -----------------------------------------------
// Action Registry Map
// -----------------------------------------------
// Maps action types to their handler registrations

export const actionRegistry: Record<ActionType, ActionRegistration> = {
    TRANSPORT: { handler: transportHandler, validate: transportValidate },
    MANEUVER: { handler: maneuverHandler, validate: maneuverValidate },
    THRUST: { handler: thrustHandler, validate: thrustValidate },
    LAUNCH: { handler: launchHandler, validate: launchValidate },
    EXTRACT: { handler: extractHandler, validate: extractValidate },
    REFINE: { handler: refineHandler, validate: refineValidate },
    MANUFACTURE: { handler: manufactureHandler, validate: manufactureValidate },
    WELD: { handler: weldHandler, validate: weldValidate },
    UNWELD: { handler: unweldHandler, validate: unweldValidate },
    MOD: { handler: modHandler, validate: modValidate },
    COMMIT: { handler: commitHandler, validate: commitValidate },
    SEAL_AIRLOCK: { handler: sealAirlockHandler, validate: sealAirlockValidate },
    UNSEAL_AIRLOCK: { handler: unsealAirlockHandler, validate: unsealAirlockValidate },
    LOAD: { handler: loadHandler, validate: loadValidate },
    UNLOAD: { handler: unloadHandler, validate: unloadValidate },
    VECTOR_LOCK: { handler: vectorLockHandler, validate: vectorLockValidate },
    MOVE_SCANNER: { handler: moveScannerHandler, validate: moveScannerValidate },
    SCAN: { handler: scanHandler, validate: scanValidate },
    TRANSFER_RESOURCE: { handler: transferResourceHandler, validate: transferResourceValidate },
    ENCOUNTER: { handler: encounterHandler, validate: encounterValidate },
};

// -----------------------------------------------
// Registry Lookup Utilities
// -----------------------------------------------

/**
 * Get the handler for a specific action type
 */
export function getHandler(actionType: ActionType): ActionHandler {
    return actionRegistry[actionType].handler;
}

/**
 * Get the validator for a specific action type
 */
export function getValidator(actionType: ActionType): ActionValidator {
    return actionRegistry[actionType].validate;
}

/**
 * Check if an action type is registered
 */
export function isRegistered(actionType: ActionType): boolean {
    return actionType in actionRegistry;
}
