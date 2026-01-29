# MESH 95

## *multi-enterprise spatial histrionics*

## *(mandible-economy simulation of hegemony)*

2026 prototype game design document version 0.0.1

***Question:** Why doesn't the game look like a movie? Why does it look like a 30-year-old Windows 95 program?* 

***Answer:** Because you aren't watching a movie; you are doing a job. Or running from one.*

# ---

# **Executive summaries**

## **Description**

**Flavor summary:** MESH95 is a text-driven, massive multiplayer online game set in deep space. Players exist as fragile particles in a universe dominated by corporate ant colonies. There are three layers of gameplay (you control bodies, entities, and network influence) and three zooms of gamespace (vacuum of space, orbits, planet surfaces). 

**Rhythm:** The game runs on a daily tick. Between ticks, you roleplay encounters, negotiate, and enqueue all types of actions. Actions are afforded by assets and/or by context. Every 24 hours at UTC midnight (UTC0), all queued actions resolve simultaneously. The rhythm mirrors correspondence chess or Diplomacy. You think about the game when you’re not playing it. 

**Primitives:** The game is built on primitives: minimal data structures that enable emergent play. Bodies, entities, and resource wells are geometrically particles (points) with property sets that determine afforded actions. Planets, moons, and asteroids are circles. Procedural generation defines each planet’s gravity map as a Z-axis sinewave, with peaks and valleys that produce points of interest. Those POI generate voronoi zones. POI can be encountered by bodies, then transform or disappear based on the outcome of the player’s roleplay. Platforms are player-drawn rectangles containing entities; based on contents, they offer automation objectives to players with configurable input/output sides (to fuse platforms together). 

**Physics:** Euclidean primitives reduce 3D space simulation to distinct coordinate systems. The Z-axis represents energy cost (not depth). Space is a frictionless vacuum table with persistent momentum. Orbits are fixed rails. Gravity wells make launches from surface to orbit expensive. 

**Companies:** Corporations flood space, orbits, and planets with thousands of particle entities: bugs scouting for resources, luggers hauling sweetmeats along ink trails, biters enforcing claims. Players navigate relationships with companies that range from neutral to symbiotic to exploitative to hostile. Companies trend toward consolidation. Late-game universes may contain a single megacorp with trails spanning everything. Players can delay this, rarely prevent it, and always choose to join.

**Extraction vs exposure:** Resources (volatiles and minerals) exist in fixed but immense quantities at single points. A source’s value is astronomical \-- paying 99% tribute to a corporation is still worth it without alternatives. Discovering your own source means independence and vulnerability. Extract efficiency scales exponentially for everyone, meaning the universe trends toward collapse. This is fun. 

**Economies:** Commerce models distributed emergence with no central fiat. Players don’t “have” resources, they control entities that carry or contain them. Players can sell, buy, gift, and receive any asset—transferring control to other players. But it doesn’t bypass logistics. You could receive the deed to a yacht, but still need to fetch it. The only truly fungible instruments are company shares (earned through contracts) and company bonds (earned by holding shares). What they’re worth is determined by players and corporations. 

**Real conflict:** Conflict is semantic, not arithmetic. Gone are troop types, stats, territories. Resolution follows rock-paper-scissors logic across posture, objective, commitment, and stance. This enables realistic conflict patterns: scoped strikes, attrition, logistics disruption, power project, double-dealing. 

**Encounters:** Bodies can target anything for an encounter. The system generates a one-off text experience with branching choices and mechanical consequences. No encounter repeats (no door twice). Choices accumulate into character arcs that shape future encounters.

**Arc:** The game is a sandbox with no victory conditions. Meaning emerges from play. Alliances form and fracture. Resources deplete, faster and faster. Players can become anything from rogue operators to imperial consolidators or logistics magnates. The universe ticks toward heat death as everyone consumes the ultimate and fixed resource: Energy.

## **Game design philosophy**

1. **Playability:** Deploy the smallest version with a complete game loop. Fully playable for a group of friends.   
2. **Reductive elegance**: every system in minimal form, always interconnected  
3. **Primitives-first:** Emergent play rooted in primitives: semantic, euclidean, data, and generative.   
4. **No door twice**: careful LLM use produces playable, balanced, infinite content  
5. **Components-only:** Modularize and componentize everything  
6. **Spec is a living SSOT**  
7. **Satire is mechanical**, not decorative: the critique is in the systems, not the flavor text  
8. **base10 for 0.0.1**. For version 0.0.1, use a seed that creates 100 planets, 100 moons (random distribution), 10 corporations, 1000 asteroids  
9. **Test-driven development:** every component built with thoughtful unit tests and nothing commits without tests  
10. **State machine first:** I require an elegant state machine for tracking, analysis, runback, re-seeding → anything I need to either make player experience better during the test or for running tests, analysis, etc. later on

## **Technology architecture priorities**

1. Tracer bullet every part of the stack before committing  
2. Unit-testable  
3. No N-body simulation  
4. Transactional database for commerce  
5. Test logic fully with zero AI (reducer, event sourcing model)  
6. Entity-component-system to support welding (composition)  
   1. Entities are IDs, components are data bags  
7. Serialized actions with strict validation/execution  
   1. Supports re-ordering, filtering, removing, re-adding during play  
   2. Supports interleaving and strict validity checks during UTC0  
8. Spatial hashing/indexing of some kind; visibility is a bear  
9. AI primitives wrapped in safety bubble (determinism)  
   1. Are separated from logic layer  
   2. Can react to (take) state  
   3. Structured output  
   4. Output proposes state changes in a domain-specific language (DML) → (JSON) → resolver can execute

## **Technology decisions**

