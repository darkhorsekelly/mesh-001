# MESH: Semantic Physics MMO Prototype

Build a playable browser-based prototype of a text-driven MMO with emergent AI-generated mechanics. The game uses five geometric primitives and two semantic types to model everything. An LLM generates new game mechanics at runtime by outputting structured JSON that the engine validates and executes.

This is a single-session prototype. No authentication, no persistence beyond memory. One player, one planet, ~10 zones. The goal is to prove the semantic physics engine works: that AI can generate valid, playable mechanics.

---

## Tech Stack

- **Runtime:** Node.js + TypeScript. Domain state layer must be completely decoupled from frontend and UI. Later on, a completely different frontend must be easily swapped in. The key here is the logic and game state, controller, types, game loop, and logic.
- **Frontend:** Single HTML page with vanilla JS (no framework)
- **AI:** Ollama instance: gemma3. Will run locally.
- **Build:** None required—use tsx to run TypeScript directly

---

## Project Structure

```
mesh-prototype/
├── src/
│   ├── engine/
│   │   ├── types.ts           # All type definitions
│   │   ├── primitives.ts      # Geometric primitive operations
│   │   ├── semantics.ts       # Action and Effect processing
│   │   ├── state.ts           # Game state management
│   │   └── resolver.ts        # Turn resolution logic
│   ├── ai/
│   │   ├── client.ts          # Ollama API client
│   │   ├── prompts.ts         # Prompt templates
│   │   └── validator.ts       # AI output validation
│   ├── world/
│   │   ├── generator.ts       # Planet/zone generation
│   │   └── lore.ts            # Lore atoms for flavor text
│   ├── server.ts              # Express server + API routes
│   └── index.ts               # Entry point
├── public/
│   ├── index.html             # Game UI
│   ├── style.css              # Minimal styling
│   └── game.js                # Frontend logic
├── package.json
└── tsconfig.json
```

---

## Part 1: Type Definitions (src/engine/types.ts)

```typescript
// =============================================================================
// GEOMETRIC PRIMITIVES
// Five atoms that model everything in the game at any zoom level
// =============================================================================

export type Point = {
  type: 'point'
  x: number
  y: number
  z?: number
}

export type Scalar = {
  type: 'scalar'
  magnitude: number
}

export type Vector = {
  type: 'vector'
  origin: Point
  movement: VectorMovement
  magnitude: number
}

export type VectorMovement =
  | { kind: 'static', dx: number, dy: number, dz?: number }
  | { kind: 'linear', velocity: { dx: number, dy: number } }
  | { kind: 'orbital', center: Point, radius: number, period: number }
  | { kind: 'patrol', waypoints: Point[], loop: boolean, currentIndex: number }

export type Cone = {
  type: 'cone'
  origin: Point
  direction: { dx: number, dy: number }
  angle: number                    // degrees, 360 = full circle
  range: number
  maxMagnitude: number
  falloff: 'linear' | 'quadratic' | 'exponential'
  shape: 'circular' | 'elliptical'
  eccentricity?: number
}

export type Cylinder = {
  type: 'cylinder'
  center: Point
  radius: number
  magnitude: number
  shape: 'circular' | 'elliptical'
  eccentricity?: number
  rotation?: number
}

export type GeometricPrimitive = Point | Scalar | Vector | Cone | Cylinder

// =============================================================================
// SEMANTIC TYPES
// Actions (what players do) and Effects (what happens to the world)
// =============================================================================

export type Action = {
  id: string
  actorId: string
  verb: ActionVerb
  targetId: string
  targetPoint?: Point
  submittedAt: number
}

export type ActionVerb = 
  | 'move'
  | 'explore'
  | 'fortify'
  | 'scan'
  | 'extract'
  | 'attack'
  // AI can reference these or the engine can learn new verbs contextually

export type Effect = {
  id: string
  name: string
  flavorText: string
  attachedTo: string              // entity ID
  shape: Cone | Cylinder
  transforms: Transform[]
  duration: number                // ticks remaining, -1 = permanent
  propagation?: {
    shape: Cone | Cylinder
    chance: number                // 0-1
    limit: number                 // max spread count
    spreadCount: number           // current spread count
  }
  createdBy: 'system' | 'ai' | 'player'
  createdAt: number
}

export type Transform =
  | { kind: 'set', field: string, value: number }
  | { kind: 'add', field: string, value: number }
  | { kind: 'multiply', field: string, value: number }
  | { kind: 'addTag', tag: string }
  | { kind: 'removeTag', tag: string }

// =============================================================================
// GAME ENTITIES
// Everything in the world is an Entity with primitives attached
// =============================================================================

export type Entity = {
  id: string
  name: string
  entityType: EntityType
  primitives: NamedPrimitive[]
  properties: Record<string, number>
  tags: string[]
  parentId?: string               // for hierarchical containment
}

export type NamedPrimitive = {
  name: string
  primitive: GeometricPrimitive
}

export type EntityType = 
  | 'planet'
  | 'zone'
  | 'body'
  | 'structure'
  | 'item'
  | 'effect-source'

// =============================================================================
// GAME STATE
// =============================================================================

export type GameState = {
  tick: number
  entities: Map<string, Entity>
  effects: Map<string, Effect>
  actionQueue: Action[]
  eventLog: GameEvent[]
  player: PlayerState
}

export type PlayerState = {
  id: string
  name: string
  bodyId: string                  // which entity is the player's body
  inventory: InventoryItem[]
  activeContractIds: string[]
}

export type InventoryItem = {
  id: string
  name: string
  quantity: number
  properties: Record<string, number>
}

export type GameEvent = {
  tick: number
  timestamp: number
  type: string
  description: string
  data: Record<string, any>
  generatedBy: 'system' | 'ai'
}

// =============================================================================
// AI OUTPUT SCHEMA
// What the LLM produces when generating emergent content
// =============================================================================

export type AIGeneratedContent = {
  flavorText: string
  outcome: {
    success: boolean
    reason?: string
  }
  newEntities?: AIEntityDefinition[]
  newEffects?: AIEffectDefinition[]
  stateChanges?: AIStateChange[]
  followUpHook?: string           // hint for next interaction
}

export type AIEntityDefinition = {
  id: string
  name: string
  entityType: EntityType
  primitives: AIPrimitiveDefinition[]
  properties: Record<string, number>
  tags: string[]
}

export type AIPrimitiveDefinition = {
  name: string
  type: 'point' | 'scalar' | 'vector' | 'cone' | 'cylinder'
  params: Record<string, any>
}

export type AIEffectDefinition = {
  id: string
  name: string
  flavorText: string
  attachedTo: string
  shapeType: 'cone' | 'cylinder'
  shapeParams: Record<string, any>
  transforms: Transform[]
  duration: number
  propagation?: {
    shapeType: 'cone' | 'cylinder'
    shapeParams: Record<string, any>
    chance: number
    limit: number
  }
}

export type AIStateChange = {
  entityId: string
  transform: Transform
}
```

---

## Part 2: Geometric Primitive Operations (src/engine/primitives.ts)

