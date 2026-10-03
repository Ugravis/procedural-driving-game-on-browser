import { createNoise2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'
import { landscapeHeight } from './landscape'

export const ROAD_HALF_WIDTH = 1.2 // m, demi-largeur de la route (rendu et aplanissement du terrain)

const SEGMENT_LENGTH = 10 // m, distance entre deux points de contrôle
const MAX_TURN_PER_SEGMENT = 0.35 // rad, virage max d'un segment à l'autre
const CANDIDATE_TURNS = [-0.35, -0.23, -0.12, 0, 0.12, 0.23, 0.35] // rad, caps testés à chaque segment
const MAX_GRADE = 0.12 // pente max ~12 %
const STEEP_PENALTY = 10 // pénalité d'un cap dépassant MAX_GRADE
const LATERAL_PROBE = 4 // m, écart latéral pour mesurer le dévers
const LATERAL_WEIGHT = 0.5 // poids du dévers dans le coût d'un cap
const TURN_WEIGHT = 0.5 // poids de l'écart au virage souhaité dans le coût
const WANDER_FREQUENCY = 0.01 // fréquence du bruit qui donne le virage souhaité
const AHEAD_BUFFER = 300 // m, distance générée devant la position courante
const BEHIND_BUFFER = 50 // m, distance gardée derrière avant recyclage

interface PathPoint {
  position: Vector3
  distance: number // distance cumulée depuis l'origine du chemin
}

// Le terrain (landscape.ts) est la seule source de vérité : la route suit son
// altitude exacte et choisit ses caps pour rester praticable.
export class ProceduralPath {
  private readonly wander2D = createNoise2D()
  private points: PathPoint[]
  private heading = 0
  private curve: CatmullRomCurve3
  revision = 0

  constructor() {
    const origin = new Vector3(0, landscapeHeight(0, 0), 0)
    this.points = [{ position: origin, distance: 0 }]
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
   * Altitude de la route à la projection de (x, z) sur le tracé, et distance
   * planaire à ce tracé. Sert à aplanir le terrain sous la route.
   */
  roadAt(x: number, z: number): { height: number; distance: number } {
    let bestDistSq = Infinity
    let height = 0
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i]!.position
      const b = this.points[i + 1]!.position
      const abx = b.x - a.x
      const abz = b.z - a.z
      const lengthSq = abx * abx + abz * abz
      const t =
        lengthSq > 0 ? Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0), 1) : 0
      const dx = a.x + abx * t - x
      const dz = a.z + abz * t - z
      const distSq = dx * dx + dz * dz
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        height = a.y + (b.y - a.y) * t
      }
    }
    return { height, distance: Math.sqrt(bestDistSq) }
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
      const step = this.chooseStep(last.position, preferredTurn)
      this.heading = step.heading
      last = { position: step.position, distance: last.distance + SEGMENT_LENGTH }
      this.points.push(last)
      didExtend = true
    }
    return didExtend
  }

  private chooseStep(from: Vector3, preferredTurn: number) {
    let best: { heading: number; position: Vector3; cost: number } | null = null

    for (const turn of CANDIDATE_TURNS) {
      const heading = this.heading + turn
      const forwardX = Math.sin(heading)
      const forwardZ = -Math.cos(heading)
      const x = from.x + forwardX * SEGMENT_LENGTH
      const z = from.z + forwardZ * SEGMENT_LENGTH
      const y = landscapeHeight(x, z)

      const slopeAlong = (y - from.y) / SEGMENT_LENGTH
      const slopeAcross =
        (landscapeHeight(x - forwardZ * LATERAL_PROBE, z + forwardX * LATERAL_PROBE) -
          landscapeHeight(x + forwardZ * LATERAL_PROBE, z - forwardX * LATERAL_PROBE)) /
        (2 * LATERAL_PROBE)

      const cost =
        Math.abs(slopeAlong) +
        LATERAL_WEIGHT * Math.abs(slopeAcross) +
        TURN_WEIGHT * Math.abs(turn - preferredTurn) +
        (Math.abs(slopeAlong) > MAX_GRADE ? STEEP_PENALTY : 0)

      if (!best || cost < best.cost) {
        best = { heading, position: new Vector3(x, y, z), cost }
      }
    }

    return { heading: best!.heading, position: best!.position }
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
