import { groveFactor, vegetationFactor, biomeWeights } from './biomes'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'
import { isUnderWater } from './water'
import { heightAt } from './terrain'

const CELL_SIZE = 6 // m, taille de cellule de la grille de dispersion
const DENSITY = 0.45 // probabilité qu'une cellule contienne un arbre
const ROAD_EDGE_CLEARANCE = 3 // m, marge entre le bord de la route et l'arbre sur terrain plat
const STEEP_CLEARANCE = 20 // m, marge depuis l'axe quand le terrain est pentu
const FLAT_SLOPE = 0.08 // pente sous laquelle la marge réduite s'applique
const MAX_SLOPE = 0.4 // pente au-delà de laquelle aucun arbre ne pousse
const SLOPE_PROBE = 1.5 // m, écart pour mesurer la pente locale

export interface VegetationInstance {
  position: [number, number, number]
  scale: number
}

// Hash déterministe (pas de Math.random) : un chunk redonne toujours la même
// végétation quand il est rechargé après avoir été déchargé.
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

function slopeAt(x: number, z: number, path: ProceduralPath): number {
  const dx = heightAt(x + SLOPE_PROBE, z, path) - heightAt(x - SLOPE_PROBE, z, path)
  const dz = heightAt(x, z + SLOPE_PROBE, path) - heightAt(x, z - SLOPE_PROBE, path)
  return Math.hypot(dx, dz) / (2 * SLOPE_PROBE)
}

/** Disperse des arbres sur une grille légèrement bruitée (jitter) plutôt qu'une
 * grille régulière, avec des bosquets et des clairières. */
export function scatterVegetation(
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  path: ProceduralPath,
): VegetationInstance[] {
  const instances: VegetationInstance[] = []
  const originX = chunkX * chunkSize
  const originZ = chunkZ * chunkSize
  const cellsPerSide = Math.floor(chunkSize / CELL_SIZE)

  for (let iz = 0; iz < cellsPerSide; iz++) {
    for (let ix = 0; ix < cellsPerSide; ix++) {
      const cellX = originX - chunkSize / 2 + ix * CELL_SIZE
      const cellZ = originZ - chunkSize / 2 + iz * CELL_SIZE

      const x = cellX + (hash(cellX + 0.37, cellZ) - 0.5) * CELL_SIZE
      const z = cellZ + (hash(cellX, cellZ + 0.59) - 0.5) * CELL_SIZE
      if (isUnderWater(x, z)) continue

      const slope = slopeAt(x, z, path)
      if (slope > MAX_SLOPE) continue
      const weights = biomeWeights(x, z)
      const slopeFactor = 1 - slope / MAX_SLOPE
      const density = DENSITY * vegetationFactor(weights) * groveFactor(x, z) * slopeFactor
      if (hash(cellX, cellZ) > density) continue

      const { distance } = path.roadAt(x, z)
      const clearance =
        slope <= FLAT_SLOPE ? ROAD_HALF_WIDTH + ROAD_EDGE_CLEARANCE : STEEP_CLEARANCE
      if (distance < clearance) continue

      instances.push({
        position: [x, heightAt(x, z, path), z],
        scale: 0.7 + hash(z, x) * 0.6,
      })
    }
  }
  return instances
}