```typescript
import { Point, Scalar, Vector, Cone, Cylinder, GeometricPrimitive, VectorMovement } from './types'

// Distance between two points
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = (b.z ?? 0) - (a.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Check if a point is inside a cylinder's footprint
export function pointInCylinder(point: Point, cylinder: Cylinder): boolean {
  const dist = distance(point, { type: 'point', x: cylinder.center.x, y: cylinder.center.y })
  if (cylinder.shape === 'circular') {
    return dist <= cylinder.radius
  }
  // Elliptical: simplified check using eccentricity
  const ecc = cylinder.eccentricity ?? 0
  const semiMajor = cylinder.radius
  const semiMinor = semiMajor * Math.sqrt(1 - ecc * ecc)
  const rot = (cylinder.rotation ?? 0) * Math.PI / 180
  const dx = point.x - cylinder.center.x
  const dy = point.y - cylinder.center.y
  const rotX = dx * Math.cos(rot) + dy * Math.sin(rot)
  const rotY = -dx * Math.sin(rot) + dy * Math.cos(rot)
  return (rotX * rotX) / (semiMajor * semiMajor) + (rotY * rotY) / (semiMinor * semiMinor) <= 1
}

// Check if a point is inside a cone's area and return the magnitude at that point
export function magnitudeInCone(point: Point, cone: Cone): number {
  const dist = distance(point, cone.origin)
  if (dist > cone.range) return 0
  
  // Check angle (skip if 360 degrees - full circle)
  if (cone.angle < 360) {
    const dx = point.x - cone.origin.x
    const dy = point.y - cone.origin.y
    const pointAngle = Math.atan2(dy, dx)
    const coneAngle = Math.atan2(cone.direction.dy, cone.direction.dx)
    let angleDiff = Math.abs(pointAngle - coneAngle)
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
    const halfAngle = (cone.angle / 2) * Math.PI / 180
    if (angleDiff > halfAngle) return 0
  }
  
  // Calculate magnitude based on falloff
  const normalizedDist = dist / cone.range
  switch (cone.falloff) {
    case 'linear':
      return cone.maxMagnitude * (1 - normalizedDist)
    case 'quadratic':
      return cone.maxMagnitude * (1 - normalizedDist * normalizedDist)
    case 'exponential':
      return cone.maxMagnitude * Math.exp(-3 * normalizedDist)
  }
}

// Get magnitude at a point for any primitive
export function magnitudeAt(primitive: GeometricPrimitive, point: Point): number {
  switch (primitive.type) {
    case 'point':
      return distance(primitive, point) < 0.001 ? 1 : 0
    case 'scalar':
      return primitive.magnitude // no spatial component
    case 'vector':
      return primitive.magnitude // could add distance-from-line calculation
    case 'cone':
      return magnitudeInCone(point, primitive)
    case 'cylinder':
      return pointInCylinder(point, primitive) ? primitive.magnitude : 0
  }
}

// Advance a vector by N ticks
export function advanceVector(vector: Vector, ticks: number): Point {
  const movement = vector.movement
  switch (movement.kind) {
    case 'static':
      return {
        type: 'point',
        x: vector.origin.x + movement.dx * ticks,
        y: vector.origin.y + movement.dy * ticks,
        z: vector.origin.z !== undefined && movement.dz !== undefined 
          ? vector.origin.z + movement.dz * ticks 
          : vector.origin.z
      }
    case 'linear':
      return {
        type: 'point',
        x: vector.origin.x + movement.velocity.dx * ticks,
        y: vector.origin.y + movement.velocity.dy * ticks
      }
    case 'orbital':
      const angle = (2 * Math.PI * ticks) / movement.period
      return {
        type: 'point',
        x: movement.center.x + movement.radius * Math.cos(angle),
        y: movement.center.y + movement.radius * Math.sin(angle)
      }
    case 'patrol':
      const idx = (movement.currentIndex + ticks) % movement.waypoints.length
      return { ...movement.waypoints[idx], type: 'point' }
  }
}

// Check if two primitives overlap (simplified)
export function overlaps(a: GeometricPrimitive, b: GeometricPrimitive): boolean {
  // Get representative points for each primitive
  const pointA = getPrimitiveCenter(a)
  const pointB = getPrimitiveCenter(b)
  
  // Check if each center is within the other
  const aContainsB = magnitudeAt(a, pointB) > 0
  const bContainsA = magnitudeAt(b, pointA) > 0
  
  return aContainsB || bContainsA
}

export function getPrimitiveCenter(p: GeometricPrimitive): Point {
  switch (p.type) {
    case 'point':
      return p
    case 'scalar':
      return { type: 'point', x: 0, y: 0 } // no spatial component
    case 'vector':
      return p.origin
    case 'cone':
      return p.origin
    case 'cylinder':
      return { type: 'point', x: p.center.x, y: p.center.y, z: p.center.z }
  }
}

// Generate a random point within a cylinder
export function randomPointInCylinder(cylinder: Cylinder): Point {
  const angle = Math.random() * 2 * Math.PI
  const r = cylinder.radius * Math.sqrt(Math.random())
  return {
    type: 'point',
    x: cylinder.center.x + r * Math.cos(angle),
    y: cylinder.center.y + r * Math.sin(angle)
  }
}
```

---

## Part 3: World Generator (src/world/generator.ts)

