// ===============================================
// UNIVERSE SATURATOR
// ===============================================
// stress testing harness that ages a universe by running
// hundreds of ticks with deterministic chaos.
// 
// validates invariants after every tick and stops immediately
// if any invariant fails, preserving the "black box" state
// for debugging.

import type { GameState } from '../state-types/state-types.js';
import type { Action } from '../primitive-types/semantic/action/action-types.js';
import type { FP } from '../primitive-types/euclidean/euclidean-types.js';
import { SeededRNG } from '../genesis/genesisService.js';
import { runTick } from './SimRunner.js';
import { checkAllInvariants, type InvariantCheckResult } from './invariants.js';
import { generateRoundActions, type ChaosRoundResult } from './ChaosAgent.js';
import { toFP } from '../primitive-types/euclidean/euclidean-types.js';

// -----------------------------------------------
// Simulation Result Types
// -----------------------------------------------

export interface SaturationResult {
    // whether the simulation completed without invariant failures
    success: boolean;

    // total ticks simulated
    ticksCompleted: number;

    // total actions processed across all ticks
    totalActionsProcessed: number;

    // actions by type for statistics
    actionsByType: Record<string, number>;

    // final game state
    finalState: GameState;

    // if failed, the tick where failure occurred
    failureTick?: number;

    // if failed, the invariant check result at failure
    failureInvariants?: InvariantCheckResult;

    // if failed, the state just before the failing tick
    preFailureState?: GameState;

    // if failed, the actions that caused the failure
    failureActions?: Action[];

    // timing information
    durationMs: number;

    // summary message
    summary: string;
}

export interface SaturationConfig {
    // number of ticks to simulate
    ticks: number;

    // probability that an entity will act each tick (0-1)
    activityProbability: number;

    // allowed mass loss per tick (for refining waste, etc.)
    // set to a reasonable value based on max expected waste
    allowedMassLossPerTick: FP;

    // whether to log progress during simulation
    verbose: boolean;

    // interval for progress logging (every N ticks)
    logInterval: number;
}

export const DEFAULT_SATURATION_CONFIG: SaturationConfig = {
    ticks: 100,
    activityProbability: 0.3,
    allowedMassLossPerTick: toFP(10000),
    verbose: false,
    logInterval: 50,
};

// -----------------------------------------------
// Universe Saturator
// -----------------------------------------------

/**
 * saturates the universe with random activity for the specified number of ticks.
 * checks all invariants after each tick and stops immediately on failure.
 */
export function saturate(
    initialState: GameState,
    seed: string,
    config: Partial<SaturationConfig> = {}
): SaturationResult {
    const cfg: SaturationConfig = { ...DEFAULT_SATURATION_CONFIG, ...config };
    const startTime = Date.now();

    // create RNG for this saturation run
    // combine the state seed with our saturation seed for unique chaos
    const rng = new SeededRNG(`${initialState.seed}-saturate-${seed}`);

    let currentState = initialState;
    let totalActions = 0;
    const actionsByType: Record<string, number> = {};

    for (let tick = 0; tick < cfg.ticks; tick++) {
        // generate chaos actions for this tick
        const chaosResult = generateRoundActions(
            currentState, 
            rng, 
            cfg.activityProbability
        );

        // track action statistics
        for (const action of chaosResult.actions) {
            if (action) {
                const type = action.type;
                actionsByType[type] = (actionsByType[type] ?? 0) + 1;
            }
        }
        totalActions += chaosResult.actionsGenerated;

        // store pre-tick state for debugging if failure occurs
        const preTickState = currentState;

        // run the tick
        const tickResult = runTick(currentState, chaosResult.actions);

        if (!tickResult.success) {
            return {
                success: false,
                ticksCompleted: tick,
                totalActionsProcessed: totalActions,
                actionsByType,
                finalState: currentState,
                failureTick: tick,
                preFailureState: preTickState,
                failureActions: chaosResult.actions,
                durationMs: Date.now() - startTime,
                summary: `FAILURE at tick ${tick}: Tick resolution failed - ${tickResult.errors.join(', ')}`,
            };
        }

        // check invariants
        const invariants = checkAllInvariants(
            preTickState,
            tickResult.nextState,
            cfg.allowedMassLossPerTick
        );

        if (!invariants.passed) {
            return {
                success: false,
                ticksCompleted: tick,
                totalActionsProcessed: totalActions,
                actionsByType,
                finalState: tickResult.nextState,
                failureTick: tick,
                failureInvariants: invariants,
                preFailureState: preTickState,
                failureActions: chaosResult.actions,
                durationMs: Date.now() - startTime,
                summary: `INVARIANT FAILURE at tick ${tick}: ${invariants.summary}`,
            };
        }

        // update state for next iteration
        currentState = tickResult.nextState;

        // verbose logging
        if (cfg.verbose && (tick + 1) % cfg.logInterval === 0) {
            console.log(
                `  [Saturator] Tick ${tick + 1}/${cfg.ticks} - ` +
                `${chaosResult.actionsGenerated} actions, ` +
                `${currentState.entities.length} entities`
            );
        }
    }

    const durationMs = Date.now() - startTime;

    return {
        success: true,
        ticksCompleted: cfg.ticks,
        totalActionsProcessed: totalActions,
        actionsByType,
        finalState: currentState,
        durationMs,
        summary: buildSuccessSummary(cfg.ticks, totalActions, actionsByType, durationMs),
    };
}

