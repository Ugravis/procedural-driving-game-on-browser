import type { ProceduralPath } from './pathGenerator'
import { heightAt } from './terrain'

const CELL_SIZE = 6 // m, taille de cellule de la grille de dispersion
const ROAD_CLEARANCE = 20 // m, pas d'arbre plus près de la route que ça
const DENSITY = 0.45 // probabilité qu'une cellule contienne un arbre

export interface VegetationInstance {
  position: [number, number, number]
  rotationY: number
  scale: number
}

// Hash déterministe (pas de Math.random) : un chunk redonne toujours la même
// végétation quand il est rechargé après avoir été déchargé.
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

/** Disperse des arbres sur une grille légèrement bruitée (jitter) plutôt qu'une
 * grille régulière, pour éviter l'effet "plantation en ligne". */
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
      if (hash(cellX, cellZ) > DENSITY) continue

      const jitterX = cellX + (hash(cellX + 0.37, cellZ) - 0.5) * CELL_SIZE
      const jitterZ = cellZ + (hash(cellX, cellZ + 0.59) - 0.5) * CELL_SIZE

      const { distance } = path.roadAt(jitterX, jitterZ)
      if (distance < ROAD_CLEARANCE) continue

      instances.push({
        position: [jitterX, heightAt(jitterX, jitterZ, path), jitterZ],
        rotationY: hash(jitterX, jitterZ) * Math.PI * 2,
        scale: 0.7 + hash(jitterZ, jitterX) * 0.6,
      })
    }
  }
  return instances
}