```typescript
import { Entity, Point, Cylinder, Scalar, Cone } from '../engine/types'
import { randomPointInCylinder, distance } from '../engine/primitives'

const TERRAIN_TYPES = ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'] as const
type TerrainType = typeof TERRAIN_TYPES[number]

const TERRAIN_PROPERTIES: Record<TerrainType, { mineralBase: number, defenseBase: number, color: string }> = {
  'regolith-basin': { mineralBase: 2, defenseBase: 1, color: '#8B7355' },
  'impact-ejecta': { mineralBase: 3, defenseBase: 2, color: '#4A4A4A' },
  'volcanic-deposit': { mineralBase: 4, defenseBase: 1, color: '#8B0000' },
  'ice-field': { mineralBase: 2, defenseBase: 3, color: '#B0E0E6' }
}

export function generatePlanet(id: string, name: string, zoneCount: number = 10): Entity[] {
  const entities: Entity[] = []
  
  // Planet entity
  const planet: Entity = {
    id,
    name,
    entityType: 'planet',
    primitives: [
      { name: 'extent', primitive: { type: 'cylinder', center: { type: 'point', x: 0, y: 0 }, radius: 500, magnitude: 0, shape: 'circular' } }
    ],
    properties: {},
    tags: ['planet']
  }
  entities.push(planet)
  
  // Generate zone centers using relaxed random placement
  const planetRadius = 500
  const zoneCenters: Point[] = []
  const minDistance = planetRadius / Math.sqrt(zoneCount) * 0.8
  
  for (let i = 0; i < zoneCount; i++) {
    let attempts = 0
    let center: Point
    do {
      const angle = Math.random() * 2 * Math.PI
      const r = Math.random() * planetRadius * 0.85
      center = { type: 'point', x: r * Math.cos(angle), y: r * Math.sin(angle) }
      attempts++
    } while (attempts < 100 && zoneCenters.some(c => distance(c, center) < minDistance))
    zoneCenters.push(center)
  }
  
  // Create zone entities
  zoneCenters.forEach((center, i) => {
    const terrain = TERRAIN_TYPES[Math.floor(Math.random() * TERRAIN_TYPES.length)]
    const props = TERRAIN_PROPERTIES[terrain]
    const zoneRadius = 40 + Math.random() * 30
    
    const zone: Entity = {
      id: `${id}-zone-${i}`,
      name: `Zone ${i + 1}`,
      entityType: 'zone',
      primitives: [
        { 
          name: 'area', 
          primitive: { 
            type: 'cylinder', 
            center, 
            radius: zoneRadius, 
            magnitude: 0, 
            shape: Math.random() > 0.5 ? 'circular' : 'elliptical',
            eccentricity: Math.random() * 0.4,
            rotation: Math.random() * 360
          } 
        },
        { name: 'mineralDensity', primitive: { type: 'scalar', magnitude: props.mineralBase + Math.floor(Math.random() * 3) } },
        { name: 'defenseStrength', primitive: { type: 'scalar', magnitude: props.defenseBase + Math.floor(Math.random() * 2) } }
      ],
      properties: {
        mineralYield: props.mineralBase + Math.floor(Math.random() * 3),
        explorationCost: 1,
        defenseStrength: props.defenseBase + Math.floor(Math.random() * 3),
        explored: 0
      },
      tags: [terrain, 'zone'],
      parentId: id
    }
    entities.push(zone)
  })
  
  // Calculate adjacencies (zones within range are adjacent)
  const zones = entities.filter(e => e.entityType === 'zone')
  zones.forEach(zone => {
    const zoneCenter = (zone.primitives.find(p => p.name === 'area')?.primitive as Cylinder).center
    const adjacentIds = zones
      .filter(other => {
        if (other.id === zone.id) return false
        const otherCenter = (other.primitives.find(p => p.name === 'area')?.primitive as Cylinder).center
        return distance(zoneCenter, otherCenter) < 150
      })
      .map(z => z.id)
    zone.tags.push(...adjacentIds.map(id => `adjacent:${id}`))
  })
  
  return entities
}

export function generatePlayerBody(playerId: string, startZone: Entity): Entity {
  const zoneArea = startZone.primitives.find(p => p.name === 'area')?.primitive as Cylinder
  const startPos = randomPointInCylinder(zoneArea)
  
  return {
    id: `body-${playerId}`,
    name: 'Your Body',
    entityType: 'body',
    primitives: [
      { name: 'position', primitive: { type: 'point', ...startPos } },
      { 
        name: 'perception', 
        primitive: { 
          type: 'cone', 
          origin: startPos, 
          direction: { dx: 1, dy: 0 }, 
          angle: 120, 
          range: 100, 
          maxMagnitude: 10, 
          falloff: 'linear', 
          shape: 'circular' 
        } 
      }
    ],
    properties: {
      health: 100,
      energy: 100,
      carryCapacity: 10
    },
    tags: ['body', 'player-controlled'],
    parentId: startZone.id
  }
}
```

---

## Part 4: Lore Atoms (src/world/lore.ts)

```typescript
export const LORE_ATOMS = {
  terrainOpeners: {
    'regolith-basin': [
      "Fine dust crunches beneath your boots as you traverse the basin.",
      "The grey expanse stretches endlessly, pockmarked by ancient impacts.",
      "Regolith swirls in your wake, disturbed for the first time in millennia."
    ],
    'impact-ejecta': [
      "Jagged debris fields surround you, remnants of cosmic violence.",
      "You pick your way through shattered rock and twisted metal.",
      "The chaotic terrain offers countless hiding spots—and ambush points."
    ],
    'volcanic-deposit': [
      "Sulfurous vents hiss warnings as you approach.",
      "Mineral-rich striations paint the ground in reds and blacks.",
      "Heat radiates from fissures in the unstable crust."
    ],
    'ice-field': [
      "Ancient ice groans beneath your weight.",
      "Crystalline formations catch the starlight, refracting it into rainbows.",
      "Subsurface oceans pulse with unknowable pressure below."
    ]
  },
  
  outcomeConnectors: {
    mineralFind: [
      "Your scanner pings—deposits confirmed.",
      "Beneath the surface, valuable ore veins glint.",
      "The extraction probe hits paydirt."
    ],
    equipmentFind: [
      "Half-buried in sediment, something manufactured.",
      "Salvage. Someone was here before.",
      "A cache, hidden deliberately or lost to time."
    ],
    hostileEncounter: [
      "Movement. Not friendly.",
      "Proximity alarms shriek.",
      "You're not alone here."
    ],
    discovery: [
      "Something unexpected reveals itself.",
      "Your instruments register an anomaly.",
      "This wasn't in any survey data."
    ]
  },
  
  flavorClosers: [
    "The Combine's satellites watch, as always.",
    "Somewhere, someone profits from your labor.",
    "Another cycle survived. Another cycle closer to something.",
    "The void doesn't care. But you do.",
    "Data uploaded. Decisions await.",
    "The universe reveals its secrets reluctantly."
  ],
  
  effectDescriptors: {
    chemical: ["toxic residue", "corrosive agents", "industrial runoff", "chemical contamination"],
    radiation: ["ionizing particles", "radioactive decay", "cosmic ray damage", "nuclear fallout"],
    seismic: ["tectonic instability", "subsurface collapse", "ground liquefaction", "tremor damage"],
    biological: ["microbial bloom", "organic contamination", "spore release", "biohazard"],
    thermal: ["heat surge", "cryogenic leak", "thermal shock", "temperature anomaly"]
  }
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateFlavorText(terrain: string, outcome: string): string {
  const terrainKey = terrain as keyof typeof LORE_ATOMS.terrainOpeners
  const opener = randomFrom(LORE_ATOMS.terrainOpeners[terrainKey] || LORE_ATOMS.terrainOpeners['regolith-basin'])
  const connector = randomFrom(LORE_ATOMS.outcomeConnectors[outcome as keyof typeof LORE_ATOMS.outcomeConnectors] || LORE_ATOMS.outcomeConnectors.discovery)
  const closer = randomFrom(LORE_ATOMS.flavorClosers)
  
  return `${opener} ${connector} ${closer}`
}
```

---

## Part 5: AI Client (src/ai/client.ts)

```typescript
import { AIGeneratedContent } from '../engine/types'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL || 'gemma3'

export async function generateContent(prompt: string): Promise<AIGeneratedContent | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: 'json'
      })
    })
    
    if (!response.ok) {
      console.error('Ollama error:', response.statusText)
      return null
    }
    
    const data = await response.json()
    const content = JSON.parse(data.response) as AIGeneratedContent
    return content
  } catch (error) {
    console.error('AI generation failed:', error)
    return null
  }
}
```

---

## Part 6: AI Prompts (src/ai/prompts.ts)

```typescript
import { Entity, Effect, GameState, Action } from '../engine/types'
import { LORE_ATOMS } from '../world/lore'

export function buildExplorationPrompt(
  zone: Entity,
  actor: Entity,
  gameState: GameState
): string {
  const terrain = zone.tags.find(t => LORE_ATOMS.terrainOpeners[t as keyof typeof LORE_ATOMS.terrainOpeners])
  const activeEffects = Array.from(gameState.effects.values()).filter(e => e.attachedTo === zone.id)
  
  return `You are the emergent narrator and mechanics generator for MESH, a text-based space MMO.

CONTEXT:
- Location: ${zone.name} on planet ${zone.parentId}
- Terrain: ${terrain || 'unknown'}
- Zone properties: mineralYield=${zone.properties.mineralYield}, explorationCost=${zone.properties.explorationCost}, defenseStrength=${zone.properties.defenseStrength}
- Times explored: ${zone.properties.explored}
- Active effects: ${activeEffects.map(e => e.name).join(', ') || 'none'}
- Actor: ${actor.name} with health=${actor.properties.health}, energy=${actor.properties.energy}

