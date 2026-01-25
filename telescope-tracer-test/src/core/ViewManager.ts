/**
 * ViewManager - Manages transitions between Telescope and Orbit views
 * 
 * Implements the "Director" transition sequence:
 * Phase A: The Departure (Turn Right) - Telescope skews and slides off left
 * Phase B: The Corridor (The Void) - Blackout
 * Phase C: The Arrival (Walk Up) - OrbitViewport slides in from right
 */

import { Container, Graphics } from 'pixi.js';
import { TelescopeViewport } from './TelescopeViewport';
import { OrbitViewport, type PlanetData } from '../views/OrbitViewport';

export enum ViewState {
  TELESCOPE,
  TRANSITIONING,
  ORBIT,
}

// Easing functions (GSAP-style)
function easePower2In(t: number): number {
  return t * t;
}

function easeBackOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class ViewManager {
  private telescopeViewport!: TelescopeViewport;
  private orbitViewport!: OrbitViewport;
  private state: ViewState = ViewState.TELESCOPE;
  
  private transitionContainer!: Container;
  private blackoutOverlay!: Graphics;
  
  private transitionStartTime = 0;
  private transitionDuration = 0;
  private currentPhase: 'A' | 'B' | 'C' | null = null;
  
  // Phase A (Departure) timing
  private phaseADuration = 600; // 0.6 seconds
  private phaseBDuration = 200; // 0.2 seconds blackout
  private phaseCDuration = 800; // 0.8 seconds
  
  constructor(telescopeViewport: TelescopeViewport, orbitViewport: OrbitViewport) {
    this.telescopeViewport = telescopeViewport;
    this.orbitViewport = orbitViewport;
    
    this.setupTransitionOverlay();
  }
  
  private setupTransitionOverlay(): void {
    // Blackout overlay for Phase B
    this.blackoutOverlay = new Graphics();
    this.blackoutOverlay.rect(-10000, -10000, 20000, 20000);
    this.blackoutOverlay.fill(0x000000);
    this.blackoutOverlay.alpha = 0;
    this.blackoutOverlay.zIndex = 1000;
  }
  
  public transitionToOrbit(planetData: PlanetData): void {
    if (this.state === ViewState.TRANSITIONING) {
      return; // Already transitioning
    }
    
    this.state = ViewState.TRANSITIONING;
    this.currentPhase = 'A';
    this.transitionStartTime = performance.now();
    this.transitionDuration = this.phaseADuration + this.phaseBDuration + this.phaseCDuration;
    
    // Set planet data for orbit viewport
    this.orbitViewport.setPlanet(planetData);
    
    // Get telescope container (we'll need to expose this)
    const telescopeContainer = this.telescopeViewport.getMasterContainer();
    const orbitContainer = this.orbitViewport.getContainer();
    
    // Setup initial states
    telescopeContainer.skew.x = 0;
    orbitContainer.x = window.innerWidth / 2;
    orbitContainer.scale.set(0.8);
    orbitContainer.skew.y = 0.1;
    orbitContainer.visible = false;
    
    // Setup blackout overlay if not already added
    const app = this.telescopeViewport.getApp();
    if (!this.blackoutOverlay.parent) {
      app.stage.addChild(this.blackoutOverlay);
    }
    
    // Start the transition update loop
    this.startTransitionLoop();
  }
  
  private isReversing = false;
  
  public transitionToTelescope(): void {
    if (this.state === ViewState.TRANSITIONING) {
      return;
    }
    
    this.state = ViewState.TRANSITIONING;
    this.isReversing = true;
    this.currentPhase = 'A';
    this.transitionStartTime = performance.now();
    this.transitionDuration = this.phaseADuration + this.phaseBDuration + this.phaseCDuration;
    
    const telescopeContainer = this.telescopeViewport.getMasterContainer();
    const orbitContainer = this.orbitViewport.getContainer();
    
    // Reverse: Orbit slides out right, Telescope slides in from left
    orbitContainer.visible = true;
    telescopeContainer.visible = true;
    telescopeContainer.x = -window.innerWidth;
    telescopeContainer.skew.x = -0.5;
    
    // Setup blackout overlay
    const app = this.telescopeViewport.getApp();
    if (!this.blackoutOverlay.parent) {
      app.stage.addChild(this.blackoutOverlay);
    }
    
    this.startTransitionLoop();
  }
  
  private transitionLoopId: number | null = null;
  
  private startTransitionLoop(): void {
    if (this.transitionLoopId !== null) return;
    
    const loop = () => {
      if (this.state === ViewState.TRANSITIONING) {
        this.updateTransition();
        this.transitionLoopId = requestAnimationFrame(loop);
      } else {
        this.transitionLoopId = null;
      }
    };
    
    this.transitionLoopId = requestAnimationFrame(loop);
  }
  
  public updateTransition(): void {
    if (this.state !== ViewState.TRANSITIONING) return;
    
    const now = performance.now();
    const elapsed = now - this.transitionStartTime;
    const progress = Math.min(elapsed / this.transitionDuration, 1.0);
    
    const telescopeContainer = this.telescopeViewport.getMasterContainer();
    const orbitContainer = this.orbitViewport.getContainer();
    const windowWidth = window.innerWidth;
    
    // Determine current phase
    let phaseProgress = 0;
    if (elapsed < this.phaseADuration) {
      this.currentPhase = 'A';
      phaseProgress = elapsed / this.phaseADuration;
    } else if (elapsed < this.phaseADuration + this.phaseBDuration) {
      this.currentPhase = 'B';
      phaseProgress = (elapsed - this.phaseADuration) / this.phaseBDuration;
    } else {
      this.currentPhase = 'C';
      phaseProgress = (elapsed - this.phaseADuration - this.phaseBDuration) / this.phaseCDuration;
    }
    
    if (this.isReversing) {
      // Reverse transition: Orbit → Telescope
      if (this.currentPhase === 'A') {
        // Phase A: Orbit slides out right
        const eased = easePower2In(phaseProgress);
        orbitContainer.x = windowWidth * eased;
        orbitContainer.scale.set(1.0 - 0.2 * eased);
        orbitContainer.skew.y = 0.1 * eased;
      } else if (this.currentPhase === 'B') {
        // Phase B: Blackout
        this.blackoutOverlay.alpha = 1.0;
        orbitContainer.visible = false;
        telescopeContainer.visible = true;
        telescopeContainer.x = -windowWidth;
        telescopeContainer.skew.x = -0.5;
      } else if (this.currentPhase === 'C') {
        // Phase C: Telescope slides in from left
        const eased = easeBackOut(phaseProgress);
        telescopeContainer.x = -windowWidth + windowWidth * eased;
        telescopeContainer.skew.x = -0.5 * (1 - eased);
        
        // Fade out blackout
        this.blackoutOverlay.alpha = 1.0 - phaseProgress;
      }
    } else {
      // Forward transition: Telescope → Orbit
      if (this.currentPhase === 'A') {
        // Phase A: Telescope skews and slides off left
        const eased = easePower2In(phaseProgress);
        telescopeContainer.skew.x = -0.5 * eased;
        telescopeContainer.x = -windowWidth * eased;
      } else if (this.currentPhase === 'B') {
        // Phase B: Blackout
        this.blackoutOverlay.alpha = 1.0;
        telescopeContainer.visible = false;
        orbitContainer.visible = true;
        orbitContainer.x = windowWidth / 2; // Start position
        orbitContainer.scale.set(0.8);
        orbitContainer.skew.y = 0.1;
      } else if (this.currentPhase === 'C') {
        // Phase C: Orbit slides in from right
        const eased = easeBackOut(phaseProgress);
        const startX = windowWidth / 2;
        const endX = 0;
        orbitContainer.x = startX + (endX - startX) * eased;
        orbitContainer.scale.set(0.8 + 0.2 * eased);
        orbitContainer.skew.y = 0.1 * (1 - eased);
        
        // Fade out blackout
        this.blackoutOverlay.alpha = 1.0 - phaseProgress;
      }
    }
    
    // Check if transition complete
    if (progress >= 1.0) {
      this.completeTransition();
    }
  }
  
  private completeTransition(): void {
    if (this.isReversing) {
      // Transitioning to telescope
      this.state = ViewState.TELESCOPE;
      this.telescopeViewport.show();
      this.orbitViewport.hide();
      
      // Reset orbit container
      const orbitContainer = this.orbitViewport.getContainer();
      orbitContainer.x = 0;
      orbitContainer.scale.set(1.0);
      orbitContainer.skew.y = 0;
      orbitContainer.visible = false;
      
      // Reset telescope container
      const telescopeContainer = this.telescopeViewport.getMasterContainer();
      telescopeContainer.skew.x = 0;
      telescopeContainer.x = 0;
    } else {
      // Transitioning to orbit
      this.state = ViewState.ORBIT;
      this.orbitViewport.show();
      this.telescopeViewport.hide();
      
      // Reset telescope container
      const telescopeContainer = this.telescopeViewport.getMasterContainer();
      telescopeContainer.skew.x = 0;
      telescopeContainer.x = 0;
      telescopeContainer.visible = false;
      
      // Finalize orbit position
      const orbitContainer = this.orbitViewport.getContainer();
      orbitContainer.x = 0;
      orbitContainer.scale.set(1.0);
      orbitContainer.skew.y = 0;
    }
    
    this.blackoutOverlay.alpha = 0;
    this.currentPhase = null;
    this.isReversing = false;
    
    // Stop transition loop
    if (this.transitionLoopId !== null) {
      cancelAnimationFrame(this.transitionLoopId);
      this.transitionLoopId = null;
    }
  }
  
  public getState(): ViewState {
    return this.state;
  }
  
  public update(deltaTime: number): void {
    if (this.state === ViewState.TRANSITIONING) {
      this.updateTransition();
    }
    
    if (this.state === ViewState.ORBIT) {
      this.orbitViewport.update(deltaTime);
    } else if (this.state === ViewState.TELESCOPE) {
      // Telescope updates itself
    }
  }
}
