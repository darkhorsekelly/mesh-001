/**
 * TelescopeViewport - Main application controller
 * Orchestrates all systems: rendering, input, audio, and game state
 * 
 * Implements "Optical Realism" upgrades:
 * - Deep Field 3-layer parallax background
 * - Geological planet shaders (FBM + Voronoi)
 * - Global barrel distortion filter
 * - Audio debounce
 */

import { Application, Container, Graphics } from 'pixi.js';
import { CONFIG, type Vec2 } from '../config/constants';
import { AudioManager } from '../audio/AudioManager';
import { InputManager } from '../input/InputManager';
import { GasGiantMesh, TerrestrialMesh, ShipGlyph, Starfield } from '../entities';
import { LensOverlay } from '../overlays/LensOverlay';
import { BarrelDistortionFilter } from '../filters/BarrelDistortionFilter';
import { ChromaticAberrationFilter } from '../filters/ChromaticAberrationFilter';
import { AlphaMaskFilter } from '../filters/AlphaMaskFilter';

export class TelescopeViewport {
  private app!: Application;
  private inputManager!: InputManager;
  private audioManager!: AudioManager;
  
  // Container hierarchy for "Turret" filter model:
  // masterContainer (ChromaticAberrationFilter) -> backgroundContainer (BarrelDistortionFilter/Pincushion)
  //                                             -> worldContainer (AlphaMaskFilter - fades at edge)
  private masterContainer!: Container;
  private chromaticFilter!: ChromaticAberrationFilter;
  private starfieldFilter!: BarrelDistortionFilter;
  private alphaMaskFilter!: AlphaMaskFilter;
  
  // Containers (render layers)
  private backgroundContainer!: Container;
  private worldContainer!: Container;
  private uiContainer!: Container;
  private overlayContainer!: Container;
  
  // Components
  private starfield!: Starfield;
  private lensOverlay!: LensOverlay;
  
