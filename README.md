# MESH 95

Deterministic space simulation with fixed-point math, server-authoritative state, and SQLite persistence.

## Local Development

```bash
# terminal 1 - server
$env:GENESIS_SEED="whatever-you-want"
npm run server

# terminal 2 - client
npm run dev
```

## Build

```bash
npm run build          # compile typescript
npm run build:client   # vite production build
npm run start          # run compiled server
```

---

## Simulation System

MESH 95 includes a comprehensive simulation and stress-testing infrastructure for validating engine correctness across hundreds of ticks with random player activity.

### Stochastic Simulation CLI

Run universe saturation tests from the command line:

```bash
# basic usage
npx tsx src/engine/scripts/run-stochastic-sim.ts --seed test123 --ticks 500

# verbose mode with custom parameters
npx tsx src/engine/scripts/run-stochastic-sim.ts --seed chaos --ticks 1000 -v

# multi-player stress test
npx tsx src/engine/scripts/run-stochastic-sim.ts -s alpha -t 100 -p 4 --systems 3
```

#### CLI Options

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--seed` | `-s` | timestamp | Seed for deterministic generation |
| `--ticks` | `-t` | 100 | Number of ticks to simulate |
| `--players` | `-p` | 2 | Number of player entities |
| `--systems` | | 2 | Number of star systems |
| `--activity` | `-a` | 0.3 | Entity activity probability (0-1) |
| `--verbose` | `-v` | false | Enable progress logging |
| `--help` | `-h` | | Show help message |

The simulation is **100% deterministic** - the same seed always produces identical results.

### Simulation Components

#### Universe Saturator (`UniverseSaturator.ts`)

Stress testing harness that ages a universe by running hundreds of ticks with deterministic chaos:

- Validates **all invariants** after every single tick
- Stops immediately on failure, preserving the "black box" state
- Tracks action statistics by type
- Reports mass conservation, timing, and entity breakdown

```typescript
import { saturate } from '../test/UniverseSaturator.js';

const result = saturate(initialState, 'my-seed', {
    ticks: 500,
    activityProbability: 0.3,
    allowedMassLossPerTick: toFP(10000),
    verbose: true,
});

if (!result.success) {
    console.log('Failure at tick:', result.failureTick);
    console.log('Failing actions:', result.failureActions);
}
```

#### Chaos Agent (`ChaosAgent.ts`)

Deterministic random action generator for stress testing. Given an entity and game state, generates plausible actions using a seeded RNG.

**Action Modes:**

| Mode | Function | Description |
|------|----------|-------------|
| Single Action | `generateRandomAction()` | One random valid action per entity |
| Round Actions | `generateRoundActions()` | Batch actions for all entities |
| Strategist | `generateStrategistRound()` | Multi-step action chains (EXTRACT → REFINE → THRUST) |
| Deep Chain | `generateDeepChainRound()` | Maximum-depth chains for stress testing |
| Resource Rush | `generateResourceRush()` | Multiple agents contest same resources (stalemate testing) |
| Weld Contention | `generateWeldContention()` | Multiple agents try to WELD same target |

**Chain Patterns:**

```typescript
const CHAIN_PATTERNS = [
    ['EXTRACT', 'LOAD', 'THRUST'],      // gather and go
    ['EXTRACT', 'REFINE', 'THRUST'],    // fuel cycle
    ['SEAL_AIRLOCK', 'WELD', 'THRUST'], // structural maneuver
    ['UNWELD', 'THRUST'],               // separation maneuver
    ['LOAD', 'THRUST', 'UNLOAD'],       // logistics
];
```

---

## Test Suites

Run all tests with Vitest:

```bash
npm test                    # run all tests
npm run test:watch          # watch mode
npx vitest run --reporter=verbose  # verbose output
```

### Test Files

| File | Coverage |
|------|----------|
| `thrust.test.ts` | Thrust action, fuel consumption, mass loss, heading conversion |
| `weld.test.ts` | Weld/Unweld actions, mass combination, relative offsets, nested structures |
| `load.test.ts` | Load action, triad validation, volume checks, mass conservation |
| `unload.test.ts` | Unload action, velocity inheritance, position binding |
| `extraction.test.ts` | Extract action, volatiles/minerals, reach validation |
| `refine.test.ts` | Refine action, efficiency calculations, batch limits |
| `containment.test.ts` | Position binding, anti-ghost-trailing, load/move/unload cycles |
| `wave-interleaving.test.ts` | Multi-wave resolution, WELD→THRUST chains, settlement integrity |
| `conflictCluster.test.ts` | Stalemate detection, cluster identification, permutation solver |

### SimRunner API (`SimRunner.ts`)

Centralized harness for running game ticks in tests:

```typescript
import { 
    runTick,
    runTickWithWaves,
    runTickWithQueues,
    testAction,
    findEntity,
} from '../test/SimRunner.js';

