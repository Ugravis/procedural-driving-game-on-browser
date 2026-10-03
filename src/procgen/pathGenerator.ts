import { createNoise2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'

const SEGMENT_LENGTH = 10 // distance (m) entre deux points de contrôle
const MAX_TURN_PER_SEGMENT = 0.35 // rad, limite la courbure d'un segment à l'autre
const MAX_GRADE = 0.12 // pente max ~12%, réaliste pour une route de montagne
const ELEVATION_NOISE_FREQUENCY = 0.004 // basse fréquence => montées/descentes longues, pas du bruit haché
const AHEAD_BUFFER = 300 // on génère toujours au moins ça devant la distance courante
const BEHIND_BUFFER = 50 // on garde ça derrière avant de recycler les points

interface PathPoint {
  position: Vector3
  distance: number // distance cumulée depuis l'origine du chemin
}

// Chemin infini généré au fur et à mesure : une suite de points espacés
// régulièrement, dont le cap (virages) et la pente (montées/descentes) dévient
// à chaque segment selon deux bruits simplex indépendants (des courbes douces
// plutôt que des changements brusques). Comme chez slowroads.io, c'est le
// chemin qui porte le relief (son élévation) ; le terrain généré à l'étape 4
// épousera cette élévation le long d'un corridor autour de la route, et se
// fondra dans un bruit plus large en s'en éloignant — ce n'est pas la route
// qui s'adapte à un terrain préexistant. Les points trop en avance ou trop
// loin derrière la position courante sont respectivement générés à la volée
// / recyclés, pour garder un nombre de points borné en mémoire quelle que
// soit la distance totale parcourue.
export class ProceduralPath {
  private readonly noise2D = createNoise2D()
  private readonly elevationNoise2D = createNoise2D()
  private points: PathPoint[] = [{ position: new Vector3(0, 0, 0), distance: 0 }]
  private heading = 0
  private curve = new CatmullRomCurve3(this.points.map((p) => p.position))
  revision = 0

  constructor() {
    this.extend(AHEAD_BUFFER)
    this.rebuildCurve()
  }

  /** À appeler une fois par frame avec la distance parcourue courante. */
  update(currentDistance: number) {
    const extended = this.extend(currentDistance + AHEAD_BUFFER)
    const pruned = this.prune(currentDistance)
    if (extended || pruned) {
      this.rebuildCurve()
      this.revision++
    }
  }

  getCurve(): CatmullRomCurve3 {
    return this.curve
  }

  get pointCount() {
    return this.points.length
  }

  /**
   * Élévation du point du chemin le plus proche de (x, z) en plan, et la
   * distance (planaire) à ce point. Utilisé par le terrain pour savoir à
   * quel point coller à la route (corridor) et où s'en détacher.
   */
  nearestElevation(x: number, z: number): { elevation: number; distance: number } {
    let bestDistSq = Infinity
    let elevation = 0
    for (const point of this.points) {
      const dx = point.position.x - x
      const dz = point.position.z - z
      const distSq = dx * dx + dz * dz
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        elevation = point.position.y
      }
    }
    return { elevation, distance: Math.sqrt(bestDistSq) }
  }

  getPointAt(distance: number): { position: Vector3; tangent: Vector3 } {
    const first = this.points[0]!
    const last = this.points[this.points.length - 1]!
    const span = last.distance - first.distance
    const t = span > 0 ? (distance - first.distance) / span : 0
    const clampedT = Math.min(Math.max(t, 0), 1)
    return {
      position: this.curve.getPointAt(clampedT),
      tangent: this.curve.getTangentAt(clampedT),
    }
  }

  private extend(targetDistance: number): boolean {
    let last = this.points[this.points.length - 1]!
    let didExtend = false
    while (last.distance < targetDistance) {
      this.heading += this.noise2D(last.distance * 0.01, 0) * MAX_TURN_PER_SEGMENT
      const grade = this.elevationNoise2D(last.distance * ELEVATION_NOISE_FREQUENCY, 0) * MAX_GRADE
      const position = new Vector3(
        last.position.x + Math.sin(this.heading) * SEGMENT_LENGTH,
        last.position.y + grade * SEGMENT_LENGTH,
        last.position.z - Math.cos(this.heading) * SEGMENT_LENGTH,
      )
      last = { position, distance: last.distance + SEGMENT_LENGTH }
      this.points.push(last)
      didExtend = true
    }
    return didExtend
  }

  private prune(currentDistance: number): boolean {
    const cutoff = currentDistance - BEHIND_BUFFER
    let removeCount = 0
    // on garde toujours au moins 2 points pour que la courbe reste valide
    while (
      this.points.length - removeCount > 2 &&
      this.points[removeCount + 1]!.distance < cutoff
    ) {
      removeCount++
    }
    if (removeCount > 0) this.points.splice(0, removeCount)
    return removeCount > 0
  }

  private rebuildCurve() {
    this.curve = new CatmullRomCurve3(this.points.map((p) => p.position))
  }
}

export const proceduralPath = new ProceduralPath()
