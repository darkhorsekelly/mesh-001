/**
 * Deep Field Starfield GLSL Shaders - SPHERICAL PROJECTION
 * 
 * KEY INSIGHT: Stars should feel like a VOLUME, not wallpaper.
 * We use spherical coordinates so movement feels like looking
 * inside a giant celestial sphere, not panning a 2D image.
 * 
 * ALL VISUAL PARAMETERS ARE CONFIGURABLE VIA UNIFORMS
 * See constants.ts CONFIG.STARFIELD for documentation
 */

export const starfieldVertexShader = `
  in vec2 aPosition;
  in vec2 aUV;
  
  out vec2 vUV;
  
  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;
  
  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clipPos = mvp * vec3(aPosition, 1.0);
    gl_Position = vec4(clipPos.xy, 0.0, 1.0);
    vUV = aUV;
  }
`;

export const starfieldFragmentShader = `
  precision highp float;
  
  in vec2 vUV;
  
  // === Core Uniforms ===
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uOffset;
  uniform float uLensRadius;
  
  // === Parallax Uniforms (CONFIG.STARFIELD) ===
  uniform float uOffsetScale;
  uniform float uParallaxLayer1;
  uniform float uParallaxLayer2;
  uniform float uParallaxLayer3;
  
  // === Zoom Uniforms ===
  uniform float uZoom;              // Current zoom level (0.1, 1.0, or 5.0)
  uniform float uZoomScaleInfluence;
  uniform float uZoomLayer1Mult;
  uniform float uZoomLayer2Mult;
  uniform float uZoomLayer3Mult;
  
  // === Star Layer 1 (Distant) Uniforms ===
  uniform float uLayer1Scale;
  uniform float uLayer1Brightness;
  uniform float uLayer1Threshold;
  uniform float uLayer1TimeMult;
  uniform float uLayer1DepthVariation;
  
  // === Star Layer 2 (Mid) Uniforms ===
  uniform float uLayer2Scale;
  uniform float uLayer2Brightness;
  uniform float uLayer2Threshold;
  uniform float uLayer2TimeMult;
  uniform float uLayer2DepthVariation;
  
  // === Star Layer 3 (Near) Uniforms ===
  uniform float uLayer3Scale;
  uniform float uLayer3Brightness;
  uniform float uLayer3Threshold;
  uniform float uLayer3TimeMult;
  uniform float uLayer3DepthVariation;
  
  // === Star Appearance Uniforms ===
  uniform float uStarSize;
  uniform float uStarSizeVariation;
  uniform float uGlowSizeMultiplier;
  uniform float uGlowIntensity;
  
  // === Twinkle Uniforms ===
  uniform float uTwinkleSpeedBase;
  uniform float uTwinkleSpeedVariation;
  uniform float uTwinkleIntensity;
  
  // === Star Color Thresholds ===
  uniform float uColorRedThreshold;
  uniform float uColorOrangeThreshold;
  uniform float uColorYellowThreshold;
  uniform float uColorWhiteThreshold;
  
  // === Star Colors ===
  uniform vec3 uColorRedGiant;
  uniform vec3 uColorOrange;
  uniform vec3 uColorYellowWhite;
  uniform vec3 uColorWhite;
  uniform vec3 uColorBlue;
  
  // === Nebula Uniforms ===
  uniform float uNebulaScale1;
  uniform float uNebulaScale2;
  uniform float uNebulaSpeed1;
  uniform float uNebulaSpeed2;
  uniform vec3 uNebulaColor1;
  uniform vec3 uNebulaColor2;
  
  // === Background & Vignette ===
  uniform vec3 uBackgroundColor;
  uniform float uVignetteInner;
  uniform float uVignetteOuter;
  uniform vec3 uEdgeHighlightColor;
  uniform float uEdgeHighlightIntensity;

  // === Gravitational Lensing ===
  uniform float uLensingEnabled;
  uniform float uLensingStrength;
  uniform float uLensingRingSize;
  uniform float uLensingFalloff;
  // Planet data: [normalizedX, normalizedY, radiusPixels, enabled]
  uniform vec4 uPlanet0;  // Gas Giant
  uniform vec4 uPlanet1;  // Mars
  uniform vec4 uPlanet2;  // Earth
  uniform vec4 uPlanet3;  // Moon

  // ============================================
  // Hash Functions (Pure math - no textures)
  // ============================================
  
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  
  // ============================================
  // Noise for Nebula
  // ============================================
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  // ============================================
  // Star Layer with Spherical Projection + PER-STAR DEPTH VARIATION
  // Each star gets a unique parallax within a band around the layer's base value
  // 
  // KEY INSIGHT: Use the layer's BASE parallax to establish a reference grid,
  // then offset each star by its DELTA from that reference.
  // ============================================
  
  vec3 starLayerWithDepth(
    vec2 basePos,           // Screen position before parallax
    vec2 normalizedOffset,  // Camera offset (scaled by uOffsetScale)
    float baseParallax,     // Layer's base parallax multiplier (reference)
    float depthVariation,   // How much variation around baseParallax (0-1 = ±0-100%)
    float scale,
    float brightness,
    float threshold,
    float time,
    float seed
  ) {
    vec3 col = vec3(0.0);
    
    // Calculate reference sky position using BASE parallax
    // This gives us a stable grid to work from
    vec2 refSkyPos = basePos + normalizedOffset * baseParallax;
    vec2 scaledRefPos = refSkyPos * scale;
    vec2 refGridID = floor(scaledRefPos);
    vec2 refGridUV = fract(scaledRefPos) - 0.5;
    
    // Check wider neighborhood to catch stars that parallax into view
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
        vec2 cellOffset = vec2(float(x), float(y));
        vec2 cellID = refGridID + cellOffset;
        
        // Hash for this cell - determines if star exists and its properties
        vec2 rand = hash22(cellID + seed);
        
        // Only top percentage become stars
        if (rand.x > threshold) continue;
        
        // Star's base position relative to current pixel (at reference parallax)
        vec2 starBase = cellOffset + rand - 0.5;
        
        // ============================================
        // PER-STAR DEPTH VARIATION
        // Calculate how much this star deviates from the reference parallax
        // ============================================
        float depthHash = hash21(cellID + seed + 500.0);
        float starParallax = baseParallax * (1.0 + (depthHash * 2.0 - 1.0) * depthVariation);
        
        // Parallax delta: how much MORE (or less) this star moves vs reference
        float parallaxDelta = starParallax - baseParallax;
        
        // Additional position offset due to this star's unique depth (in grid units)
        vec2 depthOffset = normalizedOffset * parallaxDelta * scale;
        
        // Star's apparent position = base position + depth-induced offset
        vec2 starPos = starBase + depthOffset;
        
        // Distance from current pixel to star
        float dist = length(refGridUV - starPos);
        
        // Star core (sharp point)
        float starSize = uStarSize * (1.0 - uStarSizeVariation + rand.y * uStarSizeVariation);
        float star = smoothstep(starSize, 0.0, dist);
        
        // Soft glow halo
        star += smoothstep(starSize * uGlowSizeMultiplier, starSize, dist) * uGlowIntensity;
        
        // Twinkle
        float twinkleSpeed = uTwinkleSpeedBase + rand.x * uTwinkleSpeedVariation;
        float twinkle = sin(time * twinkleSpeed + rand.y * 50.0) * uTwinkleIntensity + (1.0 - uTwinkleIntensity);
        star *= twinkle;
        
        // Star color (temperature-based)
        float temp = hash21(cellID + seed + 77.0);
        vec3 starColor;
        if (temp < uColorRedThreshold) {
          starColor = uColorRedGiant;
        } else if (temp < uColorOrangeThreshold) {
          starColor = uColorOrange;
        } else if (temp < uColorYellowThreshold) {
          starColor = uColorYellowWhite;
        } else if (temp < uColorWhiteThreshold) {
          starColor = uColorWhite;
        } else {
          starColor = uColorBlue;
        }
        
        col += star * brightness * starColor;
      }
    }
    
    return col;
  }
  
  // ============================================
  // Nebula Background (Configurable)
  // ============================================

  vec3 nebulaBackground(vec2 p, float time) {
    float n1 = fbm(p * uNebulaScale1 + time * uNebulaSpeed1, 4);
    float n2 = fbm(p * uNebulaScale2 + vec2(100.0) + time * uNebulaSpeed2, 3);

    return uNebulaColor1 * n1 + uNebulaColor2 * n2;
  }

  // ============================================
  // Gravitational Lensing - UV Displacement near massive objects
  // Stars appear to "bulge" outward around planets
  // ============================================

  vec2 applyGravitationalLensing(vec2 uv, vec4 planet, float strength, float ringSize, float falloff) {
    // planet.xy = normalized screen position (0-1)
    // planet.z = radius in pixels
    // planet.w = enabled (1.0 or 0.0)

    if (planet.w < 0.5 || planet.z < 1.0) return uv;

    // Convert planet position to same coordinate space as uv (-1 to 1, aspect corrected)
    float aspect = uResolution.x / uResolution.y;
    vec2 planetPos = (planet.xy - 0.5) * 2.0;
    planetPos.x *= aspect;

    // Planet radius in normalized coordinates
    float planetRadiusNorm = (planet.z / min(uResolution.x, uResolution.y)) * 2.0;

    // Distance from pixel to planet center
    vec2 toPlanet = uv - planetPos;
    float dist = length(toPlanet);

    // Lensing ring extends beyond the planet
    float lensingRadius = planetRadiusNorm * ringSize;

    // Only apply lensing outside the planet but within the ring
    if (dist < planetRadiusNorm * 0.8 || dist > lensingRadius) return uv;

    // Normalized distance within lensing zone (0 at planet edge, 1 at ring edge)
    float t = (dist - planetRadiusNorm) / (lensingRadius - planetRadiusNorm);
    t = clamp(t, 0.0, 1.0);

    // Lensing strength falloff (stronger near planet, weaker at ring edge)
    float lensingFactor = pow(1.0 - t, falloff);

    // Displacement direction (push outward from planet)
    vec2 direction = normalize(toPlanet);

    // Apply displacement (in normalized UV space)
    float displacementAmount = lensingFactor * strength * 0.001;
    return uv + direction * displacementAmount;
  }

  vec2 applyAllLensing(vec2 uv) {
    if (uLensingEnabled < 0.5) return uv;

    // Apply lensing from each planet (cumulative)
    uv = applyGravitationalLensing(uv, uPlanet0, uLensingStrength, uLensingRingSize, uLensingFalloff);
    uv = applyGravitationalLensing(uv, uPlanet1, uLensingStrength, uLensingRingSize, uLensingFalloff);
    uv = applyGravitationalLensing(uv, uPlanet2, uLensingStrength, uLensingRingSize, uLensingFalloff);
    uv = applyGravitationalLensing(uv, uPlanet3, uLensingStrength, uLensingRingSize, uLensingFalloff);

    return uv;
  }

  // ============================================
  // Main - SPHERICAL PARALLAX WITH PER-STAR DEPTH BANDS
  // ============================================
  
  void main() {
    // ============================================
    // 1. Convert Screen UV to "Spherical Coordinates"
    // ============================================
    vec2 p = (vUV - 0.5) * 2.0; // -1 to 1

    // Aspect ratio correction
    float aspect = uResolution.x / uResolution.y;
    p.x *= aspect;

    // ============================================
    // 1.5 Apply Gravitational Lensing
    // Stars bend around massive planets
    // ============================================
    p = applyAllLensing(p);

    // ============================================
    // 2. Normalize the camera offset (configurable scale)
    // ============================================
    vec2 normalizedOffset = uOffset * uOffsetScale;
    
    // ============================================
    // 3. Generate Nebula (uses layer 1 parallax for slowest movement)
    // ============================================
    vec2 nebulaPos = p + normalizedOffset * uParallaxLayer1;
    vec3 nebula = nebulaBackground(nebulaPos * 0.5, uTime);
    
    // ============================================
    // 4. Calculate ZOOM-adjusted scales per layer
    // Higher zoom = stars appear more spread out (lower density)
    // Each layer responds differently to zoom
    // ============================================
    float zoomFactor = log2(uZoom + 1.0); // Logarithmic for smoother feel
    
    // Zoom affects scale: zoomed in = lower scale (bigger stars, fewer visible)
    float layer1ZoomScale = uLayer1Scale / (1.0 + zoomFactor * uZoomScaleInfluence * uZoomLayer1Mult);
    float layer2ZoomScale = uLayer2Scale / (1.0 + zoomFactor * uZoomScaleInfluence * uZoomLayer2Mult);
    float layer3ZoomScale = uLayer3Scale / (1.0 + zoomFactor * uZoomScaleInfluence * uZoomLayer3Mult);
    
    // ============================================
    // 5. Generate Star Layers WITH PER-STAR DEPTH VARIATION
    // Each star in a layer gets its own unique parallax within the layer's depth band
    // ============================================
    
    // Distant stars (each star varies within ±depthVariation of uParallaxLayer1)
    vec3 distantStars = starLayerWithDepth(
      p,                      // Base position
      normalizedOffset,       // Camera movement
      uParallaxLayer1,        // Base parallax for this layer
      uLayer1DepthVariation,  // Depth band variation
      layer1ZoomScale,        // ZOOM-adjusted scale
      uLayer1Brightness,
      uLayer1Threshold,
      uTime * uLayer1TimeMult,
      0.0
    );
    
    // Mid-field stars
    vec3 midStars = starLayerWithDepth(
      p,
      normalizedOffset,
      uParallaxLayer2,
      uLayer2DepthVariation,
      layer2ZoomScale,        // ZOOM-adjusted scale
      uLayer2Brightness,
      uLayer2Threshold,
      uTime * uLayer2TimeMult,
      100.0
    );
    
    // Near stars
    vec3 nearStars = starLayerWithDepth(
      p,
      normalizedOffset,
      uParallaxLayer3,
      uLayer3DepthVariation,
      layer3ZoomScale,        // ZOOM-adjusted scale
      uLayer3Brightness,
      uLayer3Threshold,
      uTime * uLayer3TimeMult,
      200.0
    );
    
    // ============================================
    // 5. Combine All Layers (configurable background)
    // ============================================
    vec3 col = uBackgroundColor;
    col += nebula;
    col += distantStars;
    col += midStars;
    col += nearStars;
    
    // ============================================
    // 6. Vignette and Circular Mask
    // Uses pixel-based calculation for perfect circle matching LensOverlay
    // ============================================
    
    // Screen dimensions
    float minDim = min(uResolution.x, uResolution.y);
    
    // Convert UV to centered coordinates, scaled so shorter axis = 1.0
    vec2 centered = (vUV - 0.5) * uResolution / minDim;
    
    // Distance from center (now correctly circular)
    float dist = length(centered);
    
    // Normalized by lens radius ratio
    // dist = 0 at center, dist = 1.0 at minDim/2 pixels from center
    // With uLensRadius = 0.65, the edge is at dist = 0.65
    float normalizedDist = dist / uLensRadius;
    
    // Gradual vignette
    float vignette = 1.0 - smoothstep(uVignetteInner, uVignetteOuter, normalizedDist);
    col *= vignette;
    
    // Hard circular mask
    float mask = 1.0 - smoothstep(0.95, 1.05, normalizedDist);
    
    // Subtle edge highlight (configurable)
    float edgeHighlight = smoothstep(0.85, 1.0, normalizedDist) * mask;
    col += uEdgeHighlightColor * edgeHighlight * uEdgeHighlightIntensity;
    
    finalColor = vec4(col * mask, 1.0);
  }
`;