// basic tick execution
const result = runTick(state, [action1, action2]);
expect(result.success).toBe(true);

// wave-based execution
const result = runTickWithWaves(state, [
    [weldAction],           // wave 0
    [thrustAction],         // wave 1 (after settlement)
]);

// player queue mode
const queues = new Map([
    ['player-a', [action1, action2]],
    ['player-b', [action3, action4]],
]);
const result = runTickWithQueues(state, queues);
```

#### Stalemate Testing

```typescript
import { 
    runTickWithStalemateCheck,
    assertStalemate,
    assertNoStalemate,
    getActionClusters,
    testClusterResolution,
} from '../test/SimRunner.js';

// check for stalemates
const result = runTickWithStalemateCheck(state, [loadA, loadB]);
expect(result.stalemate.isStalemate).toBe(true);
expect(result.stalemate.voidedActions.length).toBe(2);

// classify conflict type
const conflict = classifyConflict(actionA, actionB, state);
// Returns: 'NONE' | 'SHARED_TARGET' | 'ACTOR_TARGET_DUALITY' | 'CONTAINMENT_CHAIN' | 'STALEMATE'
```

### Invariant Checkers (`invariants.ts`)

Hard invariant validators that must hold across all actions:

| Invariant | Function | Description |
|-----------|----------|-------------|
| Mass Conservation | `assertMassConservation()` | Total mass cannot increase |
| No Negative Mass | `assertNoNegativeMass()` | All mass values ≥ 0 |
| Position Binding | `assertPositionBinding()` | Contained entities at container position |
| Weld Binding | `assertWeldBinding()` | Welded entities at parent + offset |
| Volume Constraints | `assertVolumeConstraints()` | Used volume ≤ container capacity |
| No Circular Containment | `assertNoCircularContainment()` | No containment loops |
| No Circular Weld | `assertNoCircularWeld()` | No weld loops |
| Non-Teleportation | `assertNonTeleportation()` | Position change ≤ velocity |
| Velocity Continuity | `assertVelocityContinuity()` | No sudden velocity spikes |

**Composite Check:**

```typescript
import { checkAllInvariants } from '../test/invariants.js';

const result = checkAllInvariants(beforeState, afterState, allowedMassLoss);
if (!result.passed) {
    console.log(result.summary);
    console.log(result.massConservation.message);
}
```

### Factory Functions (`factories.ts`)

Create test entities with sensible defaults:

```typescript
import { 
    createShip, 
    createMineralStore, 
    createContainer,
    createResourceWell,
    createGameState,
} from '../test/factories.js';

const ship = createShip({
    id: 'ship-1',
    position: { x: toFP(0), y: toFP(0) },
    reach: toFP(500),
    fuelMass: toFP(100),
    isContainer: true,
    containerVolume: toFP(5000),
});

const state = createGameState({ entities: [ship, cargo] });
```

---

## Architecture Notes

### Fixed-Point Math

All engine calculations use fixed-point integers (FP) with a scaling factor of 1000:

```typescript
import { toFP, fromFP } from '../primitive-types/euclidean/euclidean-types.js';

const distance = toFP(100);    // 100000 (internal)
const display = fromFP(100000); // 100.0 (display)
```

### Wave-Based Resolution

Actions are processed in waves based on `orderIndex`. Between waves, physics "settles" so Wave N+1 sees the reality created by Wave N:

1. **Wave 0**: All actions with `orderIndex: 0`
2. **Settlement**: Binding (position snap)
3. **Wave 1**: All actions with `orderIndex: 1`
4. **Settlement**: Binding
5. **Final**: Translation (position += velocity) runs once at tick end

### Conflict Cluster Resolution

The "Unified Intent Theory" - simultaneous constraint solver that maximizes player success:

1. **Cluster Identification**: Group entangled actions (shared targets, actor-target duality, containment chains)
2. **Stalemate Check**: If two actions are mutually exclusive, void the entire cluster
3. **Permutation Search**: Find ordering where all actions succeed (e.g., WELD → THRUST)
4. **Execution**: Apply actions in optimal order

**Stalemate Rule**: If two players compete for the same unique resource, **neither wins** - the physical contention results in failure for both.
