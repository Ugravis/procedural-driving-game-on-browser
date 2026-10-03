import { BufferGeometry, Float32BufferAttribute } from 'three'
import { landscapeHeight } from './landscape'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'

export const CHUNK_SIZE = 50 // m, taille d'un chunk de terrain
export const CHUNK_RESOLUTION = 50 // subdivisions par côté (1 m, pour que l'aplanissement de la route soit net)
export const RENDER_RADIUS_CHUNKS = 4 // rayon (en chunks) chargé autour du joueur

const SHOULDER_WIDTH = 1 // m, transition douce entre l'aplanissement et le relief naturel

/**
 * Terrain sous la route : aplani à son altitude sur sa demi-largeur, puis une
 * transition d'un mètre vers le relief naturel. Au-delà, c'est le paysage brut.
 */
export function heightAt(x: number, z: number, path: ProceduralPath): number {
  const road = path.roadAt(x, z)
  if (road.distance <= ROAD_HALF_WIDTH) return road.height
  const natural = landscapeHeight(x, z)
  if (road.distance >= ROAD_HALF_WIDTH + SHOULDER_WIDTH) return natural
  const t = (road.distance - ROAD_HALF_WIDTH) / SHOULDER_WIDTH
  const smooth = t * t * (3 - 2 * t)
  return road.height + (natural - road.height) * smooth
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