ACTION: The player is exploring this zone.

Generate a JSON response with:
1. Engaging flavor text (2-3 sentences, gritty sci-fi tone)
2. An outcome (usually success with minerals/equipment, sometimes complications)
3. Optionally: a NEW emergent effect that changes zone properties

CONSTRAINTS FOR EFFECTS:
- Transform multipliers: 0.25 to 2.0
- Transform additions: -3 to +3  
- Duration: 1 to 10 ticks
- Spread chance: 0 to 0.3
- Only generate new effects ~30% of the time to keep them special

RESPOND WITH VALID JSON ONLY:
{
  "flavorText": "string",
  "outcome": {
    "success": boolean,
    "reason": "string if failed"
  },
  "stateChanges": [
    { "entityId": "string", "transform": { "kind": "add|multiply|set", "field": "string", "value": number } }
  ],
  "newEffects": [
    {
      "id": "unique-id",
      "name": "Effect Name",
      "flavorText": "What this effect represents",
      "attachedTo": "${zone.id}",
      "shapeType": "cone|cylinder",
      "shapeParams": { "radius": number, "magnitude": number, ... },
      "transforms": [{ "kind": "multiply", "field": "mineralYield", "value": 0.5 }],
      "duration": 5,
      "propagation": null
    }
  ]
}`
}

export function buildIncursionPrompt(
  attackerZone: Entity,
  defenderZone: Entity,
  attackForce: number,
  gameState: GameState
): string {
  return `You are the emergent narrator for MESH combat resolution.

CONTEXT:
- Attacker is assaulting ${defenderZone.name} with force ${attackForce}
- Defender strength: ${defenderZone.properties.defenseStrength} (HIDDEN from attacker)
- Defender terrain: ${defenderZone.tags.find(t => t.includes('basin') || t.includes('ejecta') || t.includes('volcanic') || t.includes('ice'))}
- Active effects on target: ${Array.from(gameState.effects.values()).filter(e => e.attachedTo === defenderZone.id).map(e => e.name).join(', ') || 'none'}

RESOLUTION RULE: Attacker wins if attackForce > defenseStrength. Otherwise defender holds.

Generate a JSON response describing the battle outcome. If the terrain or effects should influence the battle, factor that in narratively. You may generate aftermath effects (craters, radiation, damaged infrastructure).

{
  "flavorText": "string (dramatic battle description)",
  "outcome": {
    "success": boolean,
    "reason": "string"
  },
  "stateChanges": [
    { "entityId": "string", "transform": { "kind": "set", "field": "owner", "value": "attacker-id or unchanged" } }
  ],
  "newEffects": []
}`
}

export function buildMovementPrompt(
  actor: Entity,
  fromZone: Entity,
  toZone: Entity,
  gameState: GameState
): string {
  const pathEffects = Array.from(gameState.effects.values()).filter(e => 
    e.attachedTo === fromZone.id || e.attachedTo === toZone.id
  )
  
  return `You are the emergent narrator for MESH movement.

CONTEXT:
- ${actor.name} is traveling from ${fromZone.name} to ${toZone.name}
- Origin terrain: ${fromZone.tags.find(t => t.includes('basin') || t.includes('ejecta') || t.includes('volcanic') || t.includes('ice'))}
- Destination terrain: ${toZone.tags.find(t => t.includes('basin') || t.includes('ejecta') || t.includes('volcanic') || t.includes('ice'))}
- Path effects: ${pathEffects.map(e => e.name).join(', ') || 'none'}
- Actor energy: ${actor.properties.energy}

Movement usually succeeds, but effects or terrain might cause complications. Generate brief travel narration. Only generate new effects if something dramatic happens in transit (~10% of the time).

{
  "flavorText": "string (1-2 sentences)",
  "outcome": {
    "success": true,
    "reason": null
  },
  "stateChanges": [
    { "entityId": "${actor.id}", "transform": { "kind": "set", "field": "parentId", "value": "${toZone.id}" } }
  ],
  "newEffects": []
}`
}
```

---

## Part 7: AI Validator (src/ai/validator.ts)

```typescript
import { AIGeneratedContent, AIEffectDefinition, Transform } from '../engine/types'

export type ValidationResult = 
  | { valid: true, content: AIGeneratedContent }
  | { valid: false, errors: string[] }

export function validateAIContent(raw: unknown): ValidationResult {
  const errors: string[] = []
  
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not an object'] }
  }
  
  const content = raw as Record<string, unknown>
  
  // Required fields
  if (typeof content.flavorText !== 'string') {
    errors.push('Missing or invalid flavorText')
  }
  
  if (!content.outcome || typeof content.outcome !== 'object') {
    errors.push('Missing or invalid outcome')
  } else {
    const outcome = content.outcome as Record<string, unknown>
    if (typeof outcome.success !== 'boolean') {
      errors.push('outcome.success must be boolean')
    }
  }
  
  // Validate transforms
  if (content.stateChanges && Array.isArray(content.stateChanges)) {
    for (const change of content.stateChanges) {
      const transformErrors = validateTransform(change.transform)
      errors.push(...transformErrors)
    }
  }
  
  // Validate effects
  if (content.newEffects && Array.isArray(content.newEffects)) {
    for (const effect of content.newEffects) {
      const effectErrors = validateEffect(effect)
      errors.push(...effectErrors)
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors }
  }
  
  return { valid: true, content: content as unknown as AIGeneratedContent }
}

function validateTransform(transform: unknown): string[] {
  const errors: string[] = []
  if (!transform || typeof transform !== 'object') {
    errors.push('Transform is not an object')
    return errors
  }
  
  const t = transform as Record<string, unknown>
  
  if (!['set', 'add', 'multiply', 'addTag', 'removeTag'].includes(t.kind as string)) {
    errors.push(`Invalid transform kind: ${t.kind}`)
  }
  
  if (t.kind === 'multiply') {
    const value = t.value as number
    if (value < 0.1 || value > 3.0) {
      errors.push(`Multiply value ${value} out of bounds [0.1, 3.0]`)
    }
  }
  
  if (t.kind === 'add') {
    const value = t.value as number
    if (value < -5 || value > 5) {
      errors.push(`Add value ${value} out of bounds [-5, 5]`)
    }
  }
  
  return errors
}

function validateEffect(effect: unknown): string[] {
  const errors: string[] = []
  if (!effect || typeof effect !== 'object') {
    errors.push('Effect is not an object')
    return errors
  }
  
  const e = effect as Record<string, unknown>
  
  if (typeof e.id !== 'string' || e.id.length === 0) {
    errors.push('Effect missing valid id')
  }
  
  if (typeof e.name !== 'string' || e.name.length === 0) {
    errors.push('Effect missing valid name')
  }
  
  if (typeof e.duration !== 'number' || e.duration < 1 || e.duration > 20) {
    errors.push(`Effect duration ${e.duration} out of bounds [1, 20]`)
  }
  
  if (e.propagation) {
    const prop = e.propagation as Record<string, unknown>
    if (typeof prop.chance === 'number' && (prop.chance < 0 || prop.chance > 0.5)) {
      errors.push(`Propagation chance ${prop.chance} out of bounds [0, 0.5]`)
    }
  }
  
  if (Array.isArray(e.transforms)) {
    for (const t of e.transforms) {
      errors.push(...validateTransform(t))
    }
  }
  
  return errors
}
```

