/**
 * MESH 1995 - Telescope Viewport
 * Entry Point
 * 
 * A high-fidelity space simulation interface with procedural celestial bodies,
 * optical lens distortion effects, and convex starfield parallax.
 * 
 * Architecture:
 * ├── config/          Configuration constants
 * ├── shaders/         GLSL shader strings
 * ├── audio/           Audio management (Howler.js)
 * ├── input/           Input handling (keyboard, mouse, gamepad, touch)
 * ├── entities/        Game entities (planets, ships, starfield)
 * ├── overlays/        Post-process overlays (lens effects)
 * └── core/            Main application controller
 */

import './style.css';
import { TelescopeViewport } from './core/TelescopeViewport';

// Bootstrap the application
const viewport = new TelescopeViewport();
viewport.init().catch(console.error);
