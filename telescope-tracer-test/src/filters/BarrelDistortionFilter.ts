/**
 * BarrelDistortionFilter - Optical lens imperfections for telescope feel
 * 
 * Uses screen pixel coordinates for proper centering.
 * The circular mask now matches the LensOverlay exactly.
 */

import { Filter, GlProgram } from 'pixi.js';

const vertexShader = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  out vec2 vScreenCoord;
  
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;
  
  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }
  
  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
  
  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
    // Pass screen position (0 to 1 normalized)
    vScreenCoord = aPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  
  in vec2 vTextureCoord;
  in vec2 vScreenCoord;
  
  uniform sampler2D uTexture;
  uniform float uStrength;           // Barrel distortion strength
  uniform float uChromaticStrength;  // RGB split strength
  uniform vec2 uScreenSize;          // Screen dimensions in pixels
  uniform float uLensRadiusRatio;    // Lens radius as ratio of min(width, height)
  
  void main() {
    // ============================================
    // PIXEL-BASED CIRCLE CALCULATION
    // This exactly matches the LensOverlay Graphics
    // ============================================
    
    // Convert normalized screen coord to pixels
    vec2 pixelCoord = vScreenCoord * uScreenSize;
    
    // Screen center in pixels
    vec2 screenCenter = uScreenSize * 0.5;
    
    // Lens radius in pixels (matches LensOverlay exactly)
    float lensRadiusPx = min(uScreenSize.x, uScreenSize.y) * uLensRadiusRatio;
    
    // Vector from center in pixels
    vec2 fromCenterPx = pixelCoord - screenCenter;
    float distPx = length(fromCenterPx);
    
    // Normalized distance (0 = center, 1 = edge of lens)
    float normalizedDist = distPx / lensRadiusPx;
    
    // Direction from center (for chromatic aberration)
    vec2 direction = distPx > 0.0 ? fromCenterPx / distPx : vec2(0.0);
    
    // ============================================
    // Calculate UV offset based on screen position
    // Use vScreenCoord (0-1) centered at 0.5
    // ============================================
    vec2 screenCentered = vScreenCoord - 0.5;
    float screenDistSq = dot(screenCentered, screenCentered);
    
    // Base texture coordinate
    vec2 baseUV = vTextureCoord;
    
    // Find the relationship between screen coords and texture coords
    // This handles any offset in the filter's texture coordinate system
    vec2 texCenterOffset = vTextureCoord - vScreenCoord;
    
    // ============================================
    // Barrel Distortion (very subtle for telescope)
    // Applied uniformly based on screen position
    // ============================================
    vec2 distortedScreen = screenCentered * (1.0 + screenDistSq * uStrength) + 0.5;
    vec2 distortedUV = distortedScreen + texCenterOffset;
    
    // Bounds check
    if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || 
        distortedUV.y < 0.0 || distortedUV.y > 1.0) {
      finalColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    
    // ============================================
    // Chromatic Aberration (RGB Split at edges)
    // Based on normalized distance from lens center
    // ============================================
    float edgeFactor = smoothstep(0.3, 0.95, normalizedDist);
    float chromatic = uChromaticStrength * edgeFactor;
    
    // Apply chromatic aberration based on screen position (not texture coords)
    vec2 screenR = screenCentered * (1.0 + screenDistSq * (uStrength + chromatic)) + 0.5;
    vec2 screenG = distortedScreen;
    vec2 screenB = screenCentered * (1.0 + screenDistSq * (uStrength - chromatic)) + 0.5;
    
    // Convert back to texture coordinates
    vec2 uvR = screenR + texCenterOffset;
    vec2 uvG = distortedUV;
    vec2 uvB = screenB + texCenterOffset;
    
    // Sample with bounds checking
    float r = (uvR.x >= 0.0 && uvR.x <= 1.0 && uvR.y >= 0.0 && uvR.y <= 1.0) 
              ? texture(uTexture, uvR).r : 0.0;
    float g = texture(uTexture, uvG).g;
    float b = (uvB.x >= 0.0 && uvB.x <= 1.0 && uvB.y >= 0.0 && uvB.y <= 1.0) 
              ? texture(uTexture, uvB).b : 0.0;
    float a = texture(uTexture, distortedUV).a;
    
    vec3 color = vec3(r, g, b);
    
    // ============================================
    // Vignette (darkening toward edges)
    // ============================================
    float vignette = 1.0 - smoothstep(0.5, 1.0, normalizedDist);
    color *= vignette;
    
    // ============================================
    // Circular Mask (hard edge at lens boundary)
    // ============================================
    float mask = 1.0 - smoothstep(0.98, 1.02, normalizedDist);
    
    // Edge glow removed - was creating visible cyan stroke
    
    // Apply mask to alpha only (for proper fading)
    finalColor = vec4(color, mask);
  }
`;

export class BarrelDistortionFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex: vertexShader,
      fragment: fragmentShader,
    });
    
    super({
      glProgram,
      resources: {
        uniforms: {
          uStrength: { value: 0.02, type: 'f32' },
          uChromaticStrength: { value: 0.015, type: 'f32' },
          uScreenSize: { value: [1920, 1080], type: 'vec2<f32>' },
          uLensRadiusRatio: { value: 0.65, type: 'f32' },
        },
      },
    });
  }
  
  get strength(): number {
    return this.resources.uniforms.uniforms.uStrength;
  }
  
  set strength(value: number) {
    this.resources.uniforms.uniforms.uStrength = value;
  }
  
  get chromaticStrength(): number {
    return this.resources.uniforms.uniforms.uChromaticStrength;
  }
  
  set chromaticStrength(value: number) {
    this.resources.uniforms.uniforms.uChromaticStrength = value;
  }
  
  get lensRadius(): number {
    return this.resources.uniforms.uniforms.uLensRadiusRatio;
  }
  
  set lensRadius(value: number) {
    this.resources.uniforms.uniforms.uLensRadiusRatio = value;
  }
  
  /**
   * Set screen size for proper pixel-based circle calculation
   * MUST be called on init and resize!
   */
  setScreenSize(width: number, height: number): void {
    this.resources.uniforms.uniforms.uScreenSize = [width, height];
  }
}
