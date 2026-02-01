// ===============================================
// ENTITY TYPES
// =============================================== 
// Defines all entity types in the universe. Entities are all non-celestial "stuff" in the universe
// They can be corporate-controlled, player-controlled, or not controlled

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';
import type { ZoomLevel } from '../../../state-types/state-types.js';

export type EntityZoomState = ZoomLevel;

// -----------------------------------------------
// Entity Type Union
// -----------------------------------------------
// Strict union of all valid entity types.

export type EntityType =
    | 'ENTITY'
    | 'CORPORATE'
    | 'PLATFORM'
    | 'RESOURCE_WELL'
    | 'MINERAL_STORE';

// -----------------------------------------------
// Resource Well Type
// -----------------------------------------------
// What kind of celestial body backs this resource well.

export type WellOriginType = 'ASTEROID' | 'PLANET' | 'MOON';

// -----------------------------------------------
// Visibility levels for sensor detection
// -----------------------------------------------
// 0 = undetected, 1 = blip, 2 = signature, 3 = full scan

export type VisibilityLevel = 0 | 1 | 2 | 3;

// -----------------------------------------------
// Base Entity Interface
// -----------------------------------------------
// All entities share these core properties.

interface BaseEntity {
    id: string;
    zoomState: EntityZoomState;
    position: Vector2FP;

    // velocity is a vector of two fixed-point numbers
    velocity: Vector2FP;

    // if in ORBIT state, the ID of the celestial being orbited
    orbitTargetId?: string;
}

// -----------------------------------------------
// Physical Properties
// -----------------------------------------------
// Mass, volume, and fuel for physics calculations.

interface PhysicalProperties {
    // total dry mass of the entity (FP)
    mass: FP;

    // spatial volume for cargo calculations (FP)
    volume: FP;

    // current fuel mass, separate from dry mass (FP)
    fuelMass: FP;

    // reach in FP units; the maximum distance an entity can affect another entity
    reach: FP;
}

// -----------------------------------------------
// Container Properties
// -----------------------------------------------
// cargo containment for logistics operations.

interface ContainerProperties {
    // if this entity is inside another entity, the parent's ID
    parentId?: string;

    // whether this entity can contain other entities
    isContainer?: boolean;

    // maximum volume this entity can contain (FP)
    containerVolume?: FP;

    // opacity factor for visibility of contained entities (0-1000 FP scale)
    // 0 = transparent, 1000 = fully opaque
    inOpacity?: FP;
}

// -----------------------------------------------
// Weld Properties
// -----------------------------------------------
// structural fusion for welded entity assemblies.
// unlike containment (LOAD), welded entities maintain a relative offset.

interface WeldProperties {
    // if this entity is welded to another entity, the primary's ID
    // the primary is the "anchor" of the structure
    weldParentId?: string;

    // position offset relative to the weld parent
    // this entity's position = parent.position + relativeOffset
    relativeOffset?: Vector2FP;
}

// -----------------------------------------------
// Atmospheric Properties
// -----------------------------------------------
// Airlock state.

interface AtmosphericProperties {
    // whether the airlock is currently sealed
    airlockSealed: boolean;
}

// -----------------------------------------------
// Resource Store Properties
// -----------------------------------------------
// Raw materials carried by the entity.

interface ResourceStoreProperties {
    // volatile compounds (crude) in FP units
    volatilesMass: FP;

    // refined fuel mass (separate from dry mass)
    fuelMass: FP;
}

// -----------------------------------------------
// Sensor Properties
// -----------------------------------------------
// Detection and visibility state.

interface SensorProperties {
    // the base optic visibility of an observing entity
    opticLevel: VisibilityLevel;
}

// -----------------------------------------------
// Full Entity Interface
// -----------------------------------------------
// Combines all property groups into a single entity type.

export interface Entity extends 
    BaseEntity, 
    PhysicalProperties, 
    ContainerProperties,
    WeldProperties,
    AtmosphericProperties, 
    ResourceStoreProperties, 
    SensorProperties {
    
    // discriminator for entity subtypes
    type: EntityType;

    // optional player association
    playerId?: string;
    
    // angle in fixed-point (0-360000 for 0-360 degrees)
    heading: FP;          

    // current thrust level
    thrust: FP;

    // resource well specific: what celestial backs this well (optional)
    wellOriginType?: WellOriginType;

    // resource well specific: linked celestial ID (optional)
    linkedCelestialId?: string;
}

// -----------------------------------------------
// Entity Update Type
// -----------------------------------------------
// Partial update returned by action handlers.

export interface EntityUpdate {
    id: string;
    changes: Partial<Omit<Entity, 'id' | 'type'>>;
}

// -----------------------------------------------
// Type Guards
// -----------------------------------------------

export function isEntity(entity: Entity): boolean {
    return entity.type === 'ENTITY';
}

export function isCorporate(entity: Entity): boolean {
    return entity.type === 'CORPORATE';
}

export function isPlatform(entity: Entity): boolean {
    return entity.type === 'PLATFORM';
}

export function isResourceWell(entity: Entity): boolean {
    return entity.type === 'RESOURCE_WELL';
}

export function isMineralStore(entity: Entity): boolean {
    return entity.type === 'MINERAL_STORE';
}

export function isContainer(entity: Entity): boolean {
    return entity.isContainer === true;
}

export function isContained(entity: Entity): boolean {
    return entity.parentId !== undefined;
}

export function canContain(container: Entity, content: Entity): boolean {
    if (!container.isContainer) return false;
    if (!container.containerVolume) return false;
    
    // calculate used volume by summing volumes of all children
    // this is a simple check; full calculation should be done with game state
    return container.containerVolume >= content.volume;
}

export function isWelded(entity: Entity): boolean {
    return entity.weldParentId !== undefined;
}

export function isWeldPrimary(entity: Entity, allEntities: readonly Entity[]): boolean {
    // an entity is a weld primary if other entities are welded to it
    return allEntities.some(e => e.weldParentId === entity.id);
}

// -----------------------------------------------
// Entity Factory Defaults
// -----------------------------------------------
// Default values for creating new entities.

export const ENTITY_DEFAULTS: Omit<Entity, 'id' | 'type' | 'position'> = {
    zoomState: 'SPACE',
    velocity: { x: 0, y: 0 },
    mass: 0,
    volume: 0,
    fuelMass: 0,
    reach: 0,
    airlockSealed: false,
    volatilesMass: 0,
    opticLevel: 0,
    heading: 0,
    thrust: 0,
    // container defaults (optional properties)
    parentId: undefined,
    isContainer: false,
    containerVolume: 0,
    inOpacity: 0,
    // weld defaults (optional properties)
    weldParentId: undefined,
    relativeOffset: undefined,
};