/**
 * ChromaticAberrationFilter - Pure RGB color splitting for optical "glue"
 * 
 * This filter ONLY applies chromatic aberration (RGB separation) without
 * any geometry distortion. Applied to the entire screen to unify all layers
 * with a subtle lens imperfection feel.
 * 
 * Used in the "Turret" model where planets stay geometrically stable
 * but all layers share the same chromatic artifacts.
 */

import { Filter, GlProgram } from 'pixi.js';
import { CONFIG } from '../config/constants';

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
    vScreenCoord = aPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  
  in vec2 vTextureCoord;
  in vec2 vScreenCoord;
  
  uniform sampler2D uTexture;
  uniform float uChromaticStrength;  // RGB split intensity
  uniform vec2 uScreenSize;          // Screen dimensions in pixels
  uniform float uLensRadiusRatio;    // For edge-based intensity falloff
  
  void main() {
    // ============================================
    // Calculate normalized distance from center
    // Chromatic aberration increases toward edges
    // ============================================
    vec2 pixelCoord = vScreenCoord * uScreenSize;
    vec2 screenCenter = uScreenSize * 0.5;
    float lensRadiusPx = min(uScreenSize.x, uScreenSize.y) * uLensRadiusRatio;
    
    vec2 fromCenter = pixelCoord - screenCenter;
    float distPx = length(fromCenter);
    float normalizedDist = distPx / lensRadiusPx;
    
    // Direction from center (normalized)
    vec2 direction = distPx > 0.0 ? fromCenter / distPx : vec2(0.0);
    
    // ============================================
    // Chromatic Aberration - Edge-weighted RGB split
    // Uses radial direction for natural lens feel
    // ============================================
    float edgeFactor = smoothstep(0.2, 0.95, normalizedDist);
    float chromatic = uChromaticStrength * edgeFactor;
    
    // Calculate UV offsets in texture space
    // Red shifts outward, blue shifts inward
    vec2 offsetDir = (vTextureCoord - 0.5) * 2.0;
    float offsetMag = length(offsetDir);
    vec2 normalizedDir = offsetMag > 0.0 ? offsetDir / offsetMag : vec2(0.0);
    
    vec2 uvR = vTextureCoord + normalizedDir * chromatic * 0.01;
    vec2 uvG = vTextureCoord;
    vec2 uvB = vTextureCoord - normalizedDir * chromatic * 0.01;
    
    // Sample each channel with bounds checking
    float r = (uvR.x >= 0.0 && uvR.x <= 1.0 && uvR.y >= 0.0 && uvR.y <= 1.0) 
              ? texture(uTexture, uvR).r : texture(uTexture, vTextureCoord).r;
    float g = texture(uTexture, uvG).g;
    float b = (uvB.x >= 0.0 && uvB.x <= 1.0 && uvB.y >= 0.0 && uvB.y <= 1.0) 
              ? texture(uTexture, uvB).b : texture(uTexture, vTextureCoord).b;
    float a = texture(uTexture, vTextureCoord).a;
    
    finalColor = vec4(r, g, b, a);
  }
`;

export class ChromaticAberrationFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex: vertexShader,
      fragment: fragmentShader,
    });
    
    super({
      glProgram,
      resources: {
        uniforms: {
          uChromaticStrength: { value: CONFIG.MASTER_CHROMATIC_STRENGTH, type: 'f32' },
          uScreenSize: { value: [1920, 1080], type: 'vec2<f32>' },
          uLensRadiusRatio: { value: CONFIG.LENS_RADIUS_RATIO, type: 'f32' },
        },
      },
    });
  }
  
  get strength(): number {
    return this.resources.uniforms.uniforms.uChromaticStrength;
  }
  
  set strength(value: number) {
    this.resources.uniforms.uniforms.uChromaticStrength = value;
  }
  
  get lensRadius(): number {
    return this.resources.uniforms.uniforms.uLensRadiusRatio;
  }
  
  set lensRadius(value: number) {
    this.resources.uniforms.uniforms.uLensRadiusRatio = value;
  }
  
  setScreenSize(width: number, height: number): void {
    this.resources.uniforms.uniforms.uScreenSize = [width, height];
  }
}