  // State
  private universeOffset: Vec2 = { x: 0, y: 0 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private currentZoomIndex = 1;
  private currentZoom: number = CONFIG.ZOOM_LEVELS[1];
  private targetZoom: number = CONFIG.ZOOM_LEVELS[1];
  private time = 0;
  
  // Celestial bodies
  private gasGiantMesh!: GasGiantMesh;
  private gasGiantOrbitRings!: Graphics;
  private mars!: TerrestrialMesh;
  private earth!: TerrestrialMesh;
  private moon!: TerrestrialMesh;
  private shipGlyph!: ShipGlyph;
  
  // UI elements
  private zoomDisplay!: HTMLElement;
  private coordsDisplay!: HTMLElement;
  
  async init(): Promise<void> {
    this.app = new Application();
    
    await this.app.init({
      background: '#0a0a0f',
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    const viewport = document.getElementById('telescope-viewport')!;
    viewport.appendChild(this.app.canvas);
    
    this.inputManager = new InputManager(this.app.canvas);
    this.audioManager = new AudioManager(100); // 100ms debounce
    
    this.zoomDisplay = document.getElementById('zoom-display')!;
    this.coordsDisplay = document.getElementById('coords-display')!;
    
    this.setupContainers();
    this.createCelestialBodies();
    
    this.shipGlyph = new ShipGlyph(200, -150);
    this.uiContainer.addChild(this.shipGlyph.container);
    
    this.app.ticker.add((ticker) => this.update(ticker.deltaTime));
    
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    
    // Start ambient audio on user interaction
    const startAudio = () => {
      this.audioManager.startAmbient();
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
    window.addEventListener('click', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    
    console.log('🔭 MESH 1995 Telescope Viewport initialized');
    console.log('   ├─ Deep Field 3-layer parallax ✓');
    console.log('   ├─ Geological planet shaders ✓');
    console.log('   ├─ Global barrel distortion ✓');
    console.log('   └─ Audio debounce ✓');
  }
  
  private setupContainers(): void {
    // ============================================
    // "TURRET" MODEL CONTAINER HIERARCHY
    // ============================================
    // Planets stay geometrically stable (no warping)
    // Stars get pincushion effect (inside-dome feel)
    // All layers share chromatic aberration (optical "glue")
    
    // Master container - gets chromatic aberration only
    this.masterContainer = new Container();
    this.app.stage.addChild(this.masterContainer);
    
    // Chromatic aberration filter (entire screen, no geometry distortion)
    this.chromaticFilter = new ChromaticAberrationFilter();
    this.chromaticFilter.strength = CONFIG.MASTER_CHROMATIC_STRENGTH;
    this.chromaticFilter.lensRadius = CONFIG.LENS_RADIUS_RATIO;
    this.chromaticFilter.setScreenSize(this.app.screen.width, this.app.screen.height);
    this.masterContainer.filters = [this.chromaticFilter];
    
    // ============================================
    // BACKGROUND - Starfield with pincushion distortion
    // Negative strength = pincushion (concave, inside-dome feel)
    // ============================================
    this.backgroundContainer = new Container();
    this.masterContainer.addChild(this.backgroundContainer);
    
    // Starfield-specific filter: pincushion distortion + vignette
    this.starfieldFilter = new BarrelDistortionFilter();
    this.starfieldFilter.strength = CONFIG.STARFIELD_DISTORTION_STRENGTH; // Negative for pincushion
    this.starfieldFilter.chromaticStrength = 0; // No chromatic here, it's on master
    this.starfieldFilter.lensRadius = CONFIG.LENS_RADIUS_RATIO;
    this.starfieldFilter.setScreenSize(this.app.screen.width, this.app.screen.height);
    this.backgroundContainer.filters = [this.starfieldFilter];
    
    this.starfield = new Starfield(this.app.screen.width, this.app.screen.height);
    this.backgroundContainer.addChild(this.starfield.container);
    
    // ============================================
    // WORLD - Planets (alpha fade at edge, NO geometry distortion)
    // Planets must remain geometrically stable and "massive"
    // but fade to transparent at telescope boundary
    // ============================================
    this.worldContainer = new Container();
    this.masterContainer.addChild(this.worldContainer);
    
    // Alpha mask filter - fades planets at telescope edge (no black background)
    this.alphaMaskFilter = new AlphaMaskFilter();
    this.alphaMaskFilter.setScreenSize(this.app.screen.width, this.app.screen.height);
    this.alphaMaskFilter.setFadeRange(0.7, 1.0); // Start fading at 70%, fully black at edge
    this.worldContainer.filters = [this.alphaMaskFilter];
    
    // UI (AR elements) - also no distortion
    this.uiContainer = new Container();
    this.masterContainer.addChild(this.uiContainer);
    
    // ============================================
    // OVERLAY - Lens frame (outside all filters)
    // ============================================
    this.overlayContainer = new Container();
    this.app.stage.addChild(this.overlayContainer);
    
    this.lensOverlay = new LensOverlay(this.app.screen.width, this.app.screen.height);
    this.overlayContainer.addChild(this.lensOverlay.container);
  }
  
  private createCelestialBodies(): void {
    // Gas Giant at center (0, 0) - Using GLSL shader mesh
    this.gasGiantMesh = new GasGiantMesh(CONFIG.GAS_GIANT_RADIUS, 42);
    this.worldContainer.addChild(this.gasGiantMesh.container);
    
    // Orbit rings for Gas Giant (vector graphics overlay) - COMMENTED OUT
    // this.gasGiantOrbitRings = new Graphics();
    // this.drawOrbitRings();
    // this.worldContainer.addChild(this.gasGiantOrbitRings);
    
    // Mars - FBM terrain with thin atmosphere Fresnel glow
    this.mars = new TerrestrialMesh('mars', CONFIG.TERRESTRIAL_RADIUS, CONFIG.ORBIT_RADIUS_1, 0.001, 17);
    this.worldContainer.addChild(this.mars.container);
    
    // Earth - FBM terrain, water with specular, clouds, thick atmosphere Fresnel
    this.earth = new TerrestrialMesh('earth', CONFIG.TERRESTRIAL_RADIUS * 1.2, CONFIG.ORBIT_RADIUS_2, 0.0007, 91);
    this.worldContainer.addChild(this.earth.container);
    
    // Moon - Voronoi craters with sharp rims, no atmosphere
    this.moon = new TerrestrialMesh('moon', CONFIG.MOON_RADIUS, CONFIG.ORBIT_RADIUS_3 * 0.3, 0.003, 33);
    this.worldContainer.addChild(this.moon.container);
  }
  
  // COMMENTED OUT: Orbit rings (cyan circles)
  // private drawOrbitRings(): void {
  //   this.gasGiantOrbitRings.clear();
  //   
  //   // Draw orbit paths for planets
  //   const orbits = [
  //     { radius: CONFIG.ORBIT_RADIUS_1, color: 0x00ffcc, alpha: 0.15 },
  //     { radius: CONFIG.ORBIT_RADIUS_2, color: 0x00ffcc, alpha: 0.12 },
  //   ];
  //   
  //   for (const orbit of orbits) {
  //     this.gasGiantOrbitRings.circle(0, 0, orbit.radius);
  //     this.gasGiantOrbitRings.stroke({ color: orbit.color, width: 1, alpha: orbit.alpha });
  //     
  //     // Add tick marks around orbit
  //     const numTicks = 24;
  //     for (let i = 0; i < numTicks; i++) {
  //       const angle = (i / numTicks) * Math.PI * 2;
  //       const innerR = orbit.radius - 5;
  //       const outerR = orbit.radius + 5;
  //       this.gasGiantOrbitRings.moveTo(
  //         Math.cos(angle) * innerR,
  //         Math.sin(angle) * innerR
  //       );
  //       this.gasGiantOrbitRings.lineTo(
  //         Math.cos(angle) * outerR,
  //         Math.sin(angle) * outerR
  //       );
  //     }
  //     this.gasGiantOrbitRings.stroke({ color: orbit.color, width: 1, alpha: orbit.alpha * 0.5 });
  //   }
  // }
  
  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.starfield.resize(width, height);
    this.lensOverlay.resize(width, height);

    // Update all filters with new screen size
    this.chromaticFilter.setScreenSize(width, height);
    this.starfieldFilter.setScreenSize(width, height);
    this.alphaMaskFilter.setScreenSize(width, height);
  }
  
  private update(deltaTime: number): void {
    const dt = deltaTime / 60;
    this.time += deltaTime;
    
    const input = this.inputManager.update();
    
    // Handle zoom (audio now debounced automatically)
    if (input.zoomDelta !== 0) {
      const newIndex = Math.max(0, Math.min(2, this.currentZoomIndex + input.zoomDelta));
      if (newIndex !== this.currentZoomIndex) {
        const zoomingIn = input.zoomDelta > 0;
        this.currentZoomIndex = newIndex;
        this.targetZoom = CONFIG.ZOOM_LEVELS[this.currentZoomIndex];
        this.audioManager.playZoom(zoomingIn); // Plays zoom-in or zoom-out sound
        this.updateZoomDisplay();
      }
    }
    
    // Smooth zoom
    this.currentZoom += (this.targetZoom - this.currentZoom) * 0.15;
    
    // Apply input with inertia
    const accel = CONFIG.INPUT_ACCELERATION * dt;
    this.velocity.x += input.velocity.x * accel;
    this.velocity.y += input.velocity.y * accel;
    
    // Clamp velocity
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (speed > CONFIG.MAX_VELOCITY) {
      const scale = CONFIG.MAX_VELOCITY / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }
    
    // Friction
    this.velocity.x *= CONFIG.DRIFT_FRICTION;
    this.velocity.y *= CONFIG.DRIFT_FRICTION;
    
    // Update position
    this.universeOffset.x += this.velocity.x * dt;
    this.universeOffset.y += this.velocity.y * dt;
    
    // Update UI
    this.coordsDisplay.textContent = `${(this.universeOffset.x / 100).toFixed(2)} / ${(-this.universeOffset.y / 100).toFixed(2)}`;
    
    const screenCenter: Vec2 = {
      x: this.app.screen.width / 2,
      y: this.app.screen.height / 2,
    };
    
    // Update starfield with 3-layer parallax and zoom (shader handles internally)
    // Apply STAR_PAN_DIRECTION to match planet movement (-1 = inverted for turret model)
    const panDir = CONFIG.STAR_PAN_DIRECTION;
    this.starfield.update(deltaTime, this.universeOffset.x * panDir, this.universeOffset.y * panDir, this.currentZoom);

    // Update gravitational lensing - pass planet screen positions to starfield
    // Gas Giant (index 0)
    this.starfield.setPlanetPosition(
      0,
      this.gasGiantMesh.container.x,
      this.gasGiantMesh.container.y,
      CONFIG.GAS_GIANT_RADIUS * this.currentZoom,
      true
    );
    // Mars (index 1)
    this.starfield.setPlanetPosition(
      1,
      this.mars.container.x,
      this.mars.container.y,
      CONFIG.TERRESTRIAL_RADIUS * this.currentZoom,
      true
    );
    // Earth (index 2)
    this.starfield.setPlanetPosition(
      2,
      this.earth.container.x,
      this.earth.container.y,
      CONFIG.TERRESTRIAL_RADIUS * 1.2 * this.currentZoom,
      true
    );
    // Moon (index 3)
    this.starfield.setPlanetPosition(
      3,
      this.moon.container.x,
      this.moon.container.y,
      CONFIG.MOON_RADIUS * this.currentZoom,
      true
    );
    
    // Update Gas Giant shader mesh
    this.gasGiantMesh.update(deltaTime);
    this.gasGiantMesh.setScreenPosition(this.universeOffset, this.currentZoom, screenCenter);
    
    // Update orbit rings position - COMMENTED OUT
    // this.gasGiantOrbitRings.x = screenCenter.x + this.universeOffset.x * this.currentZoom;
    // this.gasGiantOrbitRings.y = screenCenter.y + this.universeOffset.y * this.currentZoom;
    // this.gasGiantOrbitRings.scale.set(this.currentZoom);
    
    // Update geological planets (uTime passed for cloud/ocean rotation)
    this.mars.update(this.time, 0, 0);
    this.mars.setScreenPosition(this.universeOffset, this.currentZoom, screenCenter);
    
    this.earth.update(this.time, 0, 0);
    this.earth.setScreenPosition(this.universeOffset, this.currentZoom, screenCenter);
    
    this.moon.update(this.time, this.earth.worldPosition.x, this.earth.worldPosition.y);
    this.moon.setScreenPosition(this.universeOffset, this.currentZoom, screenCenter);
    
    // Update ship
    this.shipGlyph.update(this.time, this.universeOffset, this.currentZoom, screenCenter);
    
    // Handle clicks (debounced audio)
    if (input.click && input.clickPosition) {
      this.handleClick(input.clickPosition.x, input.clickPosition.y);
    }
  }
  
  private handleClick(screenX: number, screenY: number): void {
    this.audioManager.playClick(); // Debounced
    
    if (this.shipGlyph.containsPoint(screenX, screenY)) {
      this.shipGlyph.target();
      this.audioManager.playLock(); // Debounced
      return;
    }
    
    // Check Gas Giant (shader mesh)
    if (this.gasGiantMesh.containsPoint(screenX, screenY, this.currentZoom)) {
      console.log('Clicked on gas_giant');
      return;
    }
    
    // Check other celestial bodies
    const bodies = [this.mars, this.earth, this.moon];
    for (const body of bodies) {
      if (body.containsPoint(screenX, screenY, this.currentZoom)) {
        console.log(`Clicked on ${body.type}`);
        return;
      }
    }
    
    this.shipGlyph.untarget();
  }
  
  private updateZoomDisplay(): void {
    const zoomValue = CONFIG.ZOOM_LEVELS[this.currentZoomIndex];
    const zoomName = CONFIG.ZOOM_NAMES[this.currentZoomIndex];
    this.zoomDisplay.textContent = `${zoomValue}× ${zoomName}`;
  }
  
  // ============================================
  // Public API for external control
  // ============================================
  
  /** Set starfield pincushion distortion strength (negative = pincushion) */
  setStarfieldDistortion(strength: number): void {
    this.starfieldFilter.strength = strength;
  }
  
  /** Set master chromatic aberration strength */
  setChromaticStrength(strength: number): void {
    this.chromaticFilter.strength = strength;
  }
  
  setAudioDebounce(ms: number): void {
    this.audioManager.setDebounceMs(ms);
  }
}
