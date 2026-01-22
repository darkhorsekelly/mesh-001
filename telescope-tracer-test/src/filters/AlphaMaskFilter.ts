/**
 * AlphaMaskFilter - Fades content at telescope edge
 * 
 * Applies a circular alpha mask that fades content to transparent
 * at the telescope boundary. Used for planets/moon to fade at edges.
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
  uniform vec2 uScreenSize;
  uniform float uLensRadiusRatio;
  uniform float uFadeStart;  // Where fading begins (0-1, as ratio of lens radius)
  uniform float uFadeEnd;    // Where fully transparent (0-1, as ratio of lens radius)
  
  void main() {
    // Use gl_FragCoord for absolute screen pixel coordinates (not container-relative)
    // gl_FragCoord.xy gives pixel coordinates from bottom-left
    vec2 screenCoord = gl_FragCoord.xy;
    vec2 screenCenter = uScreenSize * 0.5;
    float lensRadiusPx = min(uScreenSize.x, uScreenSize.y) * uLensRadiusRatio;
    
    vec2 fromCenter = screenCoord - screenCenter;
    float distPx = length(fromCenter);
    float normalizedDist = distPx / lensRadiusPx;
    
    // Sample original color
    vec4 color = texture(uTexture, vTextureCoord);
    
    // Apply fade to BLACK (not transparent) based on distance from SCREEN center
    // Fade starts at uFadeStart and ends at uFadeEnd (both as ratios of lens radius)
    
    // Hard cutoff - discard pixels beyond lens edge
    if (normalizedDist >= 1.0) {
      discard;
    }
    
    // Calculate fade factor (1.0 = full color, 0.0 = black)
    float fadeFactor;
    if (normalizedDist <= uFadeStart) {
      fadeFactor = 1.0; // Full color before fade start
    } else if (normalizedDist >= uFadeEnd) {
      fadeFactor = 0.0; // Fully black at fade end
    } else {
      // Smooth fade between fade start and fade end
      fadeFactor = 1.0 - smoothstep(uFadeStart, uFadeEnd, normalizedDist);
    }
    
    // Fade color towards black (multiply RGB by fade factor)
    vec3 fadedColor = color.rgb * fadeFactor;
    
    // Keep original alpha
    finalColor = vec4(fadedColor, color.a);
  }
`;

export class AlphaMaskFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex: vertexShader,
      fragment: fragmentShader,
    });
    
    super({
      glProgram,
      resources: {
        uniforms: {
          uScreenSize: { value: [1920, 1080], type: 'vec2<f32>' },
          uLensRadiusRatio: { value: CONFIG.LENS_RADIUS_RATIO, type: 'f32' },
          uFadeStart: { value: 0.7, type: 'f32' }, // Start fading at 70% of lens radius
          uFadeEnd: { value: 1.0, type: 'f32' },   // Fully black at edge
        },
      },
    });
  }
  
  setScreenSize(width: number, height: number): void {
    this.resources.uniforms.uniforms.uScreenSize = [width, height];
  }
  
  setFadeRange(start: number, end: number): void {
    this.resources.uniforms.uniforms.uFadeStart = start;
    this.resources.uniforms.uniforms.uFadeEnd = end;
  }
}
