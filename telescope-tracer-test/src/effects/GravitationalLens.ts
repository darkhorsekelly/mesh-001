/**
 * GravitationalLens - Creates displacement maps for gravitational lensing effect
 * 
 * Planets bend light from background stars, creating a "halo" distortion.
 * Uses PIXI's DisplacementFilter with procedurally generated ring textures.
 * 
 * ALL visual parameters are pulled from CONFIG for easy tuning.
 */

import { Container, Sprite, Texture, DisplacementFilter, BLEND_MODES } from 'pixi.js';
import { CONFIG } from '../config/constants';

/**
 * Creates a radial displacement texture for gravitational lensing
 * The texture creates an outward "push" effect around a planet
 */
function createLensDisplacementTexture(size: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2;
  
  // Create radial gradient for displacement
  // R channel = X displacement, G channel = Y displacement
  // Values > 128 push outward, < 128 push inward
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalizedDist = dist / radius;
      
      // Displacement strength falls off from center outward
      // Using a ring pattern: strongest at edges, zero in center
      let strength = 0;
      if (normalizedDist > 0.4 && normalizedDist < 1.0) {
        // Create ring effect
        const ringPos = (normalizedDist - 0.4) / 0.6; // 0 to 1 within ring
        strength = Math.sin(ringPos * Math.PI) * (1.0 - ringPos * 0.5);
      }
      
      // Calculate outward direction
      let dirX = 0, dirY = 0;
      if (dist > 0) {
        dirX = dx / dist;
        dirY = dy / dist;
      }
      
      // Convert to displacement (128 = neutral, >128 = positive, <128 = negative)
      const dispX = 128 + dirX * strength * 127;
      const dispY = 128 + dirY * strength * 127;
      
      const i = (y * size + x) * 4;
      data[i] = dispX;     // R = X displacement
      data[i + 1] = dispY; // G = Y displacement
      data[i + 2] = 128;   // B = unused
      data[i + 3] = 255;   // A = full opacity
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return Texture.from(canvas);
}

/**
 * GravitationalLens - Manages displacement sprites for all planets
 */
export class GravitationalLens {
  public container: Container;
  public filter: DisplacementFilter;
  
  private sprites: Map<string, Sprite> = new Map();
  private texture: Texture;
  
  constructor() {
    this.container = new Container();
    
    // Create the displacement texture (shared by all planets)
    const textureSize = 256; // Higher = more detail
    this.texture = createLensDisplacementTexture(textureSize);
    
    // Create displacement filter
    // The filter uses this container's sprites as displacement maps
    this.filter = new DisplacementFilter({
      sprite: new Sprite(this.texture), // Placeholder, will be updated
      scale: CONFIG.LENSING_ENABLED ? CONFIG.LENSING_STRENGTH : 0,
    });
  }
  
  /**
   * Add a lensing sprite for a planet
   * @param id - Unique identifier for the planet
   * @param radius - Planet radius (lens ring will be larger)
   */
  addPlanet(id: string, radius: number): Sprite {
    const sprite = new Sprite(this.texture);
    
    // Scale sprite to lens ring size
    const ringSize = radius * 2 * CONFIG.LENSING_RING_SIZE;
    sprite.width = ringSize;
    sprite.height = ringSize;
    sprite.anchor.set(0.5);
    
    // Make invisible (only affects displacement, not visible)
    sprite.alpha = 0;
    sprite.blendMode = BLEND_MODES.NORMAL;
    
    this.sprites.set(id, sprite);
    this.container.addChild(sprite);
    
    return sprite;
  }
  
  /**
   * Update a planet's lens position
   */
  updatePlanetPosition(id: string, x: number, y: number, scale: number): void {
    const sprite = this.sprites.get(id);
    if (sprite) {
      sprite.x = x;
      sprite.y = y;
      sprite.scale.set(scale);
    }
  }
  
  /**
   * Remove a planet's lens
   */
  removePlanet(id: string): void {
    const sprite = this.sprites.get(id);
    if (sprite) {
      this.container.removeChild(sprite);
      this.sprites.delete(id);
    }
  }
  
  /**
   * Enable/disable lensing effect
   */
  setEnabled(enabled: boolean): void {
    this.filter.scale.x = enabled ? CONFIG.LENSING_STRENGTH : 0;
    this.filter.scale.y = enabled ? CONFIG.LENSING_STRENGTH : 0;
  }
  
  /**
   * Set lensing strength
   */
  setStrength(strength: number): void {
    this.filter.scale.x = strength;
    this.filter.scale.y = strength;
  }
  
  /**
   * Get the filter to apply to background (stars)
   */
  getFilter(): DisplacementFilter {
    return this.filter;
  }
}
