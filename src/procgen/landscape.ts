import { createNoise2D } from 'simplex-noise'

const HEIGHT_SCALE = 12 // m, amplitude du relief
const FREQUENCY = 0.004 // collines de l'ordre de la centaine de mètres
const OCTAVES = 2
const PERSISTENCE = 0.5

const noise2D = createNoise2D()

// Source unique de vérité pour le relief : le terrain et la route en dérivent.
export function landscapeHeight(x: number, z: number): number {
  let height = 0
  let amplitude = 1
  let frequency = FREQUENCY
  let norm = 0
  for (let octave = 0; octave < OCTAVES; octave++) {
    height += noise2D(x * frequency, z * frequency) * amplitude
    norm += amplitude
    amplitude *= PERSISTENCE
    frequency *= 2
  }
  return (height / norm) * HEIGHT_SCALE
}
