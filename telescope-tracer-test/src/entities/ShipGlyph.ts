/**
 * ShipGlyph - AR overlay for ships/targets
 * Maintains minimum pixel size regardless of zoom (inverse scale)
 */

import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../config/constants';

export class ShipGlyph {
  public container: Container;
  public worldPosition: Vec2;
  
  private diamond: Graphics;
  private targetBrackets: Graphics;
  private isTargeted: boolean = false;
  private targetAnimation: number = 0;
  private pulsePhase: number = 0;
  
  private static readonly MIN_SIZE = 20;
  private static readonly BASE_SIZE = 30;
  
  constructor(worldX: number, worldY: number) {
    this.worldPosition = { x: worldX, y: worldY };
    this.container = new Container();
    
    this.diamond = new Graphics();
    this.drawDiamond(ShipGlyph.BASE_SIZE);
    this.container.addChild(this.diamond);
    
    this.targetBrackets = new Graphics();
    this.targetBrackets.alpha = 0;
    this.container.addChild(this.targetBrackets);
  }
  
  private drawDiamond(size: number): void {
    this.diamond.clear();
    
    // Outer diamond
    this.diamond.moveTo(0, -size);
    this.diamond.lineTo(size * 0.6, 0);
    this.diamond.lineTo(0, size);
    this.diamond.lineTo(-size * 0.6, 0);
    this.diamond.closePath();
    this.diamond.stroke({ color: 0x00ffcc, width: 2, alpha: 0.9 });
    
    // Inner diamond
    const innerSize = size * 0.4;
    this.diamond.moveTo(0, -innerSize);
    this.diamond.lineTo(innerSize * 0.6, 0);
    this.diamond.lineTo(0, innerSize);
    this.diamond.lineTo(-innerSize * 0.6, 0);
    this.diamond.closePath();
    this.diamond.fill({ color: 0x00ffcc, alpha: 0.3 });
    
    // Center dot
    this.diamond.circle(0, 0, 3);
    this.diamond.fill({ color: 0x00ffcc, alpha: 1 });
  }
  
  private drawTargetBrackets(size: number, progress: number): void {
    this.targetBrackets.clear();
    
    const bracketSize = size * 1.5;
    const cornerLength = bracketSize * 0.3;
    const offset = bracketSize * (1 - progress) * 0.5;
    
    const positions = [
      { x: -bracketSize - offset, y: -bracketSize - offset, dx: 1, dy: 0 },
      { x: bracketSize + offset, y: -bracketSize - offset, dx: -1, dy: 0 },
      { x: -bracketSize - offset, y: bracketSize + offset, dx: 1, dy: 0 },
      { x: bracketSize + offset, y: bracketSize + offset, dx: -1, dy: 0 },
    ];
    
    for (const pos of positions) {
      this.targetBrackets.moveTo(pos.x, pos.y);
      this.targetBrackets.lineTo(pos.x + cornerLength * pos.dx, pos.y);
      this.targetBrackets.moveTo(pos.x, pos.y);
      this.targetBrackets.lineTo(pos.x, pos.y + cornerLength * (pos.y < 0 ? 1 : -1));
    }
    
    this.targetBrackets.stroke({ color: 0xffaa00, width: 2, alpha: 0.9 });
  }
  
  target(): void {
    this.isTargeted = true;
    this.targetAnimation = 0;
  }
  
  untarget(): void {
    this.isTargeted = false;
  }
  
  update(time: number, universeOffset: Vec2, zoom: number, screenCenter: Vec2): void {
    this.pulsePhase = time * 0.003;
    
    const screenX = screenCenter.x + (this.worldPosition.x + universeOffset.x) * zoom;
    const screenY = screenCenter.y + (this.worldPosition.y + universeOffset.y) * zoom;
    
    this.container.x = screenX;
    this.container.y = screenY;
    
    // INVERSE SCALE - maintain minimum pixel size
    const worldSize = ShipGlyph.BASE_SIZE * zoom;
    const displaySize = Math.max(worldSize, ShipGlyph.MIN_SIZE);
    const scale = displaySize / ShipGlyph.BASE_SIZE;
    
    this.container.scale.set(scale);
    
    // Pulse effect
    const pulse = Math.sin(this.pulsePhase) * 0.1 + 1;
    this.diamond.scale.set(pulse);
    
    // Target animation
    if (this.isTargeted) {
      this.targetAnimation = Math.min(this.targetAnimation + 0.05, 1);
      this.targetBrackets.alpha = this.targetAnimation;
      this.drawTargetBrackets(ShipGlyph.BASE_SIZE, this.targetAnimation);
    } else {
      this.targetAnimation = Math.max(this.targetAnimation - 0.1, 0);
      this.targetBrackets.alpha = this.targetAnimation;
      if (this.targetAnimation > 0) {
        this.drawTargetBrackets(ShipGlyph.BASE_SIZE, this.targetAnimation);
      }
    }
  }
  
  containsPoint(screenX: number, screenY: number): boolean {
    const dx = screenX - this.container.x;
    const dy = screenY - this.container.y;
    const hitRadius = 40;
    return dx * dx + dy * dy < hitRadius * hitRadius;
  }
}
