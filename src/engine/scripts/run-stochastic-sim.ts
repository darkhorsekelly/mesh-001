#!/usr/bin/env node
// ===============================================
// STOCHASTIC SIMULATION CLI
// ===============================================
// command-line interface for running universe saturation tests.
// usage: npx tsx src/engine/scripts/run-stochastic-sim.ts --seed <seed> --ticks <n>
//
// examples:
//   npx tsx src/engine/scripts/run-stochastic-sim.ts --seed test123 --ticks 500
//   npx tsx src/engine/scripts/run-stochastic-sim.ts --seed chaos --ticks 1000 --verbose
//   npx tsx src/engine/scripts/run-stochastic-sim.ts --seed alpha --ticks 100 --players 4

import { generateUniverse } from '../genesis/genesisService.js';
import { saturate, formatFailure } from '../test/UniverseSaturator.js';
import { toFP, fromFP } from '../primitive-types/euclidean/euclidean-types.js';
import { getTotalEntityMass } from '../test/invariants.js';

// -----------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------

interface CliArgs {
    seed: string;
    ticks: number;
    players: number;
    systems: number;
    verbose: boolean;
    activity: number;
}

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    
    const defaults: CliArgs = {
        seed: `stochastic-${Date.now()}`,
        ticks: 100,
        players: 2,
        systems: 2,
        verbose: false,
        activity: 0.3,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const next = args[i + 1];

        switch (arg) {
            case '--seed':
            case '-s':
                if (next) defaults.seed = next;
                i++;
                break;

            case '--ticks':
            case '-t':
                if (next) defaults.ticks = parseInt(next, 10) || defaults.ticks;
                i++;
                break;

            case '--players':
            case '-p':
                if (next) defaults.players = parseInt(next, 10) || defaults.players;
                i++;
                break;

            case '--systems':
                if (next) defaults.systems = parseInt(next, 10) || defaults.systems;
                i++;
                break;

            case '--verbose':
            case '-v':
                defaults.verbose = true;
                break;

            case '--activity':
            case '-a':
                if (next) defaults.activity = parseFloat(next) || defaults.activity;
                i++;
                break;

            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    return defaults;
}

function printHelp(): void {
    console.log(`
MESH 95 Stochastic Simulation Runner
=====================================

Usage: npx tsx src/engine/scripts/run-stochastic-sim.ts [options]

Options:
  --seed, -s <string>     Seed for deterministic generation (default: timestamp)
  --ticks, -t <number>    Number of ticks to simulate (default: 100)
  --players, -p <number>  Number of player entities (default: 2)
  --systems <number>      Number of star systems (default: 2)
  --activity, -a <float>  Entity activity probability 0-1 (default: 0.3)
  --verbose, -v           Enable verbose progress logging
  --help, -h              Show this help message

Examples:
  npx tsx src/engine/scripts/run-stochastic-sim.ts --seed test123 --ticks 500
  npx tsx src/engine/scripts/run-stochastic-sim.ts --seed chaos --ticks 1000 -v
  npx tsx src/engine/scripts/run-stochastic-sim.ts -s alpha -t 100 -p 4 --systems 3

The simulation runs deterministically - same seed always produces same results.
`);
}

// -----------------------------------------------
// Main Entry Point
// -----------------------------------------------

function main(): void {
    const args = parseArgs();

    console.log('');
    console.log('='.repeat(60));
    console.log('MESH 95 STOCHASTIC SIMULATION');
    console.log('='.repeat(60));
    console.log('');

    // display configuration
    console.log('Configuration:');
    console.log(`  Seed: ${args.seed}`);
    console.log(`  Ticks: ${args.ticks}`);
    console.log(`  Players: ${args.players}`);
    console.log(`  Systems: ${args.systems}`);
    console.log(`  Activity: ${(args.activity * 100).toFixed(0)}%`);
    console.log(`  Verbose: ${args.verbose}`);
    console.log('');

    // generate universe
    console.log('Generating universe...');
    const playerIds = Array.from(
        { length: args.players }, 
        (_, i) => `player-${i + 1}`
    );

    const initialState = generateUniverse(args.seed, playerIds, {
        systemCount: args.systems,
    });

    console.log(`  Systems: ${initialState.systems.length}`);
    console.log(`  Celestials: ${initialState.celestials.length}`);
    console.log(`  Entities: ${initialState.entities.length}`);

    // calculate initial total mass
    const initialMass = initialState.entities.reduce(
        (sum, e) => sum + getTotalEntityMass(e),
        0
    );
    console.log(`  Initial Mass: ${fromFP(initialMass).toLocaleString()}`);
    console.log('');

    // run saturation
    console.log('Running saturation...');
    if (args.verbose) console.log('');

    const result = saturate(initialState, args.seed, {
        ticks: args.ticks,
        activityProbability: args.activity,
        verbose: args.verbose,
        logInterval: Math.max(1, Math.floor(args.ticks / 20)),
        allowedMassLossPerTick: toFP(50000),
    });

    console.log('');

    // display results
    if (result.success) {
        console.log('='.repeat(60));
        console.log('SIMULATION COMPLETE - SUCCESS');
        console.log('='.repeat(60));
        console.log('');
        console.log(result.summary);
        console.log('');

        // final state statistics
        const finalMass = result.finalState.entities.reduce(
            (sum, e) => sum + getTotalEntityMass(e),
            0
        );
        const massChange = finalMass - initialMass;
        const massChangePercent = ((massChange / initialMass) * 100).toFixed(2);

        console.log('Final State:');
        console.log(`  Tick: ${result.finalState.tick}`);
        console.log(`  Entities: ${result.finalState.entities.length}`);
        console.log(`  Final Mass: ${fromFP(finalMass).toLocaleString()}`);
        console.log(`  Mass Change: ${fromFP(massChange).toLocaleString()} (${massChangePercent}%)`);
        console.log('');

        // action breakdown
        console.log('Action Statistics:');
        for (const [type, count] of Object.entries(result.actionsByType)) {
            const avg = (count / args.ticks).toFixed(2);
            console.log(`  ${type}: ${count} (${avg}/tick)`);
        }
        console.log('');

        // entity type breakdown
        const entityTypes: Record<string, number> = {};
        for (const entity of result.finalState.entities) {
            entityTypes[entity.type] = (entityTypes[entity.type] ?? 0) + 1;
        }
        console.log('Entity Breakdown:');
        for (const [type, count] of Object.entries(entityTypes)) {
            console.log(`  ${type}: ${count}`);
        }
        console.log('');

        console.log('='.repeat(60));
        console.log('All invariants passed. Engine is stable.');
        console.log('='.repeat(60));

    } else {
        console.log('='.repeat(60));
        console.log('SIMULATION FAILED');
        console.log('='.repeat(60));
        console.log('');
        console.log(formatFailure(result));
        
        process.exit(1);
    }
}

// run
main();
