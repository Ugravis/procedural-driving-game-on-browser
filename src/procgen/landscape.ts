import { createNoise2D } from 'simplex-noise'

const HEIGHT_SCALE = 10 // m, amplitude du relief
const FREQUENCY = 0.015

const noise2D = createNoise2D()

// Source unique de vérité pour le relief : le terrain et la route en dérivent.
// fBm à 3 octaves pour des collines lisses mais variées.
export function landscapeHeight(x: number, z: number): number {
  let height = 0
  let amplitude = 1
  let frequency = FREQUENCY
  for (let octave = 0; octave < 3; octave++) {
    height += noise2D(x * frequency, z * frequency) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return height * HEIGHT_SCALE
}
