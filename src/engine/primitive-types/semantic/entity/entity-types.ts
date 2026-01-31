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
};