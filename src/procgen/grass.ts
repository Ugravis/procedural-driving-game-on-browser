import { isUnderWater } from './water'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'
import { hash } from './hash'
import { heightAt } from './terrain'

const GRASS_BAND = 4 // m, bande d'herbe pleine densité au-delà de la marge, de chaque côté
const GRASS_FADE = 4 // m, zone de transition où la densité décroît jusqu'à zéro
const TUFTS_PER_SEGMENT = 6 // touffes tirées par segment de route et par côté
const SEGMENT_MARGIN = 6 // m, marge autour du chunk pour retrouver les segments qui le croisent
const TUFT_HALF_WIDTH = 0.4 // m, demi-largeur de la touffe : son centre reste hors de la chaussée
const ROAD_CLEARANCE = 0.3 // m, marge supplémentaire entre la touffe et le bord

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

export interface GrassInstance {
  position: [number, number, number]
  rotationY: number
  scale: number
}

/** Touffes d'herbe le long de la route : pleine densité près du bord, puis transition douce. */
export function scatterGrass(
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  path: ProceduralPath,
): GrassInstance[] {
  const originX = chunkX * chunkSize
  const originZ = chunkZ * chunkSize
  const half = chunkSize / 2
  const reach = half + SEGMENT_MARGIN
  const instances: GrassInstance[] = []

  for (const { a, b } of path.segmentsIn(
    originX - reach,
    originX + reach,
    originZ - reach,
    originZ + reach,
  )) {
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (length === 0) continue
    const perpX = -(b.z - a.z) / length
    const perpZ = (b.x - a.x) / length

    for (let k = 0; k < TUFTS_PER_SEGMENT; k++) {
      for (const side of [-1, 1]) {
        const along = hash(a.x + k * 1.7 + side, a.z - k * 0.9)
        const spread = hash(a.z + k * 2.3, a.x - side * 0.6) * (GRASS_BAND + GRASS_FADE)
        const fade = smoothstep(GRASS_BAND, GRASS_BAND + GRASS_FADE, spread)
        if (hash(a.x - k * 0.7, a.z + side * 1.9) < fade) continue
        const offset = ROAD_HALF_WIDTH + TUFT_HALF_WIDTH + ROAD_CLEARANCE + spread
        const x = a.x + (b.x - a.x) * along + perpX * offset * side
        const z = a.z + (b.z - a.z) * along + perpZ * offset * side
        if (Math.abs(x - originX) > half || Math.abs(z - originZ) > half) continue
        const road = path.roadAt(x, z)
        if (road.bridge || road.distance < ROAD_HALF_WIDTH + TUFT_HALF_WIDTH + ROAD_CLEARANCE)
          continue
        if (isUnderWater(x, z)) continue
        instances.push({
          position: [x, heightAt(x, z, path), z],
          rotationY: hash(x, z) * Math.PI,
          scale: 0.7 + hash(z, x) * 0.6,
        })
      }
    }
  }
  return instances
}
