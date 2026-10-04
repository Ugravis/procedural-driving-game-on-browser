import { BufferGeometry, Float32BufferAttribute } from 'three'
import { CHUNK_SIZE, heightAt } from './terrain'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'

const SURFACE_OFFSET = 0.05 // m, au-dessus du sol pour éviter le z-fighting
const MARGIN = ROAD_HALF_WIDTH + 2 // m, déborde du chunk pour que les bords ne se découpent pas

/**
 * Surface de route plane d'un chunk : une bande posée sur la ligne centrale,
 * dont chaque sommet suit le relief du terrain. Les segments sont ceux du tracé
 * complet qui touchent le chunk, donc la surface ne dépend pas de la position
 * du joueur. Coordonnées locales au chunk. Les tabliers sont exclus.
 */
export function buildRoadSurface(
  chunkX: number,
  chunkZ: number,
  path: ProceduralPath,
): BufferGeometry {
  const originX = chunkX * CHUNK_SIZE
  const originZ = chunkZ * CHUNK_SIZE
  const half = CHUNK_SIZE / 2 + MARGIN
  const segments = path.segmentsIn(originX - half, originX + half, originZ - half, originZ + half)

  const positions: number[] = []
  const indices: number[] = []

  const vertex = (x: number, z: number) => {
    positions.push(x - originX, heightAt(x, z, path) + SURFACE_OFFSET, z - originZ)
  }

  for (const { a, b } of segments) {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz) || 1
    const rx = (-dz / length) * ROAD_HALF_WIDTH
    const rz = (dx / length) * ROAD_HALF_WIDTH

    const base = positions.length / 3
    vertex(a.x - rx, a.z - rz)
    vertex(a.x + rx, a.z + rz)
    vertex(b.x - rx, b.z - rz)
    vertex(b.x + rx, b.z + rz)
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}
