import { BufferGeometry, Float32BufferAttribute } from 'three'
import { landscapeHeight } from './landscape'
import type { ProceduralPath } from './pathGenerator'

export const CHUNK_SIZE = 50 // m, taille d'un chunk de terrain
export const CHUNK_RESOLUTION = 20 // subdivisions par côté
export const RENDER_RADIUS_CHUNKS = 3 // rayon (en chunks) chargé autour du joueur

const CORRIDOR_WIDTH = 15 // m, le terrain colle exactement à l'élévation de la route sur cette largeur
const BLEND_WIDTH = 35 // m, transition progressive vers le relief du paysage au-delà du corridor

/**
 * Hauteur du terrain en (x, z) : colle à l'élévation de la route dans le
 * corridor, se fond progressivement dans le relief ambiant au-delà (comme
 * slowroads.io — le terrain épouse la route, pas l'inverse).
 */
export function heightAt(x: number, z: number, path: ProceduralPath): number {
  const { elevation, distance } = path.nearestElevation(x, z)
  if (distance <= CORRIDOR_WIDTH) return elevation
  const landscape = landscapeHeight(x, z)
  if (distance >= CORRIDOR_WIDTH + BLEND_WIDTH) return landscape
  const t = (distance - CORRIDOR_WIDTH) / BLEND_WIDTH
  const smooth = t * t * (3 - 2 * t) // smoothstep : transition douce, pas de pli visible
  return elevation + (landscape - elevation) * smooth
}

/** Construit la géométrie d'un chunk de terrain (coordonnées locales centrées
 * sur le chunk ; le composant qui l'affiche le positionne dans le monde). */
export function buildChunkGeometry(
  chunkX: number,
  chunkZ: number,
  path: ProceduralPath,
): BufferGeometry {
  const segments = CHUNK_RESOLUTION
  const verticesPerSide = segments + 1
  const positions: number[] = []
  const indices: number[] = []

  const originX = chunkX * CHUNK_SIZE
  const originZ = chunkZ * CHUNK_SIZE

  for (let iz = 0; iz < verticesPerSide; iz++) {
    for (let ix = 0; ix < verticesPerSide; ix++) {
      const localX = (ix / segments) * CHUNK_SIZE - CHUNK_SIZE / 2
      const localZ = (iz / segments) * CHUNK_SIZE - CHUNK_SIZE / 2
      // Hauteur échantillonnée en coordonnées monde : deux chunks voisins
      // calculent la même hauteur à leur frontière commune, pas de couture.
      const y = heightAt(originX + localX, originZ + localZ, path)
      positions.push(localX, y, localZ)
    }
  }

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * verticesPerSide + ix
      const b = a + 1
      const c = a + verticesPerSide
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
