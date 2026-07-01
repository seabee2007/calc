import * as THREE from 'three';

export const CMU_TEXTURE_TILE_METERS = 0.45;
export const CAST_CONCRETE_TEXTURE_TILE_METERS = 1.25;
export const MORTAR_TEXTURE_TILE_METERS = 0.35;

export type TriplanarProjectionMode = 'triplanar' | 'uv';

export type TriplanarMaterialOptions = {
  colorMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  textureScaleMeters: number;
  baseColor: THREE.ColorRepresentation;
  paintColor?: THREE.ColorRepresentation;
  paintStrength?: number;
  roughness: number;
  metalness: number;
  useCheckerMap?: boolean;
};

export type TextureProjectionDiagnostics = {
  cmuProjection: TriplanarProjectionMode;
  concreteProjection: TriplanarProjectionMode;
  cmuWorldTileSize: number;
  concreteWorldTileSize: number;
  textureMaterialCacheCount: number;
  useCheckerMap: boolean;
};

let triplanarMaterialCacheCount = 0;
let useCheckerMap = false;

export function getTriplanarMaterialCacheCount(): number {
  return triplanarMaterialCacheCount;
}

export function setTriplanarCheckerDebugEnabled(enabled: boolean): void {
  useCheckerMap = enabled;
}

export function isTriplanarCheckerDebugEnabled(): boolean {
  return useCheckerMap;
}

export function getTextureProjectionDiagnostics(): TextureProjectionDiagnostics {
  return {
    cmuProjection: 'triplanar',
    concreteProjection: 'triplanar',
    cmuWorldTileSize: CMU_TEXTURE_TILE_METERS,
    concreteWorldTileSize: CAST_CONCRETE_TEXTURE_TILE_METERS,
    textureMaterialCacheCount: triplanarMaterialCacheCount,
    useCheckerMap,
  };
}

export function resetTriplanarMaterialCacheForTests(): void {
  triplanarMaterialCacheCount = 0;
  useCheckerMap = false;
}

const TRIPLANAR_VERTEX_DECL = `
varying vec3 vTriplanarWorldPos;
varying vec3 vTriplanarWorldNormal;
`;

const TRIPLANAR_VERTEX_WORLD = `
{
  vec4 triplanarWorldPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    triplanarWorldPosition = instanceMatrix * triplanarWorldPosition;
  #endif
  triplanarWorldPosition = modelMatrix * triplanarWorldPosition;
  vTriplanarWorldPos = triplanarWorldPosition.xyz;
}
{
  vec3 triplanarWorldNormal = objectNormal;
  #ifdef USE_INSTANCING
    mat3 instanceNormalMatrix = mat3( instanceMatrix );
    triplanarWorldNormal = instanceNormalMatrix * triplanarWorldNormal;
  #endif
  vTriplanarWorldNormal = normalize( mat3( modelMatrix ) * triplanarWorldNormal );
}
`;

const TRIPLANAR_FRAGMENT_DECL = `
uniform float uTriplanarScale;
uniform float uUseChecker;
uniform vec3 uTriplanarPaintColor;
uniform float uTriplanarPaintStrength;
varying vec3 vTriplanarWorldPos;
varying vec3 vTriplanarWorldNormal;

vec3 triplanarBlendWeights( vec3 worldNormal ) {
  vec3 blend = abs( normalize( worldNormal ) );
  return blend / max( blend.x + blend.y + blend.z, 0.0001 );
}

vec4 sampleTriplanarRGBA( sampler2D tex, vec3 worldPos, vec3 worldNormal ) {
  vec3 blend = triplanarBlendWeights( worldNormal );
  vec4 sampleX = texture2D( tex, worldPos.yz * uTriplanarScale );
  vec4 sampleY = texture2D( tex, worldPos.xz * uTriplanarScale );
  vec4 sampleZ = texture2D( tex, worldPos.xy * uTriplanarScale );
  return sampleX * blend.x + sampleY * blend.y + sampleZ * blend.z;
}

float sampleTriplanarRoughness( sampler2D tex, vec3 worldPos, vec3 worldNormal ) {
  return sampleTriplanarRGBA( tex, worldPos, worldNormal ).g;
}

float sampleTriplanarAo( sampler2D tex, vec3 worldPos, vec3 worldNormal ) {
  return sampleTriplanarRGBA( tex, worldPos, worldNormal ).r;
}

vec4 sampleTriplanarChecker( vec3 worldPos, vec3 worldNormal ) {
  vec3 blend = triplanarBlendWeights( worldNormal );
  float cx = step( 0.5, fract( worldPos.y * uTriplanarScale ) ) != step( 0.5, fract( worldPos.z * uTriplanarScale ) ) ? 1.0 : 0.35;
  float cy = step( 0.5, fract( worldPos.x * uTriplanarScale ) ) != step( 0.5, fract( worldPos.z * uTriplanarScale ) ) ? 1.0 : 0.35;
  float cz = step( 0.5, fract( worldPos.x * uTriplanarScale ) ) != step( 0.5, fract( worldPos.y * uTriplanarScale ) ) ? 1.0 : 0.35;
  float value = cx * blend.x + cy * blend.y + cz * blend.z;
  return vec4( vec3( value ), 1.0 );
}
`;

