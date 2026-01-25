/**
 * OrbitViewport - First-Person Immersive View
 * 
 * Renders a single planet in "4K Cinematic" quality with:
 * - ISS-style window frame (rounded rectangle mask)
 * - CinematicPlanetShader with cloud shadows, specular glint, Rayleigh fog
 * - Living Camera: Breathing (sine wave on Y position and scale)
 * - Living Camera: Blinking (random black overlay every 2-8 seconds)
 */

import { Application, Container, Graphics, Mesh, Geometry, Shader, GlProgram, Sprite, Texture, Assets } from 'pixi.js';
import { cinematicPlanetVertexShader, cinematicPlanetFragmentShader } from '../shaders/cinematicPlanet';
import { CONFIG } from '../config/constants';
import type { TerrestrialType } from '../entities/TerrestrialMesh';

export interface PlanetData {
  type: TerrestrialType | 'gas_giant';
  seed: number;
  radius: number;
}

export class OrbitViewport {
  private app!: Application;
  private container!: Container;
  private windowContainer!: Container;
  private planetContainer!: Container;
  private blinkOverlay!: Graphics;
  private windowFrameSprite!: Sprite | null;
  
  private planetMesh!: Mesh<Geometry, Shader>;
  private shader!: Shader;
  
  private time = 0;
  private breathingTime = 0;
  private blinkTime = 0;
  private nextBlinkTime = 0;
  private isBlinking = false;
  
  private planetData!: PlanetData;
  
  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.container.visible = false;
    this.app.stage.addChild(this.container);
    
    this.windowFrameSprite = null;
    this.setupWindowFrame().catch(console.error);
    this.setupPlanet();
    this.setupBlinkOverlay();
    