/**
 * builds a human-readable success summary.
 */
function buildSuccessSummary(
    ticks: number,
    totalActions: number,
    actionsByType: Record<string, number>,
    durationMs: number
): string {
    const actionsPerTick = (totalActions / ticks).toFixed(1);
    const ticksPerSecond = (ticks / (durationMs / 1000)).toFixed(1);

    const actionBreakdown = Object.entries(actionsByType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');

    return (
        `Universe aged ${ticks} ticks. ` +
        `${totalActions} actions processed (${actionsPerTick}/tick). ` +
        `Mass conservation: OK. Invariants: OK. ` +
        `Duration: ${durationMs}ms (${ticksPerSecond} ticks/sec). ` +
        `Actions: [${actionBreakdown}]`
    );
}

// -----------------------------------------------
// Quick Saturation Helpers
// -----------------------------------------------

/**
 * runs a quick saturation test with default settings.
 */
export function quickSaturate(
    initialState: GameState,
    ticks: number = 100
): SaturationResult {
    return saturate(initialState, 'quick', { ticks, verbose: false });
}

/**
 * runs a verbose saturation test with progress logging.
 */
export function verboseSaturate(
    initialState: GameState,
    seed: string,
    ticks: number = 100
): SaturationResult {
    return saturate(initialState, seed, { 
        ticks, 
        verbose: true,
        logInterval: Math.max(1, Math.floor(ticks / 10)),
    });
}

// -----------------------------------------------
// Debugging Utilities
// -----------------------------------------------

/**
 * formats a saturation failure for debugging.
 */
export function formatFailure(result: SaturationResult): string {
    if (result.success) {
        return 'No failure - simulation succeeded.';
    }

    const lines: string[] = [
        '=' .repeat(60),
        'SATURATION FAILURE REPORT',
        '=' .repeat(60),
        '',
        `Failure Tick: ${result.failureTick}`,
        `Ticks Completed: ${result.ticksCompleted}`,
        `Total Actions: ${result.totalActionsProcessed}`,
        '',
    ];

    if (result.failureInvariants) {
        lines.push('Invariant Violations:');
        lines.push(`  Summary: ${result.failureInvariants.summary}`);
        lines.push(`  Mass Conservation: ${result.failureInvariants.massConservation.message}`);
        lines.push(`  Tick Advanced: ${result.failureInvariants.tickAdvanced}`);
        
        if (result.failureInvariants.noNegativeMass.violations.length > 0) {
            lines.push('  Negative Mass Violations:');
            for (const v of result.failureInvariants.noNegativeMass.violations) {
                lines.push(`    - ${v}`);
            }
        }
        lines.push('');
    }

    if (result.failureActions && result.failureActions.length > 0) {
        lines.push(`Actions at Failure (${result.failureActions.length}):`);
        for (const action of result.failureActions.slice(0, 10)) {
            if (action) {
                lines.push(`  - ${action.type} by ${action.entityId}`);
            }
        }
        if (result.failureActions.length > 10) {
            lines.push(`  ... and ${result.failureActions.length - 10} more`);
        }
        lines.push('');
    }

    if (result.preFailureState) {
        lines.push('Pre-Failure State:');
        lines.push(`  Tick: ${result.preFailureState.tick}`);
        lines.push(`  Entities: ${result.preFailureState.entities.length}`);
        lines.push(`  Celestials: ${result.preFailureState.celestials.length}`);
    }

    lines.push('');
    lines.push('=' .repeat(60));

    return lines.join('\n');
}

/**
 * extracts the "black box" data from a failed saturation for analysis.
 */
export interface BlackBox {
    tick: number;
    preState: GameState;
    postState: GameState;
    actions: Action[];
    invariants: InvariantCheckResult;
}

export function extractBlackBox(result: SaturationResult): BlackBox | null {
    if (result.success) return null;
    if (!result.preFailureState) return null;
    if (!result.failureActions) return null;
    if (!result.failureInvariants) return null;

    return {
        tick: result.failureTick ?? 0,
        preState: result.preFailureState,
        postState: result.finalState,
        actions: result.failureActions,
        invariants: result.failureInvariants,
    };
}
