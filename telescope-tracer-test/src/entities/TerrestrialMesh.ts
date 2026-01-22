/**
 * TerrestrialMesh - Shader-based terrestrial planets with Fresnel atmosphere glow
 * Supports Mars, Earth, and Moon rendering with proper 3D lighting
 * ALL visual parameters are pulled from CONFIG for easy tuning
 */

import { Container, Mesh, Geometry, Shader, GlProgram } from 'pixi.js';
import { terrestrialVertexShader, terrestrialFragmentShader } from '../shaders/terrestrial';
import { CONFIG, type Vec2 } from '../config/constants';

export type TerrestrialType = 'mars' | 'earth' | 'moon';

// Planet type to shader int mapping
const PLANET_TYPE_MAP: Record<TerrestrialType, number> = {
  mars: 0,
  earth: 1,
  moon: 2,
};

export class TerrestrialMesh {
  public mesh: Mesh<Geometry, Shader>;
  public container: Container;
  public worldPosition: Vec2;
  public radius: number;
  public type: TerrestrialType;
  
  public orbitRadius: number;
  public orbitSpeed: number;
  public orbitAngle: number;
  
  private shader: Shader;
  private time: number = 0;
  
  constructor(
    type: TerrestrialType,
    radius: number,
    orbitRadius: number = 0,
    orbitSpeed: number = 0,
    seed: number = Math.random() * 100
  ) {
    this.type = type;
    this.radius = radius;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.worldPosition = { x: 0, y: 0 };
    this.container = new Container();

    // Create quad geometry with 25% padding for atmosphere halo
    // Mesh is 2.5x radius (1.25x the sphere diameter) to allow glow beyond sphere edge
    const meshPadding = 1.25;
    const size = radius * 2 * meshPadding;
    const geometry = new Geometry({
      attributes: {
        aPosition: [
          -size / 2, -size / 2,
          size / 2, -size / 2,
          size / 2, size / 2,
          -size / 2, size / 2,
        ],
        aUV: [
          0, 0,
          1, 0,
          1, 1,
          0, 1,
        ],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    
    // Create shader program
    const glProgram = GlProgram.from({
      vertex: terrestrialVertexShader,
      fragment: terrestrialFragmentShader,
    });
    
    // Get atmosphere config for this planet type from CONFIG
    const atmoConfig = CONFIG.ATMOSPHERE[type];
    
    // Pull config sections
    const MARS = CONFIG.MARS;
    const EARTH = CONFIG.EARTH;
    const MOON = CONFIG.MOON;
    
    // Create shader with ALL configurable uniforms
    this.shader = new Shader({
      glProgram,
      resources: {
        uniforms: {
          // === Core ===
          uTime: { value: 0.0, type: 'f32' },
          uSeed: { value: seed, type: 'f32' },
          uSunDirection: { value: [...CONFIG.SUN_DIRECTION], type: 'vec3<f32>' },
          uPlanetType: { value: PLANET_TYPE_MAP[type], type: 'i32' },
          uAtmosphereColor: { value: [...atmoConfig.color], type: 'vec3<f32>' },
          uAtmosphereIntensity: { value: atmoConfig.intensity, type: 'f32' },
          uMeshPadding: { value: meshPadding, type: 'f32' },
          
          // === Global Lighting ===
          uDiffuseTerminatorMin: { value: CONFIG.DIFFUSE_TERMINATOR_MIN, type: 'f32' },
          uDiffuseTerminatorMax: { value: CONFIG.DIFFUSE_TERMINATOR_MAX, type: 'f32' },
          uAmbientWithAtmosphere: { value: CONFIG.AMBIENT_WITH_ATMOSPHERE, type: 'f32' },
          uAmbientNoAtmosphere: { value: CONFIG.AMBIENT_NO_ATMOSPHERE, type: 'f32' },
          uLimbDarkeningStrength: { value: CONFIG.LIMB_DARKENING_STRENGTH, type: 'f32' },
          uLimbDarkeningPower: { value: CONFIG.LIMB_DARKENING_POWER, type: 'f32' },
          uFresnelPower: { value: CONFIG.FRESNEL_POWER, type: 'f32' },
          uTerminatorScatterStrength: { value: CONFIG.TERMINATOR_SCATTER_STRENGTH, type: 'f32' },
          
          // === Atmosphere Halo (Soft Edge) ===
          uAtmosphereHaloStart: { value: CONFIG.ATMOSPHERE_HALO_START, type: 'f32' },
          uAtmosphereHaloEnd: { value: CONFIG.ATMOSPHERE_HALO_END, type: 'f32' },
          uAtmosphereHaloPower: { value: CONFIG.ATMOSPHERE_HALO_POWER, type: 'f32' },
          
          // === Rayleigh Scattering Glow ===
          uRayleighSunsetColor: { value: [...CONFIG.RAYLEIGH_SUNSET_COLOR], type: 'vec3<f32>' },
          uRayleighDayColor: { value: [...CONFIG.RAYLEIGH_DAY_COLOR], type: 'vec3<f32>' },
          uRayleighIntensity: { value: CONFIG.RAYLEIGH_INTENSITY, type: 'f32' },
          uRayleighThickness: { value: CONFIG.RAYLEIGH_THICKNESS, type: 'f32' },
          
          // === Terminator Softness (Twilight) ===
          uTerminatorSoftMin: { value: CONFIG.TERMINATOR_SOFT_MIN, type: 'f32' },
          uTerminatorSoftMax: { value: CONFIG.TERMINATOR_SOFT_MAX, type: 'f32' },
          uTerminatorTwilightColor: { value: [...CONFIG.TERMINATOR_TWILIGHT_COLOR], type: 'vec3<f32>' },
          uTerminatorTwilightIntensity: { value: CONFIG.TERMINATOR_TWILIGHT_INTENSITY, type: 'f32' },
          
          // === Mars ===
          uMarsRotationSpeed: { value: MARS.ROTATION_SPEED, type: 'f32' },
          uMarsTerrainScale: { value: MARS.TERRAIN_SCALE, type: 'f32' },
          uMarsDetailScale: { value: MARS.DETAIL_SCALE, type: 'f32' },
          uMarsDetailStrength: { value: MARS.DETAIL_STRENGTH, type: 'f32' },
          uMarsLowlandThreshold: { value: MARS.LOWLAND_THRESHOLD, type: 'f32' },
          uMarsMidlandThreshold: { value: MARS.MIDLAND_THRESHOLD, type: 'f32' },
          uMarsPolarStart: { value: MARS.POLAR_START, type: 'f32' },
          uMarsPolarFull: { value: MARS.POLAR_FULL, type: 'f32' },
          uMarsPolarStrength: { value: MARS.POLAR_STRENGTH, type: 'f32' },
          uMarsVolcanoCenter: { value: [...MARS.VOLCANO_CENTER], type: 'vec2<f32>' },
          uMarsVolcanoRadius: { value: MARS.VOLCANO_RADIUS, type: 'f32' },
          uMarsVolcanoStrength: { value: MARS.VOLCANO_STRENGTH, type: 'f32' },
          uMarsColorLowlands: { value: [...MARS.COLORS.lowlands], type: 'vec3<f32>' },
          uMarsColorMidlands: { value: [...MARS.COLORS.midlands], type: 'vec3<f32>' },
          uMarsColorHighlands: { value: [...MARS.COLORS.highlands], type: 'vec3<f32>' },
          uMarsColorPeaks: { value: [...MARS.COLORS.peaks], type: 'vec3<f32>' },
          uMarsColorPolarIce: { value: [...MARS.COLORS.polarIce], type: 'vec3<f32>' },
          uMarsColorVolcano: { value: [...MARS.COLORS.volcano], type: 'vec3<f32>' },
          
          // === Earth ===
          uEarthRotationSpeed: { value: EARTH.ROTATION_SPEED, type: 'f32' },
          uEarthTerrainScale: { value: EARTH.TERRAIN_SCALE, type: 'f32' },
          uEarthCoastDetailScale: { value: EARTH.COAST_DETAIL_SCALE, type: 'f32' },
          uEarthCoastDetailStrength: { value: EARTH.COAST_DETAIL_STRENGTH, type: 'f32' },
          uEarthSeaLevel: { value: EARTH.SEA_LEVEL, type: 'f32' },
          uEarthWaterSpecularPower: { value: EARTH.WATER_SPECULAR_POWER, type: 'f32' },
          uEarthWaterSpecularIntensity: { value: EARTH.WATER_SPECULAR_INTENSITY, type: 'f32' },
          uEarthWaveScale: { value: EARTH.WAVE_SCALE, type: 'f32' },
          uEarthWaveSpeed: { value: EARTH.WAVE_SPEED, type: 'f32' },
          uEarthCloudScale: { value: EARTH.CLOUD_SCALE, type: 'f32' },
          uEarthCloudThresholdMin: { value: EARTH.CLOUD_THRESHOLD_MIN, type: 'f32' },
          uEarthCloudThresholdMax: { value: EARTH.CLOUD_THRESHOLD_MAX, type: 'f32' },
          uEarthCloudOpacity: { value: EARTH.CLOUD_OPACITY, type: 'f32' },
          uEarthCloudSpeed: { value: EARTH.CLOUD_SPEED, type: 'f32' },
          uEarthTropicalExtent: { value: EARTH.TROPICAL_EXTENT, type: 'f32' },
          uEarthTemperateStart: { value: EARTH.TEMPERATE_START, type: 'f32' },
          uEarthTemperateEnd: { value: EARTH.TEMPERATE_END, type: 'f32' },
          uEarthPolarSnowStart: { value: EARTH.POLAR_SNOW_START, type: 'f32' },
          uEarthPolarSnowFull: { value: EARTH.POLAR_SNOW_FULL, type: 'f32' },
          uEarthColorDeepWater: { value: [...EARTH.COLORS.deepWater], type: 'vec3<f32>' },
          uEarthColorShallowWater: { value: [...EARTH.COLORS.shallowWater], type: 'vec3<f32>' },
          uEarthColorBeach: { value: [...EARTH.COLORS.beach], type: 'vec3<f32>' },
          uEarthColorForest: { value: [...EARTH.COLORS.forest], type: 'vec3<f32>' },
          uEarthColorGrassland: { value: [...EARTH.COLORS.grassland], type: 'vec3<f32>' },
          uEarthColorDesert: { value: [...EARTH.COLORS.desert], type: 'vec3<f32>' },
          uEarthColorMountain: { value: [...EARTH.COLORS.mountain], type: 'vec3<f32>' },
          uEarthColorSnow: { value: [...EARTH.COLORS.snow], type: 'vec3<f32>' },
          uEarthColorClouds: { value: [...EARTH.COLORS.clouds], type: 'vec3<f32>' },
          
          // === Moon ===
          uMoonRotationSpeed: { value: MOON.ROTATION_SPEED, type: 'f32' },
          uMoonWarpScale: { value: MOON.WARP_SCALE, type: 'f32' },
          uMoonWarpStrengthX: { value: MOON.WARP_STRENGTH_X, type: 'f32' },
          uMoonWarpStrengthY: { value: MOON.WARP_STRENGTH_Y, type: 'f32' },
          uMoonDustScale: { value: MOON.DUST_SCALE, type: 'f32' },
          uMoonFineDustScale: { value: MOON.FINE_DUST_SCALE, type: 'f32' },
          uMoonFineDustStrength: { value: MOON.FINE_DUST_STRENGTH, type: 'f32' },
          uMoonDustHeightInfluence: { value: MOON.DUST_HEIGHT_INFLUENCE, type: 'f32' },
          uMoonMariaScale: { value: MOON.MARIA_SCALE, type: 'f32' },
          uMoonMariaThresholdMin: { value: MOON.MARIA_THRESHOLD_MIN, type: 'f32' },
          uMoonMariaThresholdMax: { value: MOON.MARIA_THRESHOLD_MAX, type: 'f32' },
          uMoonMariaDarkness: { value: MOON.MARIA_DARKNESS, type: 'f32' },
          uMoonLargeCraterScale: { value: MOON.LARGE_CRATER_SCALE, type: 'f32' },
          uMoonMediumCraterScale: { value: MOON.MEDIUM_CRATER_SCALE, type: 'f32' },
          uMoonSmallCraterScale: { value: MOON.SMALL_CRATER_SCALE, type: 'f32' },
          uMoonLargeCraterDepth: { value: MOON.LARGE_CRATER_DEPTH, type: 'f32' },
          uMoonLargeCraterRimInner: { value: MOON.LARGE_CRATER_RIM_INNER, type: 'f32' },
          uMoonLargeCraterRimOuter: { value: MOON.LARGE_CRATER_RIM_OUTER, type: 'f32' },
          uMoonLargeCraterRimStrength: { value: MOON.LARGE_CRATER_RIM_STRENGTH, type: 'f32' },
          uMoonLargeCraterFloorStrength: { value: MOON.LARGE_CRATER_FLOOR_STRENGTH, type: 'f32' },
          uMoonMediumCraterDepth: { value: MOON.MEDIUM_CRATER_DEPTH, type: 'f32' },
          uMoonMediumCraterRimInner: { value: MOON.MEDIUM_CRATER_RIM_INNER, type: 'f32' },
          uMoonMediumCraterRimOuter: { value: MOON.MEDIUM_CRATER_RIM_OUTER, type: 'f32' },
          uMoonMediumCraterRimStrength: { value: MOON.MEDIUM_CRATER_RIM_STRENGTH, type: 'f32' },
          uMoonMediumCraterFloorStrength: { value: MOON.MEDIUM_CRATER_FLOOR_STRENGTH, type: 'f32' },
          uMoonSmallCraterDepth: { value: MOON.SMALL_CRATER_DEPTH, type: 'f32' },
          uMoonSmallCraterRimInner: { value: MOON.SMALL_CRATER_RIM_INNER, type: 'f32' },
          uMoonSmallCraterRimOuter: { value: MOON.SMALL_CRATER_RIM_OUTER, type: 'f32' },
          uMoonSmallCraterRimStrength: { value: MOON.SMALL_CRATER_RIM_STRENGTH, type: 'f32' },
          uMoonSmallCraterFloorStrength: { value: MOON.SMALL_CRATER_FLOOR_STRENGTH, type: 'f32' },
          uMoonBaseGray: { value: MOON.BASE_GRAY, type: 'f32' },
          uMoonHeightVariation: { value: MOON.HEIGHT_VARIATION, type: 'f32' },
          uMoonGrayMin: { value: MOON.GRAY_MIN, type: 'f32' },
          uMoonGrayMax: { value: MOON.GRAY_MAX, type: 'f32' },
          uMoonWarmTint: { value: [...MOON.WARM_TINT], type: 'vec3<f32>' },
        },
      },
    });
    
    // Create mesh
    this.mesh = new Mesh({ geometry, shader: this.shader });
    this.container.addChild(this.mesh);
  }
  
  update(time: number, parentX: number = 0, parentY: number = 0): void {
    this.time += time * 0.00001;
    this.shader.resources.uniforms.uniforms.uTime = this.time;
    
    // Orbital movement
    if (this.orbitRadius > 0) {
      this.orbitAngle += this.orbitSpeed;
      this.worldPosition.x = parentX + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.worldPosition.y = parentY + Math.sin(this.orbitAngle) * this.orbitRadius;
    } else {
      this.worldPosition.x = parentX;
      this.worldPosition.y = parentY;
    }
  }
  
  setScreenPosition(universeOffset: Vec2, zoom: number, screenCenter: Vec2): void {
    const screenX = screenCenter.x + (this.worldPosition.x + universeOffset.x) * zoom;
    const screenY = screenCenter.y + (this.worldPosition.y + universeOffset.y) * zoom;
    
    this.container.x = screenX;
    this.container.y = screenY;
    this.container.scale.set(zoom);
  }
  
  containsPoint(screenX: number, screenY: number, zoom: number): boolean {
    const dx = screenX - this.container.x;
    const dy = screenY - this.container.y;
    const scaledRadius = this.radius * zoom;
    return dx * dx + dy * dy < scaledRadius * scaledRadius;
  }
  
  setAtmosphereIntensity(intensity: number): void {
    this.shader.resources.uniforms.uniforms.uAtmosphereIntensity = intensity;
  }
  
  setAtmosphereColor(r: number, g: number, b: number): void {
    this.shader.resources.uniforms.uniforms.uAtmosphereColor = [r, g, b];
  }
}
