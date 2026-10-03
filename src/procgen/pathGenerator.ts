import { createNoise2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'
import { landscapeHeight } from './landscape'

const SEGMENT_LENGTH = 10 // m, distance entre deux points de contrôle
const MAX_TURN_PER_SEGMENT = 0.35 // rad, virage max d'un segment à l'autre
const CANDIDATE_TURNS = [-0.35, -0.23, -0.12, 0, 0.12, 0.23, 0.35] // rad, caps testés à chaque segment
const MAX_GRADE = 0.12 // pente max ~12 %, route praticable même sur relief raide
const LATERAL_PROBE = 4 // m, écart latéral pour mesurer le dévers
const LATERAL_WEIGHT = 0.5 // poids du dévers dans le coût d'un cap
const TURN_WEIGHT = 0.5 // poids de l'écart au virage souhaité dans le coût
const WANDER_FREQUENCY = 0.01 // fréquence du bruit qui donne le virage souhaité
const SMOOTHING_HALF_WIDTH = 4 // fenêtre de lissage de 9 points
const AHEAD_BUFFER = 300 // m, distance générée devant la position courante
const BEHIND_BUFFER = 50 // m, distance gardée derrière avant recyclage

interface PathPoint {
  position: Vector3
  distance: number // distance cumulée depuis l'origine du chemin
  rawHeight: number // élévation échantillonnée sur le paysage, avant lissage
  smoothed: boolean
}

interface Step {
  heading: number
  position: Vector3
  rawHeight: number
}

// Le chemin est posé sur le paysage (landscape.ts), seule source de vérité du
// relief : à chaque segment on choisit le cap qui minimise la pente, puis on
// lisse l'élévation. Les points sont générés en avance et recyclés derrière.
export class ProceduralPath {
  private readonly wander2D = createNoise2D()
  private points: PathPoint[]
  private heading = 0
  private curve: CatmullRomCurve3
  revision = 0

  constructor() {
    const originHeight = landscapeHeight(0, 0)
    this.points = [
      {
        position: new Vector3(0, originHeight, 0),
        distance: 0,
        rawHeight: originHeight,
        smoothed: false,
      },
    ]
    this.curve = new CatmullRomCurve3(this.points.map((p) => p.position))
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
      const preferredTurn =
        this.wander2D(last.distance * WANDER_FREQUENCY, 0) * MAX_TURN_PER_SEGMENT
      const step = this.chooseStep(last, preferredTurn)
      this.heading = step.heading
      last = {
        position: step.position,
        distance: last.distance + SEGMENT_LENGTH,
        rawHeight: step.rawHeight,
        smoothed: false,
      }
      this.points.push(last)
      this.smoothAt(this.points.length - 1 - SMOOTHING_HALF_WIDTH)
      didExtend = true
    }
    return didExtend
  }

  private chooseStep(last: PathPoint, preferredTurn: number): Step {
    let best: (Step & { cost: number }) | null = null

    for (const turn of CANDIDATE_TURNS) {
      const heading = this.heading + turn
      const forwardX = Math.sin(heading)
      const forwardZ = -Math.cos(heading)
      const x = last.position.x + forwardX * SEGMENT_LENGTH
      const z = last.position.z + forwardZ * SEGMENT_LENGTH
      const height = landscapeHeight(x, z)

      const slopeAlong = (height - last.rawHeight) / SEGMENT_LENGTH
      const slopeAcross =
        (landscapeHeight(x - forwardZ * LATERAL_PROBE, z + forwardX * LATERAL_PROBE) -
          landscapeHeight(x + forwardZ * LATERAL_PROBE, z - forwardX * LATERAL_PROBE)) /
        (2 * LATERAL_PROBE)

      const cost =
        Math.abs(slopeAlong) +
        LATERAL_WEIGHT * Math.abs(slopeAcross) +
        TURN_WEIGHT * Math.abs(turn - preferredTurn)

      if (!best || cost < best.cost) {
        best = { heading, position: new Vector3(x, height, z), rawHeight: height, cost }
      }
    }

    const maxDelta = MAX_GRADE * SEGMENT_LENGTH
    const rawHeight = Math.min(
      Math.max(best!.rawHeight, last.rawHeight - maxDelta),
      last.rawHeight + maxDelta,
    )
    return {
      heading: best!.heading,
      position: new Vector3(best!.position.x, rawHeight, best!.position.z),
      rawHeight,
    }
  }

  private smoothAt(index: number) {
    if (index < 0) return
    const point = this.points[index]!
    if (point.smoothed) return
    const from = Math.max(0, index - SMOOTHING_HALF_WIDTH)
    const to = Math.min(this.points.length - 1, index + SMOOTHING_HALF_WIDTH)
    let sum = 0
    for (let i = from; i <= to; i++) sum += this.points[i]!.rawHeight
    point.position.y = sum / (to - from + 1)
    point.smoothed = true
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