    // Schedule first blink
    this.scheduleNextBlink();
  }
  
  private async setupWindowFrame(): Promise<void> {
    // Dark ship background (full screen)
    const background = new Graphics();
    background.rect(0, 0, this.app.screen.width, this.app.screen.height);
    background.fill(0x000000);
    this.container.addChildAt(background, 0);
    
    // Window container - holds the planet, no mask needed (PNG frame has transparency)
    this.windowContainer = new Container();
    // Center the window container in screen space
    this.windowContainer.x = this.app.screen.width / 2;
    this.windowContainer.y = this.app.screen.height / 2;
    this.container.addChild(this.windowContainer);
    
    // Try to load the PNG window frame
    try {
      const texture = await Assets.load('/ship_window_frame.png');
      this.windowFrameSprite = new Sprite(texture);
      this.windowFrameSprite.anchor.set(0.5);
      this.windowFrameSprite.x = this.app.screen.width / 2;
      this.windowFrameSprite.y = this.app.screen.height / 2;
      
      // Scale to fit screen
      const scaleX = this.app.screen.width / texture.width;
      const scaleY = this.app.screen.height / texture.height;
      this.windowFrameSprite.scale.set(Math.max(scaleX, scaleY));
      
      // Add frame sprite on top - the PNG's transparency IS the viewport
      // Planet renders behind it and shows through transparent areas
      this.container.addChild(this.windowFrameSprite);
      
      // No mask needed - PNG frame itself serves as viewport
      this.windowContainer.visible = true;
      
      console.log('Window frame PNG loaded (serves as viewport)');
    } catch (error) {
      console.warn('Could not load ship_window_frame.png, using Graphics fallback:', error);
      
      // Fallback: Create simple frame (no mask, just visual)
      const frame = new Graphics();
      const windowWidth = this.app.screen.width * 0.85;
      const windowHeight = this.app.screen.height * 0.75;
      const cornerRadius = 20;
      
      frame.roundRect(
        -windowWidth / 2 - 5,
        -windowHeight / 2 - 5,
        windowWidth + 10,
        windowHeight + 10,
        cornerRadius + 5
      );
      frame.stroke({ color: 0x1a1a1a, width: 10 });
      frame.fill(0x0a0a0a);
      frame.x = this.app.screen.width / 2;
      frame.y = this.app.screen.height / 2;
      this.container.addChild(frame);
    }
  }
  
  private setupPlanet(): void {
    this.planetContainer = new Container();
    // Center the planet container within the window container
    // Since windowContainer is already centered, planetContainer should be at (0,0)
    this.planetContainer.x = 0;
    this.planetContainer.y = 0;
    this.windowContainer.addChild(this.planetContainer);
    
    // Planet will be created when setPlanet is called
  }
  
  private setupBlinkOverlay(): void {
    this.blinkOverlay = new Graphics();
    this.blinkOverlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.blinkOverlay.fill(0x000000);
    this.blinkOverlay.alpha = 0;
    this.container.addChild(this.blinkOverlay);
  }
  
  public setPlanet(data: PlanetData): void {
    this.planetData = data;
    
    // Remove existing planet if any
    if (this.planetMesh) {
      this.planetContainer.removeChild(this.planetMesh);
      this.planetMesh.destroy();
    }
    
    // Create planet mesh with cinematic shader
    // Make planet MUCH larger so only a tiny portion is visible (close orbit view)
    // The planet should be 4-5x the window size so we see just a small region with curvature at edges
    const windowSize = Math.min(this.app.screen.width, this.app.screen.height);
    const planetScale = 4.5; // Planet is 4.5x window size - only small portion visible, edge curved in distance
    const radius = (windowSize / 2) * planetScale; // Much larger radius for close-up
    const meshPadding = 1.25;
    const size = radius * 2 * meshPadding;
    
    console.log('Creating planet mesh (close orbit view):', { 
      type: data.type, 
      seed: data.seed, 
      size, 
      windowSize,
      planetScale 
    });
    
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
    
    const glProgram = GlProgram.from({
      vertex: cinematicPlanetVertexShader,
      fragment: cinematicPlanetFragmentShader,
    });
    
    // Get planet type mapping
    const PLANET_TYPE_MAP: Record<string, number> = {
      mars: 0,
      earth: 1,
      moon: 2,
      gas_giant: 1, // Use Earth shader for gas giant (can be enhanced)
    };
    
    const planetTypeInt = PLANET_TYPE_MAP[data.type] || 1;
    
    // Get atmosphere config
    const atmoConfig = CONFIG.ATMOSPHERE[data.type as TerrestrialType] || CONFIG.ATMOSPHERE.earth;
    const EARTH = CONFIG.EARTH;
    
    // Create shader with all uniforms
    this.shader = new Shader({
      glProgram,
      resources: {
        uniforms: {
          // Core
          uTime: { value: 0.0, type: 'f32' },
          uSeed: { value: data.seed, type: 'f32' },
          uSunDirection: { value: [...CONFIG.SUN_DIRECTION], type: 'vec3<f32>' },
          uPlanetType: { value: planetTypeInt, type: 'i32' },
          uAtmosphereColor: { value: [...atmoConfig.color], type: 'vec3<f32>' },
          uAtmosphereIntensity: { value: atmoConfig.intensity, type: 'f32' },
          uMeshPadding: { value: meshPadding, type: 'f32' },
          
          // Global Lighting
          uDiffuseTerminatorMin: { value: CONFIG.DIFFUSE_TERMINATOR_MIN, type: 'f32' },
          uDiffuseTerminatorMax: { value: CONFIG.DIFFUSE_TERMINATOR_MAX, type: 'f32' },
          uAmbientWithAtmosphere: { value: CONFIG.AMBIENT_WITH_ATMOSPHERE, type: 'f32' },
          uAmbientNoAtmosphere: { value: CONFIG.AMBIENT_NO_ATMOSPHERE, type: 'f32' },
          uLimbDarkeningStrength: { value: CONFIG.LIMB_DARKENING_STRENGTH, type: 'f32' },
          uLimbDarkeningPower: { value: CONFIG.LIMB_DARKENING_POWER, type: 'f32' },
          uFresnelPower: { value: CONFIG.FRESNEL_POWER, type: 'f32' },
          uTerminatorScatterStrength: { value: CONFIG.TERMINATOR_SCATTER_STRENGTH, type: 'f32' },
          
          // Atmosphere Halo
          uAtmosphereHaloStart: { value: CONFIG.ATMOSPHERE_HALO_START, type: 'f32' },
          uAtmosphereHaloEnd: { value: CONFIG.ATMOSPHERE_HALO_END, type: 'f32' },
          uAtmosphereHaloPower: { value: CONFIG.ATMOSPHERE_HALO_POWER, type: 'f32' },
          
          // Rayleigh Scattering
          uRayleighSunsetColor: { value: [...CONFIG.RAYLEIGH_SUNSET_COLOR], type: 'vec3<f32>' },
          uRayleighDayColor: { value: [...CONFIG.RAYLEIGH_DAY_COLOR], type: 'vec3<f32>' },
          uRayleighIntensity: { value: CONFIG.RAYLEIGH_INTENSITY, type: 'f32' },
          uRayleighThickness: { value: CONFIG.RAYLEIGH_THICKNESS, type: 'f32' },
          
          // Terminator
          uTerminatorSoftMin: { value: CONFIG.TERMINATOR_SOFT_MIN, type: 'f32' },
          uTerminatorSoftMax: { value: CONFIG.TERMINATOR_SOFT_MAX, type: 'f32' },
          uTerminatorTwilightColor: { value: [...CONFIG.TERMINATOR_TWILIGHT_COLOR], type: 'vec3<f32>' },
          uTerminatorTwilightIntensity: { value: CONFIG.TERMINATOR_TWILIGHT_INTENSITY, type: 'f32' },
          
          // Earth (for cinematic rendering)
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
          
          // Cinematic Upgrades
          uCloudShadowStrength: { value: 0.4, type: 'f32' },
          uCloudShadowOffset: { value: 0.02, type: 'f32' },
          uSpecularGlintPower: { value: 64.0, type: 'f32' },
          uRayleighFogIntensity: { value: 0.8, type: 'f32' },
          uRayleighFogPower: { value: 2.5, type: 'f32' },
        },
      },
    });
    
    this.planetMesh = new Mesh({ geometry, shader: this.shader });
    
    // Position planet to show a small portion of surface with curvature/horizon visible
    // Move planet DOWN so the edge/horizon is visible in the upper portion of the window
    // This creates the "in orbit above surface" effect - horizon curves away in distance
    const surfaceOffsetX = windowSize * 0.1; // Slight horizontal offset
    const surfaceOffsetY = windowSize * -2; // Move DOWN significantly so horizon is visible above
    
    this.planetMesh.x = -surfaceOffsetX;
    this.planetMesh.y = -surfaceOffsetY; // Negative Y moves it down (shows horizon at top)
    this.planetContainer.addChild(this.planetMesh);
    
    console.log('Planet mesh created (close orbit view)');
    console.log('Planet offset:', { x: -surfaceOffsetX, y: -surfaceOffsetY });
    console.log('Planet size:', size, 'Window size:', windowSize);
  }
  
  public update(deltaTime: number): void {
    if (!this.container.visible) return;
    
    const dt = deltaTime / 60;
    this.time += deltaTime * 0.00001;
    this.breathingTime += dt;
    this.blinkTime += dt;
    
    // Update shader time
    if (this.shader) {
      this.shader.resources.uniforms.uniforms.uTime = this.time;
    }
    
    // Breathing effect: subtle sine wave on Y position and scale
    // Reduced amplitude for close-up view (less movement when very close)
    const breathingAmplitude = 1.0; // Smaller movement for close view
    const breathingScale = 0.001;   // Subtle scale change
    const breathingSpeed = 0.5;
    
    // Apply breathing to planet container (affects entire planet)
    this.planetContainer.y = Math.sin(this.breathingTime * breathingSpeed) * breathingAmplitude;
    const scaleOffset = Math.sin(this.breathingTime * breathingSpeed) * breathingScale;
    this.planetContainer.scale.set(1.0 + scaleOffset);
    
    // Blinking effect
    if (this.blinkTime >= this.nextBlinkTime) {
      this.triggerBlink();
      this.scheduleNextBlink();
    }
    
    if (this.isBlinking) {
      // Blink animation: quick fade in and out
      const blinkDuration = 0.15; // 150ms blink
      const elapsed = this.blinkTime - (this.nextBlinkTime - blinkDuration);
      
      if (elapsed < blinkDuration / 2) {
        // Fade in (close)
        this.blinkOverlay.alpha = (elapsed / (blinkDuration / 2));
      } else if (elapsed < blinkDuration) {
        // Fade out (open)
        this.blinkOverlay.alpha = 1.0 - ((elapsed - blinkDuration / 2) / (blinkDuration / 2));
      } else {
        // Blink complete
        this.blinkOverlay.alpha = 0;
        this.isBlinking = false;
      }
    }
  }
  
  private scheduleNextBlink(): void {
    // Random time between 2-8 seconds
    this.nextBlinkTime = this.blinkTime + 2.0 + Math.random() * 6.0;
  }
  
  private triggerBlink(): void {
    this.isBlinking = true;
  }
  
  public show(): void {
    this.container.visible = true;
    this.windowContainer.visible = true;
    this.planetContainer.visible = true;
    if (this.planetMesh) {
      this.planetMesh.visible = true;
    }
    this.time = 0;
    this.breathingTime = 0;
    this.blinkTime = 0;
    this.scheduleNextBlink();
  }
  
  public hide(): void {
    this.container.visible = false;
    this.blinkOverlay.alpha = 0;
    this.isBlinking = false;
  }
  
  public getContainer(): Container {
    return this.container;
  }
  
  public resize(width: number, height: number): void {
    // Update window frame size if needed
    // For now, window frame is created once at setup
  }
}
