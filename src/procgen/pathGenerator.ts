import { createNoise2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'
import { landscapeHeight } from './landscape'

export const ROAD_HALF_WIDTH = 1.2 // m, demi-largeur de la route (rendu et aplanissement du terrain)

const SEGMENT_LENGTH = 10 // m, distance entre deux points de contrôle
const MAX_TURN_PER_SEGMENT = 0.35 // rad, virage max d'un segment à l'autre
const CANDIDATE_TURNS = [-0.7, -0.5, -0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35, 0.5, 0.7] // rad, caps testés à chaque segment
const MAX_GRADE = 0.12 // pente max ~12 %
const STEEP_PENALTY = 1000 // pénalité d'un cap dépassant MAX_GRADE
const LATERAL_PROBE = 4 // m, écart latéral pour mesurer le dévers
const LATERAL_WEIGHT = 0.5 // poids du dévers dans le coût d'un cap
const TURN_WEIGHT = 0.5 // poids de l'écart au virage souhaité dans le coût
const WANDER_FREQUENCY = 0.01 // fréquence du bruit qui donne le virage souhaité
const GLOBAL_DIRECTION_FREQUENCY = 0.0002 // 1/m, la direction générale change sur plusieurs km
const GLOBAL_DIRECTION_RANGE = 1 // rad, écart max de la direction générale à l'axe initial
const GLOBAL_DIRECTION_WEIGHT = 0.3 // poids de l'écart à la direction générale dans le coût
const CLEARANCE = 8 // m, distance minimale à un point ancien (évite les croisements)
const MIN_SEPARATION_SEGMENTS = 40 // nombre de segments à partir duquel un point est "ancien"
const COLLISION_PENALTY = 1000 // pénalité d'un cap qui recroise le tracé
const LOOKAHEAD_WEIGHT = 0.7 // poids du meilleur coût au segment suivant dans le choix d'un cap
const GRID_CELL = 20 // m, taille des cellules de recherche spatiale
const AHEAD_BUFFER = 300 // m, distance générée devant la position courante
const BEHIND_BUFFER = 50 // m, distance gardée derrière avant recyclage

interface PathPoint {
  position: Vector3
  distance: number // distance cumulée depuis l'origine du chemin
}

interface Candidate {
  heading: number
  position: Vector3
  cost: number
}

const TWO_PI = Math.PI * 2

function angleDifference(a: number, b: number): number {
  let d = (a - b) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d < -Math.PI) d += TWO_PI
  return d
}

// Le terrain (landscape.ts) est la seule source de vérité : la route suit son
// altitude exacte, garde une direction générale qui varie lentement, et
// évite de recroiser un de ses anciens points.
export class ProceduralPath {
  private wander2D = createNoise2D()
  private direction2D = createNoise2D()
  private points: PathPoint[] = []
  private history: Vector3[] = []
  private grid = new Map<string, number[]>()
  private heading = 0
  private curve = new CatmullRomCurve3()
  revision = 0

  constructor() {
    this.init()
  }

  /** Repart de l'origine avec de nouveaux bruits (après régénération du relief). */
  reset() {
    this.wander2D = createNoise2D()
    this.direction2D = createNoise2D()
    this.init()
    this.revision++
  }

  private init() {
    this.history = []
    this.grid = new Map()
    this.heading = 0
    const origin = new Vector3(0, landscapeHeight(0, 0), 0)
    this.points = [{ position: origin, distance: 0 }]
    this.record(origin)
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
      const targetHeading =
        this.direction2D(last.distance * GLOBAL_DIRECTION_FREQUENCY, 0) * GLOBAL_DIRECTION_RANGE
      const step = this.chooseStep(last.position, preferredTurn, targetHeading)
      this.heading = step.heading
      last = { position: step.position, distance: last.distance + SEGMENT_LENGTH }
      this.points.push(last)
      this.record(last.position)
      didExtend = true
    }
    return didExtend
  }

  private chooseStep(from: Vector3, preferredTurn: number, targetHeading: number) {
    const lastIndex = this.history.length - 1
    let best: Candidate | null = null

    for (const turn of CANDIDATE_TURNS) {
      const first = this.evaluate(from, this.heading, turn, preferredTurn, targetHeading, lastIndex)
      let future = Infinity
      for (const nextTurn of CANDIDATE_TURNS) {
        const second = this.evaluate(
          first.position,
          first.heading,
          nextTurn,
          0,
          targetHeading,
          lastIndex,
        )
        future = Math.min(future, second.cost)
      }
      const total = first.cost + LOOKAHEAD_WEIGHT * future
      if (!best || total < best.cost) best = { ...first, cost: total }
    }

    return { heading: best!.heading, position: best!.position }
  }

  private evaluate(
    from: Vector3,
    fromHeading: number,
    turn: number,
    preferredTurn: number,
    targetHeading: number,
    lastIndex: number,
  ): Candidate {
    const heading = fromHeading + turn
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
      GLOBAL_DIRECTION_WEIGHT * Math.abs(angleDifference(heading, targetHeading)) +
      (Math.abs(slopeAlong) > MAX_GRADE ? STEEP_PENALTY : 0) +
      (this.collides(x, z, lastIndex) ? COLLISION_PENALTY : 0)

    return { heading, position: new Vector3(x, y, z), cost }
  }

  private record(position: Vector3) {
    const index = this.history.length
    this.history.push(position)
    const key = this.cellKey(position.x, position.z)
    const cell = this.grid.get(key)
    if (cell) cell.push(index)
    else this.grid.set(key, [index])
  }

  private collides(x: number, z: number, lastIndex: number): boolean {
    const cx = Math.floor(x / GRID_CELL)
    const cz = Math.floor(z / GRID_CELL)
    const oldestAllowed = lastIndex - MIN_SEPARATION_SEGMENTS
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const cell = this.grid.get(`${i}:${j}`)
        if (!cell) continue
        for (const index of cell) {
          if (index > oldestAllowed) continue
          const p = this.history[index]!
          const dx = p.x - x
          const dz = p.z - z
          if (dx * dx + dz * dz < CLEARANCE * CLEARANCE) return true
        }
      }
    }
    return false
  }

  private cellKey(x: number, z: number): string {
    return `${Math.floor(x / GRID_CELL)}:${Math.floor(z / GRID_CELL)}`
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