function attachTriplanarShader(
  material: THREE.MeshStandardMaterial,
  textureScaleMeters: number,
  checker: boolean,
  paintColor: THREE.Color,
  paintStrength: number,
): void {
  const textureScale = 1 / textureScaleMeters;
  const normalizedPaintStrength = THREE.MathUtils.clamp(paintStrength, 0, 1);
  material.userData.triplanarProjection = {
    textureScaleMeters,
    paintColorHex: paintColor.getHex(),
    paintStrength: normalizedPaintStrength,
  };

  material.customProgramCacheKey = () =>
    `triplanar_${textureScale}_${checker ? 1 : 0}_${Boolean(material.map)}_${Boolean(material.roughnessMap)}_${Boolean(material.aoMap)}_${paintColor.getHexString()}_${normalizedPaintStrength.toFixed(3)}`;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriplanarScale = { value: textureScale };
    shader.uniforms.uUseChecker = { value: checker ? 1 : 0 };
    shader.uniforms.uTriplanarPaintColor = { value: paintColor.clone() };
    shader.uniforms.uTriplanarPaintStrength = { value: normalizedPaintStrength };

    shader.vertexShader = TRIPLANAR_VERTEX_DECL + shader.vertexShader;
    shader.fragmentShader = TRIPLANAR_FRAGMENT_DECL + shader.fragmentShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `${TRIPLANAR_VERTEX_WORLD}
#include <project_vertex>`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  vec4 sampledDiffuseColor = uUseChecker > 0.5
    ? sampleTriplanarChecker( vTriplanarWorldPos, vTriplanarWorldNormal )
    : sampleTriplanarRGBA( map, vTriplanarWorldPos, vTriplanarWorldNormal );
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  float triplanarLuma = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 triplanarRecolor = uTriplanarPaintColor * ( 0.36 + 0.64 * triplanarLuma );
  sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, triplanarRecolor, uTriplanarPaintStrength );
  diffuseColor *= sampledDiffuseColor;
#endif`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= sampleTriplanarRoughness( roughnessMap, vTriplanarWorldPos, vTriplanarWorldNormal );
#endif`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      `#ifdef USE_AOMAP
  float ambientOcclusion = ( sampleTriplanarAo( aoMap, vTriplanarWorldPos, vTriplanarWorldNormal ) - 1.0 ) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
#endif`,
    );
  };

  material.needsUpdate = true;
}

export function createTriplanarStandardMaterial(options: TriplanarMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: options.baseColor,
    roughness: options.roughness,
    metalness: options.metalness,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  });

  if (options.colorMap) {
    material.map = options.colorMap;
  }
  if (options.roughnessMap) {
    material.roughnessMap = options.roughnessMap;
  }
  if (options.aoMap) {
    material.aoMap = options.aoMap;
    material.aoMapIntensity = 0.85;
  }

  attachTriplanarShader(
    material,
    options.textureScaleMeters,
    options.useCheckerMap ?? useCheckerMap,
    new THREE.Color(options.paintColor ?? 0xffffff),
    options.paintStrength ?? 0,
  );
  triplanarMaterialCacheCount += 1;
  return material;
}

/** Re-apply triplanar shader after cloning a shared preview material for selection/cutaway. */
export function reapplyTriplanarShaderToClone(
  material: THREE.MeshStandardMaterial,
  textureScaleMeters: number,
): void {
  const projection = material.userData.triplanarProjection as
    | {
        textureScaleMeters?: number;
        paintColorHex?: number;
        paintStrength?: number;
      }
    | undefined;
  attachTriplanarShader(
    material,
    projection?.textureScaleMeters ?? textureScaleMeters,
    useCheckerMap,
    new THREE.Color(projection?.paintColorHex ?? 0xffffff),
    projection?.paintStrength ?? 0,
  );
}
