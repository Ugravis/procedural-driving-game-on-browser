import { Color, MeshStandardMaterial } from 'three'

export const SEASONS = ['printemps', 'été', 'automne', 'hiver'] as const
export type Season = (typeof SEASONS)[number]

interface SeasonPalette {
  ground: string
  foliage: string
  fog: string
  sun: string
  sunIntensity: number
  snowCover: number // 0 à 1, part de neige sur les surfaces orientées vers le ciel
}

// Teintes réalistes (sol, feuillage, lumière) plutôt que stylisées.
export const SEASON_PALETTES: Record<Season, SeasonPalette> = {
  printemps: {
    ground: '#7a9a4a',
    foliage: '#5f9446',
    fog: '#dce9d6',
    sun: '#fff1d2',
    sunIntensity: 1.7,
    snowCover: 0,
  },
  été: {
    ground: '#5f7f38',
    foliage: '#2f5f2a',
    fog: '#cfe3ea',
    sun: '#fff4dc',
    sunIntensity: 2.0,
    snowCover: 0,
  },
  automne: {
    ground: '#7d6d35',
    foliage: '#a4522a',
    fog: '#e0d3b8',
    sun: '#ffd7a0',
    sunIntensity: 1.5,
    snowCover: 0,
  },
  hiver: {
    ground: '#6e7a6e',
    foliage: '#2d4a3d',
    fog: '#dde6ec',
    sun: '#dfe9ff',
    sunIntensity: 1.1,
    snowCover: 0.85,
  },
}

const SNOW_COLOR = new Color('#f2f6fa')
const terrainMaterials = new Map<string, MeshStandardMaterial>()
const foliageMaterials = new Map<string, MeshStandardMaterial>()

// Neige sur le sol : la couverture ne tient que sur les surfaces presque
// horizontales, et disparaît sur les pentes fortes (comme en réalité).
function withSnowCover(material: MeshStandardMaterial, cover: number): MeshStandardMaterial {
  if (cover <= 0) return material
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowCover = { value: cover }
    shader.uniforms.uSnowColor = { value: SNOW_COLOR }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldNormal;\nuniform float uSnowCover;\nuniform vec3 uSnowColor;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat snow = smoothstep(0.6, 0.85, vWorldNormal.y) * uSnowCover;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snow);',
      )
  }
  material.customProgramCacheKey = () => `snow-${cover}`
  return material
}

export function terrainMaterial(season: Season, lookMode: boolean): MeshStandardMaterial {
  const key = `${season}:${lookMode}`
  let material = terrainMaterials.get(key)
  if (!material) {
    const palette = SEASON_PALETTES[season]
    material = withSnowCover(
      new MeshStandardMaterial({
        color: palette.ground,
        flatShading: lookMode,
        vertexColors: true,
      }),
      palette.snowCover,
    )
    terrainMaterials.set(key, material)
  }
  return material
}

export function foliageMaterial(season: Season, lookMode: boolean): MeshStandardMaterial {
  const key = `${season}:${lookMode}`
  let material = foliageMaterials.get(key)
  if (!material) {
    material = new MeshStandardMaterial({
      color: SEASON_PALETTES[season].foliage,
      flatShading: lookMode,
    })
    foliageMaterials.set(key, material)
  }
  return material
}
