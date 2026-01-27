# MESH 95: Project Specifications (v0.0.0 - "The Triangle")

=========================================================

## 1\. Goal & Scope

----------------

**Objective:** Validate a 100% deterministic "Queue -> Resolve -> Persist" loop using Fixed-Point math.**The Triangle Universe:**

* **Celestials:** 1 Planet, 1 Moon, 1 Asteroid (rendered as white circle strokes).

* **Actors:** 2 Players (rendered as white points).

* **Transitions:** SPACE -> ORBIT via orbitRadius threshold.

* **Physics:** Newtonian; momentum persists in vacuum.

## 2\. Technical Stack

* **UI/Render:** React shell (Windows 95) with PixiJS v8 data-driven viewport.

----------------;

## 3\. Core Architecture

### 3.1 The "Library" Engine (src/engine)

The Engine is a pure state reducer: (State, Actions) => NewState.

**Pipeline of Reducers:**

1. **applyActions**: Processes THRUST intent into velocity changes.

2. **applyManeuver**: Newtonian translation: position += velocity.

3. **applyZoomStateTransition**: Threshold check for SPACE -> ORBIT.

### 3.2 The Persistence Layer (src/engine/data)

Uses a **Relational Log** to ensure 100% auditability and replay capability:

* **ticks**: id, timestamp.

* **actions**: id, tick\_id, controller\_id, entity\_id, action\_type, payload (JSON).

* **state\_snapshots**: tick\_id, data (JSON blob).

### 3.3 The "Terminal" Client (src/client)

* **TelescopeView**: Slaved to GameState. Uses fpToScreen for visual mapping. No interpolation.

* **ViewManager**: Orchestrates switching between Telescope, Orbit, and Surface pipelines.

----------------;

## 4\. Engineering Invariants

* **No Float Leak:** Engine logic never uses native floats; UI converts FP to screen-space locally.

* **No Side Effects:** The tickResolver cannot touch the DB or Network.

* **Action Atomicity:** Trade/Control transfers clear the action\_queue.

* **Fixed Step:** Physics hardcoded for configuring tick cycles (10s dev / 24h prod).

----------------;

## 5\. Visual Standards (v0.0.0 "Happy Path")

* **Style:** High-contrast Black & White.

* **Primitives:** PIXI.Graphics only. Circles for celestials; points for entities.

* **UI:** Sidebar provides raw data readouts and a manual "EXECUTE TICK" debug trigger.
