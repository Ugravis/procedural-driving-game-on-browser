import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { CHUNK_SIZE, heightAt } from './terrain'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'

const SURFACE_OFFSET = 0.05 // m, au-dessus du sol pour éviter le z-fighting
const MARGIN = ROAD_HALF_WIDTH + 2 // m, déborde du chunk pour que les bords ne se découpent pas
const PAVED = new Color('#3a3f44')
const DIRT = new Color('#8a6d46')

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
  const colors: number[] = []
  const indices: number[] = []

  const vertex = (x: number, z: number, color: Color) => {
    positions.push(x - originX, heightAt(x, z, path) + SURFACE_OFFSET, z - originZ)
    colors.push(color.r, color.g, color.b)
  }

  for (const segment of segments) {
    const { a, b } = segment
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz) || 1
    const rx = (-dz / length) * ROAD_HALF_WIDTH
    const rz = (dx / length) * ROAD_HALF_WIDTH

    const base = positions.length / 3
    const color = segment.dirt ? DIRT : PAVED
    vertex(a.x - rx, a.z - rz, color)
    vertex(a.x + rx, a.z + rz, color)
    vertex(b.x - rx, b.z - rz, color)
    vertex(b.x + rx, b.z + rz, color)
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
