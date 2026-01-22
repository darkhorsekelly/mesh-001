/**
 * Gas Giant GLSL Shaders
 * Procedural Jupiter-like planet with differential rotation,
 * domain warping, and 3D sphere lighting.
 * 
 * ALL VISUAL PARAMETERS ARE CONFIGURABLE VIA UNIFORMS
 * See constants.ts CONFIG.GAS_GIANT for documentation
 */

export const gasGiantVertexShader = `
  in vec2 aPosition;
  in vec2 aUV;
  
  out vec2 vUV;
  out vec2 vPosition;
  
  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;
  
  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clipPos = mvp * vec3(aPosition, 1.0);
    gl_Position = vec4(clipPos.xy, 0.0, 1.0);
    vUV = aUV;
    vPosition = aPosition;
  }
`;

export const gasGiantFragmentShader = `
  precision highp float;
  
  in vec2 vUV;
  in vec2 vPosition;
  
  // === Core Uniforms ===
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uSunDirection;
  uniform float uRadius;
  uniform float uMeshPadding;      // Mesh padding ratio (1.25 = 25% padding for halo)
  
  // === Rotation Uniforms (CONFIG.GAS_GIANT) ===
  uniform float uRotationSpeed;
  uniform float uDifferentialRotation;
  
  // === Band Uniforms ===
  uniform float uBandCount;
  uniform float uBandNoiseStrength;
  uniform float uSecondaryBandCount;
  uniform float uSecondaryBandNoise;
  uniform float uBandSharpness;
  
  // === Domain Warp Uniforms ===
  uniform float uDomainWarpStrength;
  uniform float uDomainWarpScale;
  
  // === Storm Uniforms ===
  uniform float uStormThresholdMin;
  uniform float uStormThresholdMax;
  uniform float uStormIntensity;
  uniform float uCloudThresholdMin;
  uniform float uCloudThresholdMax;
  uniform float uCloudIntensity;
  
  // === Color Uniforms ===
  uniform vec3 uColorCream;
  uniform vec3 uColorOrangeBrown;
  uniform vec3 uColorRust;
  uniform vec3 uColorDarkBrown;
  uniform vec3 uColorWhiteStorm;
  uniform vec3 uColorRedSpot;
  
  // === Lighting Uniforms ===
  uniform vec3 uRimColor;
  uniform float uRimIntensity;
  uniform vec3 uScatterColor;
  uniform float uScatterIntensity;
  uniform float uAmbient;
  uniform float uLimbDarkeningStrength;
  uniform float uLimbDarkeningPower;
  uniform float uDiffuseTerminatorMin;
  uniform float uDiffuseTerminatorMax;
  uniform float uFresnelPower;
  
  // ============================================
  // Simplex 3D Noise
  // ============================================
  
  vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }
  
  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  
  // ============================================
  // FBM (Fractal Brownian Motion) with Domain Warping
  // ============================================
  
  float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  vec3 domainWarp(vec3 p, float strength) {
    float warpX = fbm(p + vec3(0.0, 0.0, uSeed), 3);
    float warpY = fbm(p + vec3(5.2, 1.3, uSeed + 10.0), 3);
    float warpZ = fbm(p + vec3(2.1, 7.8, uSeed + 20.0), 3);
    return p + vec3(warpX, warpY, warpZ) * strength;
  }
  
  // ============================================
  // Gas Giant Color Palette (Configurable)
  // ============================================
  
  vec3 getGasGiantColor(float band, float noise, float latitude) {
    // Mix based on band position and noise
    float t = band * 0.5 + 0.5;
    vec3 baseColor;
    
    if (t < 0.25) {
      baseColor = mix(uColorCream, uColorOrangeBrown, t * 4.0);
    } else if (t < 0.5) {
      baseColor = mix(uColorOrangeBrown, uColorRust, (t - 0.25) * 4.0);
    } else if (t < 0.75) {
      baseColor = mix(uColorRust, uColorDarkBrown, (t - 0.5) * 4.0);
    } else {
      baseColor = mix(uColorDarkBrown, uColorCream, (t - 0.75) * 4.0);
    }
    
    // Add storm features (Great Red Spot inspired)
    float storm = smoothstep(uStormThresholdMin, uStormThresholdMax, noise) * smoothstep(0.3, 0.0, abs(latitude - 0.2));
    baseColor = mix(baseColor, uColorRedSpot, storm * uStormIntensity);
    
    // Add white clouds
    float clouds = smoothstep(uCloudThresholdMin, uCloudThresholdMax, noise * 0.5 + band * 0.5);
    baseColor = mix(baseColor, uColorWhiteStorm, clouds * uCloudIntensity);
    
    return baseColor;
  }
  
  void main() {
    // Convert UV to centered coordinates (-1 to 1), scaled by mesh padding
    // This allows the sphere (at dist <= 1.0) to fit within the larger mesh
    // leaving room for the atmosphere halo in the padding region
    vec2 uv = (vUV * 2.0 - 1.0) * uMeshPadding;

    // Calculate distance from center for sphere mask
    float dist = length(uv);

    // Sun direction for lighting
    vec3 sunDir = normalize(uSunDirection);

    // ============================================
    // ATMOSPHERE HALO (Beyond Sphere Edge)
    // Gas giants have thick atmospheres with prominent halos
    // ============================================
    if (dist > 1.0) {
      // Halo region (1.0 to ~1.15)
      float haloEnd = 1.15;
      float haloRegion = smoothstep(haloEnd, 1.0, dist);
      if (haloRegion <= 0.0) {
        discard;
      }

      // Direction from center
      vec2 haloDir = normalize(uv);

      // Approximate normal at atmosphere edge
      float zComponent = max(0.05, 1.0 - (dist - 1.0) * 5.0);
      vec3 haloNormal = normalize(vec3(haloDir.x, haloDir.y, zComponent));

      // Rayleigh intensity (stronger at limb)
      float rayleighIntensity = 1.05 - dot(haloNormal, vec3(0.0, 0.0, 1.0));
      rayleighIntensity = pow(rayleighIntensity, 3.0);

      // Sun-facing for visibility
      float haloNdotL = dot(haloNormal, sunDir);
      float haloVisibility = smoothstep(-0.3, 0.3, haloNdotL);

      // Gas giant atmosphere color (warm orange-brown glow)
      vec3 haloColor = uScatterColor * rayleighIntensity * haloRegion * uRimIntensity * 2.0;
      haloColor *= (haloVisibility * 0.7 + 0.3);

      float alpha = haloRegion * rayleighIntensity * (haloVisibility * 0.7 + 0.3);

      finalColor = vec4(haloColor, alpha);
      return;
    }
    
    // Calculate 3D sphere position (z from sphere equation)
    float z = sqrt(1.0 - dist * dist);
    vec3 spherePos = vec3(uv.x, uv.y, z);
    
    // Calculate sphere normal (same as position for unit sphere)
    vec3 normal = normalize(spherePos);
    
    // ============================================
    // Differential Rotation (Configurable)
    // ============================================
    // Latitude-based rotation speed (equator faster than poles)
    float latitude = asin(spherePos.y);
    float rotationSpeed = 1.0 - abs(latitude) * uDifferentialRotation;
    float rotation = uTime * uRotationSpeed * rotationSpeed;
    
    // Convert to spherical coordinates for texture mapping
    float phi = atan(spherePos.x, spherePos.z) + rotation;
    float theta = latitude;
    
    // 3D position for noise sampling (rotating sphere surface)
    vec3 noisePos = vec3(
      cos(theta) * cos(phi),
      sin(theta),
      cos(theta) * sin(phi)
    );
    
    // ============================================
    // Domain Warping for Cloud Flow (Configurable)
    // ============================================
    vec3 warpedPos = domainWarp(noisePos * uDomainWarpScale, uDomainWarpStrength);
    
    // Multiple noise layers for bands
    float bandNoise = fbm(warpedPos + vec3(0.0, uSeed, 0.0), 5);
    float detailNoise = fbm(warpedPos * 2.0 + vec3(uTime * 0.02, 0.0, 0.0), 4);
    
    // Create horizontal bands based on latitude (Configurable counts)
    float bands = sin(theta * uBandCount + bandNoise * uBandNoiseStrength) * 0.5 + 0.5;
    bands = pow(bands, uBandSharpness);
    
    // Add secondary band detail
    float secondaryBands = sin(theta * uSecondaryBandCount + detailNoise * uSecondaryBandNoise) * 0.3;
    bands = clamp(bands + secondaryBands, 0.0, 1.0);
    
    // ============================================
    // Get Base Color
    // ============================================
    float normalizedLat = theta / 1.57; // -1 to 1
    vec3 baseColor = getGasGiantColor(bands, detailNoise, normalizedLat);
    
    // ============================================
    // 3D Lighting (Configurable)
    // ============================================
    // sunDir already declared above for halo
    float NdotL = dot(normal, sunDir);
    
    // Diffuse lighting with soft terminator
    float diffuse = smoothstep(uDiffuseTerminatorMin, uDiffuseTerminatorMax, NdotL);
    
    // Fresnel rim lighting (atmosphere glow)
    float fresnel = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), uFresnelPower);
    
    // ============================================
    // Final Color Composition
    // ============================================
    vec3 litColor = baseColor * (diffuse * 0.9 + uAmbient);
    
    // Add rim light
    litColor += uRimColor * fresnel * uRimIntensity * (diffuse * 0.5 + 0.5);
    
    // Add subtle atmospheric scattering on shadow edge
    float terminator = smoothstep(-0.1, 0.1, NdotL);
    litColor += uScatterColor * (1.0 - terminator) * fresnel * uScatterIntensity;
    
    // Edge darkening (limb darkening)
    float limbDarkening = 1.0 - pow(1.0 - z, uLimbDarkeningPower) * uLimbDarkeningStrength;
    litColor *= limbDarkening;
    
    // Soft edge for anti-aliasing
    float edgeSoftness = 1.0 - smoothstep(0.97, 1.0, dist);
    
    finalColor = vec4(litColor, edgeSoftness);
  }
`;