---

## Part 8: Game State Management (src/engine/state.ts)

```typescript
import { GameState, Entity, Effect, Action, PlayerState, InventoryItem, GameEvent, Transform } from './types'
import { generatePlanet, generatePlayerBody } from '../world/generator'

export function createInitialState(): GameState {
  const planetEntities = generatePlanet('planet-alpha', 'Alpha Prime', 10)
  const zones = planetEntities.filter(e => e.entityType === 'zone')
  const startZone = zones[0]
  const playerBody = generatePlayerBody('player-1', startZone)
  
  const entities = new Map<string, Entity>()
  for (const entity of [...planetEntities, playerBody]) {
    entities.set(entity.id, entity)
  }
  
  const player: PlayerState = {
    id: 'player-1',
    name: 'Pioneer',
    bodyId: playerBody.id,
    inventory: [
      { id: 'alpha-minerals', name: 'Alpha Minerals', quantity: 5, properties: { value: 1 } },
      { id: 'beta-minerals', name: 'Beta Minerals', quantity: 2, properties: { value: 2 } }
    ],
    activeContractIds: []
  }
  
  return {
    tick: 0,
    entities,
    effects: new Map(),
    actionQueue: [],
    eventLog: [],
    player
  }
}

export function applyTransform(entity: Entity, transform: Transform): Entity {
  const updated = { ...entity, properties: { ...entity.properties }, tags: [...entity.tags] }
  
  switch (transform.kind) {
    case 'set':
      updated.properties[transform.field] = transform.value
      break
    case 'add':
      updated.properties[transform.field] = (updated.properties[transform.field] || 0) + transform.value
      break
    case 'multiply':
      updated.properties[transform.field] = (updated.properties[transform.field] || 1) * transform.value
      break
    case 'addTag':
      if (!updated.tags.includes(transform.tag)) {
        updated.tags.push(transform.tag)
      }
      break
    case 'removeTag':
      updated.tags = updated.tags.filter(t => t !== transform.tag)
      break
  }
  
  return updated
}

export function addEffect(state: GameState, effect: Effect): GameState {
  const newEffects = new Map(state.effects)
  newEffects.set(effect.id, effect)
  return { ...state, effects: newEffects }
}

export function tickEffects(state: GameState): GameState {
  const updatedEffects = new Map<string, Effect>()
  const expiredEffects: Effect[] = []
  
  for (const [id, effect] of state.effects) {
    if (effect.duration === -1) {
      // Permanent effect
      updatedEffects.set(id, effect)
    } else if (effect.duration > 1) {
      // Decrement duration
      updatedEffects.set(id, { ...effect, duration: effect.duration - 1 })
    } else {
      // Effect expires
      expiredEffects.push(effect)
    }
  }
  
  // Log expired effects
  const newEvents = expiredEffects.map(e => ({
    tick: state.tick,
    timestamp: Date.now(),
    type: 'effect-expired',
    description: `${e.name} has dissipated.`,
    data: { effectId: e.id },
    generatedBy: 'system' as const
  }))
  
  return {
    ...state,
    effects: updatedEffects,
    eventLog: [...state.eventLog, ...newEvents]
  }
}

export function getEntityById(state: GameState, id: string): Entity | undefined {
  return state.entities.get(id)
}

export function getPlayerBody(state: GameState): Entity | undefined {
  return state.entities.get(state.player.bodyId)
}

export function getCurrentZone(state: GameState): Entity | undefined {
  const body = getPlayerBody(state)
  if (!body) return undefined
  return state.entities.get(body.parentId || '')
}

export function getAdjacentZones(state: GameState, zoneId: string): Entity[] {
  const zone = state.entities.get(zoneId)
  if (!zone) return []
  
  const adjacentIds = zone.tags
    .filter(t => t.startsWith('adjacent:'))
    .map(t => t.replace('adjacent:', ''))
  
  return adjacentIds
    .map(id => state.entities.get(id))
    .filter((e): e is Entity => e !== undefined)
}

export function getAllZones(state: GameState): Entity[] {
  return Array.from(state.entities.values()).filter(e => e.entityType === 'zone')
}
```

---

## Part 9: Action Resolver (src/engine/resolver.ts)

