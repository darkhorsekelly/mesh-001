/**
 * CelestialBody - Graphics-based planets (Mars, Earth, Moon)
 * Uses procedural noise for terrain/atmosphere rendering.
 */

import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../config/constants';

export type PlanetType = 'mars' | 'earth' | 'moon';

export class CelestialBody {
  public container: Container;
  public worldPosition: Vec2;
  public radius: number;
  public orbitRadius: number;
  public orbitSpeed: number;
  public orbitAngle: number;
  public type: PlanetType;
  
  private graphics: Graphics;
  private seed: number;
  private rotationPhase: number = 0;
  
  constructor(
    type: PlanetType,
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
    this.seed = seed;
    
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    
    this.drawPlanet();
  }
  
  // Simple hash function
  private hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }
  
  // Simple noise
  private noise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    
    const a = this.hash(ix, iy);
    const b = this.hash(ix + 1, iy);
    const c = this.hash(ix, iy + 1);
    const d = this.hash(ix + 1, iy + 1);
    
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  }
  
  // FBM
  private fbm(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency);
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }
  
  private drawPlanet(): void {
    this.graphics.clear();
    
    const r = this.radius;
    const lightDir = { x: 0.7, y: -0.3 };
    
    // Draw using concentric circles with varying colors
    const steps = 40;
    
    for (let ring = steps; ring >= 0; ring--) {
      const ratio = ring / steps;
      const ringRadius = r * ratio;
      
      if (ringRadius < 1) continue;
      
      // Calculate sphere normal at this ring (approximation)
      const z = Math.sqrt(1 - ratio * ratio);
      const diffuse = Math.max(0, lightDir.x * ratio * 0.5 + lightDir.y * 0 + z * 0.5);
      const terminator = Math.min(1, diffuse * 2);
      
      let color: number;
      
      switch (this.type) {
        case 'mars': {
          // Rusty red terrain
          const terrain = this.fbm(ratio * 5 + this.seed, ratio * 5, 4);
          const r1 = Math.floor((0.8 + terrain * 0.1) * 255 * terminator);
          const g1 = Math.floor((0.4 + terrain * 0.1) * 255 * terminator);
          const b1 = Math.floor((0.3 + terrain * 0.05) * 255 * terminator);
          color = (r1 << 16) | (g1 << 8) | b1;
          break;
        }
        case 'earth': {
          // Blue/green with continents
          const continent = this.fbm(ratio * 4 + this.seed, (1 - ratio) * 4 + this.seed, 3);
          const isLand = continent > 0.45;
          
          if (isLand) {
            const r1 = Math.floor(0.2 * 255 * terminator);
            const g1 = Math.floor((0.5 + this.noise(ratio * 10, ratio * 10) * 0.2) * 255 * terminator);
            const b1 = Math.floor(0.2 * 255 * terminator);
            color = (r1 << 16) | (g1 << 8) | b1;
          } else {
            const depth = this.noise(ratio * 8, ratio * 8) * 0.2;
            const r1 = Math.floor(0.1 * 255 * terminator);
            const g1 = Math.floor((0.3 + depth) * 255 * terminator);
            const b1 = Math.floor((0.6 + depth) * 255 * terminator);
            color = (r1 << 16) | (g1 << 8) | b1;
          }
          break;
        }
        case 'moon': {
          // Gray with craters
          const crater = this.fbm(ratio * 8 + this.seed, ratio * 8, 3);
          const gray = 0.5 + crater * 0.3;
          const r1 = Math.floor(gray * 255 * terminator);
          const g1 = Math.floor(gray * 0.98 * 255 * terminator);
          const b1 = Math.floor(gray * 0.95 * 255 * terminator);
          color = (r1 << 16) | (g1 << 8) | b1;
          break;
        }
      }
      
      this.graphics.circle(0, 0, ringRadius);
      this.graphics.fill({ color });
    }
    
    // Atmosphere glow for non-moon bodies
    if (this.type !== 'moon') {
      const glowColor = this.type === 'earth' ? 0x4488ff : 0xff8866;
      
      for (let i = 5; i > 0; i--) {
        this.graphics.circle(0, 0, r + i * 2);
        this.graphics.stroke({ color: glowColor, width: 1, alpha: 0.1 / i });
      }
    }
  }
  
  update(time: number, parentX: number = 0, parentY: number = 0): void {
    this.rotationPhase = time * 0.0001;
    
    if (this.orbitRadius > 0) {
      this.orbitAngle += this.orbitSpeed;
      this.worldPosition.x = parentX + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.worldPosition.y = parentY + Math.sin(this.orbitAngle) * this.orbitRadius;
    } else {
      this.worldPosition.x = parentX;
      this.worldPosition.y = parentY;
    }
    
    // Redraw occasionally for rotation effect (throttled)
    if (Math.floor(time) % 60 === 0) {
      this.drawPlanet();
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
}
