import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import { biomeWeights, reliefFactors, setBiomeSeed } from './biomes'
import { createRandom } from './random'

export interface LandscapeParams {
  heightScale: number // m, amplitude du relief
  frequency: number // 1/m, fréquence de base
  octaves: number
  persistence: number
  waterLevel: number // m, altitude du plan d'eau global
  bridgeSpacing: number // m, distance minimale entre deux ponts sur un même sens
}

export const LANDSCAPE_PRESETS: Record<'Plaine' | 'Colline' | 'Montagne', LandscapeParams> = {
  Plaine: {
    heightScale: 12,
    frequency: 0.0015,
    octaves: 2,
    persistence: 0.4,
    waterLevel: -5,
    bridgeSpacing: 3000,
  },
  Colline: {
    heightScale: 40,
    frequency: 0.001,
    octaves: 2,
    persistence: 0.4,
    waterLevel: -20,
    bridgeSpacing: 3000,
  },
  Montagne: {
    heightScale: 120,
    frequency: 0.0008,
    octaves: 4,
    persistence: 0.45,
    waterLevel: -35,
    bridgeSpacing: 3000,
  },
}

export const DEFAULT_LANDSCAPE: LandscapeParams = { ...LANDSCAPE_PRESETS.Montagne }

let params: LandscapeParams = { ...DEFAULT_LANDSCAPE }
let noise2D: NoiseFunction2D = createNoise2D(createRandom(0))

export function setLandscapeParams(next: LandscapeParams) {
  params = { ...next }
}

export function getLandscapeParams(): LandscapeParams {
  return { ...params }
}

export function setLandscapeSeed(seed: number) {
  noise2D = createNoise2D(createRandom(seed))
  setBiomeSeed(seed)
}

// Source unique de vérité pour le relief : le terrain et la route en dérivent.
export function landscapeHeight(x: number, z: number): number {
  let height = 0
  let amplitude = 1
  let frequency = params.frequency
  let norm = 0
  for (let octave = 0; octave < params.octaves; octave++) {
    height += noise2D(x * frequency, z * frequency) * amplitude
    norm += amplitude
    amplitude *= params.persistence
    frequency *= 2
  }
  const { amplitude: biomeAmplitude, offset } = reliefFactors(biomeWeights(x, z))
  return (height / norm) * params.heightScale * biomeAmplitude + offset
}
