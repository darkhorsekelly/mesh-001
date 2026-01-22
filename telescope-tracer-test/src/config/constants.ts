/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MESH 1995 - SHADER CONTROL PANEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * All tunable constants for the telescope viewport simulation.
 * Adjust these values to change the look and feel of the entire experience.
 * 
 * SECTIONS:
 *   1. VIEWPORT & PHYSICS - Zoom, movement, friction
 *   2. LENS EFFECTS - Barrel distortion, chromatic aberration, vignette
 *   3. CELESTIAL BODY SIZES - Planet radii
 *   4. ORBITAL MECHANICS - Orbit radii and speeds
 *   5. GLOBAL LIGHTING - Sun direction, ambient levels
 *   6. ATMOSPHERE SETTINGS - Fresnel glow per planet type
 *   7. GAS GIANT - Bands, rotation, domain warp, colors
 *   8. EARTH - Sea level, clouds, biomes, water specular
 *   9. MARS - Terrain, polar caps, volcano
 *  10. MOON - Craters, maria, dust/regolith
 *  11. STARFIELD - Parallax, star layers, nebula
 *  12. AUDIO - Debounce timing
 */

export const CONFIG = {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. VIEWPORT & PHYSICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Discrete zoom levels: [Sector, System, Detail] */
  ZOOM_LEVELS: [0.1, 1.0, 5.0] as const,
  /** Display names for each zoom level */
  ZOOM_NAMES: ['SECTOR', 'SYSTEM', 'DETAIL'] as const,
  
  /** Drift friction (0-1). Lower = faster stopsas. 0.96 = floaty, 0.8 = responsive */
  DRIFT_FRICTION: 0.80,
  /** Input acceleration in pixels/second². Higher = snappier response */
  INPUT_ACCELERATION: 1800,
  /** Maximum drift velocity in pixels/second */
  MAX_VELOCITY: 5000,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LENS EFFECTS (Telescope "Turret" optics simulation)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Lens circle radius as ratio of screen height (0.4-0.9) */
  LENS_RADIUS_RATIO: 0.65,
  
  // --- Filter Stack Configuration (Turret Model) ---
  // Stars get barrel distortion (pincushion), planets stay stable, all get chromatic
  
  /** Starfield barrel/pincushion distortion. NEGATIVE = pincushion (inside dome feel) */
  STARFIELD_DISTORTION_STRENGTH: -0.3, // -0.08
  /** Master chromatic aberration (applied to entire screen to "glue" layers) */
  MASTER_CHROMATIC_STRENGTH: 0.032,
  /** Starfield vignette inner edge (0-1). Where darkening starts */
  STARFIELD_VIGNETTE_INNER: 0.5,
  /** Starfield vignette outer edge (0-1). Full dark */
  STARFIELD_VIGNETTE_OUTER: 1.0,
  
  // --- Legacy (for backward compat, used by old BarrelDistortionFilter) ---
  /** @deprecated Use STARFIELD_DISTORTION_STRENGTH for stars, MASTER_CHROMATIC for all */
  BARREL_STRENGTH: 0.4,
  /** @deprecated Use MASTER_CHROMATIC_STRENGTH */
  CHROMATIC_STRENGTH: 0.025,
  /** @deprecated Use STARFIELD_VIGNETTE_INNER */
  VIGNETTE_INNER: 0.6,
  /** @deprecated Use STARFIELD_VIGNETTE_OUTER */
  VIGNETTE_OUTER: 1.0,
  
  // --- Star Panning Direction ---
  /** Invert star panning to match planet direction. -1.0 = inverted, 1.0 = same */
  STAR_PAN_DIRECTION: -1.0,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CELESTIAL BODY SIZES (in world units)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Gas Giant (Jupiter-like) radius */
  GAS_GIANT_RADIUS: 180,
  /** Terrestrial planet (Mars, Earth) base radius */
  TERRESTRIAL_RADIUS: 60,
  /** Moon radius */
  MOON_RADIUS: 25,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ORBITAL MECHANICS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Mars orbit radius (distance from gas giant center) */
  ORBIT_RADIUS_1: 400,
  /** Earth orbit radius */
  ORBIT_RADIUS_2: 650,
  /** Moon orbit radius (relative to Earth) */
  ORBIT_RADIUS_3: 280,
  
  /** Default 0.001; Mars orbit speed (radians per frame).*/
  ORBIT_SPEED_MARS: 0.001,
  /** Default 0.0007; Earth orbit speed */
  ORBIT_SPEED_EARTH: 0.0007,
  /** Default 0.003; Moon orbit speed (around Earth) */
  ORBIT_SPEED_MOON: 0.003,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 5. GLOBAL LIGHTING
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Sun direction [x, y, z]. Normalized. Top-left = [0.6, -0.5, 0.65] */
  SUN_DIRECTION: [0.6, -0.5, 0.65] as const,
  
  /** Diffuse lighting terminator softness. Lower = harder shadow edge */
  DIFFUSE_TERMINATOR_MIN: -0.15,
  DIFFUSE_TERMINATOR_MAX: 0.6,
  
  /** Ambient light level for planets with atmosphere */
  AMBIENT_WITH_ATMOSPHERE: 0.1,
  /** Ambient light level for Moon (high contrast, no atmosphere) */
  AMBIENT_NO_ATMOSPHERE: 0.001, // 0.03
  
  /** Limb darkening strength (0-1). How much edges darken */
  LIMB_DARKENING_STRENGTH: 1, // 0.3
  LIMB_DARKENING_POWER: 0.7, // 2.0; 0.1 = very dark, 1 = very light
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 6. ATMOSPHERE / FRESNEL SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Fresnel exponent: pow(1.0 - dot(normal, view), FRESNEL_POWER) */
  // Fresnel power impacts the intensity of the atmosphere, with 0 being no atmosphere
  FRESNEL_POWER: 2.0, // 3.0
  
  /** Atmosphere colors and intensities per planet type */
  ATMOSPHERE: {
    mars: {
      /** RGB color [0-1] - Orange-red thin atmosphere */
      color: [1.0, 0.5, 0.3] as const,
      /** Glow intensity (0-1) */
      intensity: 0.35,
    },
    earth: {
      /** RGB color - Blue atmosphere */
      color: [0.4, 0.7, 1.0] as const,
      /** Glow intensity - Thick atmosphere */
      intensity: 0.6,
    },
    moon: {
      /** RGB color - Minimal glow (no real atmosphere) */
      color: [0.5, 0.5, 0.5] as const,
      /** Near zero - just subtle rim */
      intensity: 0.08,
    },
  },
  
  /** Atmospheric scattering on terminator edge */
  TERMINATOR_SCATTER_STRENGTH: 0.4,
  
  // --- Atmosphere Halo (Soft Edge) ---
  /** Alpha fade start radius (1.0 = sphere edge) */
  ATMOSPHERE_HALO_START: 0.95,
  /** Alpha fade end radius (beyond sphere) */
  ATMOSPHERE_HALO_END: 1.15,
  /** Halo glow falloff power (higher = sharper fade) */
  ATMOSPHERE_HALO_POWER: 2.0,
  
  // --- Rayleigh Scattering Glow ---
  /** Sunset color at atmosphere edge [R, G, B] */
  RAYLEIGH_SUNSET_COLOR: [1.0, 0.6, 0.3] as const,
  /** Day atmosphere color [R, G, B] */
  RAYLEIGH_DAY_COLOR: [0.4, 0.7, 1.0] as const,
  /** Rayleigh glow intensity (0-1) */
  RAYLEIGH_INTENSITY: 0.5,
  /** Rayleigh glow thickness as fraction of radius */
  RAYLEIGH_THICKNESS: 0.08,
  
  // --- Terminator Softness (Day/Night Transition) ---
  /** Terminator smoothstep inner edge. -0.2 = starts before perpendicular */
  TERMINATOR_SOFT_MIN: -0.2,
  /** Terminator smoothstep outer edge. 0.2 = full daylight region */
  TERMINATOR_SOFT_MAX: 0.2,
  /** Twilight color tint [R, G, B] */
  TERMINATOR_TWILIGHT_COLOR: [1.0, 0.5, 0.3] as const,
  /** Twilight blend intensity (0-1) */
  TERMINATOR_TWILIGHT_INTENSITY: 0.3,
  
  // --- Gravitational Lensing (Star Displacement) ---
  /** Enable gravitational lensing effect */
  LENSING_ENABLED: true,
  /** Lensing ring size multiplier relative to planet radius */
  LENSING_RING_SIZE: 1.5,
  /** Lensing displacement strength (pixels) */
  LENSING_STRENGTH: 15,
  /** Lensing falloff power (higher = sharper edge) */
  LENSING_FALLOFF: 2.0,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 7. GAS GIANT (Jupiter-like) SHADER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  GAS_GIANT: {
    // --- Rotation ---
    /** Base rotation speed (radians per time unit) */
    ROTATION_SPEED: 0.001, // 0.1
    /** Differential rotation: how much slower poles rotate vs equator (0-1) */
    DIFFERENTIAL_ROTATION: 0.4,
    
    // --- Bands ---
    /** Number of main horizontal bands (multiplied by latitude) */
    BAND_COUNT: 10, // 20
    /** Band noise distortion strength */
    BAND_NOISE_STRENGTH: 6.0, // 6.0
    /** Secondary band detail count */
    SECONDARY_BAND_COUNT: 20, // 50
    /** Secondary band noise strength */
    SECONDARY_BAND_NOISE: 3.0, // 3.0
    /** Band sharpness (0.5-1.0). Higher = sharper edges */
    BAND_SHARPNESS: 0.5,
    
    // --- Domain Warp (Cloud turbulence) ---
    /** Domain warp strength (0-1). How much clouds swirl */
    DOMAIN_WARP_STRENGTH: 0.4,
    /** Scale of the noise input for domain warp */
    DOMAIN_WARP_SCALE: 3.0,
    /** FBM octaves for band noise */
    BAND_FBM_OCTAVES: 5,
    /** FBM octaves for detail noise */
    DETAIL_FBM_OCTAVES: 4,
    
    // --- Storm Features ---
    /** Storm visibility threshold (0-1). Higher = fewer storms */
    STORM_THRESHOLD_MIN: 0.6,
    STORM_THRESHOLD_MAX: 0.8,
    /** Storm color influence (0-1) */
    STORM_INTENSITY: 0.6,
    /** White cloud threshold */
    CLOUD_THRESHOLD_MIN: 0.5,
    CLOUD_THRESHOLD_MAX: 0.7,
    /** White cloud mix amount */
    CLOUD_INTENSITY: 0.3,
    
    // --- Colors (RGB 0-1) ---
    COLORS: {
      cream: [0.95, 0.85, 0.7] as const,
      orangeBrown: [0.85, 0.55, 0.35] as const,
      rust: [0.75, 0.45, 0.3] as const,
      darkBrown: [0.6, 0.4, 0.35] as const,
      whiteStorm: [0.98, 0.95, 0.9] as const,
      redSpot: [0.85, 0.35, 0.25] as const,
    },
    
    // --- Lighting ---
    /** Rim light color */
    RIM_COLOR: [1.0, 0.9, 0.7] as const,
    /** Rim light intensity */
    RIM_INTENSITY: 0.3,
    /** Scatter color on shadow edge */
    SCATTER_COLOR: [1.0, 0.6, 0.3] as const,
    /** Scatter intensity */
    SCATTER_INTENSITY: 0.15,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 8. EARTH SHADER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  EARTH: {
    // --- Rotation ---
    /** Planet rotation speed (radians per time unit) */
    ROTATION_SPEED: 0.02,
    
    // --- Terrain Generation ---
    /** FBM scale for main terrain */
    TERRAIN_SCALE: 4.0,
    /** FBM octaves for terrain */
    TERRAIN_OCTAVES: 6,
    /** Coast detail scale multiplier */
    COAST_DETAIL_SCALE: 4.0,
    /** Coast detail influence (0-1) */
    COAST_DETAIL_STRENGTH: 0.15,
    
    // --- Water ---
    /** Sea level threshold (0-1). Higher = more water */
    SEA_LEVEL: 0.48,
    /** Water specular power (shininess). Higher = smaller highlight */
    WATER_SPECULAR_POWER: 64.0,
    /** Water specular intensity */
    WATER_SPECULAR_INTENSITY: 0.8,
    /** Wave pattern scale */
    WAVE_SCALE: 50.0,
    /** Wave animation speed */
    WAVE_SPEED: 0.1,
    
    // --- Clouds ---
    /** Cloud layer FBM scale */
    CLOUD_SCALE: 6.0,
    /** Cloud FBM octaves */
    CLOUD_OCTAVES: 5,
    /** Cloud threshold min (clouds start forming) */
    CLOUD_THRESHOLD_MIN: 0.45,
    /** Cloud threshold max (full clouds) */
    CLOUD_THRESHOLD_MAX: 0.65,
    /** Cloud opacity (0-1) */
    CLOUD_OPACITY: 0.6,
    /** Cloud movement speed */
    CLOUD_SPEED: 0.015,
    
    // --- Biomes ---
    /** Tropical zone extent (0-1 of latitude) */
    TROPICAL_EXTENT: 0.35,
    /** Temperate zone start */
    TEMPERATE_START: 0.2,
    /** Temperate zone end */
    TEMPERATE_END: 0.5,
    /** Polar snow start latitude */
    POLAR_SNOW_START: 0.6,
    /** Polar snow full coverage */
    POLAR_SNOW_FULL: 0.85,
    
    // --- Colors ---
    COLORS: {
      deepWater: [0.02, 0.08, 0.2] as const,
      shallowWater: [0.1, 0.3, 0.5] as const,
      beach: [0.76, 0.7, 0.5] as const,
      forest: [0.1, 0.35, 0.1] as const,
      grassland: [0.3, 0.5, 0.2] as const,
      desert: [0.8, 0.7, 0.4] as const,
      mountain: [0.4, 0.35, 0.3] as const,
      snow: [0.95, 0.95, 0.98] as const,
      clouds: [0.95, 0.95, 0.98] as const,
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 9. MARS SHADER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  MARS: {
    // --- Rotation ---
    ROTATION_SPEED: 0.02,
    
    // --- Terrain ---
    /** Main terrain FBM scale */
    TERRAIN_SCALE: 8.0,
    TERRAIN_OCTAVES: 6,
    /** Detail FBM scale multiplier */
    DETAIL_SCALE: 3.0,
    DETAIL_OCTAVES: 4,
    /** Detail influence strength */
    DETAIL_STRENGTH: 0.3,
    
    // --- Elevation Thresholds ---
    LOWLAND_THRESHOLD: 0.3,
    MIDLAND_THRESHOLD: 0.6,
    
    // --- Polar Caps ---
    /** Latitude where polar ice starts (0-1) */
    POLAR_START: 0.7,
    /** Latitude where full ice coverage */
    POLAR_FULL: 0.95,
    /** Polar ice influence strength */
    POLAR_STRENGTH: 0.7,
    
    // --- Volcano Feature ---
    /** Volcano center position [u, v] */
    VOLCANO_CENTER: [0.3, 0.6] as const,
    /** Volcano radius */
    VOLCANO_RADIUS: 0.15,
    /** Volcano color influence */
    VOLCANO_STRENGTH: 0.5,
    
    // --- Colors ---
    COLORS: {
      lowlands: [0.55, 0.2, 0.1] as const,
      midlands: [0.8, 0.4, 0.2] as const,
      highlands: [0.95, 0.7, 0.45] as const,
      peaks: [0.9, 0.85, 0.75] as const,
      polarIce: [0.95, 0.92, 0.88] as const,
      volcano: [0.3, 0.15, 0.1] as const,
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 10. MOON SHADER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  MOON: {
    // --- Rotation ---
    ROTATION_SPEED: 0.02,
    
    // --- Domain Warp (Irregular crater shapes) ---
    /** Warp FBM scale */
    WARP_SCALE: 4.0,
    WARP_OCTAVES: 4,
    /** Warp strength X */
    WARP_STRENGTH_X: 0.08,
    /** Warp strength Y */
    WARP_STRENGTH_Y: 0.06,
    
    // --- Surface Dust/Regolith ---
    /** Main dust FBM scale */
    DUST_SCALE: 25.0, // 25.0
    DUST_OCTAVES: 5,
    /** Fine dust scale */
    FINE_DUST_SCALE: 60.0,
    FINE_DUST_OCTAVES: 3,
    /** Fine dust strength */
    FINE_DUST_STRENGTH: 0.3,
    /** How much dust affects final height */
    DUST_HEIGHT_INFLUENCE: 0.3,
    
    // --- Maria (Dark Plains) ---
    /** Maria FBM scale */
    MARIA_SCALE: 1.5,
    MARIA_OCTAVES: 3,
    /** Maria threshold min */
    MARIA_THRESHOLD_MIN: 0.5,
    /** Maria threshold max */
    MARIA_THRESHOLD_MAX: 0.7,
    /** Maria darkening factor */
    MARIA_DARKNESS: 0.55,
    
    // --- Crater Scales (Voronoi input scale) ---
    /** Large crater scale (Tycho, Copernicus) */
    LARGE_CRATER_SCALE: 6.0,
    /** Medium crater scale */
    MEDIUM_CRATER_SCALE: 15.0,
    /** Small crater scale (micro-impacts) */
    SMALL_CRATER_SCALE: 40.0,
    
    // --- Crater Depth/Rim ---
    /** Large crater depth smoothstep max */
    LARGE_CRATER_DEPTH: 0.35,
    /** Large crater rim inner */
    LARGE_CRATER_RIM_INNER: 0.25,
    /** Large crater rim outer */
    LARGE_CRATER_RIM_OUTER: 0.5,
    /** Large crater rim brightness */
    LARGE_CRATER_RIM_STRENGTH: 0.25,
    /** Large crater floor darkness */
    LARGE_CRATER_FLOOR_STRENGTH: 0.35,
    
    /** Medium crater parameters */
    MEDIUM_CRATER_DEPTH: 0.25,
    MEDIUM_CRATER_RIM_INNER: 0.18,
    MEDIUM_CRATER_RIM_OUTER: 0.35,
    MEDIUM_CRATER_RIM_STRENGTH: 0.15,
    MEDIUM_CRATER_FLOOR_STRENGTH: 0.2,
    
    /** Small crater parameters */
    SMALL_CRATER_DEPTH: 0.15,
    SMALL_CRATER_RIM_INNER: 0.1,
    SMALL_CRATER_RIM_OUTER: 0.22,
    SMALL_CRATER_RIM_STRENGTH: 0.08,
    SMALL_CRATER_FLOOR_STRENGTH: 0.1,
    
    // --- Colors ---
    /** Base gray level */
    BASE_GRAY: 0.5,
    /** Height variation multiplier */
    HEIGHT_VARIATION: 0.4,
    /** Gray clamp min */
    GRAY_MIN: 0.12,
    /** Gray clamp max */
    GRAY_MAX: 0.75,
    /** Warm tint multipliers [R, G, B] */
    WARM_TINT: [0.97, 0.95, 0.9] as const,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 11. STARFIELD SHADER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  STARFIELD: {
    // --- Parallax Movement ---
    /** Base offset multiplier for camera movement */
    OFFSET_SCALE: 0.0001, // 0.0001
    /** Layer 1 (distant) parallax speed multiplier */
    PARALLAX_LAYER_1: 0.01, // 0.3
    /** Layer 2 (mid) parallax speed multiplier */
    PARALLAX_LAYER_2: 0.1, // 1.0
    /** Layer 3 (near) parallax speed multiplier */
    PARALLAX_LAYER_3: 1.0, // 2.5
    
    // --- Zoom Effects ---
    /** How much zoom affects star density/scale. 0 = no effect, 1 = full effect */
    ZOOM_SCALE_INFLUENCE: 0.3,
    /** Layer 1 zoom scale multiplier (distant stars affected less) */
    ZOOM_LAYER_1_MULT: 0.1,
    /** Layer 2 zoom scale multiplier */
    ZOOM_LAYER_2_MULT: 0.3,
    /** Layer 3 zoom scale multiplier (near stars affected more) */
    ZOOM_LAYER_3_MULT: 0.6,
    
    // --- Star Layer 1: Distant (Many, Dim, Tiny) ---
    LAYER_1: {
      /** Grid scale (higher = more dense) */
      scale: 80.0, // 80.0
      /** Star brightness */
      brightness: 0.25, // 0.25
      /** Threshold: what % of cells have stars (0-1) */
      threshold: 0.1,
      /** Time multiplier for twinkle */
      timeMultiplier: 1.0, // 1.0
      /** Depth variation: random band around PARALLAX_LAYER_1. 0.5 = ±50% of base value */
      depthVariation: 0.8,
    },
    
    // --- Star Layer 2: Mid (Medium) ---
    LAYER_2: {
      scale: 45.0,
      brightness: 0.5,
      threshold: 0.05,
      timeMultiplier: 0.9,
      /** Depth variation: random band around PARALLAX_LAYER_2. 0.5 = ±50% of base value */
      depthVariation: 0.6,
    },
    
    // --- Star Layer 3: Near (Sparse, Bright, Large) ---
    LAYER_3: {
      scale: 25.0,
      brightness: 0.75,
      threshold: 0.01,
      timeMultiplier: 1.1,
      /** Depth variation: random band around PARALLAX_LAYER_3. 0.5 = ±50% of base value */
      depthVariation: 0.5,
    },
    
    // --- Star Appearance ---
    /** Base star size */
    STAR_SIZE: 0.25, // 0.015
    /** Star size variation (0-1) */
    STAR_SIZE_VARIATION: 0.5, // 0.5    
    /** Glow halo size multiplier */
    GLOW_SIZE_MULTIPLIER: 4.0, // 4.0
    /** Glow intensity */
    GLOW_INTENSITY: 0.1, // 0.15
    
    // --- Twinkle ---
    /** Twinkle base speed */
    TWINKLE_SPEED_BASE: 1, // 1.5
    /** Twinkle speed variation */
    TWINKLE_SPEED_VARIATION: 2.0,
    /** Twinkle intensity (0-1) */
    TWINKLE_INTENSITY: 0.25,
    
    // --- Star Colors (Temperature distribution) ---
    /** % of stars that are red giants */
    COLOR_RED_THRESHOLD: 0.15,
    /** % up to orange stars */
    COLOR_ORANGE_THRESHOLD: 0.35,
    /** % up to yellow-white */
    COLOR_YELLOW_THRESHOLD: 0.6,
    /** % up to white */
    COLOR_WHITE_THRESHOLD: 0.85,
    /** Rest are blue */
    
    COLORS: {
      redGiant: [1.0, 0.6, 0.4] as const,
      orange: [1.0, 0.85, 0.6] as const,
      yellowWhite: [1.0, 0.98, 0.9] as const,
      white: [0.95, 0.95, 1.0] as const,
      blue: [0.7, 0.8, 1.0] as const,
    },
    
    // --- Nebula ---
    NEBULA: {
      /** FBM scale 1 */
      scale1: 1.2,
      /** FBM scale 2 */
      scale2: 0.8,
      /** Nebula animation speed */
      speed1: 0.002,
      speed2: 0.001,
      /** Nebula octaves */
      octaves1: 4,
      octaves2: 3,
      /** Nebula colors */
      color1: [0.015, 0.005, 0.03] as const,  // Deep violet
      color2: [0.005, 0.015, 0.04] as const,  // Deep blue
    },
    
    // --- Background ---
    /** Base space color (near black) */
    BACKGROUND_COLOR: [0.003, 0.003, 0.008] as const,
    
    // --- Vignette ---
    /** Vignette inner edge (0-1) */
    VIGNETTE_INNER: 0.4,
    /** Vignette outer edge (0-1) */
    VIGNETTE_OUTER: 1.0,
    /** Edge highlight color */
    EDGE_HIGHLIGHT_COLOR: [0.0, 0.05, 0.08] as const,
    EDGE_HIGHLIGHT_INTENSITY: 0.2,
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 12. AUDIO SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  AUDIO: {
    /** Debounce time in ms. Prevents "machine gun" effect on rapid clicks */
    DEBOUNCE_MS: 100,
    /** Ambient volume (0-1) */
    AMBIENT_VOLUME: 0.15,
    /** Zoom sound volume */
    ZOOM_VOLUME: 0.3,
    /** Click sound volume */
    CLICK_VOLUME: 0.4,
    /** Zoom sound playback rate */
    ZOOM_RATE: 1.2,
    
    /** Zoom-in sound file pool (cycles through these) */
    ZOOM_IN_SOUNDS: [
      '/zoom-in-01.m4a',
      '/zoom-in-02.m4a',
      '/zoom-in-03.m4a',
      '/zoom-in-04.m4a',
    ] as const,
    
    /** Zoom-out sound file pool (cycles through these) */
    ZOOM_OUT_SOUNDS: [
      '/zoom-out-01.m4a',
      '/zoom-out-02.m4a',
      '/zoom-out-03.m4a',
      '/zoom-out-04.m4a',
    ] as const,
  },
  
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type ZoomLevel = typeof CONFIG.ZOOM_LEVELS[number];
export type ZoomName = typeof CONFIG.ZOOM_NAMES[number];

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type AtmosphereType = keyof typeof CONFIG.ATMOSPHERE;
