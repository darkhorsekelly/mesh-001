// ===============================================
// ACTION RESOLVER TYPES
// ===============================================
// Type definitions for action handlers and validators.
// Separated to avoid circular dependencies.
//
// ARCHITECTURAL RULE: Validation Pattern
// --------------------------------------
// An action can be invalid for two reasons:
//   1. Capability: "This entity doesn't have an engine."
//   2. State: "This entity has an engine, but it has no fuel."
//
// The validate function must check BOTH conditions.
// The handler MUST call validate first. If it returns false,
// the handler returns an empty EntityUpdate[].
//
// This prevents "Illegal Action" desync between client (UI greying)
// and server (execution). Same logic gates both paths.

import type { Entity, EntityUpdate } from '../../primitive-types/semantic/entity/entity-types.js';
import type { GameState } from '../../state-types/state-types.js';

// -----------------------------------------------
// Tick Context
// -----------------------------------------------
// Provides handlers with read-only access to game state

export interface TickContext {
    // current tick number
    readonly tick: number;

    // read-only access to all entities
    readonly entities: readonly Entity[];

    // read-only access to game state for lookups
    readonly state: Readonly<GameState>;
}

// -----------------------------------------------
// Action Handler Signature
// -----------------------------------------------
// Pure function that computes updates based on action inputs

export type ActionHandler = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>,
    context: TickContext
) => EntityUpdate[];

// -----------------------------------------------
// Action Validator Signature
// -----------------------------------------------
// Pure function that checks if an action is valid

export type ActionValidator = (
    actor: Entity,
    targets: Entity[],
    inputs: Record<string, unknown>
) => boolean;

// -----------------------------------------------
// Action Handler Registration
// -----------------------------------------------
// Combines handler and validator into a single registration

export interface ActionRegistration {
    handler: ActionHandler;
    validate: ActionValidator;
}
