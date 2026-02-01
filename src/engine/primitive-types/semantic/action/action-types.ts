// ===============================================
// ACTION TYPES
// ===============================================

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';

// -----------------------------------------------
// Action Type Union
// -----------------------------------------------
// Strict union of all valid action types for 0.0.1

export type ActionType =
    | 'TRANSPORT'
    | 'MANEUVER'
    | 'THRUST'
    | 'LAUNCH'
    | 'EXTRACT'
    | 'REFINE'
    | 'MANUFACTURE'
    | 'WELD'
    | 'UNWELD'
    | 'MOD'
    | 'COMMIT'
    | 'SEAL_AIRLOCK'
    | 'UNSEAL_AIRLOCK'
    | 'LOAD'
    | 'UNLOAD'
    | 'VECTOR_LOCK'
    | 'MOVE_SCANNER'
    | 'SCAN'
    | 'TRANSFER_RESOURCE'
    | 'ENCOUNTER';

// -----------------------------------------------
// Base Action Interface
// -----------------------------------------------
// All actions share these core properties.
// 
// WAVE-BASED INTERLEAVING:
// Actions are processed in "waves" based on orderIndex.
// Wave 0 = all actions with orderIndex 0
// Wave 1 = all actions with orderIndex 1
// ...and so on.
// 
// Between each wave, physics "settles" (maneuver, binding, mass).
// This ensures Wave 2 sees the physical reality created by Wave 1.

interface BaseAction {
    type: ActionType;

    // the entity performing this action
    entityId: string;

    // optional target entities for the action
    targetIds?: string[];

    // the player who queued this action (for multi-player interleaving)
    // if undefined, derived from entity.playerId
    playerId?: string;

    // position in the player's action queue (0 = first action this tick)
    // actions are processed in waves: all orderIndex=0, then all orderIndex=1, etc.
    // if undefined, defaults to 0
    orderIndex?: number;
}

// -----------------------------------------------
// Movement Actions
// -----------------------------------------------

export interface TransportAction extends BaseAction {
    type: 'TRANSPORT';

    // entit(ies) to transport (think: pulley, tow truck, etc.)
    targetIds: string[];
}

export interface ManeuverAction extends BaseAction {
    type: 'MANEUVER';

    // target velocity vector
    targetVelocity: Vector2FP;
}

export interface ThrustAction extends BaseAction {
    type: 'THRUST';

    // normalized direction vector in FP
    direction: Vector2FP;  

    // thrust magnitude
    magnitude: FP;         
}

export interface LaunchAction extends BaseAction {
    type: 'LAUNCH';

    // launch vector
    launchVector: Vector2FP;
}

// -----------------------------------------------
// Resource Actions
// -----------------------------------------------

export interface ExtractAction extends BaseAction {
    type: 'EXTRACT';

    // resource type to extract
    resourceType: 'VOLATILES' | 'MINERALS';

    // entity to extract from
    // TODO: only resource well entities
    originIds: string[];

    // target entities to extract to; optional - entityId will be the target
    targetIds?: string[];

    // target positions to extract to; required for minerals extraction
    mineralTargetPosition?: Vector2FP[];

    // extraction rate in FP
    rate: FP;
}

export interface RefineAction extends BaseAction {
    type: 'REFINE';

    // input resource type
    inputType: 'VOLATILES';

    // entit(ies) to refine from (must have volatilesMass)
    volatilesTargetIds: string[];

    // entit(ies) to refine to (must have fuelStore)
    fuelTargetIds: string[];

    // amount of input volatiles to process
    volatilesAmount: FP;
}

export interface ManufactureAction extends BaseAction {
    type: 'MANUFACTURE';

    // blueprint identifier for what to build
    // TODO: rng blueprintId for variety based on rarity
    blueprintId: string;
}

// -----------------------------------------------
// Structural Actions
// -----------------------------------------------

export interface WeldAction extends BaseAction {
    type: 'WELD';

    // target entit(ies) to weld together
    targetIds: string[];
}

export interface UnweldAction extends BaseAction {
    type: 'UNWELD';

    // target prior-welded entity to detach from the weldHistory of this entity
    targetIds: string[];
}

export interface ModAction extends BaseAction {
    type: 'MOD';

    // mineral stores
    mineralTargetIds: string[];

    // entity to mod
    targetIds: string[];

    // modification parameters
    params: Record<string, FP>;
}

export interface CommitAction extends BaseAction {
    type: 'COMMIT';

    // finalize pending structural changes
    commitType: 'HOLD' | 'PRESS' | 'SUPPORT';

    // target body, entity or zone
    targetIds: string[];

    // commitment level
    commitmentLevel: 'DOUBLE_DOWN' | 'STOP';

}

// -----------------------------------------------
// Airlock Actions
// -----------------------------------------------

export interface SealAirlockAction extends BaseAction {
    type: 'SEAL_AIRLOCK';
}

export interface UnsealAirlockAction extends BaseAction {
    type: 'UNSEAL_AIRLOCK';
}

// -----------------------------------------------
// Cargo Actions
// -----------------------------------------------

export interface LoadAction extends BaseAction {
    type: 'LOAD';

    // entit(ies) to load into the containers
    contentIds: string[];

    // entity to load to
    containerIds: string[];
}

export interface UnloadAction extends BaseAction {
    type: 'UNLOAD';

    // entity to unload
    contentIds: string[];

    // new position per content entities
    newPositions: Vector2FP[];
}

export interface TransferResourceAction extends BaseAction {
    type: 'TRANSFER_RESOURCE';

    // resource type to load
    resourceType: 'VOLATILES' | 'FUEL';

    // entity to load from
    originIds: string[];

    // entity to load to
    targetIds: string[];

    // amount of resource to transfer
    amount: FP;
}

// -----------------------------------------------
// Navigation Actions
// -----------------------------------------------

export interface VectorLockAction extends BaseAction {
    // an automated action that either tails or pursues a target entity
    type: 'VECTOR_LOCK';

    // target to vector lock onto
    targetIds: string[];

    // lock type: pursuit, intercept, or match
    // PURSUIT: get as close to the entity as possible and get closer and closer to matching its vector
    // TAIL: match the target's vector exactly if able
    lockMode: 'PURSUIT' | 'TAIL';
}

// -----------------------------------------------
// Sensor Actions
// -----------------------------------------------

export interface MoveScannerAction extends BaseAction {
    type: 'MOVE_SCANNER';

    // new position for the scanner
    newPosition: Vector2FP;
}

export interface ScanAction extends BaseAction {
    type: 'SCAN';
}

// -----------------------------------------------
// Encounter Actions
// -----------------------------------------------

export interface EncounterAction extends BaseAction {
    type: 'ENCOUNTER';

    // target entity to encounter
    targetIds: string[];
}

// -----------------------------------------------
// Action Union Type
// -----------------------------------------------
// Discriminated union of all action interfaces

export type Action =
    | TransportAction
    | ManeuverAction
    | ThrustAction
    | LaunchAction
    | ExtractAction
    | RefineAction
    | ManufactureAction
    | WeldAction
    | UnweldAction
    | ModAction
    | CommitAction
    | SealAirlockAction
    | UnsealAirlockAction
    | LoadAction
    | UnloadAction
    | VectorLockAction
    | MoveScannerAction
    | ScanAction
    | TransferResourceAction
    | EncounterAction;