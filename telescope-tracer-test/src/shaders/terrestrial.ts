/**
 * Geological Planet GLSL Shaders
 * Terrestrial planets with FBM terrain generation
 * Moon with Voronoi crater noise
 * Full Fresnel atmosphere glow and specular water reflections
 * 
 * ALL VISUAL PARAMETERS ARE CONFIGURABLE VIA UNIFORMS
 * See constants.ts CONFIG.MARS, CONFIG.EARTH, CONFIG.MOON for documentation
 */

export const terrestrialVertexShader = `
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

export const terrestrialFragmentShader = `
  precision highp float;
  
  in vec2 vUV;
  in vec2 vPosition;
  
  // === Core Uniforms ===
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uSunDirection;
  uniform int uPlanetType;         // 0 = Mars, 1 = Earth, 2 = Moon
  uniform vec3 uAtmosphereColor;
  uniform float uAtmosphereIntensity;
  uniform float uMeshPadding;      // Mesh padding ratio (1.25 = 25% padding for halo)
  
  // === Global Lighting Uniforms ===
  uniform float uDiffuseTerminatorMin;
  uniform float uDiffuseTerminatorMax;
  uniform float uAmbientWithAtmosphere;
  uniform float uAmbientNoAtmosphere;
  uniform float uLimbDarkeningStrength;
  uniform float uLimbDarkeningPower;
  uniform float uFresnelPower;
  uniform float uTerminatorScatterStrength;
  
  // === Atmosphere Halo (Soft Edge) ===
  uniform float uAtmosphereHaloStart;    // Alpha fade start (1.0 = sphere edge)
  uniform float uAtmosphereHaloEnd;      // Alpha fade end (beyond sphere)
  uniform float uAtmosphereHaloPower;    // Glow falloff power
  
  // === Rayleigh Scattering Glow ===
  uniform vec3 uRayleighSunsetColor;     // Orange at sunset
  uniform vec3 uRayleighDayColor;        // Blue in daytime
  uniform float uRayleighIntensity;      // Glow brightness
  uniform float uRayleighThickness;      // Ring thickness
  
  // === Terminator Softness (Twilight) ===
  uniform float uTerminatorSoftMin;      // smoothstep inner edge
  uniform float uTerminatorSoftMax;      // smoothstep outer edge
  uniform vec3 uTerminatorTwilightColor; // Twilight tint
  uniform float uTerminatorTwilightIntensity;
  
  // === Mars Uniforms ===
  uniform float uMarsRotationSpeed;
  uniform float uMarsTerrainScale;
  uniform float uMarsDetailScale;
  uniform float uMarsDetailStrength;
  uniform float uMarsLowlandThreshold;
  uniform float uMarsMidlandThreshold;
  uniform float uMarsPolarStart;
  uniform float uMarsPolarFull;
  uniform float uMarsPolarStrength;
  uniform vec2 uMarsVolcanoCenter;
  uniform float uMarsVolcanoRadius;
  uniform float uMarsVolcanoStrength;
  uniform vec3 uMarsColorLowlands;
  uniform vec3 uMarsColorMidlands;
  uniform vec3 uMarsColorHighlands;
  uniform vec3 uMarsColorPeaks;
  uniform vec3 uMarsColorPolarIce;
  uniform vec3 uMarsColorVolcano;
  
  // === Earth Uniforms ===
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
  
  // === Moon Uniforms ===
  uniform float uMoonRotationSpeed;
  uniform float uMoonWarpScale;
  uniform float uMoonWarpStrengthX;
  uniform float uMoonWarpStrengthY;
  uniform float uMoonDustScale;
  uniform float uMoonFineDustScale;
  uniform float uMoonFineDustStrength;
  uniform float uMoonDustHeightInfluence;
  uniform float uMoonMariaScale;
  uniform float uMoonMariaThresholdMin;
  uniform float uMoonMariaThresholdMax;
  uniform float uMoonMariaDarkness;
  uniform float uMoonLargeCraterScale;
  uniform float uMoonMediumCraterScale;
  uniform float uMoonSmallCraterScale;
  uniform float uMoonLargeCraterDepth;
  uniform float uMoonLargeCraterRimInner;
  uniform float uMoonLargeCraterRimOuter;
  uniform float uMoonLargeCraterRimStrength;
  uniform float uMoonLargeCraterFloorStrength;
  uniform float uMoonMediumCraterDepth;
  uniform float uMoonMediumCraterRimInner;
  uniform float uMoonMediumCraterRimOuter;
  uniform float uMoonMediumCraterRimStrength;
  uniform float uMoonMediumCraterFloorStrength;
  uniform float uMoonSmallCraterDepth;
  uniform float uMoonSmallCraterRimInner;
  uniform float uMoonSmallCraterRimOuter;
  uniform float uMoonSmallCraterRimStrength;
  uniform float uMoonSmallCraterFloorStrength;
  uniform float uMoonBaseGray;
  uniform float uMoonHeightVariation;
  uniform float uMoonGrayMin;
  uniform float uMoonGrayMax;
  uniform vec3 uMoonWarmTint;
  
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
  // Noise Functions for Terrain
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
  // FBM (Fractal Brownian Motion) for Height Maps
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
  // Voronoi (Cellular) Noise for Moon Craters
  // ============================================
  
  vec2 voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    float minDist = 1.0;
    float secondDist = 1.0;
    vec2 nearestPoint = vec2(0.0);
    
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash22(i + neighbor);
        vec2 diff = neighbor + point - f;
        float dist = length(diff);
        
        if (dist < minDist) {
          secondDist = minDist;
          minDist = dist;
          nearestPoint = point;
        } else if (dist < secondDist) {
          secondDist = dist;
        }
      }
    }
    
    return vec2(minDist, secondDist);
  }
  
  // ============================================
  // Mars Renderer (Configurable FBM Terrain)
  // ============================================
  
  vec3 renderMars(vec3 spherePos, vec3 normal, float latitude, float longitude) {
    vec2 uv = vec2(longitude / 6.28 + 0.5, latitude / 3.14 + 0.5);
    
    // FBM height map (configurable scales)
    float height = fbm(uv * uMarsTerrainScale + uSeed, 6);
    float detail = fbm(uv * uMarsTerrainScale * uMarsDetailScale + uSeed + 50.0, 4) * uMarsDetailStrength;
    height = height + detail;
    
    // Mars color gradient based on elevation (configurable colors and thresholds)
    vec3 color;
    if (height < uMarsLowlandThreshold) {
      color = mix(uMarsColorLowlands, uMarsColorMidlands, height / uMarsLowlandThreshold);
    } else if (height < uMarsMidlandThreshold) {
      color = mix(uMarsColorMidlands, uMarsColorHighlands, (height - uMarsLowlandThreshold) / (uMarsMidlandThreshold - uMarsLowlandThreshold));
    } else {
      color = mix(uMarsColorHighlands, uMarsColorPeaks, (height - uMarsMidlandThreshold) / (1.0 - uMarsMidlandThreshold));
    }
    
    // Polar ice caps (configurable)
    float polar = smoothstep(uMarsPolarStart, uMarsPolarFull, abs(latitude / 1.57));
    color = mix(color, uMarsColorPolarIce, polar * uMarsPolarStrength);
    
    // Olympus Mons style volcano feature (configurable position and size)
    float volcano = 1.0 - smoothstep(0.0, uMarsVolcanoRadius, length(uv - uMarsVolcanoCenter));
    color = mix(color, uMarsColorVolcano, volcano * uMarsVolcanoStrength);
    
    return color;
  }
  
  // ============================================
  // Earth Renderer (Configurable FBM + Water + Clouds)
  // ============================================
  
  vec3 renderEarth(vec3 spherePos, vec3 normal, float latitude, float longitude, vec3 sunDir, vec3 viewDir) {
    vec2 uv = vec2(longitude / 6.28 + 0.5, latitude / 3.14 + 0.5);
    
    // FBM height map for terrain (configurable)
    float height = fbm(uv * uEarthTerrainScale + uSeed, 6);
    float coastDetail = fbm(uv * uEarthTerrainScale * uEarthCoastDetailScale + uSeed + 100.0, 4) * uEarthCoastDetailStrength;
    height = height + coastDetail;
    
    // Sea level threshold (configurable)
    bool isWater = height < uEarthSeaLevel;
    
    vec3 color;
    
    if (isWater) {
      // ============================================
      // WATER with Specular Highlight (configurable)
      // ============================================
      float waterDepth = (uEarthSeaLevel - height) / uEarthSeaLevel;
      color = mix(uEarthColorShallowWater, uEarthColorDeepWater, waterDepth);
      
      // Specular reflection (Sun glint on water) - configurable power and intensity
      vec3 halfVec = normalize(sunDir + viewDir);
      float specular = pow(max(dot(normal, halfVec), 0.0), uEarthWaterSpecularPower);
      color += vec3(1.0, 0.95, 0.8) * specular * uEarthWaterSpecularIntensity;
      
      // Subtle wave pattern (configurable)
      float waves = fbm(uv * uEarthWaveScale + uTime * uEarthWaveSpeed, 3) * 0.05;
      color += vec3(waves);
      
    } else {
      // ============================================
      // LAND with elevation-based coloring (configurable)
      // ============================================
      float landHeight = (height - uEarthSeaLevel) / (1.0 - uEarthSeaLevel);
      
      // Biome based on latitude and height (configurable extents)
      float tropical = 1.0 - smoothstep(0.0, uEarthTropicalExtent, abs(latitude / 1.57));
      float temperate = smoothstep(uEarthTemperateStart, uEarthTemperateEnd, abs(latitude / 1.57)) * (1.0 - smoothstep(uEarthTemperateEnd, 0.8, abs(latitude / 1.57)));
      
      // Beach near water
      if (landHeight < 0.05) {
        color = uEarthColorBeach;
      } else if (landHeight < 0.4) {
        // Low to mid elevation
        vec3 lowlandColor = mix(uEarthColorForest, uEarthColorGrassland, 1.0 - tropical);
        lowlandColor = mix(lowlandColor, uEarthColorDesert, (1.0 - tropical) * (1.0 - temperate));
        color = mix(uEarthColorBeach, lowlandColor, (landHeight - 0.05) / 0.35);
      } else if (landHeight < 0.7) {
        // Mid to high elevation
        color = mix(uEarthColorGrassland, uEarthColorMountain, (landHeight - 0.4) / 0.3);
      } else {
        // Mountain peaks with snow
        float snowLine = smoothstep(0.7, 0.9, landHeight);
        color = mix(uEarthColorMountain, uEarthColorSnow, snowLine);
      }
      
      // Polar snow (configurable)
      float polarSnow = smoothstep(uEarthPolarSnowStart, uEarthPolarSnowFull, abs(latitude / 1.57));
      color = mix(color, uEarthColorSnow, polarSnow);
    }
    
    // ============================================
    // Cloud Layer (animated, configurable)
    // ============================================
    float cloudTime = uTime * uEarthCloudSpeed;
    vec2 cloudUV = uv + vec2(cloudTime, 0.0);
    float clouds = fbm(cloudUV * uEarthCloudScale + uSeed + 500.0, 5);
    clouds = smoothstep(uEarthCloudThresholdMin, uEarthCloudThresholdMax, clouds);
    
    // Clouds are white/gray (configurable color)
    color = mix(color, uEarthColorClouds, clouds * uEarthCloudOpacity);
    
    return color;
  }
  
  // ============================================
  // Moon Renderer - Configurable Domain Warped Voronoi + FBM Dust
  // ============================================
  
  vec3 renderMoon(vec3 spherePos, vec3 normal, float latitude, float longitude) {
    vec2 uv = vec2(longitude / 6.28 + 0.5, latitude / 3.14 + 0.5);
    
    // ============================================
    // DOMAIN WARPING (configurable)
    // ============================================
    float warp = fbm(uv * uMoonWarpScale + uSeed, 4);
    vec2 warpedUV = uv + vec2(warp * uMoonWarpStrengthX, warp * uMoonWarpStrengthY);
    
    // ============================================
    // SURFACE TEXTURE (configurable)
    // ============================================
    float dust = fbm(uv * uMoonDustScale + uSeed, 5);
    float fineDust = fbm(uv * uMoonFineDustScale + uSeed + 300.0, 3) * uMoonFineDustStrength;
    float surfaceTexture = dust * 0.7 + fineDust;
    
    // ============================================
    // MARIA (Dark Basaltic Plains) - configurable
    // ============================================
    float maria = fbm(uv * uMoonMariaScale + uSeed + 50.0, 3);
    float mariaMask = smoothstep(uMoonMariaThresholdMin, uMoonMariaThresholdMax, maria);
    
    // ============================================
    // VORONOI CRATERS - All scales configurable
    // ============================================
    
    // Large impact craters
    vec2 largeVoronoi = voronoi(warpedUV * uMoonLargeCraterScale + uSeed);
    float largeCrater = largeVoronoi.x;
    float largeCraterDepth = 1.0 - smoothstep(0.0, uMoonLargeCraterDepth, largeCrater);
    float largeCraterRim = smoothstep(uMoonLargeCraterRimInner, uMoonLargeCraterDepth, largeCrater) - smoothstep(uMoonLargeCraterDepth, uMoonLargeCraterRimOuter, largeCrater);
    
    // Medium craters
    vec2 medVoronoi = voronoi(warpedUV * uMoonMediumCraterScale + uSeed + 100.0);
    float medCraterDepth = 1.0 - smoothstep(0.0, uMoonMediumCraterDepth, medVoronoi.x);
    float medCraterRim = smoothstep(uMoonMediumCraterRimInner, uMoonMediumCraterDepth, medVoronoi.x) - smoothstep(uMoonMediumCraterDepth, uMoonMediumCraterRimOuter, medVoronoi.x);
    
    // Small craters
    vec2 smallVoronoi = voronoi(warpedUV * uMoonSmallCraterScale + uSeed + 200.0);
    float smallCraterDepth = 1.0 - smoothstep(0.0, uMoonSmallCraterDepth, smallVoronoi.x);
    float smallCraterRim = smoothstep(uMoonSmallCraterRimInner, uMoonSmallCraterDepth, smallVoronoi.x) - smoothstep(uMoonSmallCraterDepth, uMoonSmallCraterRimOuter, smallVoronoi.x);
    
    // ============================================
    // COMBINE: Dust + Craters (configurable strengths)
    // ============================================
    float height = surfaceTexture * uMoonDustHeightInfluence;
    
    // Add crater rims (raised)
    height += largeCraterRim * uMoonLargeCraterRimStrength;
    height += medCraterRim * uMoonMediumCraterRimStrength;
    height += smallCraterRim * uMoonSmallCraterRimStrength;
    
    // Subtract crater floors (depressed)
    height -= largeCraterDepth * uMoonLargeCraterFloorStrength;
    height -= medCraterDepth * uMoonMediumCraterFloorStrength;
    height -= smallCraterDepth * uMoonSmallCraterFloorStrength;
    
    // Base gray with height variation (configurable)
    float gray = uMoonBaseGray + height * uMoonHeightVariation;
    
    // Apply maria (darker regions)
    gray = mix(gray, gray * uMoonMariaDarkness, mariaMask);
    
    // Clamp to valid range (configurable)
    gray = clamp(gray, uMoonGrayMin, uMoonGrayMax);
    
    // Warm tint (configurable)
    vec3 color = vec3(gray) * uMoonWarmTint;
    
    return color;
  }
  
  // ============================================
  // Main
  // ============================================

  void main() {
    // Convert UV to centered coordinates (-1 to 1), scaled by mesh padding
    // This allows the sphere (at dist <= 1.0) to fit within the larger mesh
    // leaving room for the atmosphere halo in the padding region
    vec2 uv = (vUV * 2.0 - 1.0) * uMeshPadding;

    // Calculate distance from center for sphere mask
    float dist = length(uv);

    // Sun direction (normalized)
    vec3 sunDir = normalize(uSunDirection);

    // ============================================
    // ATMOSPHERE HALO (Beyond Sphere Edge)
    // Renders in the "padding" region between sphere edge and mesh edge
    // Uses Rayleigh scattering for realistic atmosphere glow
    // ============================================
    if (dist > 1.0) {
      // Moon has no atmosphere - hard cutoff
      if (uPlanetType == 2) {
        discard;
      }

      // Atmosphere ring region (between sphere edge and halo end)
      float haloRegion = smoothstep(uAtmosphereHaloEnd, uAtmosphereHaloStart, dist);
      if (haloRegion <= 0.0) {
        discard;
      }

      // ============================================
      // RAYLEIGH SCATTERING for Halo
      // intensity = 1.05 - dot(normal, viewDir)
      // Gives stronger glow at grazing angles
      // ============================================
      vec2 haloDir = normalize(uv);

      // Approximate normal at atmosphere edge (pointing outward from sphere)
      // Use small z component for grazing angle calculation
      float zComponent = max(0.05, 1.0 - (dist - 1.0) * 5.0);
      vec3 haloNormal = normalize(vec3(haloDir.x, haloDir.y, zComponent));

      // Rayleigh intensity based on view angle
      float rayleighIntensity = 1.05 - dot(haloNormal, vec3(0.0, 0.0, 1.0));
      rayleighIntensity = pow(rayleighIntensity, 3.0);

      // Sun-facing calculation for color variation
      float haloNdotL = dot(haloNormal, sunDir);
      float sunFacing = smoothstep(-0.5, 0.5, haloNdotL);

      // Rayleigh scattering: Blue where facing sun, orange at edges/terminator
      vec3 rayleighColor = mix(uRayleighSunsetColor, uRayleighDayColor, sunFacing);

      // Combine with atmosphere base color
      vec3 atmosphereBlend = mix(rayleighColor, uAtmosphereColor, 0.3);

      // Apply Rayleigh intensity and halo falloff
      float haloGlow = pow(haloRegion, uAtmosphereHaloPower);
      vec3 haloColor = atmosphereBlend * rayleighIntensity * haloGlow * uRayleighIntensity;

      // Visibility based on sun direction (lit side stronger)
      float haloVisibility = smoothstep(-0.3, 0.3, haloNdotL);
      haloColor *= (haloVisibility * 0.7 + 0.3); // Keep some glow on dark side

      // Alpha based on intensity for proper blending
      float alpha = haloGlow * rayleighIntensity * (haloVisibility * 0.7 + 0.3);

      finalColor = vec4(haloColor, alpha);
      return;
    }
    
    // ============================================
    // SPHERE INTERIOR - Main Planet Rendering
    // ============================================
    
    // Calculate 3D sphere position
    float z = sqrt(1.0 - dist * dist);
    vec3 spherePos = vec3(uv.x, uv.y, z);
    
    // Sphere normal
    vec3 normal = normalize(spherePos);
    
    // View direction (camera looking at sphere)
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    
    // Spherical coordinates with rotation (rotation speed per planet type)
    float latitude = asin(spherePos.y);
    float rotSpeed = uPlanetType == 0 ? uMarsRotationSpeed : (uPlanetType == 1 ? uEarthRotationSpeed : uMoonRotationSpeed);
    float longitude = atan(spherePos.x, spherePos.z) + uTime * rotSpeed;
    
    // ============================================
    // Render Based on Planet Type
    // ============================================
    vec3 baseColor;
    
    if (uPlanetType == 0) {
      baseColor = renderMars(spherePos, normal, latitude, longitude);
    } else if (uPlanetType == 1) {
      baseColor = renderEarth(spherePos, normal, latitude, longitude, sunDir, viewDir);
    } else {
      baseColor = renderMoon(spherePos, normal, latitude, longitude);
    }
    
    // ============================================
    // 3D Lighting with SOFT TERMINATOR
    // ============================================
    float NdotL = dot(normal, sunDir);
    
    // Enhanced terminator softness (twilight zone)
    // Use configurable smoothstep for gradual day-to-night transition
    float terminatorFactor = smoothstep(uTerminatorSoftMin, uTerminatorSoftMax, NdotL);
    
    // Diffuse lighting
    float diffuse = terminatorFactor;
    
    // Ambient (configurable per atmosphere type)
    float ambient = (uPlanetType == 2) ? uAmbientNoAtmosphere : uAmbientWithAtmosphere;
    
    // Apply base lighting
    vec3 litColor = baseColor * (diffuse * 0.95 + ambient);
    
    // ============================================
    // TWILIGHT COLOR TINT at Terminator
    // Add warm/orange tint in the twilight zone
    // ============================================
    if (uPlanetType != 2) { // Not for moon
      float twilightZone = 1.0 - abs(NdotL - 0.0);
      twilightZone = pow(twilightZone, 3.0) * smoothstep(-0.3, 0.1, NdotL);
      litColor += uTerminatorTwilightColor * twilightZone * uTerminatorTwilightIntensity;
    }
    
    // ============================================
    // RAYLEIGH SCATTERING ATMOSPHERE (on surface)
    // Uses intensity = 1.05 - dot(normal, viewDir)
    // Gives stronger glow at limb (grazing angles)
    // ============================================

    // Rayleigh intensity calculation
    float rayleighIntensity = 1.05 - dot(normal, viewDir);
    vec3 surfaceAtmosphere = uAtmosphereColor * pow(rayleighIntensity, 3.0);

    // Sun-facing for color variation (blue in daylight, orange at terminator)
    float surfaceSunFacing = smoothstep(-0.2, 0.5, NdotL);
    vec3 surfaceRayleigh = mix(uRayleighSunsetColor, uRayleighDayColor, surfaceSunFacing);

    // Blend Rayleigh scattering with atmosphere color
    vec3 atmosphereBlend = mix(surfaceRayleigh, uAtmosphereColor, 0.4);

    // Atmosphere visibility based on sun position
    float atmosphereVisibility = smoothstep(-0.3, 0.3, NdotL) * 0.7 + 0.3;

    // Additive blend for surface atmosphere (stronger at limb)
    vec3 atmosphereGlow = atmosphereBlend * pow(rayleighIntensity, 3.0) * uAtmosphereIntensity * atmosphereVisibility;
    litColor += atmosphereGlow;

    // Enhanced terminator scattering (sunset/sunrise glow)
    float terminator = 1.0 - abs(NdotL);
    terminator = pow(terminator, 2.0) * smoothstep(-0.2, 0.2, NdotL);
    litColor += uRayleighSunsetColor * terminator * rayleighIntensity * uTerminatorScatterStrength;
    
    // ============================================
    // Limb Darkening (configurable)
    // ============================================
    float limbDarkening = 1.0 - pow(1.0 - z, uLimbDarkeningPower) * uLimbDarkeningStrength;
    litColor *= limbDarkening;
    
    // ============================================
    // Soft Edge Anti-aliasing with Atmosphere Blend
    // ============================================
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
