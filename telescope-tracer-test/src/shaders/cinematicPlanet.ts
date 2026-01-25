/**
 * Cinematic Planet GLSL Shader
 * High-fidelity 4K quality planet rendering for OrbitViewport
 * 
 * Upgrades from terrestrial shader:
 * - Cloud Shadows: Offset cloud noise to create terrain shadows
 * - Specular Glint: Sharp pow(dot(reflection, view), 64.0) on water
 * - Rayleigh Fog: Atmospheric density based on viewing angle (edge glows, center clear)
 */

export const cinematicPlanetVertexShader = `
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

export const cinematicPlanetFragmentShader = `
  precision highp float;
  
  in vec2 vUV;
  in vec2 vPosition;
  
  out vec4 finalColor;
  
  // === Core Uniforms ===
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uSunDirection;
  uniform int uPlanetType;         // 0 = Mars, 1 = Earth, 2 = Moon
  uniform vec3 uAtmosphereColor;
  uniform float uAtmosphereIntensity;
  uniform float uMeshPadding;
  
  // === Global Lighting Uniforms ===
  uniform float uDiffuseTerminatorMin;
  uniform float uDiffuseTerminatorMax;
  uniform float uAmbientWithAtmosphere;
  uniform float uAmbientNoAtmosphere;
  uniform float uLimbDarkeningStrength;
  uniform float uLimbDarkeningPower;
  uniform float uFresnelPower;
  uniform float uTerminatorScatterStrength;
  
  // === Atmosphere Halo ===
  uniform float uAtmosphereHaloStart;
  uniform float uAtmosphereHaloEnd;
  uniform float uAtmosphereHaloPower;
  
  // === Rayleigh Scattering ===
  uniform vec3 uRayleighSunsetColor;
  uniform vec3 uRayleighDayColor;
  uniform float uRayleighIntensity;
  uniform float uRayleighThickness;
  
  // === Terminator Softness ===
  uniform float uTerminatorSoftMin;
  uniform float uTerminatorSoftMax;
  uniform vec3 uTerminatorTwilightColor;
  uniform float uTerminatorTwilightIntensity;
  
  // === Earth Uniforms (for cinematic rendering) ===
  uniform float uEarthRotationSpeed;
  uniform float uEarthTerrainScale;
  uniform float uEarthCoastDetailScale;
  uniform float uEarthCoastDetailStrength;
  uniform float uEarthSeaLevel;
  uniform float uEarthWaterSpecularPower;
  uniform float uEarthWaterSpecularIntensity;
  uniform float uEarthWaveScale;
  uniform float uEarthWaveSpeed;
  uniform float uEarthCloudScale;
  uniform float uEarthCloudThresholdMin;
  uniform float uEarthCloudThresholdMax;
  uniform float uEarthCloudOpacity;
  uniform float uEarthCloudSpeed;
  uniform float uEarthTropicalExtent;
  uniform float uEarthTemperateStart;
  uniform float uEarthTemperateEnd;
  uniform float uEarthPolarSnowStart;
  uniform float uEarthPolarSnowFull;
  uniform vec3 uEarthColorDeepWater;
  uniform vec3 uEarthColorShallowWater;
  uniform vec3 uEarthColorBeach;
  uniform vec3 uEarthColorForest;
  uniform vec3 uEarthColorGrassland;
  uniform vec3 uEarthColorDesert;
  uniform vec3 uEarthColorMountain;
  uniform vec3 uEarthColorSnow;
  uniform vec3 uEarthColorClouds;
  
  // === Cinematic Upgrades ===
  uniform float uCloudShadowStrength;      // How much clouds darken terrain (0.0-1.0)
  uniform float uCloudShadowOffset;        // UV offset for shadow calculation (0.02)
  uniform float uSpecularGlintPower;       // Sharpness of water glint (64.0)
  uniform float uRayleighFogIntensity;      // Edge fog intensity
  uniform float uRayleighFogPower;         // Edge fog falloff power
  
  // ============================================
  // Hash Functions
  // ============================================
  
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
  
  float hash31(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }
  
  // ============================================
  // Noise Functions
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
  
  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }
  
  // ============================================
  // FBM (Fractal Brownian Motion)
  // ============================================
  
  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float maxValue = 0.0;
    
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * noise(p * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value / maxValue;
  }
  
  float fbm3D(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    float maxValue = 0.0;
    
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      value += amplitude * noise3D(p * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value / maxValue;
  }
  
  // ============================================
  // Cinematic Earth Renderer
  // ============================================
  
  vec3 renderCinematicEarth(vec3 spherePos, vec3 normal, float latitude, float longitude, vec3 sunDir, vec3 viewDir) {
    vec2 uv = vec2(longitude / 6.28 + 0.5, latitude / 3.14 + 0.5);
    
    // FBM height map for terrain
    float height = fbm(uv * uEarthTerrainScale + uSeed, 6);
    float coastDetail = fbm(uv * uEarthTerrainScale * uEarthCoastDetailScale + uSeed + 100.0, 4) * uEarthCoastDetailStrength;
    height = height + coastDetail;
    
    // Sea level threshold
    bool isWater = height < uEarthSeaLevel;
    
    vec3 color;
    
    if (isWater) {
      // ============================================
      // WATER with CINEMATIC Specular Glint
      // ============================================
      float waterDepth = (uEarthSeaLevel - height) / uEarthSeaLevel;
      color = mix(uEarthColorShallowWater, uEarthColorDeepWater, waterDepth);
      
      // CINEMATIC UPGRADE: Sharp specular glint (pow 64.0)
      vec3 reflection = reflect(-sunDir, normal);
      float specular = pow(max(dot(reflection, viewDir), 0.0), uSpecularGlintPower);
      color += vec3(1.0, 0.95, 0.8) * specular * uEarthWaterSpecularIntensity;
      
      // Subtle wave pattern
      float waves = fbm(uv * uEarthWaveScale + uTime * uEarthWaveSpeed, 3) * 0.05;
      color += vec3(waves);
      
    } else {
      // ============================================
      // LAND with CINEMATIC Cloud Shadows
      // ============================================
      float landHeight = (height - uEarthSeaLevel) / (1.0 - uEarthSeaLevel);
      
      // Biome based on latitude and height
      float tropical = 1.0 - smoothstep(0.0, uEarthTropicalExtent, abs(latitude / 1.57));
      float temperate = smoothstep(uEarthTemperateStart, uEarthTemperateEnd, abs(latitude / 1.57)) * (1.0 - smoothstep(uEarthTemperateEnd, 0.8, abs(latitude / 1.57)));
      
      // Beach near water
      if (landHeight < 0.05) {
        color = uEarthColorBeach;
      } else if (landHeight < 0.4) {
        vec3 lowlandColor = mix(uEarthColorForest, uEarthColorGrassland, 1.0 - tropical);
        lowlandColor = mix(lowlandColor, uEarthColorDesert, (1.0 - tropical) * (1.0 - temperate));
        color = mix(uEarthColorBeach, lowlandColor, (landHeight - 0.05) / 0.35);
      } else if (landHeight < 0.7) {
        color = mix(uEarthColorGrassland, uEarthColorMountain, (landHeight - 0.4) / 0.3);
      } else {
        float snowLine = smoothstep(0.7, 0.9, landHeight);
        color = mix(uEarthColorMountain, uEarthColorSnow, snowLine);
      }
      
      // Polar snow
      float polarSnow = smoothstep(uEarthPolarSnowStart, uEarthPolarSnowFull, abs(latitude / 1.57));
      color = mix(color, uEarthColorSnow, polarSnow);
      
      // CINEMATIC UPGRADE: Cloud Shadows
      // Offset cloud noise to simulate light source position
      float cloudTime = uTime * uEarthCloudSpeed;
      vec2 cloudUV = uv + vec2(cloudTime, 0.0);
      float clouds = fbm(cloudUV * uEarthCloudScale + uSeed + 500.0, 5);
      clouds = smoothstep(uEarthCloudThresholdMin, uEarthCloudThresholdMax, clouds);
      
      // Shadow: offset cloud noise (simulates light source offset)
      vec2 shadowUV = cloudUV + vec2(uCloudShadowOffset, uCloudShadowOffset);
      float cloudShadow = fbm(shadowUV * uEarthCloudScale + uSeed + 500.0, 5);
      cloudShadow = smoothstep(uEarthCloudThresholdMin, uEarthCloudThresholdMax, cloudShadow);
      
      // Darken land where clouds cast shadows
      color = mix(color, vec3(0.0), cloudShadow * uCloudShadowStrength * clouds);
    }
    
    // ============================================
    // Cloud Layer (on top of everything)
    // ============================================
    float cloudTime = uTime * uEarthCloudSpeed;
    vec2 cloudUV = uv + vec2(cloudTime, 0.0);
    float clouds = fbm(cloudUV * uEarthCloudScale + uSeed + 500.0, 5);
    clouds = smoothstep(uEarthCloudThresholdMin, uEarthCloudThresholdMax, clouds);
    
    // Clouds are white/gray
    color = mix(color, uEarthColorClouds, clouds * uEarthCloudOpacity);
    
    return color;
  }
  
  // ============================================
  // Main
  // ============================================
  
  void main() {
    vec2 uv = (vUV * 2.0 - 1.0) * uMeshPadding;
    float dist = length(uv);
    vec3 sunDir = normalize(uSunDirection);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    
    // ============================================
    // ATMOSPHERE HALO (Beyond Sphere Edge)
    // ============================================
    if (dist > 1.0) {
      if (uPlanetType == 2) {
        discard;
      }
      
      float haloRegion = smoothstep(uAtmosphereHaloEnd, uAtmosphereHaloStart, dist);
      if (haloRegion <= 0.0) {
        discard;
      }
      
      vec2 haloDir = normalize(uv);
      float zComponent = max(0.05, 1.0 - (dist - 1.0) * 5.0);
      vec3 haloNormal = normalize(vec3(haloDir.x, haloDir.y, zComponent));
      
      float rayleighIntensity = 1.05 - dot(haloNormal, vec3(0.0, 0.0, 1.0));
      rayleighIntensity = pow(rayleighIntensity, 3.0);
      
      float haloNdotL = dot(haloNormal, sunDir);
      float sunFacing = smoothstep(-0.5, 0.5, haloNdotL);
      
      vec3 rayleighColor = mix(uRayleighSunsetColor, uRayleighDayColor, sunFacing);
      vec3 atmosphereBlend = mix(rayleighColor, uAtmosphereColor, 0.3);
      
      float haloGlow = pow(haloRegion, uAtmosphereHaloPower);
      vec3 haloColor = atmosphereBlend * rayleighIntensity * haloGlow * uRayleighIntensity;
      
      float haloVisibility = smoothstep(-0.3, 0.3, haloNdotL);
      haloColor *= (haloVisibility * 0.7 + 0.3);
      
      float alpha = haloGlow * rayleighIntensity * (haloVisibility * 0.7 + 0.3);
      
      finalColor = vec4(haloColor, alpha);
      return;
    }
    
    // ============================================
    // SPHERE INTERIOR - Main Planet Rendering
    // ============================================
    
    float z = sqrt(1.0 - dist * dist);
    vec3 spherePos = vec3(uv.x, uv.y, z);
    vec3 normal = normalize(spherePos);
    
    float latitude = asin(spherePos.y);
    float rotSpeed = uPlanetType == 0 ? 0.001 : (uPlanetType == 1 ? uEarthRotationSpeed : 0.003);
    float longitude = atan(spherePos.x, spherePos.z) + uTime * rotSpeed;
    
    // Render based on planet type (for now, focus on Earth for cinematic)
    vec3 baseColor;
    if (uPlanetType == 1) {
      baseColor = renderCinematicEarth(spherePos, normal, latitude, longitude, sunDir, viewDir);
    } else {
      // Fallback to simple rendering for Mars/Moon (can be enhanced later)
      baseColor = vec3(0.5, 0.3, 0.2);
    }
    
    // ============================================
    // 3D Lighting
    // ============================================
    float NdotL = dot(normal, sunDir);
    float terminatorFactor = smoothstep(uTerminatorSoftMin, uTerminatorSoftMax, NdotL);
    float diffuse = terminatorFactor;
    float ambient = (uPlanetType == 2) ? uAmbientNoAtmosphere : uAmbientWithAtmosphere;
    
    vec3 litColor = baseColor * (diffuse * 0.95 + ambient);
    
    // Twilight tint
    if (uPlanetType != 2) {
      float twilightZone = 1.0 - abs(NdotL - 0.0);
      twilightZone = pow(twilightZone, 3.0) * smoothstep(-0.3, 0.1, NdotL);
      litColor += uTerminatorTwilightColor * twilightZone * uTerminatorTwilightIntensity;
    }
    
    // ============================================
    // CINEMATIC UPGRADE: Rayleigh Fog
    // Atmospheric density based on viewing angle
    // Edge glows brightly, center is clear
    // ============================================
    float rayleighIntensity = 1.05 - dot(normal, viewDir);
    float rayleighFog = pow(rayleighIntensity, uRayleighFogPower);
    
    // Sun-facing for color variation
    float surfaceSunFacing = smoothstep(-0.2, 0.5, NdotL);
    vec3 surfaceRayleigh = mix(uRayleighSunsetColor, uRayleighDayColor, surfaceSunFacing);
    
    // Blend Rayleigh scattering with atmosphere color
    vec3 atmosphereBlend = mix(surfaceRayleigh, uAtmosphereColor, 0.4);
    
    // Atmosphere visibility based on sun position
    float atmosphereVisibility = smoothstep(-0.3, 0.3, NdotL) * 0.7 + 0.3;
    
    // Additive blend for surface atmosphere (stronger at limb/edge)
    vec3 atmosphereGlow = atmosphereBlend * rayleighFog * uRayleighIntensity * uRayleighFogIntensity * atmosphereVisibility;
    litColor += atmosphereGlow;
    
    // Enhanced terminator scattering
    float terminator = 1.0 - abs(NdotL);
    terminator = pow(terminator, 2.0) * smoothstep(-0.2, 0.2, NdotL);
    litColor += uRayleighSunsetColor * terminator * rayleighIntensity * uTerminatorScatterStrength;
    
    // Limb Darkening
    float limbDarkening = 1.0 - pow(1.0 - z, uLimbDarkeningPower) * uLimbDarkeningStrength;
    litColor *= limbDarkening;
    
    // Soft Edge Anti-aliasing
    float edgeSoftness = 1.0 - smoothstep(0.95, 1.0, dist);
    
    // For planets with atmosphere, blend to halo at edge
    if (uPlanetType != 2 && dist > 0.92) {
      float edgeBlend = smoothstep(0.92, 1.0, dist);
      float edgeNdotL = dot(normal, sunDir);
      float edgeSunFacing = smoothstep(-0.5, 0.5, edgeNdotL);
      vec3 edgeRayleigh = mix(uRayleighSunsetColor, uRayleighDayColor, edgeSunFacing);
      float edgeVisibility = smoothstep(-0.3, 0.3, edgeNdotL);
      litColor = mix(litColor, edgeRayleigh * uRayleighIntensity * edgeVisibility, edgeBlend * 0.5);
    }
    
    finalColor = vec4(litColor, edgeSoftness);
  }
`;
