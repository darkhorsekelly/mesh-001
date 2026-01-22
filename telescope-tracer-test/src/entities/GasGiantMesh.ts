/**
 * GasGiantMesh - Procedural gas giant planet using GLSL shaders
 * ALL visual parameters are pulled from CONFIG for easy tuning
 */

import { Container, Mesh, Geometry, Shader, GlProgram } from 'pixi.js';
import { gasGiantVertexShader, gasGiantFragmentShader } from '../shaders/gasGiant';
import { CONFIG, type Vec2 } from '../config/constants';

export class GasGiantMesh {
  public mesh: Mesh<Geometry, Shader>;
  public container: Container;
  public worldPosition: Vec2;
  public radius: number;
  
  private shader: Shader;
  private time: number = 0;
  
  constructor(radius: number, seed: number = 42) {
    this.radius = radius;
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
      vertex: gasGiantVertexShader,
      fragment: gasGiantFragmentShader,
    });
    
    // Pull all config values
    const GG = CONFIG.GAS_GIANT;
    
    // Create shader with ALL configurable uniforms
    this.shader = new Shader({
      glProgram,
      resources: {
        uniforms: {
          // Core
          uTime: { value: 0.0, type: 'f32' },
          uSeed: { value: seed, type: 'f32' },
          uSunDirection: { value: [...CONFIG.SUN_DIRECTION], type: 'vec3<f32>' },
          uRadius: { value: radius, type: 'f32' },
          uMeshPadding: { value: meshPadding, type: 'f32' },
          
          // Rotation
          uRotationSpeed: { value: GG.ROTATION_SPEED, type: 'f32' },
          uDifferentialRotation: { value: GG.DIFFERENTIAL_ROTATION, type: 'f32' },
          
          // Bands
          uBandCount: { value: GG.BAND_COUNT, type: 'f32' },
          uBandNoiseStrength: { value: GG.BAND_NOISE_STRENGTH, type: 'f32' },
          uSecondaryBandCount: { value: GG.SECONDARY_BAND_COUNT, type: 'f32' },
          uSecondaryBandNoise: { value: GG.SECONDARY_BAND_NOISE, type: 'f32' },
          uBandSharpness: { value: GG.BAND_SHARPNESS, type: 'f32' },
          
          // Domain Warp
          uDomainWarpStrength: { value: GG.DOMAIN_WARP_STRENGTH, type: 'f32' },
          uDomainWarpScale: { value: GG.DOMAIN_WARP_SCALE, type: 'f32' },
          
          // Storm
          uStormThresholdMin: { value: GG.STORM_THRESHOLD_MIN, type: 'f32' },
          uStormThresholdMax: { value: GG.STORM_THRESHOLD_MAX, type: 'f32' },
          uStormIntensity: { value: GG.STORM_INTENSITY, type: 'f32' },
          uCloudThresholdMin: { value: GG.CLOUD_THRESHOLD_MIN, type: 'f32' },
          uCloudThresholdMax: { value: GG.CLOUD_THRESHOLD_MAX, type: 'f32' },
          uCloudIntensity: { value: GG.CLOUD_INTENSITY, type: 'f32' },
          
          // Colors
          uColorCream: { value: [...GG.COLORS.cream], type: 'vec3<f32>' },
          uColorOrangeBrown: { value: [...GG.COLORS.orangeBrown], type: 'vec3<f32>' },
          uColorRust: { value: [...GG.COLORS.rust], type: 'vec3<f32>' },
          uColorDarkBrown: { value: [...GG.COLORS.darkBrown], type: 'vec3<f32>' },
          uColorWhiteStorm: { value: [...GG.COLORS.whiteStorm], type: 'vec3<f32>' },
          uColorRedSpot: { value: [...GG.COLORS.redSpot], type: 'vec3<f32>' },
          
          // Lighting
          uRimColor: { value: [...GG.RIM_COLOR], type: 'vec3<f32>' },
          uRimIntensity: { value: GG.RIM_INTENSITY, type: 'f32' },
          uScatterColor: { value: [...GG.SCATTER_COLOR], type: 'vec3<f32>' },
          uScatterIntensity: { value: GG.SCATTER_INTENSITY, type: 'f32' },
          uAmbient: { value: CONFIG.AMBIENT_WITH_ATMOSPHERE, type: 'f32' },
          uLimbDarkeningStrength: { value: CONFIG.LIMB_DARKENING_STRENGTH, type: 'f32' },
          uLimbDarkeningPower: { value: CONFIG.LIMB_DARKENING_POWER, type: 'f32' },
          uDiffuseTerminatorMin: { value: CONFIG.DIFFUSE_TERMINATOR_MIN, type: 'f32' },
          uDiffuseTerminatorMax: { value: CONFIG.DIFFUSE_TERMINATOR_MAX, type: 'f32' },
          uFresnelPower: { value: CONFIG.FRESNEL_POWER, type: 'f32' },
        },
      },
    });
    
    // Create mesh
    this.mesh = new Mesh({ geometry, shader: this.shader });
    this.container.addChild(this.mesh);
  }
  
  update(deltaTime: number): void {
    this.time += deltaTime * 0.016; // Convert to seconds-ish
    this.shader.resources.uniforms.uniforms.uTime = this.time;
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
  
  setSunDirection(x: number, y: number, z: number): void {
    this.shader.resources.uniforms.uniforms.uSunDirection = [x, y, z];
  }
}
