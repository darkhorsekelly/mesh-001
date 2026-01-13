// ===============================================
// GEOMETRIC PRIMITVES
// Five atoms that model everything in the game at any zoom level
// ===============================================

import type { P } from "ollama/dist/shared/ollama.1bfa89da.mjs"

export type Point = {
    type: "point"
    x: number
    y: number
    z?: number
}

export type Scalar = {
    type: "scalar"
    magnitude: number
}

export type Vector = {
    type: "vector"
    origin: Point
    movement: VectorMovement

    // Changed this from 'number' to 'Scalar' to allow for more complex vector math
    magnitude: Scalar
}

// This is a union type because the vector can move in a variety of ways. A union type is a way to express that a value can be one of a set of types.
export type VectorMovement = 
    | { kind: 'static', dx: number, dy: number, dz?: number }
    | { kind: 'linear', velocity: { dx: number, dy: number } }

    // The period is the time it takes to complete one orbit
    | { kind: 'orbital', center: Point, radius: number, period: number}
    | { kind: 'patrol', waypoints: Point[], loop: boolean, currentIndex: number }

export type Cone = {
    type: 'cone'
    origin: Point
    direction: Vector
    angle: Scalar
    range: Scalar
    maxMagnitude: Scalar
    falloff: 'linear' | 'quadratic' | 'exponential'
    shape: 'circular' | 'elliptical'

    // The eccentricity is the ratio of the distance between the foci to the length of the major axis
    // Foci are the two points that are the closest to the origin and the farthest from the origin
    eccentricity?: Scalar
    rotation?: Vector
}

export type Cylinder = {
    type: 'cylinder'
    center: Point
    radius: Scalar
    magnitude: Scalar
    shape: 'circular' | 'elliptical'

    // The eccentricity is the ratio of the distance between the foci to the length of the major axis
    // Foci are the two points that are the closest to the origin and the farthest from the origin
    eccentricity?: Scalar
    rotation?: Vector
}

export type GeometricPrimitive = Point | Scalar | Vector | Cone | Cylinder

// ===============================================
// SEMANTIC PRIMITVES
// Actions (what players do) and Effects (what happens)
// ===============================================

export type Action = {
    id: string
    actorId: string
    verb: ActionVerb
    targetIds?: string[]
    targetPoints?: Point[]
    targetVectors?: Vector[]
    targetCones?: Cone[]
    targetCylinders?: Cylinder[]
    targetGeometricPrimitives?: GeometricPrimitive[]
    submittedAt: Date
}

export type ActionVerb =
| 'move'
| 'explore'
| 'fortify'
| 'scan'
| 'extract'
| 'incur'
// AI can reference these or create new ones contextually

export type Effect = {
    id: string
    name: string
    effectFlavorText: string
    attachedTo: string[] // entity IDs
    shape: GeometricPrimitive
    
    // more work to do here
    transforms: Transform[]

    duration: number // ticks remaining, -1 = permanent
    propogation?: {
        shape: GeometricPrimitive
        chance: number
        limit: number
        spreadCount: number
    }
    createdBy: string[] // action IDs, player IDs, AI IDs, entity IDs, anything that created or combined to create this effect
    createdAt: Date
}

export type Transform = 
    // Tag transforms
    | { kind: 'addTag', tag: string }
    | { kind: 'removeTag', tag: string }    

    // Set transforms, replace the current value with the new value
    | { kind: 'set', field: string, value: number }

    // Additive transforms, add the new value to the current value
    | { kind: 'add', field: string, value: number }

    // Multiplicative transforms, multiply the current value by the new value
    | { kind: 'multiply', field: string, value: number }

    // Compound transforms, combine multiple transforms
    | { kind: 'compound', transforms: Transform[] }

    // Effect transforms, add an effect to the entity
    | { kind: 'addEffect', effect: Effect }
    | { kind: 'removeEffect', effect: Effect }

    // Geometric primitive transforms
    | { kind: 'set', field: string, value: GeometricPrimitive }

    // Abstracted transforms for all geometric primitives

        // Rotate the geometric primitive around the origin
        | { kind: 'rotate', angle: number }

        // Scale the geometric primitive by a factor
        | { kind: 'scale', factor: number }

        // Translate the geometric primitive by a vector
        | { kind: 'translate', vector: Vector }

        // Project the geometric primitive onto a plane
        | { kind: 'project', vector: Vector }

        // Reflect the geometric primitive off a plane
        | { kind: 'reflect', vector: Vector }

        // Normalize the geometric primitive
        | { kind: 'normalize', vector: Vector }

// ===============================================
// GAME ENTITIES
// Everything in the galaxy is an Entity with primitives, actions, and/or effects attached in any recombination
// ===============================================

export type Entity = {
    id: string
    name: string
    entityType: EntityType
    primitives: NamedPrimitive[]
    properties: Record<string, number>
    tags: string[]
    parentId?: string[]
}

export type NamedPrimitive = {
    name: string
    primitive: GeometricPrimitive
}

export type EntityType = 
| 'planet'
| 'zone'
| 'body'
| 'object'

// ===============================================
// GAME STATE
// State of the game at any given time
// ===============================================

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
    bodyId: string
   
    // more work to do here
}

export type InventoryItem = {
    
}