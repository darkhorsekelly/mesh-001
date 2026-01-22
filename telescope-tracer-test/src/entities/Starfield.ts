/**
 * Starfield - Deep Field Background with 3-Layer Parallax
 * 
 * Uses GLSL shader with procedural star generation.
 * ALL visual parameters are pulled from CONFIG for easy tuning.
 * 
 * See constants.ts CONFIG.STARFIELD for documentation
 */

import { Container, Mesh, Geometry, Shader, GlProgram } from 'pixi.js';
import { starfieldVertexShader, starfieldFragmentShader } from '../shaders/starfield';
import { CONFIG } from '../config/constants';

export class Starfield {
  public container: Container;
  
  private mesh: Mesh<Geometry, Shader>;
  private shader: Shader;
  private time: number = 0;
  
  constructor(width: number, height: number) {
    this.container = new Container();
    
    // Create full-screen quad geometry
    const geometry = new Geometry({
      attributes: {
        aPosition: [
          0, 0,
          width, 0,
          width, height,
          0, height,
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
      vertex: starfieldVertexShader,
      fragment: starfieldFragmentShader,
    });
    
    // Pass lens radius RATIO - shader calculates pixel-based radius internally
    
    // Pull config section
    const SF = CONFIG.STARFIELD;
    
    // Create shader with ALL configurable uniforms
    this.shader = new Shader({
      glProgram,
      resources: {
        uniforms: {
          // === Core ===
          uTime: { value: 0.0, type: 'f32' },
          uResolution: { value: [width, height], type: 'vec2<f32>' },
          uOffset: { value: [0.0, 0.0], type: 'vec2<f32>' },
          uLensRadius: { value: CONFIG.LENS_RADIUS_RATIO, type: 'f32' },
          
          // === Parallax ===
          uOffsetScale: { value: SF.OFFSET_SCALE, type: 'f32' },
          uParallaxLayer1: { value: SF.PARALLAX_LAYER_1, type: 'f32' },
          uParallaxLayer2: { value: SF.PARALLAX_LAYER_2, type: 'f32' },
          uParallaxLayer3: { value: SF.PARALLAX_LAYER_3, type: 'f32' },
          
          // === Zoom ===
          uZoom: { value: 1.0, type: 'f32' },
          uZoomScaleInfluence: { value: SF.ZOOM_SCALE_INFLUENCE, type: 'f32' },
          uZoomLayer1Mult: { value: SF.ZOOM_LAYER_1_MULT, type: 'f32' },
          uZoomLayer2Mult: { value: SF.ZOOM_LAYER_2_MULT, type: 'f32' },
          uZoomLayer3Mult: { value: SF.ZOOM_LAYER_3_MULT, type: 'f32' },
          
          // === Layer 1 (Distant) ===
          uLayer1Scale: { value: SF.LAYER_1.scale, type: 'f32' },
          uLayer1Brightness: { value: SF.LAYER_1.brightness, type: 'f32' },
          uLayer1Threshold: { value: SF.LAYER_1.threshold, type: 'f32' },
          uLayer1TimeMult: { value: SF.LAYER_1.timeMultiplier, type: 'f32' },
          uLayer1DepthVariation: { value: SF.LAYER_1.depthVariation, type: 'f32' },
          
          // === Layer 2 (Mid) ===
          uLayer2Scale: { value: SF.LAYER_2.scale, type: 'f32' },
          uLayer2Brightness: { value: SF.LAYER_2.brightness, type: 'f32' },
          uLayer2Threshold: { value: SF.LAYER_2.threshold, type: 'f32' },
          uLayer2TimeMult: { value: SF.LAYER_2.timeMultiplier, type: 'f32' },
          uLayer2DepthVariation: { value: SF.LAYER_2.depthVariation, type: 'f32' },
          
          // === Layer 3 (Near) ===
          uLayer3Scale: { value: SF.LAYER_3.scale, type: 'f32' },
          uLayer3Brightness: { value: SF.LAYER_3.brightness, type: 'f32' },
          uLayer3Threshold: { value: SF.LAYER_3.threshold, type: 'f32' },
          uLayer3TimeMult: { value: SF.LAYER_3.timeMultiplier, type: 'f32' },
          uLayer3DepthVariation: { value: SF.LAYER_3.depthVariation, type: 'f32' },
          
          // === Star Appearance ===
          uStarSize: { value: SF.STAR_SIZE, type: 'f32' },
          uStarSizeVariation: { value: SF.STAR_SIZE_VARIATION, type: 'f32' },
          uGlowSizeMultiplier: { value: SF.GLOW_SIZE_MULTIPLIER, type: 'f32' },
          uGlowIntensity: { value: SF.GLOW_INTENSITY, type: 'f32' },
          
          // === Twinkle ===
          uTwinkleSpeedBase: { value: SF.TWINKLE_SPEED_BASE, type: 'f32' },
          uTwinkleSpeedVariation: { value: SF.TWINKLE_SPEED_VARIATION, type: 'f32' },
          uTwinkleIntensity: { value: SF.TWINKLE_INTENSITY, type: 'f32' },
          
          // === Star Color Thresholds ===
          uColorRedThreshold: { value: SF.COLOR_RED_THRESHOLD, type: 'f32' },
          uColorOrangeThreshold: { value: SF.COLOR_ORANGE_THRESHOLD, type: 'f32' },
          uColorYellowThreshold: { value: SF.COLOR_YELLOW_THRESHOLD, type: 'f32' },
          uColorWhiteThreshold: { value: SF.COLOR_WHITE_THRESHOLD, type: 'f32' },
          
          // === Star Colors ===
          uColorRedGiant: { value: [...SF.COLORS.redGiant], type: 'vec3<f32>' },
          uColorOrange: { value: [...SF.COLORS.orange], type: 'vec3<f32>' },
          uColorYellowWhite: { value: [...SF.COLORS.yellowWhite], type: 'vec3<f32>' },
          uColorWhite: { value: [...SF.COLORS.white], type: 'vec3<f32>' },
          uColorBlue: { value: [...SF.COLORS.blue], type: 'vec3<f32>' },
          
          // === Nebula ===
          uNebulaScale1: { value: SF.NEBULA.scale1, type: 'f32' },
          uNebulaScale2: { value: SF.NEBULA.scale2, type: 'f32' },
          uNebulaSpeed1: { value: SF.NEBULA.speed1, type: 'f32' },
          uNebulaSpeed2: { value: SF.NEBULA.speed2, type: 'f32' },
          uNebulaColor1: { value: [...SF.NEBULA.color1], type: 'vec3<f32>' },
          uNebulaColor2: { value: [...SF.NEBULA.color2], type: 'vec3<f32>' },
          
          // === Background & Vignette ===
          uBackgroundColor: { value: [...SF.BACKGROUND_COLOR], type: 'vec3<f32>' },
          uVignetteInner: { value: SF.VIGNETTE_INNER, type: 'f32' },
          uVignetteOuter: { value: SF.VIGNETTE_OUTER, type: 'f32' },
          uEdgeHighlightColor: { value: [...SF.EDGE_HIGHLIGHT_COLOR], type: 'vec3<f32>' },
          uEdgeHighlightIntensity: { value: SF.EDGE_HIGHLIGHT_INTENSITY, type: 'f32' },

          // === Gravitational Lensing ===
          uLensingEnabled: { value: CONFIG.LENSING_ENABLED ? 1.0 : 0.0, type: 'f32' },
          uLensingStrength: { value: CONFIG.LENSING_STRENGTH, type: 'f32' },
          uLensingRingSize: { value: CONFIG.LENSING_RING_SIZE, type: 'f32' },
          uLensingFalloff: { value: CONFIG.LENSING_FALLOFF, type: 'f32' },
          // Planet positions (screen coords normalized 0-1) and radii (in pixels)
          // [x, y, radius, enabled] for each planet
          uPlanet0: { value: [0.5, 0.5, 0.0, 0.0], type: 'vec4<f32>' },  // Gas Giant
          uPlanet1: { value: [0.5, 0.5, 0.0, 0.0], type: 'vec4<f32>' },  // Mars
          uPlanet2: { value: [0.5, 0.5, 0.0, 0.0], type: 'vec4<f32>' },  // Earth
          uPlanet3: { value: [0.5, 0.5, 0.0, 0.0], type: 'vec4<f32>' },  // Moon
        },
      },
    });
    
    // Create mesh
    this.mesh = new Mesh({ geometry, shader: this.shader });
    this.container.addChild(this.mesh);
  }
  
  resize(width: number, height: number): void {
    // Update geometry
    const positions = this.mesh.geometry.getAttribute('aPosition');
    positions.buffer.data = new Float32Array([
      0, 0,
      width, 0,
      width, height,
      0, height,
    ]);
    positions.buffer.update();
    
    // Update resolution - shader calculates pixel-based lens radius internally
    this.shader.resources.uniforms.uniforms.uResolution = [width, height];
    // Lens radius ratio stays constant (pixel calculation done in shader)
  }
  
  /**
   * Update starfield with camera offset for parallax and zoom level
   * The shader internally handles 3 layers with different parallax speeds
   * @param deltaTime - Frame delta time
   * @param offsetX - Camera X offset
   * @param offsetY - Camera Y offset
   * @param zoom - Current zoom level (affects star density per layer)
   */
  update(deltaTime: number, offsetX: number, offsetY: number, zoom: number = 1.0): void {
    this.time += deltaTime * 0.016;
    this.shader.resources.uniforms.uniforms.uTime = this.time;
    // Pass raw offset - shader handles parallax multipliers internally
    this.shader.resources.uniforms.uniforms.uOffset = [offsetX, offsetY];
    // Pass zoom level - shader adjusts star scale per layer
    this.shader.resources.uniforms.uniforms.uZoom = zoom;
  }
  
  /**
   * Set the lens radius ratio (0-1, as fraction of min screen dimension)
   */
  setLensRadiusRatio(ratio: number): void {
    this.shader.resources.uniforms.uniforms.uLensRadius = ratio;
  }

  /**
   * Update planet positions for gravitational lensing effect
   * @param planetIndex - 0=GasGiant, 1=Mars, 2=Earth, 3=Moon
   * @param screenX - Screen X position (pixels)
   * @param screenY - Screen Y position (pixels)
   * @param radius - Scaled radius (pixels)
   * @param enabled - Whether this planet should affect lensing
   */
  setPlanetPosition(planetIndex: number, screenX: number, screenY: number, radius: number, enabled: boolean): void {
    const resolution = this.shader.resources.uniforms.uniforms.uResolution as number[];
    // Normalize to 0-1 screen coordinates
    const normX = screenX / resolution[0];
    const normY = screenY / resolution[1];
    const uniformName = `uPlanet${planetIndex}`;
    this.shader.resources.uniforms.uniforms[uniformName] = [normX, normY, radius, enabled ? 1.0 : 0.0];
  }
}
