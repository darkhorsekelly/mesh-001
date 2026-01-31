// ===============================================
// ENTITY TYPES
// =============================================== 

import type { Vector2FP, FP } from '../../euclidean/euclidean-types.js';
import type { ZoomLevel } from '../../../state-types/state-types.js';

export type EntityZoomState = ZoomLevel;

// -----------------------------------------------
// Visibility levels for sensor detection
// -----------------------------------------------
// 0 = undetected, 1 = blip, 2 = signature, 3 = full scan
// TODO: Add more visibility levels
export type VisibilityLevel = 0 | 1 | 2 | 3;

// -----------------------------------------------
// Base Entity Interface
// -----------------------------------------------
// All entities share these core properties

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
// Mass, volume, and fuel for physics calculations

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
// Airlock state 

interface AtmosphericProperties {
    // whether the airlock is currently sealed
    airlockSealed: boolean;
}

// -----------------------------------------------
// Resource Store Properties
// -----------------------------------------------
// Raw materials carried by the entity

interface ResourceStoreProperties {
    // volatile compounds (crude or fuel) in FP units

    volatilesMass: FP;
    fuelMass: FP;

    // volatiles are a property value; but mineral stores are independent entities
    // no need to store them as a proprety
}

// -----------------------------------------------
// Sensor Properties
// -----------------------------------------------
// Detection and visibility state

interface SensorProperties {
    // the base optic visibility of an observing entity
    opticLevel: VisibilityLevel;
}

// -----------------------------------------------
// Full Entity Interface
// -----------------------------------------------
// Combines all property groups into a single entity type

export interface Entity extends 
    BaseEntity, 
    PhysicalProperties, 
    AtmosphericProperties, 
    ResourceStoreProperties, 
    SensorProperties {
    
    // discriminator for entity subtypes (eventually PLATFORM and MINERAL and CORPORATE_BUG, etc.)
    type: string;

    // optional player association
    playerId?: string;
    
    // angle in fixed-point (0-360000 for 0-360 degrees)
    heading: FP;          

    // current thrust level
    thrust: FP;
}

// -----------------------------------------------
// Entity Update Type
// -----------------------------------------------
// Partial update returned by action handlers

export interface EntityUpdate {
    id: string;
    changes: Partial<Omit<Entity, 'id' | 'type'>>;
}