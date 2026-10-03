import { createNoise2D } from 'simplex-noise'

export interface LandscapeParams {
  heightScale: number // m, amplitude du relief
  frequency: number // 1/m, fréquence de base
  octaves: number
  persistence: number
}

export const DEFAULT_LANDSCAPE: LandscapeParams = {
  heightScale: 40,
  frequency: 0.001,
  octaves: 2,
  persistence: 0.4,
}

let params: LandscapeParams = { ...DEFAULT_LANDSCAPE }
let noise2D = createNoise2D()

export function setLandscapeParams(next: LandscapeParams) {
  params = { ...next }
}

// Nouveau bruit aléatoire : le relief change, la graine n'étant pas fixée.
export function reseedLandscape() {
  noise2D = createNoise2D()
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
  return (height / norm) * params.heightScale
}
