import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { landscapeHeight } from './landscape'
import { ROAD_HALF_WIDTH, type ProceduralPath } from './pathGenerator'

export const CHUNK_SIZE = 50 // m, taille d'un chunk de terrain
export const CHUNK_RESOLUTION = 50 // subdivisions par côté (1 m, pour que l'aplanissement de la route soit net)
export const RENDER_RADIUS_CHUNKS = 4 // rayon (en chunks) chargé autour du joueur

const SHOULDER_WIDTH = 0.5 // m, bande plate de chaque côté de la route
const TRANSITION_WIDTH = 3 // m, raccord doux (talus) entre la bande plate et le relief naturel
const EDGE_WIDTH = 0.5 // m, fondu de couleur entre la route et le sol
const GROUND_COLOR = new Color('#4a6b4a')
const ROAD_COLOR = new Color('#3a3f44')

export interface Surface {
  height: number
  roadCover: number // 0 = sol, 1 = surface de route
}

/**
 * Terrain autour de la route : aplani à son altitude sur la route et son
 * accotement, puis un talus progressif vers le relief naturel. Sur une pente,
 * le talus est en déblai côté amont et en remblai côté aval. Sous un tablier,
 * le relief naturel est conservé et la surface n'est pas couverte de route.
 */
export function surfaceAt(x: number, z: number, path: ProceduralPath): Surface {
  const road = path.roadAt(x, z)
  const natural = landscapeHeight(x, z)
  if (road.bridge) return { height: natural, roadCover: 0 }

  const roadCover = Math.min(
    Math.max((ROAD_HALF_WIDTH + EDGE_WIDTH - road.distance) / EDGE_WIDTH, 0),
    1,
  )
  const flatRadius = ROAD_HALF_WIDTH + SHOULDER_WIDTH
  if (road.distance <= flatRadius) return { height: road.height, roadCover }
  if (road.distance >= flatRadius + TRANSITION_WIDTH) return { height: natural, roadCover: 0 }
  const t = (road.distance - flatRadius) / TRANSITION_WIDTH
  const smooth = t * t * (3 - 2 * t)
  return { height: road.height + (natural - road.height) * smooth, roadCover: 0 }
}

export function heightAt(x: number, z: number, path: ProceduralPath): number {
  return surfaceAt(x, z, path).height
}

/** Construit la géométrie d'un chunk de terrain (coordonnées locales centrées
 * sur le chunk ; le composant qui l'affiche le positionne dans le monde). La
 * route est peinte dans les couleurs des sommets : elle suit le relief exact et
 * n'existe que là où le terrain est chargé. */
export function buildChunkGeometry(
  chunkX: number,
  chunkZ: number,
  path: ProceduralPath,
): BufferGeometry {
  const segments = CHUNK_RESOLUTION
  const verticesPerSide = segments + 1
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const originX = chunkX * CHUNK_SIZE
  const originZ = chunkZ * CHUNK_SIZE

  for (let iz = 0; iz < verticesPerSide; iz++) {
    for (let ix = 0; ix < verticesPerSide; ix++) {
      const localX = (ix / segments) * CHUNK_SIZE - CHUNK_SIZE / 2
      const localZ = (iz / segments) * CHUNK_SIZE - CHUNK_SIZE / 2
      // Hauteur échantillonnée en coordonnées monde : deux chunks voisins
      // calculent la même hauteur à leur frontière commune, pas de couture.
      const surface = surfaceAt(originX + localX, originZ + localZ, path)
      positions.push(localX, surface.height, localZ)
      const color = GROUND_COLOR.clone().lerp(ROAD_COLOR, surface.roadCover)
      colors.push(color.r, color.g, color.b)
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
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