```typescript
import { GameState, Action, Entity, Effect, GameEvent, AIGeneratedContent, Cylinder } from './types'
import { applyTransform, addEffect, getEntityById, getPlayerBody, getCurrentZone, getAdjacentZones } from './state'
import { generateContent } from '../ai/client'
import { buildExplorationPrompt, buildMovementPrompt, buildIncursionPrompt } from '../ai/prompts'
import { validateAIContent } from '../ai/validator'
import { generateFlavorText } from '../world/lore'
import { randomPointInCylinder } from './primitives'

export async function resolveAction(state: GameState, action: Action): Promise<GameState> {
  switch (action.verb) {
    case 'explore':
      return resolveExplore(state, action)
    case 'move':
      return resolveMove(state, action)
    case 'fortify':
      return resolveFortify(state, action)
    case 'scan':
      return resolveScan(state, action)
    default:
      return state
  }
}

async function resolveExplore(state: GameState, action: Action): Promise<GameState> {
  const actor = getPlayerBody(state)
  const zone = getCurrentZone(state)
  
  if (!actor || !zone) {
    return addEvent(state, 'error', 'Cannot explore: invalid state')
  }
  
  // Build prompt and call AI
  const prompt = buildExplorationPrompt(zone, actor, state)
  const aiResponse = await generateContent(prompt)
  
  let updatedState = state
  
  if (aiResponse) {
    const validation = validateAIContent(aiResponse)
    
    if (validation.valid) {
      const content = validation.content
      
      // Apply state changes
      if (content.stateChanges) {
        for (const change of content.stateChanges) {
          const entity = getEntityById(updatedState, change.entityId)
          if (entity) {
            const updated = applyTransform(entity, change.transform)
            const newEntities = new Map(updatedState.entities)
            newEntities.set(entity.id, updated)
            updatedState = { ...updatedState, entities: newEntities }
          }
        }
      }
      
      // Add new effects
      if (content.newEffects) {
        for (const effectDef of content.newEffects) {
          const effect = convertAIEffect(effectDef, zone)
          updatedState = addEffect(updatedState, effect)
        }
      }
      
      // Grant minerals on success
      if (content.outcome.success) {
        const mineralYield = zone.properties.mineralYield || 1
        const mineralType = Math.random() > 0.7 ? 'beta-minerals' : 'alpha-minerals'
        updatedState = addInventoryItem(updatedState, mineralType, mineralYield)
      }
      
      // Increment explored count
      const updatedZone = { 
        ...zone, 
        properties: { ...zone.properties, explored: (zone.properties.explored || 0) + 1 } 
      }
      const newEntities = new Map(updatedState.entities)
      newEntities.set(zone.id, updatedZone)
      updatedState = { ...updatedState, entities: newEntities }
      
      // Log event
      updatedState = addEvent(updatedState, 'exploration', content.flavorText, { 
        zoneId: zone.id, 
        success: content.outcome.success,
        newEffects: content.newEffects?.map(e => e.name) || []
      })
    } else {
      // AI validation failed, use fallback
      console.warn('AI validation failed:', validation.errors)
      updatedState = resolveFallbackExplore(state, zone)
    }
  } else {
    // AI call failed, use fallback
    updatedState = resolveFallbackExplore(state, zone)
  }
  
  return updatedState
}

function resolveFallbackExplore(state: GameState, zone: Entity): GameState {
  const terrain = zone.tags.find(t => ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'].includes(t)) || 'regolith-basin'
  const roll = Math.random()
  
  let outcome: string
  let updatedState = state
  
  if (roll < 0.7) {
    // Find minerals
    outcome = 'mineralFind'
    const yield_ = zone.properties.mineralYield || 1
    updatedState = addInventoryItem(state, 'alpha-minerals', yield_)
  } else if (roll < 0.9) {
    // Find equipment
    outcome = 'equipmentFind'
    updatedState = addInventoryItem(state, 'scanner', 1)
  } else {
    // Hostile encounter
    outcome = 'hostileEncounter'
  }
  
  const flavor = generateFlavorText(terrain, outcome)
  return addEvent(updatedState, 'exploration', flavor, { zoneId: zone.id, fallback: true })
}

async function resolveMove(state: GameState, action: Action): Promise<GameState> {
  const actor = getPlayerBody(state)
  const fromZone = getCurrentZone(state)
  const toZone = getEntityById(state, action.targetId)
  
  if (!actor || !fromZone || !toZone) {
    return addEvent(state, 'error', 'Cannot move: invalid target')
  }
  
  // Check adjacency
  const adjacent = getAdjacentZones(state, fromZone.id)
  if (!adjacent.find(z => z.id === toZone.id)) {
    return addEvent(state, 'error', `Cannot move: ${toZone.name} is not adjacent`)
  }
  
  // Call AI for flavor
  const prompt = buildMovementPrompt(actor, fromZone, toZone, state)
  const aiResponse = await generateContent(prompt)
  
  // Update body position
  const toZoneArea = toZone.primitives.find(p => p.name === 'area')?.primitive as Cylinder
  const newPosition = randomPointInCylinder(toZoneArea)
  
  const updatedBody: Entity = {
    ...actor,
    parentId: toZone.id,
    primitives: actor.primitives.map(p => 
      p.name === 'position' ? { ...p, primitive: { type: 'point' as const, ...newPosition } } : p
    )
  }
  
  const newEntities = new Map(state.entities)
  newEntities.set(actor.id, updatedBody)
  
  let updatedState = { ...state, entities: newEntities }
  
  const flavorText = aiResponse?.flavorText || `You travel to ${toZone.name}.`
  updatedState = addEvent(updatedState, 'movement', flavorText, { from: fromZone.id, to: toZone.id })
  
  return updatedState
}

async function resolveFortify(state: GameState, action: Action): Promise<GameState> {
  const zone = getEntityById(state, action.targetId)
  
  if (!zone || zone.entityType !== 'zone') {
    return addEvent(state, 'error', 'Cannot fortify: invalid zone')
  }
  
  const currentStrength = zone.properties.defenseStrength || 1
  if (currentStrength >= 5) {
    return addEvent(state, 'error', `${zone.name} is already at maximum fortification`)
  }
  
  const updatedZone = {
    ...zone,
    properties: { ...zone.properties, defenseStrength: currentStrength + 1 }
  }
  
  const newEntities = new Map(state.entities)
  newEntities.set(zone.id, updatedZone)
  
  let updatedState = { ...state, entities: newEntities }
  updatedState = addEvent(updatedState, 'fortification', `${zone.name} fortified. Defense strength now ${currentStrength + 1}.`, { zoneId: zone.id })
  
  return updatedState
}

async function resolveScan(state: GameState, action: Action): Promise<GameState> {
  const zone = getEntityById(state, action.targetId)
  
  if (!zone || zone.entityType !== 'zone') {
    return addEvent(state, 'error', 'Cannot scan: invalid zone')
  }
  
  const effects = Array.from(state.effects.values()).filter(e => e.attachedTo === zone.id)
  
  const scanResult = {
    name: zone.name,
    terrain: zone.tags.find(t => ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'].includes(t)),
    mineralYield: zone.properties.mineralYield,
    defenseStrength: zone.properties.defenseStrength,
    explored: zone.properties.explored,
    activeEffects: effects.map(e => ({ name: e.name, duration: e.duration }))
  }
  
  return addEvent(state, 'scan', `Scan complete: ${JSON.stringify(scanResult, null, 2)}`, { zoneId: zone.id, result: scanResult })
}

function convertAIEffect(def: any, zone: Entity): Effect {
  const zoneArea = zone.primitives.find(p => p.name === 'area')?.primitive as Cylinder
  
  return {
    id: def.id || `effect-${Date.now()}`,
    name: def.name,
    flavorText: def.flavorText || '',
    attachedTo: def.attachedTo,
    shape: def.shapeType === 'cone' 
      ? {
          type: 'cone',
          origin: zoneArea.center,
          direction: { dx: 0, dy: 0 },
          angle: 360,
          range: def.shapeParams?.range || 50,
          maxMagnitude: def.shapeParams?.maxMagnitude || 1,
          falloff: def.shapeParams?.falloff || 'linear',
          shape: 'circular'
        }
      : {
          type: 'cylinder',
          center: zoneArea.center,
          radius: def.shapeParams?.radius || 50,
          magnitude: def.shapeParams?.magnitude || 1,
          shape: 'circular'
        },
    transforms: def.transforms || [],
    duration: def.duration || 5,
    propagation: def.propagation ? {
      shape: {
        type: 'cylinder',
        center: zoneArea.center,
        radius: def.propagation.shapeParams?.radius || 30,
        magnitude: 0,
        shape: 'circular'
      },
      chance: def.propagation.chance || 0.1,
      limit: def.propagation.limit || 3,
      spreadCount: 0
    } : undefined,
    createdBy: 'ai',
    createdAt: Date.now()
  }
}

function addInventoryItem(state: GameState, itemId: string, quantity: number): GameState {
  const inventory = [...state.player.inventory]
  const existing = inventory.find(i => i.id === itemId)
  
  if (existing) {
    existing.quantity += quantity
  } else {
    inventory.push({ id: itemId, name: itemId, quantity, properties: {} })
  }
  
  return { ...state, player: { ...state.player, inventory } }
}

function addEvent(state: GameState, type: string, description: string, data: Record<string, any> = {}): GameState {
  const event: GameEvent = {
    tick: state.tick,
    timestamp: Date.now(),
    type,
    description,
    data,
    generatedBy: 'system'
  }
  
  return { ...state, eventLog: [...state.eventLog, event] }
}
```

---

## Part 10: Express Server (src/server.ts)