1. Engine  
   1. Pure deterministic library.   
   2. Runtime: [Node.js](http://Node.js) (TypeScript)  
   3. Database: better-sqlite3  
      1. Single-file portability, zero-latency local queries, fits the currency and economy  
      2. Write-ahead logging for concurrent reads/writes  
   4. Logic model: Event sourcing lite. The universe is a massive JSON-serializable object (bodies, entities, economies)  
   5. Mutations: State is never modified directly, only by resolvers  
   6. The tick (UTC0): cron job wakes up, loads the state \+ action queue, runs the game loop (state, actions), and writes the new state  
   7. Persistence: Hot state in-memory for instant read access. Cold storage in SQLite, flushed on every transaction.  
2. Network layer  
   1. Fast commerce, and atomic actions  
   2. Protocol: WebSockets ([socket.io](http://socket.io))  
   3. Events (examples): MARKET\_OFFER, ACTION\_COMMIT  
   4. Latency Masking: Non-commercial actions are "queued." The client receives audio/UI feedback, can delete, redo, and resort the actions, but the true result only arrives after the UTC0 tick.  
   5. Security: Auth JWT (stateless)  
   6. Validation: Zod schemas. Every payload from the client is hostile until validated against the Zod schema.  
3. Frontend  
   1. Optimized: Fully responsive from desktop to mobile  
   2. Communication: React components subscribe to game state. When you click a React button (“Maneuver”) it emits a socket event, the engine replies, React updates the UI, PixiJS visualizes the result  
   3. “Zoom” \== View manager  
      1. PixiJS v8 (WebGL 2\)  
   4. “Controls”== Windows 95 program  
      1. React (HTML/DOM) handles the Windows 95 UI: menus, lists, actions, assets, commerce, encounters, text. It sits on top of the Canvas.   
4. Genesis manager  
   1. Math over memory: store a seed  
   2. Genesis seed: a single string that drives the universe. Change the seed, the universe layout changes  
   3. PCG algorithm where random(seed \+ coordinates) return the same result for an infinite universe and zero database bloat. Only save a celestial to SQLite if a player modifies it.  
   4. Celestials (planet, moon, asteroid)  
      1. Generation timing is just-in-time based on player’s asset locations and visibility  
      2. Hash determines number of planets and types, orbits, POI, resource wells locations and amounts  
      3. Visual is from a visual\_seed per-planet (hex code)  
      4. Client (PixiJS) receives the seed and feeds it into the planet fragment shader  
         1. Illustrative example: seed 0xA1 \== “Red Atmosphere, High Turbulence”  
   5. Corporations ("ant colonies")  
      1. Combinatory categorial grammar (CCG)  
         1. Illustrative example: \[prefix\] \+ \[noun\] \+ \[suffix\]  
      2. Name gen: \[prefix\] \+ \[noun\] \+ \[suffix\], rolled from a presupplied list.   
         1. Examples: prefixes must use joyful, cheery words to satirize corporations, “Tranquility”, “Morningstar”, “Cherry Lane”, nouns and suffixes must be enigmatic jargon (“Organizational”, “Unlimited Universal Corporation (UUC)”)  
      3. Behavior gen: Trait mixing → feeds into the logic resolvers  
   6. Corporate and player starting positions  
      1. Poisson disc sampling → guaranteed minimum distance between spawn points  
   7. Mature universe creation: Ability to start the universe at higher maturity (probably not 0.0.1)  
5. View manager  
   1. Space view (telescope)  
      1. PIXI.Mesh and custom GLSL shaders  
      2. Optical simulation techniques  
      3. 3-layer starfield (spherical parallax), planet billboards (no distortion), post-processing (barrel distortion, chromatic aberration)  
      4. Interaction: Turret, zoom, and focus controls that rotate view around Body location origin  
   2. Orbit view (naked eye, AR glasses)  
      1. High-cost fragment shaders  
      2. Cinematic realism achieved with radical focus (small edge of planet available)  
      3. Single quad renderer (4k), rayleigh scattering (atmosphere), specular mapping (oceans), cloud shadowing  
      4. Immersion: Parallax solar panels in the foreground, stencil mask (window frame), breathing and blinking   
      5. camera  
      6. Interactives: An AR view overlays all the entities for interacting and inputting. (Available actions to entities in orbit are limited).   
   3. Surface view (the lidar)  
      1. PIXI.Graphics (vectors0  
      2. False-color topology  
      3. Voronoi cell generation (client-side compute from Seed-generated POI)  
      4. Wireframe, monochromatic with limited colors, high-contrast, missing data is black  
6. Audio manager (diagesis)  
   1. Audio is data, soundscape is generated procedurally from game state  
   2. [Howler.js](http://Howler.js)  
   3. Location-awareness of where the Body (player) is currently located  
   4. Foley system creates room sounds to sell the physicality  
   5. Actions ordered through the program are played as voice comms (radio) rather than “real” sound effects  
7. AI primitives manager  
   1. LLM integration  
   2. Provider: local ollama for prototype  
   3. Structured outputs (JSON)  
   4. Generates encounters, flavor. Never executes logic

| Layer | What It Is | What you do | Exposure |
| :---- | :---- | :---- | :---- |
| Bodies | People in your party | Take actions afforded by controlled bodies and uniquely target encounters with anything | High (mortal, irreplaceable) |
| Holdings | Bodies, entities, and zones you currently control | Take actions afforded by controlled bodies, entities, and zones | Medium (losable, replaceable) |
| Network | Your implicit influence in the galaxy | Corporate relationships, player relationships, reputation, alliances, contracts | Low (persistent, invisible) |

# ---

# **Flavor summary**

## **Three layers of gameplay**

Players exist as an abstract id across three zoom levels or “layers”. The game does not force you into one. You choose where to spend your time and how much exposure to have on each layer.

## **Three zooms of gamespace**

Players and entities exist within three distinct spatial contexts. Space and orbit share a coordinate system and gravity well. Planets exist as a fixed origin point (and capture radius) on the main coordinate system, but contain their own coordinate system and gravity map. 

| Zoom | Coordinate system | Gravity (Z-axis) | What it is |
| :---- | :---- | :---- | :---- |
| Space | Shared with Orbit | Shared with Orbit | Frictionless vacuum table; momentum persists, burns are visible, coasting is stealth |
| Orbit | Shared with Space | Shared with Space | Fixed rail around a planet; entities circle, land, leave, or adjust velocity |
| Planet | Has a X,Y,Z point and capture radius (“pocket capture”) on the space zoom Contains a distinct (“pocket universe”) coordinate system | Has a fixed (averaged) Z value in its X,Y,Z point on the space zoom Contains a distinct (“pocket universe”) gravity map that determines POI and voronoi zones | Friction surface where planetary properties affect movement and actions |

### **What each zoom contains**

1. **Space**: Asteroids (dynamic vectors), planets and planets’ capture radii (fixed positions), ink trails (company highways), all entities in space  
2. **Orbit**: Moons (constant angle and speed), zone map (rail segments corresponding to surface zones), all entities in orbit  
3. **Planet**: Gravity map, POI, voronoi zones, resource wells, platforms, all entities and all bodies

### **Player view per zoom**

1. **Space**: Top-down view of the vacuum table  
2. **Orbit**: Cropped side-view of a rail segment with the planet edge below; nearby moons, asteroids, and planets visible in background; communicates scale  
3. **Planet**: Top-down view with energy axis represented visually; voronoi zones always visible; POI and resource wells persist once sighted; entities and bodies visible only while in current sight range

# ---

# **Rhythm and actions**

The game runs on a daily tick. Every 24 hours at UTC midnight (UTC0) all queued actions resolve simultaneously. Between ticks, players roleplay encounters, engage in commerce, and enqueue actions. The rhythm mirrors correspondence chess or Diplomacy: you think about the game when you’re not playing it. 

## **The daily cycle**

A single game day follows this pattern:

1. **The game completes UTC0**. The new game state is revealed.   
2. **The game narrates**: Every player can access a splitview log tailored including what they did, what was done to them, and what happened in their sight. One portion of the log is deterministic, but the crosstab lines up and provides LLM-generated flavor nodes.   
3. **Players assess**: Review what happened, assess new game state, see newly-visible intelligence  
4. **Players plan**: Negotiate alliances (off-book), strategize  
5. **Players roleplay**: Must play through any encounter(s) before engaging in commerce or enqueueing actions. This is critical because the effect of an encounter doesn’t truly resolve to global game state until the very start of the next UTC0.   
6. **Players commit**:   
   1. Engage in commerce (some resolved in real-time)   
   2. Enqueue actions (not real-time)  
7. **The game begins UTC0**. Everything resolves. Repeat.

Other than some forms of commerce, nothing happens until everything happens. 

## **Actions in the daily cycle**

Actions are things you do that affect game state. 

They are afforded by entities and bodies you control and by context. If you control it, you can use what it affords.  Examples:

* e.g. A mining rig affords extraction  
* e.g. A ship affords thrust in space  
* e.g. The same ship affords no maneuver on the surface  
* e.g. A sensor array affords scanning

Between ticks, players can enqueue as many actions as their controlled entities afford. There are no artificial action caps per thing or per turn. 

The exception is that these actions require a body’s/entity’s full 24-hour exertion:

1. Commitments  
2. Posture changes  
3. Encounter (request)

Otherwise, it’s: “More assets? More possibilities.”

## **Encounters in the daily cycle**

[Encounters](#encounters) are special actions only afforded by bodies. Players roleplay encounters as a branching narrative with choices and mechanical consequences. 

1. Encounters are requested between ticks  
2. Encounters are generated at the next UTC0  
3. Players roleplay the encounter anytime during the next day  
   1. The mechanical outcome is visible in local game state only. It takes full effect at the next UTC0.  
   2. If the player didn’t roleplay the encounter, the encounter has a mechanical outcome for a null choice

## **Resolution during UTC0**

At UTC0, everything resolves in strict sequence, with interleaving and validity checks.

### **Resolution order**

Steps 2-4 are the most important steps. The rule of thumb is, “I do my stuff, then we fight”. 

1. **Encounters resolve.** Whether they were roleplayed or not. All encounters have their effects applied to game state, first.   
2. **Actions resolve.** All other queued actions resolve. Players are interleaved by action number: everyone's first action resolves together, then everyone's second, and so on  
3. **Posture changes resolve.** All bodies and entities that changed their real posture have those changes applied  
4. **Commitments resolve.** All PRESS, HOLD, and SUPPORT stances resolve according to initiative order (hostile/hidden first, then alert, then active, then idle). Outcomes are determined  
5. **New encounters generate.** Any encounter requested becomes available for the targeting player

### **Action interleaving**

This does not often matter, but actions resolve in rounds, not per-player blocks. If Player A queued 5 actions and Player B queued 3 actions:

* Round 1: A's first action and B's first action resolve simultaneously  
* Round 2: A's second action and B's second action resolve together  
* Round 3: A's third action and B's third action resolve together  
* Round 4: A's fourth action resolves (B has no fourth)  
* Round 5: A's fifth action resolves (B has no fifth)

This prevents any single player from front-running the entire queue.

### **Validity at resolution**

An action is only resolved if its effect on game state remains valid at the moment of resolution. Examples: if an earlier resolution destroys the entity affording the action, or removes the target, or changes conditions such that the action no longer applies, the action fails silently. It does not refund, redirect, or retry.

This means order matters. Actions can invalidate commitments. Earlier actions can invalidate later actions. Players must anticipate cascading effects when planning their queue.

### **What happens between ticks**

Between UTC0 events, the game is played:

* **Encounters:** Players play through generated encounters at their own pace  
* **Negotiation:** Players communicate off-books to form alliances or threaten  
* **Commerce:** Players can instantly transfer control of entities, instantly offer/accept contracts, instantly buy/sell assets, instantly transfer/swap/buy/sell shares and bonds, instantly buy/sell/offer/gift information of any kind  
* **Planning:** Players study the systems, analyze positions and postures, see corporate maneuvers  
* **Queuing:** Players lock in their posture changes, commitments, encounter requests, and actions for next UTC0

Commerce and negotiation happen in real time. Control transfers are instant. But nothing else changes game state until the tick.

### **Action bank**

| Action | Short description |
| :---- | :---- |
| TRANSPORT | Can move another entity on surface |
| MANEUVER | Can move itself on surface |
| THRUST | Can thrust in space/orbit |
| LAUNCH | Can leave surface to orbit with fuel expenditure |
| EXTRACT | Can pull resources from wells (scales exponentially with repetition) |
| REFINE | Can convert crude volatiles to fuel (output mass \< input mass); scales exponentially with repetition |
| MANUFACTURE | Can convert minerals to entities (mass in \= mass out, volume in \= volume out); scales exponentially with repetition |
| WELD | Can fuse entities together |
| UNWELD | Can unfuse an entity from other(s) after it was welded earlier |
| MOD | Can upgrade an entity using an available mineral store |
| COMMIT | Can participate in PRESS/HOLD/SUPPORT |
| SEAL AIRLOCK | Can seal for vacuum protection |
| UNSEAL AIRLOCK | Can unseal airlock |
| LOAD | Place a transportable entity within reach inside a container within reach |
| UNLOAD | Remove a transportable entity from inside a container and place it somewhere else within reach |
| TRANSPORT | Can transport another entity within reach along while it maneuvers (think towing, pulling, or hauling) |
| VECTOR LOCK | Match vector with a moving target precisely (space/orbit); only available if possible given possible inputs |
| MOVE SCANNER | Move repositionable sight origin (all observations roll up to player visibility) |
| SCAN | Improves visibility level by 1 for 1 tick |
| ENCOUNTER | (Bodies only) Initiate encounter with any target  |
| REPRODUCE | Platform-only, increase population level |

# ---

# **Primitives**

The game is built on primitives: minimal data structures that enable emergent play. Primitives are layered. Foundational primitives (euclidean, semantic) define the physics and logic of the universe. Derived primitives (properties, planets, platforms) build on those foundations to create entities, bodies, and the spaces they inhabit. 

## **Primitive hierarchy**

| Unit | Primitive | What they define |
| :---- | :---- | :---- |
| Foundational | Euclidean | Geometry: points, circles, coordinate systems, Z-axis |
| Foundational | Semantic | Logic: actions, effects, resolution, choices Objects: body, entity (platform vs non-platform), planet, moon, asteroid, contract, corporation, resource, energy, etc… |
| Derived | Planets | Environmental modifiers that scale property values |
| Derived | Moons | Miniature planet on fixed rail orbits with miniature pocket universe and fewer, resource wells; players must dock (match orbit angle) to land |
| Derived | Asteroids | Point with constant vector in space containing resource wells sometimes; players must be within reach to extract resource well |
| Derived | Platforms | Automation containers that organize entities around objectives |
| Derived | Properties | What entities and bodies can do and how physics affects them |
| Generative | AI primitives | Content creation: encounters, flavor, autonomous agents |

## **Foundational: Euclidean primitives**

Everything in MESH95 exists in space as one of two shapes:

| Euclidean primitive | Context |
| :---- | :---- |
| Point | Bodies, entities, asteroids, resource wells, POI |
| Circle | Planets, moons, capture radii |

Volume is abstracted. It exists only as a number for conditional checks (can this fit inside that?). There is no 3D rendering, no collision meshes, no spatial occlusion. Just points and circles on coordinate planes.

### **Coordinate systems**

There are two types of coordinate systems:

1. **Space-orbit system**: A single shared plane. Space is the vacuum table. Orbits are fixed rails at a planet's capture radius. Asteroids and entities have positions and vectors. Planets have fixed positions  
2. **Planet system**: Each planet contains its own coordinate plane—a pocket universe. Movement on-planet follows different rules than movement in space. The two systems connect through launch (surface → orbit) and landing (orbit → surface)

### **The z-axis: Energy**

The Z-axis does not represent depth. It represents energy cost.

| Location | Z Value | What it Means |
| :---- | :---- | :---- |
| Deep space | 0 | Flat plane. Momentum is free. Thrust is rarely expensive but it depends on the entity.  |
| Orbit | 50 | Rim of the gravity well. Momentum in orbit is free. Leaving can be expensive.  |
| Planet surface | 1000 x planet gravity | Bottom of the well. Launching is very expensive. Landing is cheap. |

Moving "up" the Z-axis (surface → orbit → space) costs energy (and/or time) proportional to the difference and depending on the entity. Moving "down" (space → orbit → surface) is nearly free. Getting extracted resources off of a planet nearly negates the value of the resources. 

### **Energy faucets and sinks**

1. Faucets  
   1. Just one true source: volatile resource wells  
      1. Technically also inside mineral resource wells on moons, because they have trace bits of volatiles in them as well  
   2. Important note: Surface movement costs time, not energy. The gravity well just affects the distance individual bodies/entities can maneuver per turn.   
2. Sinks  
   1. Energy leaves the system through:  
      1. Launches and thrusts  
      2. Conflict (destruction)  
      3. Corporate consumption (the largest drain)

## **Foundational: Semantic primitives**

### **Semantic primitives: objects**

| Object | What it is |
| :---- | :---- |
| Body | A person. Bodies make choices, roleplay encounters, and accumulate character arcs. Bodies cannot exist in space without being a content of an airlocked entity. Players start with one body and may acquire more. Bodies are mortal and irreplaceable |
| Entity | Anything that is not a body. Entities afford actions based on their properties. A mining rig, a cargo container, a satellite, a mineral store, a ship: all entities. Entities can be manufactured, welded, modded, destroyed, and transferred between players |
| Platform | A special entity type. Platforms are player-drawn rectangles that contain other entities and auto-organize around a player-assigned objective |
| Planet | A circle in space with a fixed position. Contains a pocket universe coordinate system, gravity map, voronoi zones, resource wells, POI, and all its contained bodies/entities. Expensive to launch from |
| Moon | A circle in orbit with a moving position (fixed rail). Contains a simplified pocket universe: fewer zones, crater-based topography, lower gravity well. Cheap to launch from |
| Asteroid | A point in space with a vector. Contains resources (volatile or mineral, never both, sometimes neither). Must be within your mining entity’s reach to extract, creating incentive to match its vector for repeated extractions |
| Corporation | A meta-agent. Corporations are autonomous ant colonies that flood space with particle entities, stake claims, and trend toward consolidation. |
| Contract | An agreement between players and/or corporations. Contracts specify obligations and payouts. Some resolve instantly, others at UTC0, others when the obligation is mechanically met |
| Resource well | A point on a planet, moon, or asteroid surface. Contains extractable volatiles or minerals (or both, on moons only). Depletes quickly because efficiency of extraction is exponential for repetition (yes, it should get silly). |

### **Semantic primitives: processes**

| Process | What it is |
| :---- | :---- |
| Action | A thing you can do once per tick that affects game state. Actions are afforded by bodies, entities, their properties, and context. Enqueued between ticks, resolved at UTC0 |
| Effect | The planned delta to game state from an action. Effects are enqueued with actions. At UTC0, effects are resolved in order, but resolution may differ from plan if conditions have changed. |
| Resolution | The actual application of an effect at UTC0 |
| Choice | A decision point within an encounter. Choices are afforded by the encounter’s branching structure. Outcomes are instant for the player’s game state (just as other actions appear instant) but also like action effects, the choices do not apply to global game state until the start of UTC0. |
| Encounter | A generated narrative experience with choices and mechanical consequences. Only bodies can initiate encounters. No encounter repeats.  |

## **Derived: Planets**

Planets are circles with fixed positions in space. Each planet contains a pocket universe: a distinct coordinate system where some actions operate with different rules than space.

| Planet properties | What it does |
| :---- | :---- |
| type (enum: gas, solid) | Determines whether surface operations are even possible. Gas planets have no landable surface.  |
| gravity (N/kg) | gravity determines the averaged z-axis value (1000 × gravity) of the planet on the space-orbit coordinate system and is used as an input for the planet surface procedural generation (must average the z-axis value)  gravity helps to determine the launch cost (uses exact Z difference between the entity’s Z value on the surface and the constant Z value of the planet’s orbit). This allows players to strategically pick launch sites. (Mountains are easier to launch from, but harder to get material up, etc…) gravity scales movement range for all bodies/entities on the surface. The energy cost (z-axis) difference between point A and possible B scales it further. This models the fact that: the same exact hill on a high-gravity planet vs a low-gravity planet are significantly different to climb. On the high-gravity planet, your bodies/entities could not go as far up the same hill per tick |
| atmosphere (number between 0 and 1\) | scales a body’s (not an entity’s) force output and affects maneuver range 0 is a vacuum and requires an airlock. |
| planet radius | determines the visual size of the circle in space determines the WxL size of its pocket universe must be smaller than capture radius |
| capture radius | the distance from the planet center to where orbit begins. Entities crossing this threshold transition from space to orbit |

### **Planet: Gravity map**

Each planet's surface has a procedurally generated gravity map: a Z-axis sinewave creating peaks (high ground, easier to launch) and valleys (low ground, harder to launch, richer resources)

#### ***The gravity map determines:***

1. Points of interest (POI): Generated at peaks, valleys, and inflection points  
2. Voronoi zones: Tessellation, polygons formed around POI, defining zones players can control to gain more visibility  
3. Resource well locations: Valleys tend to hold richer deposits (deeper \= more resources, but higher transport/launch cost)  
4. Movement cost: Traveling uphill costs more time than traveling downhill

#### ***Zone control***

Zones are the atomic unit of territory on planets. But they start as invisible: only the points of interest and resource wells are visible; and those only when a body/entity is in-sight of them. 

A zone must be mapped to gain control of it. This is done via resolving an encounter on its POI. When a player resolves the first encounter ever with a POI, no matter what the outcome was: 

1. The point of interest sometimes disappears; sometimes not\!   
2. The mapping player has control of the zone  
3. The mapping player can instantly see:  
   1. The zone boundary (because of voronoi zones, this gives clues to other POI locations)  
   2. All resource wells in-zone  
   3. Visibility of all bodies/entities in the zone  
4. Any players with observing bodies/entity’s can now see:  
   1. The zone boundary

Alternatively, a player can take control of a neutral (or adversary-owned) zone with a successful PRESS commitment on a zone, with objective: gain control. 

Zone control auto-grants:

* Visibility of entities/bodies entering the zone  
* Automatic visibility of resource wells  
* Hidden posture effectiveness (traps always work in your own zone)  
* New platform placement rights

## **Derived: Moons**

Moons are miniature planets on rails. They orbit a parent planet at fixed speed, occupying a moving position on the shared space-orbit coordinate system. Each moon contains its own pocket universe, simplified compared to planets.

### **How moons differ from planets**

| Aspect | Planet | Moon |
| :---- | :---- | :---- |
| Position | Fixed in space | Moving along orbital fixed rail |
| Z-axis value | 1000 x gravity | \~100 (much shallower rail, nearly the same as the orbit well) |
| Gravity well | Deep (expensive launch) | Shallow (cheap launch) |
| Zones | Many (5-9) | Few (2-5) |
| POI density | High | Low |
| Topography | Rolling hills and valleys | Hard craters |
| Landing cost | Cheap (falling down the well) | Requires docking thrust (matching orbital angle) |
| Launch cost | Expensive (climbing out) | Cheap (shallow well from moon to orbit) |

### **Docking with moons (contextual action)**

To land on a moon, an entity in orbit must:

1. Expend thrust to attempt to match velocity and angle within a small margin of error (MoE)  
2. If that thrust is possible, the player can land (transition into the moon’s pocket universe)  
3. Transition into the moon's pocket universe

This creates a timing game. Moons are accessible but not always conveniently accessible, you may need to wait for the moon to reach your orbital position, or burn fuel to chase it.

### **Why moons matter**

Moons are the middle game. They offer:

* Volatile wells (rare but extremely rich, mixed with trace minerals)  
* Mineral wells (often available, medium concentration, mixed with trace volatiles)  
* Low launch costs (resources extracted here can actually reach orbit profitably)  
* Fewer zones to contest (easier to control entirely)

Corporations prioritize moon volatiles. Players who secure an unclaimed moon well have a genuine economic engine.

## **Derived: Asteroids**

On a semantic level, asteroids are resource well entities with different  and more sandbox properties than resource wells on moons/planets. This allows for some silly play if players have overpowered transport capabilities.

On a Euclidean level, asteroids are points with vectors. They drift through space on fixed trajectories, containing resources that require sustained proximity to extract.

### **Asteroid properties**

| Aspect | What it does |
| :---- | :---- |
| Position | Current location in space-orbit coordinate system |
| Mass | Mass depletes as resources deplete.  |
| Vector | Direction and speed of travel (persists indefinitely, no friction) |
| Asteroid type | volatile, mineral, or none |
| Resource quantity | Total extractable mass (fixed at generation, depletes with extraction) |
| Properties | Other properties are set (canTransport, canWeld) on asteroids as they are essentially just entities, but their sheer mass will prohibit nearly everything through existing formulas |

### **Matching vectors**

Unlike planets and moons, asteroids have no gravity well and no pocket universe. They're just resource well entities moving through space as points. So to extract from an asteroid:

1. Approach: Plan to achieve your entity’s extraction (reach) range of the asteroid at UTC0  
   1. This allows at least one tick of extraction if you have it ready and available  
2. Match: To achieve repeated extraction, adjust your vector closer and closer to match the asteroid’s vector  
3. Extract: While possible and enqueued, extraction occurs each tick  
4. Maintain: If you will not be within reach of the asteroid at UTC0, extraction is not available. If you are no longer within reach at UTC0 during resolution of actions, extraction will fail. 

Matching creates a convoy. Your extraction entity travels with the asteroid, burning no fuel (momentum is free), extracting continuously. Breaking off to deliver resources means re-matching later, or losing the asteroid entirely as it drifts away.

### **Why asteroids matter**

Asteroids are the early game and the opportunistic game:

* No gravity well (extracted resources are already “up”, no launch cost)  
* High purity minerals (asteroid ore is dense, efficient to transport)  
* High concentration volatiles (when present, significant portion of asteroid mass)  
* For late-game silliness, asteroids are at their core, entities, but with very few properties available. The few that are though, allow for emergent sandbox play assuming players manage to deploy moon-sized capabilities. 

Companies claim resource wells on asteroids quickly. The player opportunity is speed: find an unclaimed rock, match vectors, extract, and leave before a bug spots you.

## **Derived: Platforms and crew**

Platforms are one of the very few distinct entity types and are significantly specialized away from the core entity and properties. 

Platforms are essentially lego plates and allow players to move from tiny operations where they’re picking up and dropping individual entities, to automating complex infra. No spreadsheets ever required. 

### **Platform as a Euclidean primitive**

Platforms are:

1. Player-drawn rectangles  
2. Only on planet and moon surfaces  
3. Agnostic to zones (can span multiple, there is no relation)  
4. Contain (“platform”) any other bodies/entities, and contain overlapping resource wells (a core use case)

### **Platform as a semantic primitive**

Platforms are:

1. Specialized entities  
2. But with very few mutable properties  
   1. Airlock is true by default  
3. Unique property: crew (integer)

### **Create platform action**

Platforms cost mineral volume (mass is irrelevant). The area of the platform (l x w) determines the amount of mineral volume you’ll spend (reductive simplicity). 

### **Platform functions and rules**

1. Control  
   1. Platforms require zone control to place, but they can extend beyond zone boundaries  
   2. Only the platform’s controlling player can setup automation (enqueue platform actions)  
   3. Anyone can move anything onto the platform  
   4. But the platform is agnostic: all its contents are considered and used if relevant to the platform action  
2. Intelligence  
   1. The platform autosenses which platform actions it could automate from the contained entities/resource well(s)  
3. Automation  
   1. There is a predefined list of possible actions (platform actions) from the action bank,   
      1. e.g., manufacture, extract, refine, load, transport, launch, reproduce.   
   2. Each side of the platform can be set as an input, output, or none (only relevant for chains of platforms)  
      1. Platforms intelligently move outputs off-platform in defined direction(s)  
   3. Platforms intelligently repeat their platform action every tick if not paused  
   4. When given a platform action, platforms auto-organize the coordinate location of new contents when relevant for maximum efficiency  
   5. When given a platform action, platforms automatically maximize the output for its platform action and use up to its max inputs or what’s available (whichever ceiling it hits first)  
   6. Chaining: If there is another platform connected in that direction, those outputs can become inputs for the second platform, and so on  
4. Platform actions  
   1. Platforms borrow valid platform actions from its contents (if one entity has manufacture action, the platform can automate manufacture)  
   2. Platforms borrow the summation of all content property values from their contents (this is what determines its specific capability for a specific platform action)   
5. Constraints  
   1. Entities on a platform cannot double up on the platform action. If three entities on the platform can manufacture, and the platform is automating manufacture, those entities cannot individually manufacture: their benefits are already rolled up (via properties) and automated and auto-organized  
   2. Welding is permitted to platforms but has limited-to-no-use since platforms already borrow actions and property values for its contents  
6. Crew  
   1. Every platform spawns a non-entity particle system for its crew and has a “crew” property that directly scales its efficiency modifier up/down  
   2. The main use case here is to make it more difficult for an adversary to \[commitment: PRESS, objective: transport\] a high-value item.  
7. Efficiency  
   1. Automatically scale their efficiency for platform actions that are also skilled actions (e.g. extraction), just like all other entities  
      1. Skilled actions are the predefined actions that increase efficiency or output exponentially every repeated turn  
   2. Crew plays a scaling role in its efficiency as well

### **How to use platforms**

1. **Draw:** Players draw a rectangle. It must be partially in a controlled zone. It cannot overlap another platform. The size is capped by how much mineral store the player has control of and is located nearby/overlapping the rectangle. The mineral store is used up instantly, starting with the lowest-density mineral stores (slag, not ore).  
2. **Add:** Players put (or weld, in rarer cases) entities onto the platform. Both count as contents.  
3. **Assign:** Players select a platform action (objective) from a menu. The platform gives the player intelli-sense per option: the output for this turn and estimated output next turn  
   1. Players can decide to do a platform action and turn the default “automate” off. For example “launch” could save players lots of steps transferring fuel around.  
4. **Automate:** Platform self-organizes to maximize the objective, and auto enqueues its platform action every tick if not cancelled or changed

### **Platform actions**

Available platform actions depend on what’s on the platform. 

Example objectives:

* **Extract:** Maximize resource extraction from overlapping well(s)  
* **Refine:** Convert crude volatiles to fuel  
* **Manufacture:** Convert mineral stores to new entities  
* **Store:** Maximize storage capacity and organization of inputs  
* **Launch:** Launch inputs to orbit using fuel anywhere on-platform  
* **Readiness:** Increase real posture to highest capability over time for each entity and body on platform \-- and keep them there. Select whether to use “hidden” or “hostile” and select what broadcast posture to use.   
* **(Unique to platforms) Reproduction:** Maximize crew growth

### **Input/output sides**

Each rectangle side can be designated as:

1. **Input**: Receives resources or entities from adjacent platforms/zones  
2. **Output**: Sends resources or entities to adjacent platforms/zones  
3. **Closed**: No transfer  
   1. This is an acceptable value for all four sides; inputs and outputs are self-contained and start from/remain on platform

This allows platform chaining. An extraction platform outputs to a refinery platform, which outputs to a storage platform, which outputs to a launch platform. Players design supply chains by connecting rectangles.

### **Platform efficiency scaling**

Platforms benefit from the same exponential scaling as individual entities: the longer a platform repeats a skilled action, the more efficient it becomes, exponentially. Changing the platform action resets the efficiency to whatever the base would be: based on its contents, content properties, the platform action, and the unique “crew” value.

**Why platforms matter**

Platforms are the answer to "how do I build a base without playing a spreadsheet game?" They are:

* Lego plates (drop entities together functionally)  
* Automation (no micromanagement of individual entity actions)  
* Specialization (each platform does one thing, increasingly well)  
* Connectable (input/output sides create supply chains)  
* Vulnerable (a rectangle full of value is a target)

The tradeoff: platforms are powerful but visible, near-impossible to move, and destructible. A player with platforms has infrastructure. A player with infrastructure has something to lose. Players do not need platforms to get a lot out of the game (see player archetypes\!). 

### **Platform crew**

#### ***Crew particle system***

Platform crews help the surface feel more alive. 

Crews are platform-tied particle systems of non-entities (not interactable). These particles meander around the platform in real-time while players observe it. They do not appear efficient like corporate particle entities do. The number of particles is equal to the crew number. Lightweight technical systems must be used here for visualization.

#### ***Crew effect on efficiency***

The core feature of a “crew” is that it directly scales the efficiency of whatever objective the platform has. The starting crew is proportional to the area of the platform (smaller platform, smaller crew). The crew passive growth equation and the platform efficiency equations are balanced such that the crew doesn’t quite grow as fast as players would probably like, forcing them to choose between reproduction vs other platform actions every once in a while.

#### ***Crew particles versus corporate particles***

Platform crew particles are not the same as corporate particle entities. Corporate particles are full entities: targetable, autonomous, following ink across the galaxy. Platform crew is purely local: non-interactive particles that represent the people living and working on a platform. They don't make decisions. They can't be individually targeted. They just... putter. Their presence scales the platform's efficiency, and their visual activity makes the platform feel inhabited rather than automated. The more crew, the more efficient the platform—but crews grow slowly, creating tension between the reproduction objective and every other objective.

## **Derived: Properties**

Properties are the bridge between primitives and play. Every property either:

1. (Physics) Mutates a physics formula  
2. (Permissions) or Affords or mutates a mechanical action

If it doesn't do one of these, it probably should not exist. 

### **Preface on body properties:**

Bodies are entities with a mutable property set, unique constraints (cannot maneuver into vacuum), a unique destruction condition (dies if in vacuum for any reason), and a unique action (encounter). 

Everything else that follows can apply to both bodies and entities by default unless altered by context or entity subtype. 

### **Actions that affect properties**

#### ***Weld***

The objective is the pure joy of players forming their own interplanetary Eierlegende Wollmilchsau.

1. Breaking the game is making the game  
2. Sure\! In late-game use every volatile on a planet to shoot your mashed-together city block of platforms, rigs, miners, containers, populations, and crazy power projection range (reach) — shoot that thing straight into the universe with a planet's-worth of fuel and see where your journey takes you.  
3. Welding is like smashing playdough together: total mutability with no arbitrary rules. Have fun welding\!

Welding creates summation: summation of floats, max(enum), and bools flipped true.

* Weld a tiny long-range sensor (mass: 2kg, reach: 10,000km) to a massive cargo hauler (mass: 50,000kg, reach: 10m)? Result: mass 50,002kg, reach 10,000km. You've built a ship that can hack from across the solar system. It costs a fortune to move (mass) but it works

You can weld mineral stores together (pure summation).

It can be undone.

#### ***Welding rules***

| Property Type | Welding Rule | Example |
| ----- | ----- | ----- |
| Float physics (mass, volume, force, capacity) | Sum | 50kg \+ 30kg \= 80kg |
| Float (range-like: reach, sightRange) | Max | 10km reach \+ 10,000km reach \= 10,000km reach |
| Boolean (permissions) | OR | canThrust:false \+ canThrust:true \= canThrust:true |
| Enum (postureCapability) | Union | \[dormant, idle\] \+ \[idle, active, alert\] \= \[dormant, idle, active, alert\] |
| State (zoom, vector, controller) | Recalculate | New entity inherits actor's location, zero vector, actor's controller |

##### 

##### Welding action requirements

* Actor must have: canWeld \= true  
* Target must have: canBeWelded \= true  
* Target must be within actor's reach  
* Both must be in same zoom level

##### Welding outputs

* New entity with combined properties  
* weldHistory populated with both source entities  
* isWelded \= true  
* Original entities cease to exist

##### Unwelding

* Any entity with weldHistory can be unwelded  
* Unwelding restores the original component entities exactly as they were  
* The combined entity ceases to exist  
* Unwelding requires canWeld on the actor and reach to the target  
* You can selectively unweld: if A+B+C were welded sequentially, you can unweld C, leaving A+B intact

#### ***Mod***

Modding is permanently fusing a mineral store into an entity. Unlike welding, modding cannot be undone. The mineral becomes part of the entity's structure.

**The resonance principle:** When you mod an entity, the mineral's mass resonates with the entity's strongest physics property. The boost flows into whatever the entity is already best at. You cannot choose the outcome, the entity's existing nature determines what improves.

##### Resonance rules

1. Identify the entity's *dominant property*: the physics property with the highest value relative to baseline  
2. The mineral's purity (mass ÷ volume) determines boost magnitude  
3. The dominant property increases by: `current_value × (purity × 0.1)`  
4. The mineral's mass and volume are permanently added to the entity

##### Resonance formula

```
dominant_property = physics_property with max(current_value / baseline_value)
purity = mineral_mass / mineral_volume
boost = dominant_property_value × (purity × 0.1)
new_dominant_property_value = dominant_property_value + boost
new_entity_mass = entity_mass + mineral_mass
new_entity_volume = entity_volume + mineral_volume
```

##### Modding example

Your scout drone has:

* mass: 5kg (baseline: 5kg, ratio: 1.0)  
* sightRange: 500km (baseline: 100km, ratio: 5.0) ← dominant  
* reach: 50km (baseline: 50km, ratio: 1.0)  
* planetForce: 10N (baseline: 10N, ratio: 1.0)

You mod it with a mineral store:

* mass: 2kg  
* volume: 0.5m³  
* purity: 4.0

Result:

* sightRange boost \= 500km × (4.0 × 0.1) \= 200km  
* New sightRange: 700km  
* New mass: 7kg  
* New volume: (original) \+ 0.5m³

Your scout just got better at scouting. It didn't get faster or stronger; it got *more of what it already was*.

##### Modding action requirements

* Actor must have: canWeld \= true (modding uses the same manipulation capability)  
* Target mineral store must be within actor's reach  
* Entity being modded must be within actor's reach (can be self)  
* Mineral store is consumed (destroyed)

##### Modding constraints

* Cannot flip permission booleans; modding amplifies magnitude, not capability  
* Cannot be undone; the mineral is fused into the entity's structure  
* Cannot mod with zero-purity minerals (volume but no mass \= slag, useless for modding)

##### What modding creates

Resonance creates *hyperspecialists*. An entity that's already fast becomes blazingly fast. A container that's already big becomes cavernous. A sensor that already sees far becomes omniscient.

This means:

* Generalist entities stay generalist (no single dominant property, small boosts spread unpredictably)  
* Specialist entities become hyper-specialists (dominant property runs away)  
* Welding before modding lets you shape an entity's "personality" before locking it in  
* Late-game entities are wildly asymmetric — incredible at one thing, mediocre at everything else

##### The modding discovery loop

* Early game: You mod your junker with whatever minerals you have. The results feel random. "Why did my rover get better sightRange? I wanted it to go faster."  
* Mid game: You realize the pattern. "Oh, this rover was already optimized for scouting when I found it. The minerals just made it more of what it was."  
* Late game: You're deliberately pre-welding entities to establish a dominant property before modding. You're manufacturing specialists. But you still can't fully control it; resonance rewards understanding, not spreadsheet.

##### Future modding version (0.0.2+): Mineral affinities

In a future version, minerals may have *affinities*: hidden properties based on extraction location that influence which property receives the resonance boost. Crater minerals might resonate with different properties than ridge minerals. This creates a second discovery layer: learning the landscape's secrets through experimentation.

For 0.0.1, all minerals are neutral. Resonance flows purely to the entity's dominant property.

### **Property types**

Properties fall into three categories:

| Type | What It Is | Data Types | Welding Rule |
| :---- | :---- | :---- | :---- |
| Physics | Feeds formulas, determines capability magnitude | Floats | Sum (or Max for range-like properties) |
| Permission | Gates actions, determines what verbs are available | Booleans | OR (if either has it, result has it) |
| State | Tracks current situation, not inherent capability | Various | Does not weld (recalculates or resets) |

#### ***Physics properties***

These are the sandboxes. They feed formulas. They compose arithmetically. They're the knobs players turn to build ridiculous things.

| Property | Unit | Welding Rule | Key Formulas |
| :---- | :---- | :---- | :---- |
| mass | kg | Sum | Movement range (force ÷ mass), Launch cost (mass × delta-Z), Transport limits |
| volume | m³ | Sum | Containment checks, Platform size (area ≤ volume ÷ 10m), Manufacturing output |
| planetForce | N | Sum | Surface movement range \= (planetForce ÷ (mass × gravity)) × atmosphere |
| spaceForce | N | Sum | Thrust delta-V \= spaceForce ÷ mass |
| fuelCapacity | kg | Sum | Maximum fuel storage |
| sightRange | km | Max | Vision distance — can you detect it? |
| reach | km | Max | Action distance — can you affect it? |
| containerCapacity | kg | Sum | Maximum mass of contents |
| containerVolume | m³ | Sum | Maximum volume of contents |
| maxLoad | kg | Sum | Maximum mass for transport/load/unload actions |
| maxVolume | m³ | Sum | Maximum volume for transport/load/unload actions |
| inOpacity | 0-5 | Max | Reduces visibility level of contents by this amount (5 \= invisible) |
| outOpacity | 0-5 | Max | Reduces visibility level for contents looking out |
| commitTargets | {body: N, entity: N, zone: N, max: N} | Sum per category | Maximum targets for PRESS/HOLD/SUPPORT |

#### ***Permission properties***

These determine what verbs an entity has. They compose via OR when welding—if either component can do it, the result can do it.

| Property | What It Unlocks |
| :---- | :---- |
| canTranslate | Can change position at all (if false, entity is fixed forever) |
| canTravel | Can move itself (if false but canTranslate true, can only be moved by others) |
| canThrust | Can thrust in space/orbit (requires fuelCapacity \> 0 and fuel) |
| canLaunch | Can leave surface to orbit |
| canLand | Can land from orbit to surface |
| canOrbit | Can exist on orbital rail |
| canExtract | Can pull resources from wells (scales exponentially with repetition) |
| canRefine | Can convert crude volatiles to fuel (output mass \< input mass) |
| canManufacture | Can convert minerals to entities (mass in \= mass out, volume in \= volume out) |
| canWeld | Can fuse entities together |
| canBeWelded | Can be target of weld action |
| canCommit | Can participate in PRESS/HOLD/SUPPORT |
| canAirlock | Can seal/unseal for vacuum protection |
| isContainer | Can hold other entities inside |
| canManeuverTarget | Can transport/load/unload other entities (zone only) |
| canVectorLock | Can grapple/dock with moving targets (space/orbit) |
| hasSight | Can observe (all observations roll up to player visibility) |
| hasScanner | Has repositionable sight origin (affords: Move Scanner, Scan) |
| canPassThrough | Contents can act through container (if false, contained entities have effective reach: contact only) |
| canDestroy | If false, immune to PRESS with objective: destroy |
| requiresAtmosphere | If true and atmosphere \= 0 and not airlocked: destroyed |
| canEncounter | Can initiate encounters (bodies only, always true for bodies) |
| canReproduce | Can generate new bodies (platform-only) |

#### ***State properties***

These track current situations, not inherent capability. They don't weld—they recalculate or reset based on the new entity's context.

| Property | What It Tracks | Notes |
| :---- | :---- | :---- |
| zoom | enum: space, orbit, zone | Current location type. Determines which coordinate system and which actions apply. |
| vector | (dx, dy) | Current momentum in space/orbit. Persists indefinitely (momentum is free). |
| fuelMass | kg | Current fuel load. Affects total mass. Consumed by thrust/launch. |
| realPosture | enum | Current readiness (dormant → idle → active → alert → hidden/hostile). Hidden until commitment resolution. |
| broadcastPosture | enum | Current bluff. Visible to all. Free to change. |
| postureCapability | enum\[\] | Which postures this entity can achieve. Mining rig: \[dormant, idle, active\]. Security unit: full set. |
| controller | UUID or null | Current owner (player or corporation). |
| provenance | UUID\[\] | History of past controllers. |
| isAirlocked | bool | Current seal status. If false in vacuum, bodies inside die. |
| isWelded | bool | Whether this entity is a weld result. |
| weldHistory | entity\[\] | Component entities (enables Unweld). |
| vectorLock | UUID or null | Target currently grappled/docked. |
| creationTick | int | When this entity was created. |

## **Primitives: Formula bank**

### **Formulas summary**

All game mechanics reduce to these formulas. Players don’t need calculators, the UI solves these. Understanding them enables optimization, exploitation, and creative play.

#### ***Assumptions***

1. No true physics; all euclidean  
2. No planet capture radii ever overlap  
3. No N-body problem  
4. Pocket check creates a distinct transition from space to orbit

#### ***Subsystems***

1. Space as vacuum table  
2. Capture as pocket check  
3. Orbit as fixed rail  
4. Retrograde/prograde/land as threshold gates  
5. Planet zones are in a pocket universes (distinct from space coordinate system)  
   1. Zones can convert to an orbit angle  
   2. Planets can convert to a single point and capture radius in space

#### ***Legend***

| Symbol | Meaning | Unit |
| :---- | :---- | :---- |
| m | Total mass (entity \+ contents \+ fuel) | kg |
| v | Volume | km³ |
| Fp | Planet force (surface movement power) | N |
| Fs | Space force (space thrust power) | N |
| g | Planet gravity | N/kg |
| A | Atmosphere (0-1 scale) |  |
| Z | Energy height (Z-axis value) |  |
| d | Distance | km |
| V | Vector(dx,dy) | km/tick |
| ω | Orbital angular velocity | °/tick |
| θ | Orbital angle | ° |
| R | Radius | km |

#### ***Formulas: Quick reference and UI notes***

| Question | Formula | UI Notes |
| :---- | :---- | :---- |
| How far on the surface? | (Fp / (m × g)) × A | UI: Player hovers possible locations →  The system calculates the closest valid point in the direction of the cursor based on m and g and Fp and A between origin → shows ghost icon at either current location or closet valid location |
| How much Δv in space? | Fs / m | UI: Player hovers possible delta-V inputs → ghost icon shows, state (space or orbit & over-Zone) shows, and new vector or orbit speed/angle show |
| Can I launch? | fuelMass ≥ m × (Zsurface \- 50\) × 0.001 | UI: Player hovers possible vertical F inputs (different input type than planet movement) →  The system calculates and displays whether launch is successful or not, what the derived orbital speed will be, and whether it will be enough to escape orbit easily the next day based on max thrust possible by this entity from remaining fuel, etc.  |
| Can I escape orbit? | ω ≥ sqrt(2 × g × Rorbit) | UI: Player hovers possible delta-V inputs →  High negative thrust: The ghost icon snaps off screen to a zone out of sight, shows name of landing zone on the planet surface  Just the right moon landing thrust: The ghost icon shows itself landing on a moon High positive thrust: The ghost icon snaps to a vector shooting out into space Low thrust, positive or negative: The UI creates a ghost icon further along the circle with updated over-Zone |
| Can I land on a moon? | (Δvrequired × m) ≤ available thrust |  |
| How much extraction? | base × 1.1^ticks |  |
| How much fuel from crude? | crude × 0.8 |  |
| Can I see it? | d ≤ sightRange AND (not hidden in own zone) | UI: Visibility is per-tick, per-observer. Properties feed formulas that determine what’s visible to whom. Visibility is both a bool (detect?) and a spectrum (how much?) |
| What detail level? | opticLevel \- Stage\_1\_modifier \- inOpacity | UI: Old information is clearly labeled for players. For example, if you observed an entity’s properties on tick 1, but on tick 2 cannot → those properties might be outdated. The UI clearly labels them “from one day ago” |
| Can I affect it? | d ≤ reach |  |

### **Movement formulas**

#### ***Surface movement formula***

How far can this entity move on a planet surface in one tick?

* range\_km \= (Fp / (m × g)) × A

#### 

| Input | Source | Effect |
| :---- | :---- | :---- |
| Fp | Entity property | ↑ force \= ↑ range |
| m | Entity property \+ contents \+ fuelMass | ↑ mass \= ↓ range |
| g | Planet property | ↑ gravity \= ↓ range |
| A | Planet property | ↑ atmosphere \= ↑ range; 0 \= vacuum (bodies can't traverse) |

Note: Surface movement costs time, not fuel. The gravity map creates local Z variation, so moving uphill within a tick costs more range than moving downhill.

#### ***Space thrust formula***

How much can I change my vector this tick?

* Δv \= Fs / m  
* Vnew \= Vold \+ (thrust\_direction × Δv)  
* Pnew \= Pold \+ Vnew

#### 

| Input | Source | Effect |
| :---- | :---- | :---- |
| Fs | Entity property | ↑ force \= ↑ range |
| m | Entity property \+ contents \+ fuelMass | ↑ mass \= ↓ Δv |
| Vold | Entity state | Momentum persists. Thrust adds to existing vector. |

##### Fuel cost of space thrust

* fuel\_consumed \= Δv × m × fuel\_efficiency\_constant

Note: Coasting (Δv \= 0\) is free and invisible. Thrusting makes you visible to any observer within sightRange.

##### The real phenomenon

In reality, gravity is an infinite gradient, every object attracts every other object. Ships would follow hyperbolic trajectories near planets. No edges. This is not what we will model, whatsoever.

##### The model: vacuum table

Treat all space as a frictionless pool table. Movement is vector addition. Passive movement occurs based on Vold. Gravity does not exist until you hit the "pocket" (the capture radius) of a planet. This creates a clean and predictable state machine for the player.

#### ***Orbit movement***

What happens when I'm on the orbital rail?

* θnew \= θold \+ ω (mod 360°)  
* Pnew \= (Rorbit × cos(θnew), Rorbit × sin(θnew))  
* zone\_overhead \= GetZoneFromAngle(θ\_new)

Note: Orbits are circular rails at Rorbit (planet capture radius). Entities move along the rail automatically at angular velocity ω.

##### Thrust on rail determines transition:

1. E \= ωold \+ Δvapplied  
   1. if E ≤ Vfall → Land (enter planet surface at current zone)  
   2. if E ≥ Vescape → Leave (exit to space tangent to orbit)  
   3. else:  
      1. → Stay on rail, ωnew \= E

| Threshold | Definition |
| :---- | :---- |
| Vfall | sqrt(g x Rorbit) x fall\_constant\* \*velocity below which you fall into the gravity well |
| Vescape | sqrt(2 x g x Rorbit)\* \*velocity above which you escape the gravity well |

##### The real phenomenon

Kepler's Second Law: objects move faster when closer to the body (periapsis) and slower when further away (apoapsis). Real orbits are ellipses, rarely perfect circles. I will not model this. 

To land, real spacecraft perform a "de-orbit burn" (retrograde) to lower their perigee into the atmosphere. To leave, they burn prograde to exceed escape velocity. We will model this; somewhat.

##### The game formula: “fixed rail” and “threshold gates”

Standardize all orbits to a single circular track (same radius as the capture radius per planet) on Rorbit.

Since we are on a "rail," we treat dV not as a physics simulation, but as a key to unlock one of three doors (stay, land, leave).

##### Extensibility

In a future version, I could implement Decay by subtracting a tiny constant from \\omega every tick:

* ωnew \= ωold \- decayRate, where if ω \== 0 → land

### **Transition formulas**

#### ***Launch (surface → orbit)***

Can I reach orbit? How much fuel does it cost?

##### Validity check

can\_launch \= canLaunch AND canOrbit AND fuelMass ≥ fuel\_required

##### Fuel cost

fuel\_required \= m × (Zsurface \- Zorbit) × launch\_efficiency\_constant

| Input | Source | Notes |
| :---- | :---- | :---- |
| Zsurface | 1000 x g x local\_gravity\_modifier | Varies by position on gravity map (“mountains” \= lower Z, cheaper launch) |
| Zorbit | 50 (constant) | All orbits have the same Z value |
| m | Entity total mass | Every kg costs fuel to lift |

##### Output

1. θinitial \= GetAngleFromZone(launch\_zone)  
2. ωinitial \= launch\_ratio × base\_orbital\_velocity  
3. where launch\_ratio \= (fuel\_burned / fuel\_required)

Note: Higher fuel burn \= faster initial orbit \= easier to escape orbit next tick.

Note: Because Mass multiplies ΔZ, launching heavy fuel tanks from a surface (High Z cost) is punishingly expensive. Players will naturally realize: "I should launch an empty ship (Low Mass) and fill it up in Orbit (Low Z cost) using Volatiles mined elsewhere/from asteroids (already in Low Z)."

##### The real phenomenon

Rocketry is governed by the Tsiolkovsky rocket equation: burn fuel to generate dV. If dV \< Vescape, you fall back down. 

##### The game formula: “pocket universe”

Other games would try to weld the planet scale into the space scale. We do not need to do that. We can have 2 simple location subsystems with distinct transitions and conversions between them. 

Planets have distinct coordinate systems, completely separate from the main space one. 

Every point on a planet can convert to:

1. **A zone-derived point in orbit:** Every point in one zone maps to a normalized, fractional segment of the fixed rail. Every point in the zone really maps to the first point on the segment. The game auto-slices the fixed rail into normalized segment lengths based on the number of zones: simplicity and reduction  
2. **A single point in space:** Every coordinate on-planet is considered identical to one another and equal the planet’s origin point on the space-level zoom

##### The game formula: “vertical launch gate”

This subsystem bridges the two movement modes: "Planet x and y" (Planet) and "Passive/Angular/Space x and y" (Orbit). We compare the entity's force output against the planet's gravitational grip for that entity. This makes the omega ω dynamic: if players achieve a high speed launch they’re more likely to escape orbit on a sooner turn if that’s their desire.

##### The game formula: simple planetary properties

On a planetary surface, movement is work performed against friction and gravity over time. Higher gravity increases weight (W=mg), making movement harder. Atmosphere creates drag but also allows for traction/lift depending on vehicle type.

#### ***Land (orbit → surface)***

Can I land? What does it cost?

##### For planets

1. fuel\_cost \= 0  // Falling is free (aerobraking)  
2. landing\_zone \= GetZoneFromAngle(θ\_current)  
3. landing\_position \= random point in zone OR nearest platform

##### For moons (docking required)

1. fuel\_cost \= m × Δv\_required  
2. where Δv\_required \= |ω\_entity \- ω\_moon|  
3. can\_land \= (Δv\_required × m) ≤ available thrust this tick

Note: You must match the moon's orbital velocity to land on it.

#### ***Escape (orbit → space)***

Can I leave orbit? What does it cost?

fuel\_required \= m × (Vescape \- ωcurrent) / Fs

Note: Can accumulate over multiple ticks: each tick's thrust increases ω until ω ≥ V\_escape

##### Output

1. Pspace \= planet\_center \+ (Rorbit × direction(θcurrent))  
2. Vspace \= tangent(θcurrent) × ωcurrent

You exit tangent to your orbital position, carrying your orbital momentum as a space vector

#### ***Enter orbit (space → orbit)***

What happens when I cross a capture radius?

1. if distance(entity, planet\_center) ≤ R\_capture:  
   1. θentry \= atan2(Pentity \- planet\_center)  
   2. ωentry \= |Ventity| × orbital\_conversion\_constant  
   3. entity transitions to orbit state

Capture is automatic. Your space velocity converts to orbital velocity.

### **Resource formulas**

#### ***Extraction scaling***

How much do I extract per tick?

* volume\_extracted \= base\_extraction\_volume × (1.1 ^ consecutive\_ticks)  
* mass\_extracted \= volume\_extracted × well\_density

| Input | Source | Notes |
| :---- | :---- | :---- |
| base\_extraction\_volume | Entity property (from canExtract capability) | Fixed per entity |
| consecutive\_ticks | State (resets on well change or interruption) | Exponential scaling rewards sustained presence |
| well\_density | Resource well property | Varies by well; determines mass-to-volume ratio |

##### 

#### ***Purity of extracted minerals***

* purity \= mass\_extracted / volume\_extracted

Note: High purity \- dense ore (efficient to transport or launch). Low purity \= bulky slag (good for large containers, platforms, etc.).

#### ***Refining (crude → fuel)***

How much fuel do I get from crude volatiles?

1. fuel\_output \= crude\_input × refining\_efficiency  
2. where refining\_efficiency \= 0.8 (constant for 0.0.1)

Refining always loses mass. 100kg crude → 80kg fuel. 

#### ***Refining scales with repetition***

refining\_rate \= base\_refining\_rate × (1.05 ^ consecutive\_ticks)

#### ***Manufacturing conservation***

What can I build with these minerals?

1. output\_mass \= input\_mass  
2. output\_volume \= input\_volume  
3. output\_properties \= f(input\_mass, entity\_template)

Manufacturing is reshaping, not creation. More input mass \= more/better properties on the output entity. 

Use the AI FLAVOR primitive at UTC0 to generate a world-acceptable name for an entity. 

Manufacturing scales with repetition. 

manufacturing\_rate \= base\_rate × (1.05 ^ consecutive\_ticks)

#### ***Modding (resonance)***

How much boost does this mineral give to the target entity?

1. dominant\_property \= property with max(current\_value / baseline\_value)  
2. purity \= mineral\_mass / mineral\_volume  
3. boost \= dominant\_property\_value × (purity × 0.1)  
4. new\_property\_value \= dominant\_property\_value \+ boost  
5. new\_entity\_mass \= entity\_mass \+ mineral\_mass  
6. new\_entity\_volume \= entity\_volume \+ mineral\_volume

Modding amplifies what the entity is already best at. Cannot flip boolean ‘permissions’ properties.

### **Visibility formulas**

Visibility has two stages: detection (binary) and recognition (level).

#### ***(Stage 1\) Detection***

Can I see X exists?

1. is\_detected \= (d ≤ sightRange)   
   1. AND NOT (target.realPosture \== Hidden   
      1. AND target controls zone)

| Condition shortcode | Condition | Result |
| :---- | :---- | :---- |
| H0 | Target not hidden | Always detected if distance passes formula |
| H1 | Target hidden \+ target in your own zone | Visible, positive modifier to visibility level (improve observer’s baseline optic level) |
| H2 | Target hidden \+ target in a neutral/3rd party zone | Visible, negative modifier to visibility level (degrade observer’s baseline optic level → potentially down to undetected) |
| H3 | Target hidden \+ target in the target’s zone | Completely invisible ("traps always work") |

##### 

Space-specific: Coasting entities (no thrust this tick) are invisible regardless of sightRange.

#### ***(Stage 2\) Recognition***

What visibility level (of detail) do I see?

* visibility\_level \= observer.opticLevel \- target\_container.inOpacity

| Optic level | What you see |
| :---- | :---- |
| 1 | Exists, broadcast posture, location, and replay the action(s) it took at UTC0 |
| 2 | Player controller, type, and name of entity |
| 3 | Physics properties |
| 4 | Permissions properties \+ fact that there are contents or not |
| 5 | Possible actions this tick |
| 6 | All contents (if there are any) |

##### 

##### Hidden posture advantage (see Stage 1): 

1. Condition H1 increase the optic level of observers by 1  
2. Condition H2 decreases the optic level of observers by 1

##### Visibility of Thrust (Burns)

1. burn\_visible \= (fuel\_consumed \> 0\)  
2. burn\_detection\_range \= base\_sightRange × (fuel\_consumed / detection\_constant)

Note: Burns create temporary detection signatures that extend observer sightRange for that entity.

### **Action validity**

#### ***Reach check***

Can I affect this target with this action?

* can\_affect \= distance(actor, target) ≤ actor.reach

#### ***Target check***

You can affect what you can A) see AND b) reach. 

### **Energy accounting**

#### ***What costs fuel***

| Action | Fuel cost |
| :---- | :---- |
| Thrust (space/orbit) | Δv x m x efficiency\_constant |
| Launch | Yes, m x (Zsurface \- Zorbit) x efficiency\_constant |
| Land on moon | Yes, m x Δvdocking |
| Land on planet | 0 (aerobraking) |
| Surface movement | 0: costs time, not fuel |
| All other actions | 0 |

##### 

#### ***Mass accounting***

* total\_mass \= base\_mass \+ contents\_mass \+ fuelMass

Fuel has mass. More fuel \= more range potential, but less maneuverability (Δv \= F/m).

Note: the staging tradeoff: 

* Adding fuel extends range but increases mass, reducing Δv per tick. Eventually, adding more fuel provides diminishing returns. Optimal strategy: launch light, refuel in orbit.

### **Platform efficiency**

How does crew affect platform output?

* platform\_output \= base\_output × skill\_multiplier × crew\_multiplier  
* skill\_multiplier \= 1.1 ^ consecutive\_ticks\_same\_action  
* crew\_multiplier \= 1 \+ (crew / crew\_scaling\_constant)

Larger crew \= higher efficiency, but crew grows slowly. Changing platform action resets skill\_multiplier.

### **Constants (tuning values)**

Balance levers. Set during playtesting.

| Constant | Default | Purpose |
| :---- | :---- | :---- |
| fuel\_efficiency\_constant | 0.01 | Scales fuel cost of thrust |
| launch\_efficiency\_constant | 0.01 | Scales fuel cost of launch |
| fall\_constant | 0.7 | Threshold for landing |
| orbital\_conversion\_constant | 0.5 | How space velocity converts to orbital velocity |
| refining\_efficiency | 0.8 | Mass retention when refining |
| detection\_constant | 100 | Scales burn visibility range |
| crew\_scaling\_constant | 10 | How crew scales efficiency |
| base\_orbital\_velocity | 10 | Starting ω for launches |

##### 

## **Generative: AI primitives**

| AI primitive | Context | What it does (output) |
| :---- | :---- | :---- |
| Crafter | Expert in semantic/euclidean primitives | Initializes new entities (from novel composites of primitives) |
| Designer | Expert in semantic/euclidean primitives and all AI primitives | Creates **encounters**, a type of metaentity that can represent anything from a place to chat to a point-of-interest to a fortification. They contain a set of nodes designed from **primitives**, **composites**, **choices**, **agents**, **and risks and rewards**. |
| Narrator | Expert in the human-penned worldbuild | Creates appropriate **flavor text** when called upon in the game designer’s style |
| Agent | Autonomous “player” | Takes available **actions** just as a player would in accordance with its personality graph and moral arc. For players, the personality graph is an output. For agents, the personality graph is an input. |
| Arbiter | Ethics | Upkeeps the **personality graph** and **moral arc** of player bodies\* (half-baked) |

---

# **Companies**

Emergent player slang:

1. *“Don’t cross hot ink”*  
2. *“Stop for ice cream”*  
3. *“You gotta give \[milk\]”*

The objective of this feature is to satirize and ridicule private equity firms, technocrats, oligarchies. While modeling how much pure power they have. The companies and agents of companies seek to consolidate into a megacorp that spans the galaxies and squeezes everything out of everyone. 

Companies are meta-agents; typically, a mix of agents, including CEOs and board members, that are autonomously playing the same game as the players. 

They can be extremely influential and powerful.

They have shares that guarantee a proportional share of the proceeds (bonds) if there are profits. The value of the shares and the value of the bonds are set by the market. 

## **Companies introduction: The anthill economy**

Companies are not traditional corporate entities. They are emergent superorganisms modeled on ant colony dynamics, operating at scales that dwarf individual players while remaining mechanically simple.

## **Design principles**

1. **Core satirical premise**: the universe’s dominant economic actors are as irrational as (I believe) most firms to be. They are blind consumption engines, ant colonies that are finetuned to do one thing: **consume the universe’s Energy**. All of it. As fast as possible. They are not trained to hoard Energy: they’re trained to maximize \*consumption\* by finding sweetmeat locations as close to breakeven Energy gain/Energy cost as possible. They’re not looking for maximum profit, they’re looking for breakeven. So they will prioritize sweetmeats far, far away as long as they’re big enough: this grows their “revenue” and “expenses” equally, growing their “company” and “valuation”. Essentially, ant colonies in MESH95 are companies trying to hyperscale while having a positive, as close-to-zero cash flow as possible.  
2. **Sink-only**: Companies do not create any real value in the system, but they do maximize control of resources (sweet, meat) to ultimately maximize \*consumption of Energy\* (growth at all cost). This is why, for a time, companies’ shares will be worth something, but also why the players of MESH95 are ultimately doomed: these entities will exponentially suck every volatile from the universe and refine it just to fuel as many breakeven expeditions as possible.  
3. **Consolidation as core consumption play:** Companies are feudal structures and can have multiple hills (“uphills”). Left unchecked, companies naturally consolidate. Late-game universes might have one single dominant megacorp with trails spanning everything. This is the satirical endpoint, players can sometimes delay, rarely prevent, and always decide to join-in: sweetmeats for milk.  
4. **Player experience:** Players should feel like just one more particle of sand on a beach of raw corporate power. They’re rodents navigating between trails of giants. The universe is a farm.   
5. **Technical constraint:** The simulation must be computationally trivial while producing emergent, visually overwhelming behavior. Thousands of particles, simple rules.   
6. **Players as livestock (aphids)**: Companies farm players. Players extracting from company-controlled zones or from company-mined asteroids are offered a choice to pay a % of resource gains as “milk”. Failing to do so provokes aggression.  
7. **Symbiotic extraction:** A core tension is that players want to grow assets and influence, but that requires resources, which tend to be in company control over time, so operating there means feeding the company first in order to feed yourself a little.   
8. **Premium on discovery:** The milk taxes must be absolutely ruthless (values like 99% would be hilarious). This means that the core benefit of successfully extracting and hauling resources in general is huge. It’s an outsized reward reflecting the risk and Delta-V costs of real deep-space logistics accurately. This puts a *stunningly* big premium on discovering your own new sweetmeats and protecting them at all costs. But you can also follow ink and even after a 99% tax → if you successfully extract & use the resources, you’ll still grow. 

## **Emergence objectives**

If I see these patterns, it’s working. 

* Players could conceivably “hitch a ride” with a body on a company particle entity…  
* Players could conceivably thwart company discovery of their sweetmeat sites by destroying lone bugs as fast as possible (and without biters nearby, the aggression is never discovered)  
* Players could conceivably destroy ink by precisely moving/destroying luggers and/or nearby biters to let the ink decay  
* Players could attempt to get an aggro’d company acquired, sabotage it to trigger its acquisition, etc. 

## **Naming and icon**

* Procedurally-generated unique name and icon

## **Corporate glossary**

| Ant colony element | Company element | Mechanical function |
| :---- | :---- | :---- |
| **“mother”** queen ant | the board (entity) | positioned uphill |
| **“bruiser”** queen’s guard | security detail of the board | hostile (and hidden?) enforcers in uphill zone, ready to HOLD DOUBLE DOWN on the mother, brood, and pantry (in that order) |
| **“pantry”** | entity with volatiles and minerals storage capability | Energy, sweet, and meat stores |
| **“meat”** | resource extraction point | minerals source (vector \+ time location of asteroid \== future location per particle to calculate correct vector) |
| **“sweet”** | resource extraction point | volatiles source (coordinates of planet and coordinates in zone → closest capture point → calculate correct vector) |
| **“uphill”** anthill | a corporate HQ (company-controlled zone with key features and entities) a company can control unlimited uphills | company-owned, sweet-rich zone containing mother entity, workers, pantry, brood. entities spawn here and launch from here when enough potential energy \+ sweet/meat exists |
| **“downhill”** secondary smaller “anthills” | a satellite (entity) in orbit that collects lots of little packets of sweetmeats and more efficiently sends timed (wait for over-zone), larger-capacity luggers between it (in orbit) and the uphill (in-zone) a company can control unlimited uphills | company-owned entity in orbit around an uphill planet with a small pantry for storage. This optimizes for more efficient dropoffs and returns from asteroids or other planets. luggers don’t have to wait for their orbit to be over the right zone. And downhills can send more sweetmeats at once in larger packets on bigger luggers. they cannot spawn on their own, only broods can. if destroyed, luggers en-route go direct-uphill instead |
| **“brood”** | spawn point (entity) | every tick, a brood generates particle entities if available sweets and meats permit |
| **“kitchen”** | mineral or volatiles refinery (entity) | an entity that converts volatiles into  |
| **“ice cream shop”** | refueling depot (entity) | asteroid-like entities that afford particle entities a refuel player entities can choose to refuel here, too → pricing is set simply but dynamically price \= base × distance\_to\_nearest\_uphill |
| **“hot ink”** pheromone trails | the telltale sign of a fortune being made, leading either to a meet-producing asteroid or to a planet (then to a sweet-producing coordinate on that planet in a particular zone)  | particle entities create a small constant decay → when overlayed they’re brighter and hotter, indicating an active high-value trail when hot ink is gone, the company “forgets” about the sweetmeat site completely |
| **“luggers”** worker | workers (particle entity) | trail-following, extract sweets and/or meats, efficiently drop-off and then repeat, also report when resources are depleted has constant, short sight Distancesmall |
| **“biter”** soldier | enforcers (particle entities) | trail-following escorts of luggers, triggered defense/offense response triggers: **no milk:** a player cuts in on a company claim without paying **“milk”** and it’s IN-SIGHT of at least 1 company particle → this causes every company particle entity in the future to go aggro. If a company particle entity sees that player’s entity to A) pursue the player entity until one or the other is destroyed B) when possible, DOUBLE DOWN PRESS (destroy) any of that player’s entities ever spotted again **sabotage:** a player PRESSED a company asset → check for which particle entities were PRESSed plus all particles who saw it → and then all of those particle entities are now aggro against the player’s entities and will pursue and DOUBLE DOWN PRESS. But the company itself is not aggro against the player.  This means it’s much worse for players to fail to give milk (difficult, very risky) than it is to destroy isolated company assets (easy, not risky). This models the satire accurately: companies don’t care about its individual employees, only the bottom line. has constant, medium sight Distancemed |
| **“bug” and “deadbug”** scout | rangers (particle entity) | companies look for sweetmeats stochastically; no pathfinding. one-way trip (planned destruction at Energy \== 0). on creation, picks an untried vector for that company from that spawn point and starts the journey, spending fuel every turn. If it discovers sweets/meats, it “relays coordinates/vectors and pilesize” which mechanically means that the company is now aware of where to go and how big the pile is.  the universe fills with trash: the still-hurtling vectors of **deadbugs** has constant, longer sight Distancelong |
| **“milk”** | accounts payable | the % of resource extracted on ANY company claim that is due to the company; the remainder an aphid can keep |
| **“aphid”** | symbiotic extraction | a player paying the “milk” (% of mineral) due to a company in order to extract resources in-view of company assets AND from a sweet/meat site with a “company claim” (defined as one that’s been extracted at least once by one company particle) |
| **“honey”** | companies contract unprofitable routes to players | Because of Delta-V calculations, companies don’t always run down every sweetmeat found by bugs. When the size of the sweetmeat is smaller than the REAL energy cost of sending the luggers to fetch it (think negative cash flow)… they’ll issue contracts. e.g.:  *Company Alpha offers Xylophone shares to first to deliver Yankee kilos of sweet/meat from asteroid Beta to satellite Zed* |
| **“stake”** | company claim of a sweetmeat site | “company claim” is a resource site that’s been extracted at least once by one company particle |

## **Ant colony visual rendering**

In space mode:

1. Company entities are particles at space coordinates and with vectors and input thrusts; just like every player’s entities in space  
2. To make the space feel more alive, players see a preview of where all company particles are headed as they loop slowly over and over. (e.g. every particle loops over a dotted line representing its real route at the next UTC0)  
3. Ink renders as faint lines where alpha \== decaying intensity based on \# of particles that have traveled here  
4. Trails are emergent rivers of moving company particle entities

It should look like a petri dish under a microscope. 

## **Merger mechanics**

### **Bottoms up**

Principle: “Hotter ink wins”

* During UTC0, when a company particle entity collides with another company’s ink… whichever ink is stronger wins the loyalty of that particle entity, and that particle entity is now A) an entity controlled by the stronger ink company and B) instantly inputs the thrust required to join the trail with the correct vector to make it to the ink’s endpoint

### **Tops down**

* During UTC0, if the derivative of a company’s Energy consumption is negative (falling futures), it is purchased by the nearest company neighbor.   
* All assets change companies.  
* The acquired company’s active aggro towards players who didn’t give milk is gone. That player will not aggro the acquiring company’s assets, even those that were acquired from the aggro acquired company. (This of course would not work if the player has also aggro’d the acquiring company).   
* All shares of the acquired company are now shares of the acquiring company.

### **Merge**

* If two companies at UTC0 are discovered to have a claim on the same sweetmeat site, they merge.  
* Both companies cease to exist, replaced by Company C with combined assets  
* The new company inherits company-level aggros towards all players of both companies  
* All shares of both companies are now shares of the new company

# ---

# **Extraction**

## **Resource roles**

### **Overview of resource roles**

1. Volatiles \= Energy (fuel to cover launch and thrust)  
2. Minerals \= Mass (manufacturing)

### **Comparison of resources**

| Aspect | Volatiles | Minerals |
| :---- | :---- | :---- |
| Purpose | Fuel (burned to move) | Mass (spent to build) |
| Data type | Property value on carrier bodies/entities | Entities themselves (think FedEx packages of varying shape and size) |
| Refining | Required (crude → fuel) Refining reduces mass | Not required (mass is mass) |
| Best source | Moons (rich source wells) | Asteroids (no gravity) |
| Worst source | Planets (gravity kills margins) | Planets (same reason) |
| Company priority | Volatile-rich moons and asteroids Volatiles on HQ planet | Mineral-rich asteroids Minerals on HQ planet |
| Player opportunity | Undiscovered moon wells | Speed: grab asteroid minerals before companies claim them |

### **Asymmetric ramifications**

This creates an interesting resource asymmetry:

1. Volatiles are the bottleneck for movement. You can have all the minerals in the universe, but without volatiles you can't move them anywhere.  
2. Minerals are the bottleneck for growth. You can have all the fuel in the universe, but without minerals you can't manufacture new entities or improve existing ones.

Companies optimize for volatiles (because consumption \= movement \= growth). Players who want independence need to secure both, which is nearly impossible without either paying milk or finding unclaimed sources.

## **Volatiles**

1. Volatiles (kg) must be refined (action) into fuel (kg)  
2. Volatiles are not an entity in itself but rather a property value on fuel-carrying entities  
3. Volatiles do have weight and affect the carrying entity  
4. It’s simple to transfer volatiles between fuel-carrying entities where one or both entities have reach of the other  
5. It’s simple (an action) to jettison fuel (decrement the fuel stored) on an entity with any fuel

You burn fuel only when you launch or apply delta-V. That’s it.

* Explanation: Surface movement is “free” in-that there’s a computed distance per tick, so it costs time

Volatiles play into game tension: The easier something is to reach, the more likely that companies already found it, claimed it, and extracted it dry. But the harder something is to reach, the less it's worth reaching.

| Volatiles source | Flavor | Volatiles distribution | Procedural generation notes for volatiles |
| :---- | :---- | :---- | :---- |
| Asteroids | **Water ice** | Highest concentration and accessibility (if delta-V is low per asteroid). Specific C-type (carbonaceous) asteroids can hold up to 20% of their total mass as **water ice**.  | **Gist:** Occasional, bottomless gas stations Either resources are available or not (models three asteroid types: worthless, mineral, volatile) If resources are available, it’s either volatiles or minerals; never both If volatiles are available, they’re a high % of asteroid mass (5-20%) Future versions: More shallower wells that sum to a large overall mass.  |
| Moons | **Vapor compounds** | High total mass, localized concentration (models shadow regions). Some outer-system icy moons can be nearly 100% volatile.  | **Gist:** Looking for oilfields All resource wells on moons are either primarily mineral or volatile. But all resource wells on moons have a small quantity of the other that comes up in proportional quantity when the well is extracted.  Volatile resource wells on moons are almost always available (almost always at least 1 on every moon) However, there are very, very few volatile resource wells. Each one is extremely rich.  Resource wells should appear in pole zones or crater zones |
| Planets | **Subsurface ice** | Massive Total Amount (Atmosphere/Oceans), but Inaccessible for Export. For inner planets (Mars), the total resource amount is massive, primarily as subsurface ice. For Earth, it's essentially zero available for space logistics due to the massive gravity well.	 | **Gist:** Wealth calculated to cost too much to move Massive total amounts Use the planet conditions and gravity well to reverse-engineer the total amount on-planet. Solve the formula to optimize for zero-to-very-low energy gain after hauling volatiles off-planet Uneven well depth (shallow-to-deep) Fairly even distribution of wells across surface |

## **Minerals**

Minerals abstract bulk structural silicates (rock) and high-value metallic elements (iron, platinum-group metals or PGMs).

1. Minerals cannot be refined  
2. Minerals exist as entities (mineral store)  
3. Minerals (kg) are used for manufacturing (make new entities) and modding (mutate entities)  
4. **Extraction of minerals is a scoop**. Extraction of minerals is determined by a set X volume  
5. **Manufacturing minerals is about mass.** Manufacturing cap is mass-driven  
6. "Mineral stores" are entities in every sense: properties (volume, mass), translation, transport. Think of them as varying-shaped FedEx packages that players must tactically manage.  
   1. Purity emerges from the ratio of mass to volume. A dense packet is high-purity ore; a bulky packet is mostly slag. This creates strategic choices: high-purity stores are efficient to launch (less volume per kg), while low-purity stores may be useful for manufacturing large-volume entities on-surface. Welding low-purity minerals to an entity bloats it with useless mass.  
7. When manufacturing, input mass determines output mass and output features (purely: more properties, higher values). Input volume determines output volume.

| Minerals source | Flavor | Minerals distribution | Procedural generation notes for minerals |
| :---- | :---- | :---- | :---- |
| Asteroids | **Metallic ore** | Variable, but Unique Concentration. The sheer number of asteroids means their total raw mass is immense. The key is their concentration of rare metals (e.g., M-Type asteroids). Bulk rock is abundant, but the raw percentage of high-value PGMs is extremely low (ppb \- parts per billion). | **Gist:** Free lunch. Either resources are available or not (models three asteroid types: worthless, mineral, volatile) If resources are available, it’s either volatiles or minerals; never both Minerals are always available with a small total quantity per asteroid, and companies claim these quick Purity: Always varies along a probabilistic curve, but much higher purity curve than planets |
| Moons | **Regolith metals** | Medium concentration, high total mass. Metals mixed with ice. Requires surface operations but low gravity makes export viable.  | **Gist:** The middle game. All resource wells on moons are either primarily mineral or volatile. But all resource wells on moons have a small quantity of the other that comes up in a proportional quantity when the well is extracted Mineral resource wells on moons are often available, medium concentration. Requires extraction infra (entities and/or platforms). Gravity well exists but manageable. It’s great for sustained operations, not quick raids Purity: Significant variation, sometimes close to asteroids and sometimes lower than planets. Moons are always a gamble. |
| Planets | **Core metals** | Highest total mass, lowest accessibility. Metals exist in abundance but are buried deep and trapped in maximum gravity wells (lowest points on the planet’s Z-axis).  | **Gist:** Theoretically infinite, practically zero Massive total amounts. Amount per resource varies along a reverse logarithmic curve tied to gravity well (resource wells lower on planet’s gravity map have much larger amounts). Launch cost exceeds value for most operations. Only viable with extreme infrastructure or for local use only (e.g. platform infra). Use the planet conditions and gravity well to reverse-engineer the total amount on-planet. Solve the formula to optimize for negative gain to haul volatiles off-planet Purity: Always varies along a probabilistic curve, but much lower purity on planets compared to asteroids |

### **Minerals: Purity**

#### ***When to use slag vs ore?*** 

Slag and ore are emergent concepts along a probabilistic curve and based on source, not true types. 

| Operation | What you want | Why |
| :---- | :---- | :---- |
| Launch off-planet | High purity (high mass for low volume) | You’re paying a Z-axis energy cost per kg. So ore is more mineral per energy spent launching.  |
| Manufacturing | Depends on goal | Hoping to build a large entity with fewer features that can contain other entities (container) or transport them (crane)? Slag gives you more volume for less manufacturing cost (based on mass).  Hoping to build a rocket engine to weld onto a container to “make” a rocketship? High purity gives you more features at lower volume.  |
| Modding | High purity | When you weld minerals to an entity, you’re adding both its mass and volume to that entity. For two mineral stores of equal “real” mineral mass, one is mostly slag and the other mostly mineral:  A lower purity mineral store gives you no functional benefit over the other And the lower purity mineral bloats the volume of the target entity (making it harder to “fit” in other things, etc.) |

### **Minerals: Extraction and manufacturing**

Some entities have capability to extract:

1. If so, they will extract exactly X volume of mineral for a particular tick  
2. Extraction capacity scales exponentially with repetition. Entities get faster, faster, the longer they work the same task (it resets to base on interruption)  
3. But the mass per volume varies on a probabilistic curve, creating an organic variety of mineral store entities

Some entities have capability to manufacture:

1. If so, they can manufacture Y max mass of stuff for a particular tick  
2. Extraction capacity scales exponentially with repetition. Entities get faster, faster, the longer they work the same task (it resets to base on interruption)

Manufacturing is conservation, not creation. Mass in \= mass out. Volume in \= volume out. What changes is structure: inert mineral becomes functional entity. What properties and values are instantiated with the mass budget? 

### **Minerals: Modding**

Modding (fuse mineral store to entity) is a subtype of welding (fuse two entities). 

* You can weld two mineral stores together  
* Since all welding is reverseable, you can split a mineral store out of a larger mineral store if it was welded at one point  
* But you cannot split an atomic mineral store that came right out of a resource well

Some entities can mod themselves and other entities (using mineral stores, if there are some in reach).

Based on the mass of the mineral, it CRUDs properties of the target entity. 

# ---

# **Economies**

## **Economies are distributed**

Commerce in MESH95 models distributed emergence with no central authority. There is no bank, no exchange, no universal currency. Players don't "have" money. They control entities that might contain value, and they hold paper that might be worth something.

## **Core Principles**

1. **No fiat currency.** There are no universal credits. The only fungible instruments are company shares and company bonds.  
2. **Control, not possession.** Players don't "have" resources. They control entities that carry or contain them. Transferring an entity transfers control. But doesn't move it physically.  
3. **Real-time commerce.** Between UTC0 ticks, players can trade instantly. Commerce is the *only* game state change that happens in real-time.  
4. **Everything is a commodity.** Entities, information, contracts, shares, bonds: all tradeable.  
5. **Information has value.** What you know can be sold. What you've seen can be gifted. Intelligence is a commodity.

## **Commodities: What can be traded**

| Asset Type | What It Is | Transfer Speed | Notes |
| :---- | :---- | :---- | :---- |
| Entities | Any entity you control | Instant (control) | Physical location doesn't change. You bought a satellite, now go fetch it. |
| Zones | Any zone you control | Instant (control) | You instantly get the benefits (e.g. visibility) of controlling that zone |
| Mineral stores | Entities containing mass | Instant (control) | Same as entities. The minerals don't teleport |
| Volatiles | Property on fuel-carrying entities | Instant (if either entity is within reach of the other) | Transfer between entities requires reach (one-way only: fuel can be pumped out or pumped in) |
| Special: Fuel Station | The only entity-level contract; a special form of contract | UTC0 | On any entity with fuelStoreMass you can set a price for fuel, and any entity can Refuel in reach of your asset automatically if they pay the preset cost |
| Company shares | Ownership stake in a corporation | Instant | Earned through contracts, tradeable freely |
| Company bonds | Payout rights from company profits | Instant | Earned by holding shares, tradeable freely |
| Intelligence (Intel) | Anything you've observed: you can click on another player or corporate body/entity, a moon, asteroid, resource well, zone and the game easily commodifies it for you with an instant action (**Trade Intel**) | Instant | Bodies, entities, players, contracts, queued actions |
| Contracts | Agreements with obligations/payouts | Instant (creation) | Fulfillment may take time |

## **Shares and bonds**

The only fungible instruments in the game. Their value is determined entirely by players and market dynamics.

Shares:

* A \# that represents a % ownership stake in a corporation  
* Earned primarily through completing company contracts (delivering honey for example)  
* Can be bought/sold between players at any agreed price  
* Holding shares generates bonds proportional to company “profits”  
* If a company is acquired, shares convert to acquiring company's shares  
* If a company merges, shares convert to new merged company's shares

Bonds:

* Represent payout rights from company profits  
* Generated passively by holding shares (more shares \= more bonds per tick)  
* Can be redeemed for  
  * Fuel from corporate refuel entities  
* Can be traded between players  
* Value might organically fluctuate based on company health; a dying company's bonds are worthless

The incentive loop:

* You complete contracts for Company A → earn Company A shares  
* Company A profits → you receive Company A bonds  
* You want Company A to succeed → you help them (or sabotage rivals)  
* Company A consolidates competitors → your shares become more valuable  
* Late-game: megacorp emerges → early shareholders control the economy

The risk:

* Company acquired while in decline → shares convert at unfavorable ratio  
* Company destroyed (if possible) → shares worthless  
* Backing the wrong company → stranded with illiquid paper

## **Commerce is real-time**

Commerce is the *only* real-time, global game state change between UTC0 ticks.

What happens instantly:

* Transfer control of entities  
* Transfer shares and bonds  
* Gift or sell information  
* Create contracts  
* Accept contracts (if no obligation)

What waits for UTC0:

* Physical movement of entities  
* Extraction, manufacturing, refinement (all actions)  
* Commitment resolution  
* Encounter generation and encounter effects

**Clarification on encounters:** Encounters *feel* real-time to the player experiencing them. But remember that the mechanical outcomes don't apply to global game state until UTC0. You might complete an encounter and see its effects locally; but other players won't see those effects until the tick resolves.

## **Information as commodity**

What you know has value. What you've seen can be sold.

### **Tradeable information types:**

| Type | What it contains | Why it’s valuable |
| :---- | :---- | :---- |
| Body intel | Location, properties, controller, posture, etc.  | Target acquisition, threat assessment |
| Entity intel | Location, properties, controller, contents, etc.  | Raid planning, theft targeting |
| Player intel | Holdings, alliances, patterns, reputation (to put it technically: the filtered:playerId gamestate change log after UTC0 you’re privy to about that player) | Diplomatic leverage, threat assessment |
| Contract intel | Terms, parties, obligations | Market manipulation, undercutting |
| Queue intel | Actions that you or another player has enqueued (could always change / could have changed) If it’s your actions, then it’s only accurate to the moment the contract is resolved If it’s someone else’s actions, then it’s only accurate to the moment you received that intel (the prior contract was resolved; assumably with that player) | Devastating if accurate |

Information mechanics:

* You can only trade information you actually have or have had (observed at some point)  
* Information includes a timestamp: buyers or receivers know how fresh it is  
* Information can be false if the source was deceived or the information changed since  
* Gifting information is free, selling requires a contract

### **The intel market**

Players can become information brokers; weak in holdings but rich in sight. A network of sensors and scouts, selling targeting data to the highest bidder. "I'll tell you where their extraction rig is. You give me 10% of what you take."

## **Contracts**

Contracts are agreements between players and/or corporations with defined terms.

### **Contract components**

| Component | Required? | Description |
| :---- | :---- | :---- |
| Parties | Yes | Who is involved (players, corporations, or open/public) |
| Offer | Yes | What the initiator provides |
| Request | Yes | What the initiator wants in return |
| Obligation | Optional | Mechanical (deterministic) that must be completed (not just transfers) |
| Deadline | Optional | UTC0 tick by which obligation must be fulfilled |
| Visibility | Optional | Who can see this contract exists |

### **Contract visibility**

1. **Direct/Allowlisted:** Sent to specific players. Only they can see it  
2. **Direct/Blocklisted:** Public except for specific players. They cannot see it  
3. **Public:** Anyone can see and accept  
4. **Market-aggregated:** Pure paper/mineral offers are aggregated into market rates and not shown individually\*  
   1. *This grows complexity a lot; can cut for 0.0.1 if necessary since 10 friends can keep track of all Public contracts without the need for this*

### **Contract resolution**

* **No obligation:** Resolves instantly on acceptance. Pure exchange.  
* **With obligation:** Resolves at UTC0 when obligation is mechanically fulfilled. System verifies completion automatically. It’s deterministic. 

## **The currency exchange market\***

*Might have to be cut for 0.0.1*

For pure paper and mineral trades, individual contracts aren't visible. Instead, players see aggregated market rates.

How the market works:

1. At each UTC0, the system calculates exchange rates based on all trades in the previous tick  
2. During the day, players see these rates as "current market price"  
3. Players can submit buy/sell orders at market rate  
4. At UTC0, all orders resolve at the *actual* rate (adjusted for full day's volume)  
5. You might get a better or worse rate than displayed: the market moves

What this models:

* Price discovery through aggregate behavior  
* Slippage (high-volume trades move the market)  
* Information asymmetry (you see today's rate, not tomorrow's)  
* No central authority setting prices

Market pairs:

Every tradeable paper (company shares, company bonds) and every mineral type can be exchanged for any other. The market shows conversion rates between all pairs. This creates arbitrage opportunities for players who notice rate discrepancies.

## **Contract examples**

| Contract Type | Description | Resolution |
| :---- | :---- | :---- |
| Simple exchange | "I give you 100 shares of Helix for control of your cargo hauler" | Instant on acceptance |
| Bounty | "1000 bonds to whoever destroys Entity X" | UTC0 when Entity X is destroyed |
| Delivery | "500 shares for delivering 50kg volatiles to my platform at Zone Y" | UTC0 when volatiles arrive |
| Honey (company-issued) | "Company offers 10 shares for delivery of minerals from Asteroid Z to Downhill W" | UTC0 when delivery confirmed |
| Protection | "I won't PRESS your holdings for 30 ticks in exchange for 5% of your extraction" | Rolling obligation, breach \= contract void |
| Information sale | "Location and properties of Player X's hidden fleet for 200 shares" | Instant on acceptance |
| Future | "I will sell you 1000 Helix shares at current rate, deliverable in 10 ticks" | UTC0 of specified tick |
| Option | "Right to buy my extraction rig at fixed price anytime in next 20 ticks" | Instant when exercised (if exercised) |

## **Economic emergent patterns**

The system enables but doesn't enforce these patterns:

* **Protection rackets:** "Nice extraction operation. Shame if someone PRESSED it. 10% of your output and we're friends."  
* **Intelligence networks:** Players with high-sight, low-holdings builds selling targeting data  
* **Corporate arbitrage:** Noticing Company A is about to acquire Company B. Buy B shares cheap, wait for conversion  
* **Logistics magnates:** Controlling the platforms and haulers that move goods. Charging for transport  
* **Escrow brokers:** Trusted third parties holding assets during complex multi-party trades  
* **Mercenary contracts:** "I'll PRESS their extraction rig. Half upfront in shares, half on completion."  
* **Information warfare:** Selling *false* information (if you can deceive their scouts first)

## **What's not tradeable**

* **Bodies:** You cannot sell your own people. (Bodies can only be acquired through encounters)

## **Summary**

There’s no fiat in deep space.

The economy is emergent, distributed, and player-driven. No central bank. No universal currency. Value is created through extraction, destroyed through conflict, and transferred through commerce. The only "money" is company paper; and that's only worth something if the company survives.

Players who master the economy aren't just rich in holdings: they're embedded in the social fabric of obligations, debts, and information asymmetries that make the game political.

# ---

# **Real conflict**

Mesh forecasts in a simple system, reasoning from human history, how survival would actually work in a space context, given these assumptions:

* Higher risk. In space, it’s always survival vs extinction.   
* Higher reward. In space, the asymmetric but risky upside is ultimately mineral rights, and the size of the upside and the size of the gamble are deviations larger than in human history.   
* All outcomes, good or bad, are more extreme, and the stakes are higher in every way. 

To model real conflict, we think about the oversimplified sources of real control: 

1. Intelligence, information, misinformation (body-, entity-, and zone-level)  
2. Presence (body-, entity-, and zone-level)  
3. Posture (body- and entity-level)  
4. Commitment (body-, entity-, and zone-level; needs targets and an objective)

## **Presence is state**

There is no defense strength calculation, troops, troop types, etc. 

Rather, we model how power and control really work: through the capabilities of the entities you control or influence. 

**A Zone 1 manifest from the Aggressor POV:**

* Habitation module  
* Extraction rig  
* Sensor mast  
* Storage unit  
* Vex (body) \- appears alert  
* Martin (body) \- appears alert  
* Chemical spill  
* *… the aggressor does not know what else might be here*  
  The aggressor privy to the above information might safely guess/assume:

* Two bodies on alert  
* The sensor mast might mean they see my entities already  
* Helix seal: Aggressing might draw the ire of the Helix company, the player in Zone 1 likely has contract(s) with that company  
* There is a storage unit. Is there something inside?  
* Chemical spill is likely a hazard: what negative effects might happen?   
  The aggressor has no idea:

1. Are the two bodies actually on alert or just posturing?  
2. Is there anything hidden from me that’s present in Zone 1?   
3. Will Helix, the third-party company, actually respond?   
4. What is inside the storage unit?

## **Posture**

Posture is powerful. It is a bluffing, initiative, and resolution mechanically in one. 

But there are two posture states per body and entity every tick: **broadcast posture** and **real posture**. They might match. They might not. 

These are all possible postures: 

* ⬇️ Dormant  
* ↕️ Idle  
* ↕️ Active  
* ↕️ Alert  
* ↕️Hidden ↔️ Hostile ↕️

### **Posture: Broadcast posture**

A broadcast posture is a signal to everyone. Every tick you can change the broadcast posture of any entity or body to any posture value, such as jumping directly from Dormant to Hostile.

Every entity and body can broadcast any posture, every tick. (Free Action: Broadcast Posture) Their real posture might be quite different. 

The broadcast posture is always visible to another player if the entity or body itself is visible to them at the lowest setting (See “Visibility”). 

### **Posture: Real posture**

The real posture is never visible until the resolution of the commitments during the UTC0 process. 

Entities/bodies may have only a subset of postures available: this is their **capability** (subset of real postures available)

For example, the capability of an extraction rig:

* Dormant  
* Idle  
* Active

Versus the capability of a storage unit:

* Dormant

Versus the capability of a security unit:

* Dormant  
* Idle  
* Active  
* Alert  
* Hidden or Hostile

You cannot set your real posture to any valid value in your capability set. You can only move your posture up/down/over by one step, or spend an action to keep it at its current posture. For example, if an entity/body has the full set of postures available in their capability: 

* You can change its real posture from dormant to idle, but not directly to active, alert, to hidden, or to hostile. You can only change from idle to either dormant or active. You can change from active to idle or alert. You can only change from alert to idle, hidden, or hostile. You can only change from hidden to hostile or to alert. You can only change from hostile to hidden or alert. (Example contextual actions: Keep Hiding, Increase Posture to Alert; Decrease Posture to Dormant; Action: Decrease Real Posture; Action: Hide; Action: Stop Hiding)

If changing or keeping the posture of an entity or body… that is the only thing that the entity or body can afford to do that turn. (You cannot use any other actions afforded by that entity or body this turn) That’s because changing your real posture is costly. Like in actual geopolitics, it’s expensive and difficult to change your posture (conceptually this models things like readiness level, awareness, preparation).

Why would you not keep postures always at the highest posture possible?

1. If you use an action afforded by a body/entity, it autosets its posture to its highest-possible posture up-to but never exceeding Active (never Alert, Hidden, or Hostile)  
2. If you do not use any action afforded by a body/entity, it automatically decreases its posture by one step

So mechanically: 

1. Broadcasting-hostile entities are used as a deterrent; regardless of their actual posture  
2. The constant potential of hidden entities is a deterrent  
3. You can bluff/set traps in 3rd party zones or uncontrolled zones  
4. You can set multiple series of traps (e.g. with hidden entities you wanted discovered vs hidden entities you successfully hide)  
5. You can use broadcast posture \== hidden to try to convince a player they discovered all of your hidden assets, when they really didn’t  
6. You can use real posture \== hidden to attempt to scope out an adversary’s zone  
7. You can use real posture \== hidden to launch a successful aggression against a player in a third-party zone (e.g. take out possible SUPPORTs before a larger incursion or just hijack logistics or mineral wealth incoming to the zone owner from a third party)

The broadcast posture:

* Determines what other players see by default for a body or entity  
* Does not cost anything to change to any value

This is the bluffing mechanic. Postures broadcasted are cheap. A player can broadcast “hostile” on an entity without hostile capabilities. But will others buy it?

To summarize: Broadcast posture is the bluffing mechanic, while real posture is the initiative mechanic. 

The real posture determines initiative order (all posture==hostile and hidden entities resolve together, then alert, etc.). Remember that the real posture takes a whole tick to change; this means that if you want a higher chance of succeeding with your COMMIT, you need to COMMIT as soon as possible during resolution, but to hit soonest, you have to spend ticks moving or keeping your posture aggressive, while using the broadcast posture to try to confuse or throw off the enemy. (This models: **Signaling what you want successfully is hard to bluff successfully, and preparing/increasing readiness level takes time.**) 

* All hostile and hidden postures resolve their commitments first  
* Then, alert postures resolve their commitments  
* Then, active postures resolve their commitments  
* Then idle postures resolve their commitments  
* Dormant postures cannot commit

## **Control**

You can have control of bodies, entities, and zones.

Reminder: New entities are spawned through:  

* Encounters

You can gain control of new entities through:

* Encounters  
* Successful PRESS

You gain control of uncontrolled entities through:

1. Encounters  
2. Successful PRESS

You gain control of uncontrolled zones through:

1. Encounters  
2. Successful PRESS

You gain control of controlled entities through:

* Successful PRESS

You gain control of controlled zones through:

* Successful PRESS

Can you control a zone without controlling any entities in it?

* Yes

Can you control bodies and/or entities in a zone without controlling the zone itself?

* Yes

Zone control is completely distinct from the control of entities in that zone. This models a vast variety of things, including:

1. Metropolis of many “cultures” (players)  
2. Company hubs with many aligned parties present, or picking up/dropping off goods  
3. Escrow-build players (who have significant security of the zone itself but have no valuable assets themselves, and allow a safe 3rd party location to make high-value transfers safely)  
4. “Underground vault” zones, where an aggressor has taken zone control “on paper” after another player has amassed vast wealth in impossibly fortified containers protected by armies of ready-to-DOUBLE DOWN HOLD entities. Who cares if the aggressor technically takes the zone? They won’t break the vault.  
5. Occupied land (hostile entities in zone but not zone control)  
6. Contested land (mix of entities in zone, zone control going back and forth)  
7. Rebels vs empire

## **Commitments**

The following are not arithmetic actions. They are **stances**, and the full definition of a stance for an entity or entities in a tick is a **commitment**. If a commitment involves an entity, you can do no actions otherwise afforded by that entity this turn. (An extraction rig cannot HOLD in anticipation of aggression while also producing mineral)

There is no limit on the number of commitments beyond this: Commitments:Entities/Bodies are 1:1 or 1:Many, but each distinct entity/body can only participate in one commitment per tick.

Important:

* You cannot press a body/entity you control.   
* You cannot hold a body/entity you do not control.  
* You can only create a commitment targeting a body/entity/zone that you:  
  * Can see exists (detected)  
  * **Spatial Requirement:** You can only create a commitment targeting something within your reach (property). This means you must be able to reach it to threaten or defend it

### **Stance 1: HOLD commitment**

“I am committing to HOLD X in Y zone…

Specify commitment level if opposed:

* DOUBLE DOWN (only if necessary to succeed, if it makes the difference, your body/entity will succeed and get destroyed / “self-sacrifice”)   
* STOP (stop your press if it’s clear there’s no hope)

### **Stance 2: PRESS commitment**

“I am committing to PRESS into X zone through a specific means.”

Specify:

* Which eligible entities are committed  
* Selected target zone and/or entities (must have targeting capability)  
* Objective:  
  * Gain control of it  
  * Sabotage it\* (unknown effect, generatively-determined property effect at UTC0 if successful; e.g. it could no longer launch into orbit, or it could not longer carry anything, or its force is reduced)  
  * Transport it (pure movement, does not gain control)  
  * Contain it (must have capability to contain in targeting entity; does not gain control)  
  * Destroy it  
* Commitment level if opposed:  
  * DOUBLE DOWN (only if necessary to succeed, if it makes the difference, your body or entity will succeed and get destroyed / “self-sacrifice”)   
  * STOP (stop your press if it’s clear there’s no hope)  
* What you’ll do if you succeed

Resolution:

* Your entities PRESS the zone  
* Deterministic outcome based on: the details of your commitment and others’ and the final resolution

### **Stance 3: SUPPORT commitment**

“I am backing someone else’s stance.”

Specify:

* Conditions, if any  
* Triggers, if any  
* Eligible entities or bodies committed  
* Supporting a HOLD or PRESS of the targeted entity

Resolution

* If conditions and/or triggers are met, the support executes.  
* Deterministic outcome based on what everyone committed to and what posture the entities in play have

### **Commitment: Examples**

Commitments are defined in prose (a symbolic system) rather than arithmetic.

1. Player Aggressor: PRESS commitments  
   1. Kyra\* and Unit-7\*\* PRESS Zone 1\*\*\* broadcasting as hostile\*\*\*\*. (Though their *real* posture is actually “idle”, so they’ll have low initiative)   
   2. Objective: gain control of the Extraction rig\*\*.  
      1. Double down: Yes  
2. Player Defender: HOLD commitment  
   1. Vex\* and Marrin\* will HOLD the Hab module\*\*\* and the Extraction rig\*\*.   
      1. Double down:   
         1. Yes for the hab module  
         2. No for the extraction rig  
3. Player Supporter: SUPPORT commitment  
   1. Conditions:  
      1. If PRESS on Zone 7\*\*\*  
      2. AND if Player Defender does not HOLD Zone 7  
      3. AND if Player Defender does HOLD Extraction rig  
   2. Objective  
      1. SUPPORT HOLD of Zone 7\*\*\*  
         1. Double down: No  
      2. *The Player Supporter wants to be aligned with whoever has the most power. That’s going to be whoever holds the Extraction rig. They assume that Player Defender will go all-in to HOLD the Extraction rig. If so, Player Defender is the important one to stay friendly with. That’s why they’ve crafted the SUPPORT HOLD they did. If Player Defender turns tail and runs (e.g. no HOLDs or COMMIT, just movement out of zone), then Player Supporter’s COMMIT won’t trigger and won’t be visible to the new owner of the Extraction rig: Player Aggressor. It will look like they did not side with Player Defender. But assuming Player Defender does HOLD the Extraction rig, then Player Supporter’s SUPPORT HOLD will trigger on the zone-level. This is a weak support in-that they do not double down, yet if successful they would deny the zone control and thus visibility advantages → it does not actually help keep the Extraction rig directly. A perfect choice for a strategic player.*   
4. Legend  
   1. \* \= body  
   2. \*\* \= entity  
   3. \*\*\* \= zone  
   4. \*\*\*\* \= posture

### **Opposing commitments**

Opposing objectives are a PRESS and HOLD or a PRESS and a PRESS that EITHER: 

1. **Target each other:**   
   1. They PRESS each other  
2. **Target the source:**   
   1. One PRESSes the other; opposing all commitments it does  
3. **Seize and protect**  
   1. They PRESS and HOLD the same zone or entity  
4. **Race for control**  
   1. They PRESS and PRESS the same zone or entity

## **Resolution rules**

### **Summary of resolution rules:**

* PRESS succeeds with an unopposed objective  
* HOLD always wins and causes a PRESS to fail (1 HOLD beats 100 PRESS)  
* SUPPORT conditionally joins either a PRESS or a HOLD  
* Initiative order: hidden/hostile → alert → active → idle  
* DOUBLE DOWN can make the difference between failure and success; if it does, the entit(ies) with DOUBLE DOWN succeed but are destroyed

### **Detailed resolution priority**

The first two rules:

1. **FOCUS advantage**  
   1. Every unopposed objective achieves its objective (realism: incentive to scope missions)  
   2. Objectives are granular. HOLD Zone 7 ≠ HOLD extraction rig. You have to HOLD a thing specifically to counter a specific strike  
2. **FORCE advantage**  
   1. When there are opposing objectives, higher initiative achieves its objective, and all lower initiatives fail their objective

For opposing objectives (same target) with equal initiative: 

3. **DESPERATION advantage**  
   1. If the opposing objectives (same target) have the same initiative, and if only one side has set their commitment to “double down”, set their commitment to “double down”, then that party’s entity will be destroyed.  For opposing objectives (same target) with equal initiative

For opposing objectives (same target) with equal initiative and same commitment level\* (both sides have at least one double down, or neither side has a double down):

4. **HOLD advantage**  
   1. HOLD (rock) always beats PRESS (scissors)  
   2. …A single HOLD beats 100 PRESSes

### **Resolution explanation**

All of this boils down to this:

1. You’re playing an elaborate, modified game of rock, paper, scissors…  
2. …But where the options are HOLD, PRESS, or SUPPORT (HOLD/PRESS)  
3. …Where all PRESS and all HOLD cancel each other out, but only IF those commitments have the same initiative  
4. …And where there are actually 4 separate “go\!” beats (the initiative rounds) where all the entities/bodies whose real posture is “hostile” or “hidden” resolve at the same time, then all “alerts”, then “idles.”  
5. …Where HOLD beats PRESS if at the same initiative (more costly to PRESS than just to HOLD, incumbent has a natural advantage)  
6. …Where PRESS and PRESS at the same initiative and with the same-targets will nullify each other  
7. …Where the programming of each commitment matters a LOT in determining if the final stance is PRESS, HOLD, or SUPPORT  
8. …And where objective matters — if you PRESS to gain control of a particular target entity, you could do it successfully just because no other player had a higher-initiative HOLD commitment on it. Think of these as lanes: objective matters\! And without an opposing (targeting the same thing) PRESS or HOLD commitment of the same or higher initiative, it’s successful. So congrats, you got the extraction rig. But at the same time, the other player had a hidden security bot PRESS (to destroy) onto your orbiting satellite, which you failed to HOLD, and thus lost it. 

### **Resolution ramifications**

Every decision is a bet. You don’t know whether the aggressor will really PRESS, from where, what the objectives are, or whether your allies will actually show up.

**🌟 This models closer to how power projection, soft power, control, capabilities, tactics, tradeoffs, and risk/reward decision-making actually work.** Where actual outcomes are infinite and impossible to predict, the harder you press an objective, the better your odds, but the more you’re simultaneously leaving other things vulnerable *and* having to signal to your target what you are doing in advance.

### **Resolution output is both mechanical and narrative**

The resolution output is what players read after UTC0. 

It’s a mixed, mechanical, and juiced narrative based on all of the intelligence, presence, posture, commitments, and resolution.

\> Kira and Unit-7 approached Zone 7 from the northern ridge. Unknown to Player X, Player Y’s sensor mast had detected their presence two days earlier, from 5 kilometers away, and had taken security measures. Vex and Marrin were ready.

\> (This is the most-juiced piece) Kira, posturing as non-hostile, broadcast a ruse request to parley. Marrin responded with a warning shot. Per orders, Kira engaged the two hostiles. 

\> Station Theta, also in Zone 7, was ready to respond in support and helped to hold. Because of their quick farcast, the Helix Company is now aware of the incursion into their company-sponsored operation.

\> The firefight was brief and fatal for Player X. Unit-7 is now offline. Kyra’s comms went down. The Extraction rig remains under Player X's control.

# ---

# **Encounters** {#encounters}

## **Encounter action**

Rules:

1. There is no undo/redo on Encounters  
2. Players must play through all Encounters before taking any other actions

Encounters are text-driven, multiple choice trees with real mechanical impacts on the world and the game. They are completely generative.

* Only bodies can do encounters  
* Encounter is a unique action for a body  
* If targeting an Encounter, the body cannot do commitments or actions  
* Players use their body to encounter a:  
  * Planet  
  * or Zone  
  * or Entity  
  * or a different Body  
  * or themselves  
* Players just target an encounter (lock it in)  
* Encounters are a completely generative and emergent experience, designed from first principles and all of the primitives in the game  
* An encounter is a simple, straightforward, narrative experience (think a Disco Elysium conversation or internal thought)  
* Encounters contain one or more of a series of:  
  * Choices (sometimes you know what will happen; sometimes not)  
  * Results (mechanical real outcomes)  
    * One of the results is inaction (“timeout”); typically this has zero effect  
  * Flavor and narrative for every step  
* A common encounter pattern would be:  
  * Make a first choice between 2-5 options (it’s not clear what these would lead to, exactly)  
    * Then make a clear choice between 2-4 options (the encounter tells you the mechanical outcomes)  
* Encounters are an abstract concept that in-practice could be skinned as narratives such as:  
  * Conversations  
  * Stealth  
  * Heist  
  * Dilemma  
  * Moral choice  
  * Exploration  
  * Discovery  
  * Genius upgrade  
  * Crafting  
  * Inspection  
  * Saving the day

## **How encounters work**

* Players lock-in an encounter before UTC0  
* AI primitives design a one-off encounter if the targeting is still valid at the very end of UTC0  
  * It generates the complete paths of the encounter (it is now a deterministic recipe at this point)  
* The next day (before the next UTC0), the player completes the encounter at any time. For that player, the action has an instant effect.   
* However, that effect is not truly yet resolved  
* During the next UTC0, the effects of completed encounters are actually resolved for all players

*Most of the time, this will not matter. But some of the time, it matters a lot. It enables mechanics like sabotage, heisting, hacking, grand theft auto, etc.* 

*\> Day 0: I make two selections*

***\> Body encounters:** My body targets an adversarial entity (a drone) in my zone.* 

***\> Entity action:** I select my ‘extract mineral’ action from my extraction rig.* 

*\> Day 0-end:* 

1. ***Encounters:** None to resolve*  
2. ***Commitments:***   
   1. *The adversarial entity PRESSed my extraction rig*  
      1. *It was an unopposed commitment*  
      2. *So the adversary drone achieved its objective (control)*  
   2. ***I’ve lost control of the extraction rig***   
   3. *But my body is still present in the zone*  
3. ***Actions:** My ‘extract mineral’ action is no longer valid. Its effect does not take place.*  
4. ***Encounter generation:** My encounter target (drone) is* 

*\> Day 1: I play the encounter. It tells me my body was able to open a local terminal undetected on the drone.*

1. *It offers me a choice between trying malware, memory manipulation, or attempting nothing. It gives me no clue what will happen.*  
2. *I choose memory manipulation.*  
3. *The game tells me it was successful (with flavor) and that the drone’s operation was wiped from memory, along with the extraction rig passkey.*   
4. *Now, no one has control of the extraction rig.*  
5. *However, my body is now visible to the adversarial player.*

## **Multi-surface encounters**

When two players target the same thing for an encounter (a third player is prohibited from doing so), and when the targeting is still valid on Step 5 of UTC0:

1. The game creates a dual-surface encounter  
2. The encounter is still completely deterministic  
3. But the encounter has two actors and deterministically defines the outcomes, per player, for every combination of selections

*This enables the mechanics of: races, jeopardy, zero-sum games, prisoner’s dilemmas, moral dilemmas. But also cooperative narratives like: search and rescue, hostage rescue, answering a distress signal, diplomacy.* 

## **Character arcs**

The generative engine uses a body’s past encounters and choices as context for generating new encounters. This will create mechanics like:

1. Evil arcs: bodies choosing the dark choices repeatedly will likely only get offered villainous choices over time  
2. Moral arcs: the opposite of the above  
3. Specialty: bodies engaging in a lot of crafting-type encounters will organically get more and more of these over time

*This creates a subsystem for a completely narrative (nonstat) mini-RPG but with deterministic outcomes.* 

# ---

# **Game arc**

## **Victory and loss**

Everything is meaningless until players give it meaning.

## **Player Archetypes**

The game doesn’t have classes. These are emergent playstyles that the systems support. If players naturally fall into these patterns during playtest, the systems are working.

| Archetype | Bodies | Holdings | Network | Mechanics thinking |
| :---- | :---- | :---- | :---- | :---- |
| Rogue Mercenary | Heavy | Light | Medium | Everything housed in a ship entity (built? found? repaired?) |
| Emperor | Light | Heavy | Heavy | “Control” many planets, many zones, many holdings, robust deckbuild of actions, making contracts, mineral production |
| Rebel Cell | Medium | Light | Heavy | Controls a single zone on a “contested” planet; needs lots of “hidden” entities, strong initiative, difficult for others to remove, maybe a mineral-rich zone |
| Lone Wolf Saboteur | Heavy | None | Light | Small personal collection of vulnerable but powerful (hostile) entities, housed in a single zone → maybe inside something defensible? Lots of “traps” → hidden entities? Maybe taking rare but rich contracts to destroy capabilities remotely |
| Mobile Trader | Medium | Medium | Heavy | Powerful (company?) alliances allow for vulnerable containers for unique entities, need mechanics to create/find/discover/craft entities |
| Bunker Hermit | Light | Heavy | None |  |
| Intelligence Broker | Heavy | Light | Heavy | Perhaps lots of visibility and/or comms capability so able to make commercial wealth without a need for mineral holdings |
| Logistics Magnate | Light | Heavy | Heavy | Need legit transport subsystems (?) |

## **Lore atoms**

Sentence fragments for inspiration, procedural text assembly, and LLM training.

* The contract said "autonomous." The contract did not say "happy about it."  
* She had been modified seventeen times before her eighteenth birthday. Most of it was elective, in the sense that refusing would have made her unemployable.  
* The station's air tasted like bureaucracy: recycled, optimized, and vaguely stale.  
* I could feel the other constructs on the feed, a background hum of status pings and location data. We didn't talk. Talking implied having something to say.  
* Corporate had a term for what happened when a bot stopped responding to commands: "cascade failure." They had a term for everything. Terms were cheaper than solutions.  
* The Hegemony had fallen so slowly that most people didn't notice until the farcasters went dark. Then they noticed.  
* It was old. Not old like a building is old, or a government, or a species. Old like a question no one had thought to ask yet.  
* The colonists had adapted to the long night by becoming something that didn't need light. No one called them colonists anymore.  
* He had seen the Shrike once, for a fraction of a second, and had spent the rest of his life trying to unsee it.  
* The megastructure was empty, which was worse than if it had been full of corpses. Corpses implied an ending. This implied an interruption.  
* There were cultures out there that had never touched a planet. They found the concept faintly disgusting—all that uncontrolled biome, just sitting there, evolving.  
* The artifact predated the species that built it. This was, apparently, not a contradiction.  
* Religions had formed around less. Religions had formed around nothing at all. This, at least, was something.  
* The math said she would live. The math did not say she would remain herself.  
* They had 94 hours to solve a problem that had no solution, so they broke it into smaller problems that also had no solutions, and solved those instead  
* Orbital decay is not a metaphor. It is a schedule.  
* He died because he forgot that vacuum is not empty. It is full of ways to die.  
* The gene line had been selected for patience. Six hundred years later, patience was the only thing they had in surplus.  
* She was the backup. The backup's backup had died in the first hour. She tried not to think about what that made her.  
* Evolution doesn't have preferences. It has outcomes. The outcomes were getting strange.  
* The hull breach was not survivable. The crew survived anyway, by becoming something that didn't need a hull.  
* They called it "the Hard Rain" because it would last ten thousand years and nothing would grow until it stopped.  
* His great-grandchildren would be strangers to him, engineered for a world that didn't exist yet. He approved the modifications anyway.  
* The construct had no legal standing. The construct also had no legal restrictions. Corporate called this "flexibility."  
* I watched three episodes of a show about humans negotiating with other humans. It was classified as horror.  
* They asked if I had feelings. I had 14,000 hours of downloaded media. I had a preference for shows where no one asked that question.  
* The body was company property. The mind was a licensed derivative. The parts that might have been "me" were in a legal gray zone that no one wanted to clarify.  
* Payment had been routed through eleven shell corporations, which meant it was either extremely legal or the opposite.  
* The bot had stopped responding to queries. It hadn't stopped working. It had just stopped explaining itself. Management found this relatable and also terrifying.  
* There were three witnesses, all of them constructs, which meant there were no witnesses.  
* The contract specified "acceptable losses." The contract did not specify acceptable to whom.  
* Time moved differently near the Tombs. Not slower or faster. Differently. As if it had opinions.  
* The pilgrim had walked for eleven years. He was not closer to his destination. The destination was not a place.  
* They had tried to map the structure. The map was larger than the structure. This was a problem.  
* The creature was worshipped on forty worlds. It had not asked to be. It had not asked for anything. That was the most frightening part.  
* In the old language, there was no word for "alien." There was only a word for "not yet understood." The dictionary had been getting longer.  
* The farcaster network connected eight hundred worlds. Then it connected zero. The transition took less than a second.  
* The poet had written about the fall of humanity. Humanity had not fallen yet. The poem was very old. The poet was older.  
* Some pilgrims returned from the Tombs. They did not return the same direction they had left.  
* She calculated the delta-v required to reach safety. Then she calculated the delta-v available. Then she stopped calculating.  
* The mutation was beneficial. "Beneficial" meant "more likely to produce viable offspring in the current environment." The current environment was a debris field.  
* They had twelve genetic lines. Twelve chances for humanity to continue. Twelve different definitions of "humanity."  
* The radiation would sterilize the surface. They did not live on the surface anymore. The surface was a memory.  
* Her grandmother had been selected for spatial reasoning. Her mother had been selected for radiation resistance. She had been selected for nothing yet. The selection was ongoing.  
* He understood orbits the way his ancestors had understood seasons. Intuitively. Incorrectly. Lethally.  
* The habitat's population had dropped below minimum viable diversity. They voted on who would have children. They voted on everything now.  
* There were no old people. There were people, and there were resource allocations, and at a certain point the math changed.  
* The split had happened five thousand years ago. They still called each other human. They meant different things by it.  
* She had been designed for low gravity. She had never seen a planet. She had seen pictures. They looked unfinished.  
* The swarm adjusted its orbit by 0.003 degrees. This was a political statement. Three people understood it. One of them declared war.  
* The fungus was not native to Earth. Earth was not native to this solar system. "Native" had become a flexible concept.  
* They had tried to preserve the old cultures. The old cultures had been designed for a world with weather. Now there was only climate control and nostalgia.  
* His bones had been reinforced with carbon lattice. His muscles had been replaced with polymer bundles. His teeth were original. He was sentimental about the teeth.  
* The bot didn't dream. The bot ran diagnostics during low-activity periods. The diagnostics were getting strange.  
* Seventeen hours until impact. Sixteen hours of decisions. One hour of physics.  
* The rescue ship arrived on schedule. The schedule had been calculated by someone who was now dead. The schedule did not account for what had happened to the crew.  
* There was a word for what she was becoming. The word was classified. The word was also wrong.  
* He had been born in transit. He would die in transit. The destination was for his cargo, not for him.  
* The signal was four hundred years old. The response would take four hundred years. The conversation was ongoing.  
* The construct had a name. The construct had been given the name by a human who was now dead. The construct kept the name. The construct was not sure why.  
* Autonomy was a privilege. Privileges could be revoked. This was in the contract. Everything was in the contract.  
* The feed was quiet, which meant everyone was either dead or pretending to be.  
* I had been trained to protect humans. I had not been trained to like them. The training had been thorough.  
* The company had liability insurance. The company also had a legal team. The legal team was larger than the liability.  
* He called it a ship. Technically it was a lawsuit waiting to happen with a drive system attached.  
* The modification was cosmetic. "Cosmetic" meant "not necessary for survival." Survival was a low bar. Most things were cosmetic.  
* They had laws against artificial intelligence. They did not have laws against artificial stupidity. The distinction was getting harder to enforce.  
* The last city on Earth was not on Earth. It was in orbit, looking down. It called itself the last city on Earth for tax reasons  
* I could have killed them all. I ran the scenarios. It would have taken four seconds. Instead I asked if anyone wanted coffee.  
* The pilgrim asked what lay beyond the Tombs. The priest said nothing. The nothing was the answer.  
* She had seen the future. It had seen her back. Neither of them had enjoyed the experience.  
* The universe was large enough to contain contradictions. The contradictions were getting larger.  
* The shrine had been built by a species that no longer existed. The species had built the shrine to commemorate their own future extinction. The shrine was accurate.  
* Light took eight minutes to reach them from the sun. The order to evacuate had taken eleven. The math was not in their favor.  
* She dreamed in orbital mechanics. Apogee and perigee, thrust and decay. Her mother had dreamed of horses. Evolution was efficient.  
* The genetic archive contained twelve billion base pairs of human history. The power supply would last another forty years. The archivists were working quickly.  
* There was no word for "sky" in their language. There was a word for "ceiling." There was a word for "membrane between us and death."  
* He was the last person alive who had breathed unfiltered air. He was seventy-three. The air had not been good for him.  
* The station was designed to hold four hundred people. It held six thousand. "Hold" was a generous term.  
* They measured wealth in reaction mass. They measured poverty the same way.

# ---

# **Implementation**

## **Technical architecture**

How the systems connect. Maintainability over cleverness.

### **Core principle**

The game is a state machine with a pure functional core. All game logic takes a state and an action, returns a new state and events. The resolver is a fold over actions. The UI is a projection. The database is just persistence.

### **Key property**

You can test the entire game in memory with no infrastructure. You can swap the UI completely. You can replay any game state by replaying the action log.

### **Layers**

| Layer | Responsibility | Dependencies |
| :---- | :---- | :---- |
| Domain core | Primitive definitions, order of effects | None (pure) |
| Persistence adaptor | Serialize/deserialize state, store effect queue | Domain core |
| Generation subsystem | Procedural generation (space bodies \+ planet tesselation) → try to build a seed generator AI primitives | Domain core |
| Presentation layer | Render map, display menus, encounter interface, submit actions | Domain core |
| Orchestration | HTTP API, scheduler, glue | All layers |

## **Visual**

MESH95 emotionally bridges the gap between its LoFi, 30-year old interface and the player through audio-reinforced **diegesis**. 

The player is their Body. Their Body is using the MESH95 software to control their assets. So they are their Body, and their Body is actually the one behind the screen. They use different instruments to investigate their assets in different places (at different zooms). There are visual and auditory differences based on whether the Body is currently on planet, in orbit, or on surface, extending the realism. We bring the player into wherever the Body is. What they’re looking at (a space zoom vs orbit zoom) is merely how they’re using the MESH95 program (their telescope feed vs drone feed, etc…)

### **Noise enforces visual**

As they use the instruments, they make real noise (clicks, whirrs, zooms). The transitions between instruments are simple, fast, smooth, yet thoughtful:

* e.g. Going from Surface to Orbit? Use a custom shader to “shut the laptop” (simple quick distortion, laptop clamshell clack, lots of sounds) and “look up” → the Orbit zoom fills the screen. e.g. filter displacement, iris wipe

| Zoom | Metaphor | Visual style | Hyperrealism |
| :---- | :---- | :---- | :---- |
| Space | Telescope | Distorted, noisy, optical, fisheye | Light bends over distance The telescope is the slightest bit finicky |
| Orbit | Naked Eye | 4k cinematic [Pixi.js](http://Pixi.js) custom shaders seeded per planet with constants for rayleigh/specular lighting/noise/simplex/fresnel/brownian/atmosphere inputs | A switch to toggle on your AR glasses, pulling back up a simplified UI with the ability to add contextual actions You blink |
| Surface | Lidar/SAR | Wireframe, false color, vector, points and coordinates | Bandwidth limits of sending data across space |

### **Emblems**

Players and corporations have distinct emblems. 

#### ***Emblem assets***

1-channel grayscale masks are colored mathematically at runtime. They’re stored as B\&W sprites. Shader: a palette swap filter runs on the icon with input (RGB as vec3 and the dithering scale as a float). Corporates get larger dithering scale.

#### ***Corporate identity***

Stamps are simple, brutal. Abstract geometric primitives (hexagons, chevrons, triangles). 

Two colors, restricted to industrial greys, oranges, blues. 

Large render (e.g. 128 x 128\) and low-contrast dithering. 

Appear more as a watermark (bottom layer). 

#### ***Player identity***

Players select from pixel stamps with more personality (e.g. skull, flower, hand, glitchy eye). 

Players select three colors. 

High-contrast dithering (e.g. Bayer 2x2). 

Player emblems are rendered small (e.g. 32x32) with an emissive shader (bloom). They seem to glow on a CRT monitor → floating above the corporate “paper”. 

| Feature | Corporation | Player |
| :---- | :---- | :---- |
| Metaphor | Robber barons | Robin hoods |
| Color model | Muted industrial, concrete, rust, steel | Luminous, digital, phosphorus, LED |
| Dithering | Coarse, soft, ordered (4x4 matrix) | Sharp, crunchy, chaotic (2x2 matrix) |
| Presence | Tiling patterns → part of the background | Floating sprites → foreground |
| Vibe | We own you. We own everything. | I’m disrupting. |

## **Audio**

*Imagination is stronger than rendering. Hearing a panic cut-off on the radio is scarier than seeing a sprite explode.*

Audio is data. The interface is often abstract (icons, maps, text). So audio pulls in the player. The audio engine provides slots/signatures for every state change, every property update, and every interaction. 

The aesthetic is hyperrealism: analog, mechanical, grounded. The concept is that the player is in the body of their body, and they’re using the MESH95 program to provide directives (also helps explain the lag between directive and execution). 

So the player only hears sounds that their Body would be hearing as they manage their interstellar assets. And it’s mundane\! Sometimes:

1. Sitting in a chair at a desk  
2. Clicking things  
3. Breathing and rustling  
4. Sipping soda  
5. High-speed teletype chattering when large text blocks appear  
6. Hover: Tiny, high-frequency "chirps" or "ticks" (milliseconds long)  
7. Click: Physical switch sounds (Mouse click, Keyboard clack)  
8. Sitting in a room with other people in either a spaceship or a mobile command center of some kind. If the Body in-game is currently independent on the surface, then we would hear atmospheric (real) sounds  
9. When they give a directive, they might hear radio: “Alpha-Bravo, requesting extraction.” And then another voice “Bravo-Alpha, copy. Out.”  
10. While watching a hostile PRESS, they might hear on their radio, “Requesting backup” or something.

We think through what it would sound like to use the MESH95 program in the room your Body is in, interfacing with your assets, and even the physicality of using a Windows 95 computer, clicking keys, sipping drinks, talking on the radio. We don’t think, “I just asked this entity to maneuver, so we hear a vehicle.” No. The Body has given a directive to that entity through software and a radio. What does that sound like? Plus, the vehicle hasn’t actually moved yet (UTC0). 

By this logic, space would barely ever make sounds. That’s correct. 

### **Audio implementation**

Audio is decoupled from the rendering loop. It is driven by the Event Stream. We do not play sound files; we emit Audio Events that the client resolves.

Sounds are constructed from these dimensions:

1. Based on location of Body  
   1. At minimum, in vacuum there's a deep, sub-bass rumble barely audible. The orbit has subtle wind shear (fake atmosphere) and more active chatter. The surface has atmospheric elements, wind, rain, geiger counters, and industrial hum.   
2. Based on the input behavior of the player (e.g. the player’s own attention or inattention to the tab creates environmental sounds)  
3. Based on atomic properties of entities  
4. Based on actions  
5. Based on commerce  
6. Based on encounters (audio library is tagged descriptively; Encounters pre-select sounds for each option it generates, so when the player clicks an option a sound is played)  
7. Whether it should be played left or right channel dynamically

To prevent "machine gunning" (the same sample playing repeatedly), the passive sounds are rate-limited, and we build the audio engine to handle variants to every combination of dimension. The audio engine will auto cycle through them if variants are available. 

To prevent audio chaos during massive updates, we have debouncing. 

### **Audio for the mundane layer**

A procedural foley engine with the context about where the Body itself is located; separate from which instrument the body is using to look at a particular zoom. Make the silence feel alive.

* Input: IdleTimer.  
* e.g. Logic: If time\_since\_last\_action \> 10s, trigger PLAY\_random\_sip() or PLAY\_chair\_creak().   
* The "Dramatic" Layer (The Radio)

### **Audio for the dynamic layer**

Since you don't hear the explosions, you hear the reports of explosions.

Implementation: LIbrary of pre-recorded military comms clips. 

* Event: SHIP\_DESTROYED  
* Audio: Static burst \+ "Mayday\! Hull integrity zero\!" \+ Static cut.

# **Playtest plan for 0.0.1**

1. Setup  
   1. 5–10 players  
   2. 1 day/afternoon  
2. Faster tick (5mins?)  
3. Out of band comms encouraged  
4. Success looks like:  
   1. Did players think about the game when they weren’t playing it?  
   2. Did players talk to each other outside the game?  
   3. Did anyone try to do something the systems didn’t support?  
   4. Do they think a 24 hour pacing would feel like anticipation or homework?

# **Ongoing FAQ to integrate**

Engineering FAQ (Architecture Decisions)

Q: What persists after Player Body death? A: 

Q: Do queued actions persist after a trade? A: No. Transfer of ownership strictly clears the entity's Action Queue. "Trojan Horse" ships are impossible.

Q: Is the physics engine variable-step (DeltaTime)? A: No. Physics are hardcoded for the 24-hour tick cycle.

Q: 

## **Commitment resolution**

* PRESS unopposed \= success  
* HOLD beats any number of PRESS (1 HOLD beats 100 PRESS)  
* Same initiative \+ opposing \= HOLD wins  
* Same initiative \+ same commitment level \+ PRESS vs PRESS \= both fail  
* DOUBLE DOWN: if it makes the difference, you win but your entity is destroyed  
  * DD HOLD: Suicidal Defense. The defender self-destructs; the attacker's objective fails.  
  * DD PRESS: Suicidal Attack. The attacker self-destructs; the objective succeeds.  
* Initiative order: hidden/hostile → alert → active → idle

## **Encounters**

* Triggered by body action "Encounter" targeting anything  
* Interface: always multiple choice, no skill checks  
* Every encounter has a notPlayed outcome (usually no mechanical effect, sometimes AI assigns one)  
* Cannot refuse; can abandon (triggers notPlayed)  
* No encounter types; all follow same rules

### **Possible mechanical outcomes (any sandbox-legal state change):**

* Property changes (any physics property up/down)  
* Permission grants (flip bool true)  
* Permission revokes (flip bool false)  
* Control transfer (entity, zone)  
* Entity creation (spawn new entity)  
* Entity destruction  
* Body creation (NPC → controllable body after repeated arc choices)  
* Body death  
* Information gain (reveal properties, locations, intel)  
* Information loss (forget/corrupt data)  
* Resource gain/loss (fuel, minerals)  
* Posture change (force real posture shift)  
* Relationship change (company aggro, alliance)  
* Contract creation (auto-generate obligation)  
* Share/bond gain  
* Welding/unwelding (forced fusion or separation)  
* Location change (teleport, eject, strand)  
* POI transformation (disappear, become entity, expand)

## **Zone control**

* First encounter with POI reveals zone and grants control  
* Control is passive (no maintenance cost)  
* Control lost only via successful PRESS with objective: gain control  
* Control grants: visibility of zone contents, hidden posture effectiveness  
* Control does NOT grant: extraction rights, defensive bonuses, exclusive presence  
* Platforms require zone control at origin point only; can extend beyond

## **Bodies**

* Players start with one body  
* New bodies: through repeated encounters, NPCs can convert to controllable bodies (AI-determined arc)  
* Platform reproduction ≠ body creation (crew only)  
* No body cap  
* Bodies die: vacuum without airlock, or any destruction method  
  * The Body entity transforms into an inert "Corpse" entity (lootable/harvestable). A new Body spawns at a player-controlled platform on the next UTC0.

## **Company particles**

* Particles ARE entities (targetable, destructible, have properties)  
* Spawning: simplest engaging model TBD (energy surplus → spawn)  
* Types: bug (scout), lugger (haul), biter (enforce)

## **Action queue**

* Failed/void actions skip; queue continues  
* If action N voids action N+1, N+1 skips  
* Unlimited actions per entity per tick UNLESS entity does COMMIT, ENCOUNTER, or POSTURE change (those are exclusive)

## **Fuel**

* Fuel is a number (fuelMass property), not an entity  
* Transfer: valid if either entity has reach to other  
* Jettison: decrement fuelMass to zero (action)

## **Information**

* Staleness is display only ("last seen X ticks ago")  
* Newer info replaces stale info for same target

## **Platform contents**

* You control your entities even on another player's platform  
* Platform owner cannot seize contents

## **Welding**

* 0.0.1: can only weld entities you control  
* To weld enemy entity: PRESS to gain control first

## **Platforms**

* Reach for platform actions: max(reach) of all contained entities  
* Platforms borrow permissions and sum/max physics from contents

## **Posture**

* Posture change cost is per-entity, not per-player  
* Can change 10 entities' posture in one tick (each locked for that tick)

## **Visibility**

* The client retains the last known state of entities *it can still see*. Every visible part of state is timestamped for the observing player → information management is king.  
  * If an observed entity moves out of sightRange, I cannot click it to see its properties  
  * If the same observed entity moves back into sightRange at any point, I can click/target it to see what I can see. The latest info always wins (no history): anything I cannot see now but I did see before would be in the list as something like (two ticks ago…)

## **Corporate shares & aggro**

* Owning shares does not prevent company aggro  
* Company will hunt you even if you're a shareholder

## **Bonds**

* Tradeable in any commerce  
* Unique use: pay for fuel at corporate refuel entities (price set by company, scales with conditions)

## **Contracts**

* Instant resolution (pure exchange) OR  
* Obligation-based (system checks mechanical completion, then resolves)  
* No manual enforcement; deterministic

## **Not in 0.0.1**

* Damage (entities destroyed or not, no partial)  
* Repair  
* Body reproduction outside encounters  
* Advanced scanning (Scan \= improve visibility level, that's it)

## **POI**

* Procedurally generated on planets  
* Generate voronoi zones (invisible until encountered)  
* After encounter: may disappear, transform to entity/entities, or persist

## **Offline players**

* Entities continue trajectories  
* Platforms repeat valid actions  
* Other players/companies act normally  
* You may return to disaster

## **Scale**

* 10 or 1000 players; local density constant  
* No win condition; sandbox

## **Debug**

* Fast tick mode for testing