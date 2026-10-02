import { createNoise2D } from 'simplex-noise'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { ProceduralPath } from './pathGenerator'

export const CHUNK_SIZE = 50 // m, taille d'un chunk de terrain
export const CHUNK_RESOLUTION = 20 // subdivisions par côté
export const RENDER_RADIUS_CHUNKS = 3 // rayon (en chunks) chargé autour du joueur

const CORRIDOR_WIDTH = 15 // m, le terrain colle exactement à l'élévation de la route sur cette largeur
const BLEND_WIDTH = 35 // m, transition progressive vers le relief ambiant au-delà du corridor
const AMBIENT_HEIGHT_SCALE = 10 // amplitude des collines "libres"
const AMBIENT_FREQUENCY = 0.015

const ambientNoise2D = createNoise2D()

/** Relief ambiant (loin de la route) : un fBm à 3 octaves pour des collines
 * lisses mais variées, indépendant du chemin. */
function ambientHeight(x: number, z: number): number {
  let height = 0
  let amplitude = 1
  let frequency = AMBIENT_FREQUENCY
  for (let octave = 0; octave < 3; octave++) {
    height += ambientNoise2D(x * frequency, z * frequency) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return height * AMBIENT_HEIGHT_SCALE
}

/**
 * Hauteur du terrain en (x, z) : colle à l'élévation de la route dans le
 * corridor, se fond progressivement dans le relief ambiant au-delà (comme
 * slowroads.io — le terrain épouse la route, pas l'inverse).
 */
export function heightAt(x: number, z: number, path: ProceduralPath): number {
  const { elevation, distance } = path.nearestElevation(x, z)
  if (distance <= CORRIDOR_WIDTH) return elevation
  const ambient = ambientHeight(x, z)
  if (distance >= CORRIDOR_WIDTH + BLEND_WIDTH) return ambient
  const t = (distance - CORRIDOR_WIDTH) / BLEND_WIDTH
  const smooth = t * t * (3 - 2 * t) // smoothstep : transition douce, pas de pli visible
  return elevation + (ambient - elevation) * smooth
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