```typescript
import express from 'express'
import cors from 'cors'
import { createInitialState, getCurrentZone, getAdjacentZones, getAllZones, getPlayerBody, tickEffects } from './engine/state'
import { resolveAction } from './engine/resolver'
import { GameState, Action } from './engine/types'

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public'))

let gameState: GameState = createInitialState()

// Get current game state (client view)
app.get('/api/state', (req, res) => {
  const body = getPlayerBody(gameState)
  const currentZone = getCurrentZone(gameState)
  const adjacentZones = currentZone ? getAdjacentZones(gameState, currentZone.id) : []
  const allZones = getAllZones(gameState)
  const activeEffects = Array.from(gameState.effects.values())
  
  res.json({
    tick: gameState.tick,
    player: gameState.player,
    body: body ? {
      id: body.id,
      name: body.name,
      properties: body.properties,
      location: body.parentId
    } : null,
    currentZone: currentZone ? {
      id: currentZone.id,
      name: currentZone.name,
      terrain: currentZone.tags.find(t => ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'].includes(t)),
      properties: currentZone.properties,
      effects: activeEffects.filter(e => e.attachedTo === currentZone.id).map(e => ({
        name: e.name,
        duration: e.duration,
        flavorText: e.flavorText
      }))
    } : null,
    adjacentZones: adjacentZones.map(z => ({
      id: z.id,
      name: z.name,
      terrain: z.tags.find(t => ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'].includes(t))
    })),
    allZones: allZones.map(z => ({
      id: z.id,
      name: z.name,
      terrain: z.tags.find(t => ['regolith-basin', 'impact-ejecta', 'volcanic-deposit', 'ice-field'].includes(t)),
      center: (z.primitives.find(p => p.name === 'area')?.primitive as any)?.center,
      radius: (z.primitives.find(p => p.name === 'area')?.primitive as any)?.radius,
      properties: z.properties
    })),
    activeEffects: activeEffects.map(e => ({
      id: e.id,
      name: e.name,
      attachedTo: e.attachedTo,
      duration: e.duration,
      flavorText: e.flavorText
    })),
    recentEvents: gameState.eventLog.slice(-20)
  })
})

// Submit an action
app.post('/api/action', async (req, res) => {
  const { verb, targetId } = req.body
  
  if (!verb) {
    return res.status(400).json({ error: 'Missing verb' })
  }
  
  const action: Action = {
    id: `action-${Date.now()}`,
    actorId: gameState.player.bodyId,
    verb,
    targetId: targetId || '',
    submittedAt: Date.now()
  }
  
  try {
    gameState = await resolveAction(gameState, action)
    res.json({ success: true, event: gameState.eventLog[gameState.eventLog.length - 1] })
  } catch (error) {
    console.error('Action failed:', error)
    res.status(500).json({ error: 'Action resolution failed' })
  }
})

// Advance tick (simulate daily resolution)
app.post('/api/tick', (req, res) => {
  gameState = tickEffects(gameState)
  gameState = { ...gameState, tick: gameState.tick + 1 }
  res.json({ tick: gameState.tick })
})

// Reset game
app.post('/api/reset', (req, res) => {
  gameState = createInitialState()
  res.json({ success: true })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`MESH prototype running at http://localhost:${PORT}`)
})
```

---

## Part 11: Frontend HTML (public/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MESH Prototype</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>MESH</h1>
      <span id="tick-display">Tick: 0</span>
    </header>
    
    <main>
      <section id="map-container">
        <h2>Planet Alpha Prime</h2>
        <svg id="planet-map" viewBox="-550 -550 1100 1100"></svg>
      </section>
      
      <section id="info-panel">
        <div id="player-info">
          <h3>Pioneer</h3>
          <div id="player-stats"></div>
          <div id="inventory"></div>
        </div>
        
        <div id="zone-info">
          <h3 id="zone-name">Current Zone</h3>
          <div id="zone-details"></div>
          <div id="zone-effects"></div>
        </div>
        
        <div id="actions">
          <h3>Actions</h3>
          <div id="action-buttons"></div>
          <select id="move-target">
            <option value="">Select destination...</option>
          </select>
        </div>
      </section>
      
      <section id="event-log">
        <h3>Event Log</h3>
        <div id="events"></div>
      </section>
    </main>
    
    <footer>
      <button id="tick-btn">Advance Tick</button>
      <button id="reset-btn">Reset Game</button>
    </footer>
  </div>
  
  <script src="game.js"></script>
</body>
</html>
```

---

## Part 12: Frontend CSS (public/style.css)

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Courier New', monospace;
  background: #0a0a0f;
  color: #c0c0c0;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #12121a;
  border-bottom: 1px solid #2a2a3a;
}

header h1 {
  color: #00ff88;
  font-size: 1.5rem;
  letter-spacing: 0.3em;
}

#tick-display {
  color: #888;
}

main {
  display: grid;
  grid-template-columns: 1fr 300px 300px;
  gap: 1rem;
  padding: 1rem;
  flex: 1;
}

section {
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 4px;
  padding: 1rem;
}

h2, h3 {
  color: #00ff88;
  margin-bottom: 1rem;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

#planet-map {
  width: 100%;
  height: 500px;
  background: #08080c;
  border-radius: 4px;
}

.zone {
  fill-opacity: 0.6;
  stroke: #2a2a3a;
  stroke-width: 1;
  cursor: pointer;
  transition: fill-opacity 0.2s;
}

.zone:hover {
  fill-opacity: 0.9;
}

.zone.current {
  stroke: #00ff88;
  stroke-width: 3;
}

.zone.adjacent {
  stroke: #ffaa00;
  stroke-width: 2;
}

.zone-label {
  fill: #ffffff;
  font-size: 10px;
  text-anchor: middle;
  pointer-events: none;
}

#player-stats, #inventory, #zone-details, #zone-effects {
  margin-bottom: 1rem;
  font-size: 0.85rem;
  line-height: 1.6;
}

#inventory {
  border-top: 1px solid #2a2a3a;
  padding-top: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: #fff;
}

#action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

button {
  background: #1a1a2a;
  border: 1px solid #3a3a5a;
  color: #c0c0c0;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
  transition: all 0.2s;
}

button:hover {
  background: #2a2a4a;
  border-color: #00ff88;
  color: #00ff88;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select {
  width: 100%;
  background: #1a1a2a;
  border: 1px solid #3a3a5a;
  color: #c0c0c0;
  padding: 0.5rem;
  font-family: inherit;
}

#event-log {
  max-height: 600px;
  overflow-y: auto;
}

#events {
  font-size: 0.8rem;
  line-height: 1.8;
}

.event {
  padding: 0.5rem;
  border-bottom: 1px solid #1a1a2a;
}

.event-type {
  color: #00ff88;
  text-transform: uppercase;
  font-size: 0.7rem;
}

.event-description {
  margin-top: 0.25rem;
}

.event.error .event-type {
  color: #ff4444;
}

.event.ai-generated {
  border-left: 2px solid #ff00ff;
  padding-left: 0.75rem;
}

.effect-badge {
  display: inline-block;
  background: #2a1a3a;
  border: 1px solid #5a3a7a;
  padding: 0.2rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  margin: 0.2rem;
}

footer {
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem;
  background: #12121a;
  border-top: 1px solid #2a2a3a;
}

