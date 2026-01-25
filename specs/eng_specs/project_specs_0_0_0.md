# MESH 1995: Project Specifications (v0.0.0 - "The Triangle")

## 1. Project Overview
**Goal:** Validate the core "Queue -> Resolve -> Update" loop in a deterministic space simulation.
**Scope (v0.0.0):** "The Triangle Loop." A closed system with minimal complexity to prove the architecture.
- **Universe:** 1 Planet, 1 Moon, 1 Asteroid.
- **Actors:** 2 Players.
- **Economy:** 1 Resource ("Volatiles").
- **Constraint:** Fixed Tick (configurable, default 10s for dev, 24h for prod).

## 2. Technical Stack
**Philosophy:** "The Engine is a Library." Zero network dependencies in core logic.

### Backend (The Truth)
- **Runtime:** Node.js (TypeScript)
- **Database:** `better-sqlite3` (WAL mode enabled, synchronous).
- **Communication:** `socket.io` (Real-time events + State Push).
- **Validation:** `zod` (Strict schema validation for all inputs).

### Frontend (The Interface)
- **UI Framework:** React (Windows 95 Aesthetics).
- **Renderer:** PixiJS v8 (WebGL 2).
- **Audio:** Howler.js (Event-driven).
- **Bundler:** Vite.

---

## 3. Architecture & Data Model

### 3.1 The Engine (`src/engine`)
A pure function that takes `(State, Action[])` and returns `(NewState, Events[])`.

**Core Entities:**
```typescript
type Vector2 = { x: number; y: number };

// The Player Account (Persistent)
type Account = {
  id: string;
  username: string;
  color_primary: string; // Hex (Additive/Neon)
  reputation: number;
};

// The Physical Presence
type Body = {
  id: string;
  account_id: string;
  location: string; // ID of Celestial Body or "VOID"
  status: 'ALIVE' | 'DEAD';
};

// The Game Object
type Entity = {
  id: string;
  type: 'SHIP' | 'PLATFORM' | 'CORPSE';
  owner_id: string; // Account ID
  position: Vector2; // Relative to current Orbit/Surface
  velocity: Vector2;
  action_queue: Action[]; // Pending actions for next tick
  inventory: Record<string, number>;
  last_seen_tick: number; // For Fog of War
};

// The World
type CelestialBody = {
  id: string;
  type: 'PLANET' | 'MOON' | 'ASTEROID';
  gravity_well: number;
  orbit_center_id: string | null;
  resources: { type: string; yield: number }[];
};

### 3.2 The Game Loop (UTC0 Resolver)

1.  **Snapshot:** Load State from SQLite.
    
2.  **Order:** Sort ActionQueues by initiative/priority.
    
3.  **Execute:** Apply actions to a localized memory copy.
    
    *   _Move:_ Update positions.
        
    *   _Harvest:_ Add resource to inventory.
        
    *   _Conflict:_ Resolve "Double Down" logic.
        
4.  **Commit:** Write NewState to SQLite.
    
5.  **Broadcast:** Push diffs to connected Sockets.
    

### 3.3 The Sensor Stack (Visual State Machine)

The client ViewManager switches rendering pipelines based on zoom/context.

| Context | Metaphor  | Tech Implementation         | Visual Style                                      |
| ------- | --------- | --------------------------- | ------------------------------------------------- |
| Space   | Telescope | PIXI.Mesh + Post-Processing | Distortion, Chromatic Aberration, Parallax Stars  |
| Orbit   | Naked Eye | PIXI.Shader (Fragment)      | 4K Cinematic, Rayleigh Scattering, Specular Glint |
| Surface | Lidar     | PIXI.Graphics (Vector)      | Voronoi Wireframe, False Color, Glitch/Ghosting   |

4\. Specific Mechanics (v0.0.0)
-------------------------------

### 4.1 Death & Ghosts

*   If a Body reaches 0 Integrity or double-downs suicidally, it becomes type: 'CORPSE'.
    
*   The Player Account persists (Ghost Mode).
    
*   Corpse retains inventory (Lootable).
    
*   New Body spawns at nearest friendly Platform on next Tick.
    

### 4.2 Commerce & Queues

*   **Rule:** If Entity.owner\_id changes (Trade), Entity.action\_queue is strictly CLEARED.
    
*   Prevents "Trojan Horse" attacks.
    

### 4.3 Fog of Data

*   Client stores LocalKnownState.
    
*   If Entity is not in VisibleRange this tick:
    
    *   Render at last\_known\_position.
        
    *   Apply GlitchShader + "STALE DATA" timestamp label.
        
    *   Interaction disabled.
        

5\. File Structure
------------------
`
├── src/
│ ├── engine/ # Pure Logic (Node/Browser compatible)
│ │ ├── core/ # The Loop, Tick Resolver
│ │ ├── systems/ # Movement, Economy, Combat
│ │ ├── data/ # SQLite Repositories
│ │ └── types.ts # Shared Types
│ ├── server/ # Socket.io handling
│ │ ├── events/ # Input Validators (Zod)
│ │ └── main.ts # Entry point
│ ├── client/ # Frontend
│ │ ├── ui/ # React Components (Windows 95)
│ │ ├── renderer/ # PixiJS Viewports
│ │ │ ├── shaders/ # GLSL Code
│ │ │ ├── filters/ # Post-Processing
│ │ │ └── views/ # Telescope, Orbit, Surface
│ │ └── audio/ # Howler Event Bus
│ └── shared/ # Constants (TickRate, Config)
├── public/
│ └── assets/ # Sounds, Fonts (No textures mostly)
└── package.json`

6\. Audio Architecture
----------------------

*   **Philosophy:** Audio is Data. Driven by the Event Bus.
    
*   **Implementation:** AudioEventBus listens to State Changes.
    
*   **Context Awareness:**
    
    *   If Player.location === 'VACUUM': Apply LowPass Filter.
        
    *   If UI.interaction === 'TYPING': Play teletype\_chatter.wav.
        
    *   If Event === 'SHIP\_DESTROYED': Play radio\_static\_burst.wav + tts\_report.mp3.

    