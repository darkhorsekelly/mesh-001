/**
 * LensOverlay - Post-process overlay for telescope lens effects
 * Renders the dark cockpit mask and lens edge effects
 */

import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config/constants';

export class LensOverlay {
  public container: Container;
  
  private graphics: Graphics;
  private width: number;
  private height: number;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    
    this.draw();
  }
  
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.draw();
  }
  
  draw(): void {
    this.graphics.clear();
    
    const cx = this.width / 2;
    const cy = this.height / 2;
    const lensRadius = Math.min(this.width, this.height) * CONFIG.LENS_RADIUS_RATIO;
    
    // Outer dark mask (everything outside the lens)
    // Draw full screen rect
    this.graphics.rect(0, 0, this.width, this.height);
    // Cut out circle
    this.graphics.circle(cx, cy, lensRadius);
    this.graphics.cut();
    this.graphics.fill({ color: 0x0a0a0f });
    
      
    // Inner lens highlight (subtle glass reflection)
    this.graphics.arc(cx - lensRadius * 0.3, cy - lensRadius * 0.3, lensRadius * 0.7, Math.PI * 1.2, Math.PI * 1.7);
    this.graphics.stroke({ color: 0xffffff, width: 2, alpha: 0.02 });
    
    // Scanlines (subtle CRT effect)
    for (let y = 0; y < this.height; y += 3) {
      this.graphics.moveTo(0, y);
      this.graphics.lineTo(this.width, y);
    }
    this.graphics.stroke({ color: 0x000000, width: 1, alpha: 0.015 });
  }
}