/* Terrain colors */
.terrain-regolith-basin { fill: #8B7355; }
.terrain-impact-ejecta { fill: #4A4A4A; }
.terrain-volcanic-deposit { fill: #8B0000; }
.terrain-ice-field { fill: #4A7B8C; }

/* Loading state */
.loading {
  opacity: 0.5;
  pointer-events: none;
}
</style>
```

---

## Part 13: Frontend JavaScript (public/game.js)

```javascript
const API_BASE = ''

let state = null
let loading = false

async function fetchState() {
  const res = await fetch(`${API_BASE}/api/state`)
  state = await res.json()
  render()
}

async function submitAction(verb, targetId = null) {
  if (loading) return
  setLoading(true)
  
  try {
    const res = await fetch(`${API_BASE}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verb, targetId })
    })
    const result = await res.json()
    await fetchState()
  } catch (error) {
    console.error('Action failed:', error)
  } finally {
    setLoading(false)
  }
}

async function advanceTick() {
  if (loading) return
  setLoading(true)
  
  try {
    await fetch(`${API_BASE}/api/tick`, { method: 'POST' })
    await fetchState()
  } finally {
    setLoading(false)
  }
}

async function resetGame() {
  if (!confirm('Reset the game? All progress will be lost.')) return
  setLoading(true)
  
  try {
    await fetch(`${API_BASE}/api/reset`, { method: 'POST' })
    await fetchState()
  } finally {
    setLoading(false)
  }
}

function setLoading(isLoading) {
  loading = isLoading
  document.body.classList.toggle('loading', isLoading)
}

function render() {
  if (!state) return
  
  renderTick()
  renderMap()
  renderPlayerInfo()
  renderZoneInfo()
  renderActions()
  renderEvents()
}

function renderTick() {
  document.getElementById('tick-display').textContent = `Tick: ${state.tick}`
}

function renderMap() {
  const svg = document.getElementById('planet-map')
  svg.innerHTML = ''
  
  // Draw zones
  state.allZones.forEach(zone => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', zone.center?.x || 0)
    circle.setAttribute('cy', zone.center?.y || 0)
    circle.setAttribute('r', zone.radius || 40)
    circle.setAttribute('class', `zone terrain-${zone.terrain || 'regolith-basin'}`)
    
    if (state.currentZone?.id === zone.id) {
      circle.classList.add('current')
    } else if (state.adjacentZones.some(z => z.id === zone.id)) {
      circle.classList.add('adjacent')
    }
    
    circle.addEventListener('click', () => handleZoneClick(zone))
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    label.setAttribute('x', zone.center?.x || 0)
    label.setAttribute('y', zone.center?.y || 0)
    label.setAttribute('class', 'zone-label')
    label.textContent = zone.name.replace('Zone ', '')
    
    group.appendChild(circle)
    group.appendChild(label)
    svg.appendChild(group)
  })
  
  // Draw player position
  if (state.currentZone) {
    const zone = state.allZones.find(z => z.id === state.currentZone.id)
    if (zone?.center) {
      const player = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      player.setAttribute('cx', zone.center.x)
      player.setAttribute('cy', zone.center.y)
      player.setAttribute('r', 8)
      player.setAttribute('fill', '#00ff88')
      player.setAttribute('stroke', '#fff')
      player.setAttribute('stroke-width', 2)
      svg.appendChild(player)
    }
  }
}

function renderPlayerInfo() {
  const statsEl = document.getElementById('player-stats')
  const invEl = document.getElementById('inventory')
  
  if (state.body) {
    statsEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Health:</span><span class="stat-value">${state.body.properties.health}</span></div>
      <div class="stat-row"><span class="stat-label">Energy:</span><span class="stat-value">${state.body.properties.energy}</span></div>
    `
  }
  
  invEl.innerHTML = '<strong>Inventory:</strong><br>' + 
    state.player.inventory.map(item => 
      `${item.name}: ${item.quantity}`
    ).join('<br>')
}

function renderZoneInfo() {
  const nameEl = document.getElementById('zone-name')
  const detailsEl = document.getElementById('zone-details')
  const effectsEl = document.getElementById('zone-effects')
  
  if (state.currentZone) {
    nameEl.textContent = state.currentZone.name
    detailsEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Terrain:</span><span class="stat-value">${state.currentZone.terrain || 'Unknown'}</span></div>
      <div class="stat-row"><span class="stat-label">Mineral Yield:</span><span class="stat-value">${state.currentZone.properties.mineralYield}</span></div>
      <div class="stat-row"><span class="stat-label">Defense:</span><span class="stat-value">${state.currentZone.properties.defenseStrength}</span></div>
      <div class="stat-row"><span class="stat-label">Times Explored:</span><span class="stat-value">${state.currentZone.properties.explored || 0}</span></div>
    `
    
    if (state.currentZone.effects?.length > 0) {
      effectsEl.innerHTML = '<strong>Active Effects:</strong><br>' +
        state.currentZone.effects.map(e => 
          `<span class="effect-badge">${e.name} (${e.duration} ticks)</span>`
        ).join('')
    } else {
      effectsEl.innerHTML = ''
    }
  }
}

function renderActions() {
  const buttonsEl = document.getElementById('action-buttons')
  const selectEl = document.getElementById('move-target')
  
  buttonsEl.innerHTML = `
    <button onclick="submitAction('explore')">Explore Zone</button>
    <button onclick="submitAction('scan', state.currentZone?.id)">Scan Zone</button>
    <button onclick="submitAction('fortify', state.currentZone?.id)">Fortify Zone</button>
    <button onclick="moveToSelected()">Move To Zone</button>
  `
  
  selectEl.innerHTML = '<option value="">Select destination...</option>' +
    state.adjacentZones.map(z => 
      `<option value="${z.id}">${z.name} (${z.terrain})</option>`
    ).join('')
}

function renderEvents() {
  const eventsEl = document.getElementById('events')
  
  eventsEl.innerHTML = state.recentEvents
    .slice()
    .reverse()
    .map(event => `
      <div class="event ${event.type} ${event.generatedBy === 'ai' ? 'ai-generated' : ''}">
        <div class="event-type">[${event.type}]</div>
        <div class="event-description">${event.description}</div>
      </div>
    `).join('')
}

function handleZoneClick(zone) {
  const isAdjacent = state.adjacentZones.some(z => z.id === zone.id)
  
  if (isAdjacent) {
    if (confirm(`Move to ${zone.name}?`)) {
      submitAction('move', zone.id)
    }
  } else if (zone.id === state.currentZone?.id) {
    submitAction('explore')
  }
}

function moveToSelected() {
  const select = document.getElementById('move-target')
  if (select.value) {
    submitAction('move', select.value)
  }
}

// Initialize
document.getElementById('tick-btn').addEventListener('click', advanceTick)
document.getElementById('reset-btn').addEventListener('click', resetGame)

fetchState()
```

---

## Part 14: Package Configuration

**package.json:**
```json
{
  "name": "mesh-prototype",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

---

## Setup Instructions

1. Create the project directory and all files as specified above
2. Run `npm install`
3. Ensure Ollama is running locally with gemma3: `ollama run gemma3`
4. Start the server: `npm run dev`
5. Open `http://localhost:3000` in your browser

---

## What This Prototype Proves

1. **Geometric primitives** (Point, Scalar, Vector, Cone, Cylinder) can model zones, bodies, and effects
2. **AI generates mechanics** — not just flavor text, but actual transforms that modify game state
3. **Validation layer** catches out-of-bounds AI outputs before they enter the game
4. **Effects persist and propagate** — the chemical spill affects future exploration
5. **The semantic physics engine works** — shape-based effects compose with existing game logic

---

## Next Steps After Prototype

- Add incursion (Stratego attack) with AI-narrated combat
- Add contracts from the Combine megacorp
- Add player-to-player trade
- Implement effect propagation to adjacent zones
- Add more sophisticated AI prompting with full lore book context
- Performance testing with many concurrent effects