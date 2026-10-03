import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'
import { landscapeHeight } from './landscape'
import { createRandom } from './random'

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
const MIN_SEPARATION = 400 // m, longueur d'arc à partir de laquelle un point est "ancien"
const COLLISION_PENALTY = 1000 // pénalité d'un cap qui recroise le tracé
const LOOKAHEAD_WEIGHT = 0.7 // poids du meilleur coût au segment suivant dans le choix d'un cap
const GRID_CELL = 20 // m, taille des cellules de recherche spatiale
const AHEAD_BUFFER = 300 // m, distance fournie devant la position courante
const BEHIND_BUFFER = 50 // m, distance fournie derrière la position courante

const WANDER_SALT = 1
const DIRECTION_SALT = 2

const TWO_PI = Math.PI * 2

interface PathPoint {
  position: Vector3
  distance: number // distance signée depuis l'origine (négative vers l'arrière)
}

interface Candidate {
  heading: number
  position: Vector3
  cost: number
}

interface Sample {
  x: number
  z: number
  distance: number
}

function angleDifference(a: number, b: number): number {
  let d = (a - b) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d < -Math.PI) d += TWO_PI
  return d
}

// Le tracé est généré dans les deux sens à partir de l'origine, en pas
// synchronisés : le segment n'ayant besoin que de ce qui a déjà été généré,
// un même couple (graine, distance) donne toujours le même tracé, quel que soit
// le chemin parcouru par le joueur. Seule une fenêtre autour du joueur est
// exposée au terrain et au rendu.
export class ProceduralPath {
  private wander2D!: NoiseFunction2D
  private direction2D!: NoiseFunction2D
  private forward: Vector3[] = [] // forward[i] à la distance +i * SEGMENT_LENGTH
  private backward: Vector3[] = [] // backward[i] à la distance -i * SEGMENT_LENGTH
  private headingForward = 0
  private headingBackward = Math.PI
  private grid = new Map<string, Sample[]>()
  private windowFirst = Number.NaN
  private windowLast = Number.NaN
  private window: PathPoint[] = []
  private curve = new CatmullRomCurve3()
  revision = 0

  constructor(seed: number) {
    this.reset(seed)
  }

  reset(seed: number) {
    this.wander2D = createNoise2D(createRandom(seed + WANDER_SALT))
    this.direction2D = createNoise2D(createRandom(seed + DIRECTION_SALT))
    const origin = new Vector3(0, landscapeHeight(0, 0), 0)
    this.forward = [origin]
    this.backward = [origin]
    this.headingForward = 0
    this.headingBackward = Math.PI
    this.grid = new Map()
    this.record(origin, 0)
    this.windowFirst = Number.NaN
    this.windowLast = Number.NaN
    this.refreshWindow(0)
    this.revision++
  }

  /** À appeler une fois par frame avec la distance signée courante. */
  update(currentDistance: number) {
    if (this.refreshWindow(currentDistance)) this.revision++
  }

  getCurve(): CatmullRomCurve3 {
    return this.curve
  }

  get pointCount() {
    return this.window.length
  }

