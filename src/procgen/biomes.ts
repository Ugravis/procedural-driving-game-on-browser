import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import { createRandom } from './random'

export const BIOMES = ['vallée', 'plaine', 'colline', 'montagne'] as const
export type Biome = (typeof BIOMES)[number]

// Trois échelles de bruit (grandes régions, régions moyennes, détails) et une
// déformation des coordonnées : les régions ne sont plus toutes de la même taille.
const SCALES = [
  { frequency: 1 / 9000, weight: 0.6 },
  { frequency: 1 / 3000, weight: 0.3 },
  { frequency: 1 / 1500, weight: 0.1 },
]
const SCALE_STD = Math.sqrt(SCALES.reduce((sum, scale) => sum + scale.weight ** 2, 0)) // restaure la variance du bruit
const WARP_FREQUENCY = 1 / 6000 // 1/m
const WARP_AMPLITUDE = 1500 // m
const BIOME_SALT = 4
const CENTRES = [-0.6, -0.2, 0.2, 0.6] // valeur du bruit de biome au centre de chaque biome
const SPREAD = 0.25 // largeur des transitions entre biomes

// Par biome : amplitude relative du relief, décalage d'altitude (m), densité de végétation,
// teinte du sol (multiplie la couleur de saison) et couleur sur la minimap.
const AMPLITUDE = [0.35, 0.12, 0.4, 1.6]
const OFFSET = [-15, 0, 0, 0]
const VEGETATION = [1, 0.5, 0.6, 0.1]
const TINT = [
  [0.9, 1, 0.85],
  [1.05, 1.05, 0.9],
  [0.95, 1, 0.9],
  [0.85, 0.82, 0.78],
]
const MAP_COLOUR = [
  [79, 122, 58],
  [127, 154, 69],
  [111, 125, 60],
  [122, 116, 104],
]

let scaleNoises: NoiseFunction2D[] = SCALES.map((_, i) =>
  createNoise2D(createRandom(BIOME_SALT + i)),
)
let warpNoise: NoiseFunction2D = createNoise2D(createRandom(BIOME_SALT + 10))

export function setBiomeSeed(seed: number) {
  scaleNoises = SCALES.map((_, i) => createNoise2D(createRandom(seed + BIOME_SALT + i)))
  warpNoise = createNoise2D(createRandom(seed + BIOME_SALT + 10))
}

// Poids de chaque biome en (x, z), somme égale à 1. Continu, donc les transitions
// sont douces (relief, couleur, végétation s'y mélangent).
export function biomeWeights(x: number, z: number): number[] {
  const warpX = x + warpNoise(x * WARP_FREQUENCY, z * WARP_FREQUENCY) * WARP_AMPLITUDE
  const warpZ = z + warpNoise(z * WARP_FREQUENCY + 17, x * WARP_FREQUENCY) * WARP_AMPLITUDE
  let value = 0
  SCALES.forEach((scale, i) => {
    value += scale.weight * scaleNoises[i]!(warpX * scale.frequency, warpZ * scale.frequency)
  })
  value /= SCALE_STD
  const raw = CENTRES.map((centre) => Math.exp(-(((value - centre) / SPREAD) ** 2)))
  const total = raw.reduce((sum, weight) => sum + weight, 0)
  return raw.map((weight) => weight / total)
}

export function reliefFactors(weights: number[]): { amplitude: number; offset: number } {
  let amplitude = 0
  let offset = 0
  weights.forEach((weight, i) => {
    amplitude += weight * AMPLITUDE[i]!
    offset += weight * OFFSET[i]!
  })
  return { amplitude, offset }
}

export function vegetationFactor(weights: number[]): number {
  return weights.reduce((sum, weight, i) => sum + weight * VEGETATION[i]!, 0)
}

export function soilTint(weights: number[]): number[] {
  const tint = [0, 0, 0]
  weights.forEach((weight, i) => {
    const colour = TINT[i]!
    for (let c = 0; c < 3; c++) tint[c]! += weight * colour[c]!
  })
  return tint
}

export function mapColour(weights: number[]): string {
  const rgb = [0, 0, 0]
  weights.forEach((weight, i) => {
    const colour = MAP_COLOUR[i]!
    for (let c = 0; c < 3; c++) rgb[c]! += weight * colour[c]!
  })
  return `rgb(${rgb.map(Math.round).join(',')})`
}

export function dominantBiome(weights: number[]): number {
  return weights.indexOf(Math.max(...weights))
}

// Point le plus proche (grille de 200 m, rayon de 15 km) dont le biome dominant est celui demandé
// et qui est accepté par `accept` (par exemple hors de l'eau).
export function findNearestBiome(
  index: number,
  fromX: number,
  fromZ: number,
  accept: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const step = 200
  const radius = 15000
  const candidates: { x: number; z: number; d: number }[] = []
  for (let x = -radius; x <= radius; x += step) {
    for (let z = -radius; z <= radius; z += step) {
      const px = fromX + x
      const pz = fromZ + z
      candidates.push({ x: px, z: pz, d: x * x + z * z })
    }
  }
  candidates.sort((a, b) => a.d - b.d)
  for (const candidate of candidates) {
    if (
      dominantBiome(biomeWeights(candidate.x, candidate.z)) === index &&
      accept(candidate.x, candidate.z)
    ) {
      return { x: candidate.x, z: candidate.z }
    }
  }
  return null
}
