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
 * ├── views/           Viewport implementations (Telescope, Orbit)
 * └── core/            Main application controller
 */

import './style.css';
import { TelescopeViewport } from './core/TelescopeViewport';
import { OrbitViewport } from './views/OrbitViewport';
import { ViewManager } from './core/ViewManager';

// Bootstrap the application
async function init() {
  const telescopeViewport = new TelescopeViewport();
  await telescopeViewport.init();
  
  const app = telescopeViewport.getApp();
  const orbitViewport = new OrbitViewport(app);
  
  const viewManager = new ViewManager(telescopeViewport, orbitViewport);
  
  // Wire up planet click callback
  telescopeViewport.onPlanetClick = (planetData) => {
    viewManager.transitionToOrbit(planetData);
  };
  
  // Update view manager in main loop
  app.ticker.add((ticker) => {
    viewManager.update(ticker.deltaTime);
  });
  
  console.log('🎬 ViewManager initialized');
  console.log('   ├─ Telescope → Orbit transition ✓');
  console.log('   ├─ Cinematic planet shader ✓');
  console.log('   └─ Living camera effects ✓');
}

init().catch(console.error);
