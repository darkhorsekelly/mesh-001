/**
 * InputManager - Normalizes input from keyboard, mouse, gamepad, and touch
 */

import { CONFIG } from '../config/constants';

export interface InputState {
  velocity: { x: number; y: number };
  zoomDelta: number;
  click: boolean;
  clickPosition: { x: number; y: number } | null;
}

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseDown = false;
  private lastMousePos = { x: 0, y: 0 };
  private mouseDelta = { x: 0, y: 0 };
  private wheelDelta = 0;
  private clickPos: { x: number; y: number } | null = null;
  
  // Touch state
  private touches: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDist = 0;
  private touchDelta = { x: 0, y: 0 };
  
  constructor(canvas: HTMLCanvasElement) {
    this.setupKeyboard();
    this.setupMouse(canvas);
    this.setupGamepad();
    this.setupTouch(canvas);
  }
  
  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === '+' || e.key === '=') this.wheelDelta = 1;
      if (e.key === '-' || e.key === '_') this.wheelDelta = -1;
      if (e.key === ' ') {
        this.clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }
  
  private setupMouse(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    
    window.addEventListener('mousemove', (e) => {
      if (this.mouseDown) {
        this.mouseDelta.x += e.clientX - this.lastMousePos.x;
        this.mouseDelta.y += e.clientY - this.lastMousePos.y;
      }
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta = e.deltaY > 0 ? -1 : 1;
    }, { passive: false });
    
    canvas.addEventListener('click', (e) => {
      if (Math.abs(this.mouseDelta.x) < 5 && Math.abs(this.mouseDelta.y) < 5) {
        this.clickPos = { x: e.clientX, y: e.clientY };
      }
    });
  }
  
  private setupGamepad(): void {
    window.addEventListener('gamepadconnected', () => {
      console.log('🎮 Gamepad connected');
    });
  }
  
  private setupTouch(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        this.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
      if (this.touches.size === 2) {
        const [t1, t2] = Array.from(this.touches.values());
        this.lastPinchDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.touches.size === 1) {
        const touch = e.changedTouches[0];
        const last = this.touches.get(touch.identifier);
        if (last) {
          this.touchDelta.x += touch.clientX - last.x;
          this.touchDelta.y += touch.clientY - last.y;
          this.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
        }
      } else if (this.touches.size === 2) {
        for (const touch of e.changedTouches) {
          this.touches.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
        }
        const [t1, t2] = Array.from(this.touches.values());
        const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
        if (this.lastPinchDist > 0) {
          const delta = dist - this.lastPinchDist;
          if (Math.abs(delta) > 30) {
            this.wheelDelta = delta > 0 ? 1 : -1;
            this.lastPinchDist = dist;
          }
        }
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      for (const touch of e.changedTouches) {
        if (this.touches.size === 1 && Math.abs(this.touchDelta.x) < 10 && Math.abs(this.touchDelta.y) < 10) {
          this.clickPos = { x: touch.clientX, y: touch.clientY };
        }
        this.touches.delete(touch.identifier);
      }
      this.lastPinchDist = 0;
    });
  }
  
  update(): InputState {
    const velocity = { x: 0, y: 0 };
    
    // Keyboard input
    if (this.keys.has('w') || this.keys.has('arrowup')) velocity.y = 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) velocity.y = -1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) velocity.x = 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) velocity.x = -1;
    
    // Mouse drag (inverted - universe moves opposite to drag)
    velocity.x += this.mouseDelta.x * 0.5;
    velocity.y += this.mouseDelta.y * 0.5;
    
    // Touch drag
    velocity.x += this.touchDelta.x * 0.5;
    velocity.y += this.touchDelta.y * 0.5;
    
    // Gamepad
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp) {
        const deadzone = 0.15;
        const lx = Math.abs(gp.axes[0]) > deadzone ? -gp.axes[0] : 0;
        const ly = Math.abs(gp.axes[1]) > deadzone ? -gp.axes[1] : 0;
        velocity.x += lx * CONFIG.INPUT_ACCELERATION * 0.016;
        velocity.y += ly * CONFIG.INPUT_ACCELERATION * 0.016;
        
        if (gp.buttons[6]?.pressed) this.wheelDelta = -1;
        if (gp.buttons[7]?.pressed) this.wheelDelta = 1;
        
        if (gp.buttons[0]?.pressed) {
          this.clickPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }
      }
    }
    
    const state: InputState = {
      velocity,
      zoomDelta: this.wheelDelta,
      click: this.clickPos !== null,
      clickPosition: this.clickPos,
    };
    
    // Reset deltas
    this.mouseDelta = { x: 0, y: 0 };
    this.touchDelta = { x: 0, y: 0 };
    this.wheelDelta = 0;
    this.clickPos = null;
    
    return state;
  }
}