  /**
   * Altitude de la route à la projection de (x, z) sur le tracé, et distance
   * planaire à ce tracé. Sert à aplanir le terrain sous la route.
   */
  roadAt(x: number, z: number): { height: number; distance: number } {
    let bestDistSq = Infinity
    let height = 0
    for (let i = 0; i < this.window.length - 1; i++) {
      const a = this.window[i]!.position
      const b = this.window[i + 1]!.position
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
    const first = this.window[0]!
    const last = this.window[this.window.length - 1]!
    const span = last.distance - first.distance
    const t = span > 0 ? (distance - first.distance) / span : 0
    const clampedT = Math.min(Math.max(t, 0), 1)
    return {
      position: this.curve.getPointAt(clampedT),
      tangent: this.curve.getTangentAt(clampedT),
    }
  }

  private refreshWindow(distance: number): boolean {
    const first = Math.floor((distance - BEHIND_BUFFER) / SEGMENT_LENGTH)
    const last = Math.ceil((distance + AHEAD_BUFFER) / SEGMENT_LENGTH)
    if (first === this.windowFirst && last === this.windowLast) return false
    this.ensure(Math.max(last, -first))
    this.windowFirst = first
    this.windowLast = last
    this.window = []
    for (let k = first; k <= last; k++) {
      this.window.push({ position: this.pointAt(k), distance: k * SEGMENT_LENGTH })
    }
    this.curve = new CatmullRomCurve3(this.window.map((p) => p.position))
    return true
  }

  private pointAt(index: number): Vector3 {
    return index >= 0 ? this.forward[index]! : this.backward[-index]!
  }

  private ensure(count: number) {
    while (this.forward.length <= count) {
      this.grow(1)
      this.grow(-1)
    }
  }

  private grow(direction: 1 | -1) {
    const arm = direction > 0 ? this.forward : this.backward
    const fromIndex = arm.length - 1
    const from = arm[fromIndex]!
    const fromDistance = direction * fromIndex * SEGMENT_LENGTH
    const fromHeading = direction > 0 ? this.headingForward : this.headingBackward
    const preferredTurn = this.wander2D(fromDistance * WANDER_FREQUENCY, 0) * MAX_TURN_PER_SEGMENT
    const baseHeading = direction > 0 ? 0 : Math.PI
    const targetHeading =
      baseHeading +
      this.direction2D(fromDistance * GLOBAL_DIRECTION_FREQUENCY, 0) * GLOBAL_DIRECTION_RANGE

    const step = this.chooseStep(
      from,
      fromHeading,
      fromDistance,
      direction,
      preferredTurn,
      targetHeading,
    )
    arm.push(step.position)
    this.record(step.position, fromDistance + direction * SEGMENT_LENGTH)
    if (direction > 0) this.headingForward = step.heading
    else this.headingBackward = step.heading
  }

  private chooseStep(
    from: Vector3,
    fromHeading: number,
    fromDistance: number,
    direction: 1 | -1,
    preferredTurn: number,
    targetHeading: number,
  ): Candidate {
    const distance = fromDistance + direction * SEGMENT_LENGTH
    const nextDistance = distance + direction * SEGMENT_LENGTH
    let best: Candidate | null = null

    for (const turn of CANDIDATE_TURNS) {
      const first = this.evaluate(from, fromHeading, turn, distance, preferredTurn, targetHeading)
      let future = Infinity
      for (const nextTurn of CANDIDATE_TURNS) {
        const second = this.evaluate(
          first.position,
          first.heading,
          nextTurn,
          nextDistance,
          0,
          targetHeading,
        )
        future = Math.min(future, second.cost)
      }
      const total = first.cost + LOOKAHEAD_WEIGHT * future
      if (!best || total < best.cost) best = { ...first, cost: total }
    }

    return best!
  }

  private evaluate(
    from: Vector3,
    fromHeading: number,
    turn: number,
    distance: number,
    preferredTurn: number,
    targetHeading: number,
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
      (this.collides(x, z, distance) ? COLLISION_PENALTY : 0)

    return { heading, position: new Vector3(x, y, z), cost }
  }

  private record(position: Vector3, distance: number) {
    const key = this.cellKey(position.x, position.z)
    const sample: Sample = { x: position.x, z: position.z, distance }
    const cell = this.grid.get(key)
    if (cell) cell.push(sample)
    else this.grid.set(key, [sample])
  }

  private collides(x: number, z: number, distance: number): boolean {
    const cx = Math.floor(x / GRID_CELL)
    const cz = Math.floor(z / GRID_CELL)
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        const cell = this.grid.get(`${i}:${j}`)
        if (!cell) continue
        for (const sample of cell) {
          if (Math.abs(sample.distance - distance) <= MIN_SEPARATION) continue
          const dx = sample.x - x
          const dz = sample.z - z
          if (dx * dx + dz * dz < CLEARANCE * CLEARANCE) return true
        }
      }
    }
    return false
  }

  private cellKey(x: number, z: number): string {
    return `${Math.floor(x / GRID_CELL)}:${Math.floor(z / GRID_CELL)}`
  }
}

export const proceduralPath = new ProceduralPath(0)
