import { BufferGeometry, Float32BufferAttribute } from 'three'

const LIFT = 0.05 // m, évite le z-fighting avec le terrain

// Courbes de niveau d'une grille de sommets (marching squares) : chaque cellule
// produit un ou deux segments entre les arêtes où la hauteur croise un niveau.
export function buildContourGeometry(
  terrain: BufferGeometry,
  verticesPerSide: number,
  interval: number,
): BufferGeometry {
  const p = terrain.getAttribute('position').array as ArrayLike<number>
  const vertex = (ix: number, iz: number) => (iz * verticesPerSide + ix) * 3
  const segments: number[] = []

  for (let iz = 0; iz < verticesPerSide - 1; iz++) {
    for (let ix = 0; ix < verticesPerSide - 1; ix++) {
      const corners = [
        vertex(ix, iz),
        vertex(ix + 1, iz),
        vertex(ix + 1, iz + 1),
        vertex(ix, iz + 1),
      ]
      const heights = corners.map((v) => p[v + 1]!)
      const low = Math.min(...heights)
      const high = Math.max(...heights)

      for (let level = Math.ceil(low / interval) * interval; level <= high; level += interval) {
        const crossings: number[] = []
        for (let e = 0; e < 4; e++) {
          const a = corners[e]!
          const b = corners[(e + 1) % 4]!
          const ha = heights[e]!
          const hb = heights[(e + 1) % 4]!
          if ((ha - level) * (hb - level) >= 0 || ha === hb) continue
          const t = (level - ha) / (hb - ha)
          crossings.push(p[a]! + (p[b]! - p[a]!) * t, p[a + 2]! + (p[b + 2]! - p[a + 2]!) * t)
        }
        for (let k = 0; k + 3 < crossings.length; k += 4) {
          segments.push(
            crossings[k]!,
            level + LIFT,
            crossings[k + 1]!,
            crossings[k + 2]!,
            level + LIFT,
            crossings[k + 3]!,
          )
        }
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(segments, 3))
  return geometry
}
