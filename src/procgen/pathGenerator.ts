import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import { CatmullRomCurve3, Vector3 } from 'three'
import { getLandscapeParams, landscapeHeight } from './landscape'
import { createRandom } from './random'

export const ROAD_HALF_WIDTH = 1.2 // m, demi-largeur de la route (rendu et aplanissement du terrain)

const SEGMENT_LENGTH = 10 // m, distance entre deux points de contrôle
const AVOIDANCE_TURNS = [-1.3, -1.1, -0.9, 0.9, 1.1, 1.3] // rad, virages supplémentaires pour contourner un obstacle
const MAX_TURN_PER_SEGMENT = 0.35 // rad, virage max d'un segment à l'autre
const CANDIDATE_TURNS = [-0.7, -0.5, -0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35, 0.5, 0.7] // rad, caps testés à chaque segment
const MAX_GRADE = 0.12 // pente max ~12 %
const STEEP_PENALTY = 1000 // pénalité d'un cap dépassant MAX_GRADE
const WATER_PENALTY = 1000 // pénalité d'un cap qui tombe dans l'eau
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
const AHEAD_BUFFER = 400 // m, distance fournie devant la position courante (couvre le terrain chargé)
const BEHIND_BUFFER = 400 // m, distance fournie derrière la position courante (conduite arrière)
const WATER_LOOKAHEAD = 120 // m, distance regardée devant pour anticiper un lac
const BRIDGE_MIN_SEGMENTS = 3 // segments, ~30 m
const BRIDGE_MAX_SEGMENTS = 30 // segments, ~300 m
const BRIDGE_HEADING_OFFSETS = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3] // rad, caps testés pour un tablier
const WATER_CLEARANCE = 1.5 // m, hauteur minimale du tablier au-dessus de l'eau

const DENSE_PER_POINT = 4 // échantillons de courbe par point de contrôle, pour suivre la courbe au mètre près

const WANDER_SALT = 1
const DIRECTION_SALT = 2

const TWO_PI = Math.PI * 2

export interface PathPoint {
  position: Vector3
  distance: number // distance signée depuis l'origine (négative vers l'arrière)
  bridge: boolean // vrai si le segment qui arrive à ce point est un tablier
}

interface Candidate {
  heading: number
  position: Vector3
  cost: number
  obstacle: boolean // eau ou pente au point candidat
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

function last<T>(items: T[]): T {
  return items[items.length - 1]!
}

// Le tracé est généré dans les deux sens à partir de l'origine. Chaque pas ne
// dépend que de l'état déjà généré, et le bras le moins avancé est toujours
// prolongé en premier : la suite de pas est donc canonique, quel que soit le
// parcours du joueur. Seule une fenêtre autour du joueur est exposée au terrain
// et au rendu.
export class ProceduralPath {
  private wander2D!: NoiseFunction2D
  private direction2D!: NoiseFunction2D
  private forward: PathPoint[] = []
  private backward: PathPoint[] = []
  private headingForward = 0
  private headingBackward = Math.PI
  private lastBridge = { forward: -Infinity, backward: -Infinity }
  private grid = new Map<string, Sample[]>()
  private windowFirst = Number.NaN
  private windowLast = Number.NaN
  private window: PathPoint[] = []
  private dense: Vector3[] = []
  private curve = new CatmullRomCurve3()
  revision = 0

  constructor(seed: number) {
    this.reset(seed)
  }

  reset(seed: number) {
    this.wander2D = createNoise2D(createRandom(seed + WANDER_SALT))
    this.direction2D = createNoise2D(createRandom(seed + DIRECTION_SALT))
    const origin: PathPoint = {
      position: new Vector3(0, landscapeHeight(0, 0), 0),
      distance: 0,
      bridge: false,
    }
    this.forward = [origin]
    this.backward = [origin]
    this.headingForward = 0
    this.headingBackward = Math.PI
    this.lastBridge = { forward: -Infinity, backward: -Infinity }
    this.grid = new Map()
    this.record(origin.position, 0)
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

  getWindow(): readonly PathPoint[] {
    return this.window
  }

  get pointCount() {
    return this.window.length
  }

  /**
   * Altitude de la route à la projection de (x, z) sur le tracé, distance
   * planaire à ce tracé, et vrai si la projection tombe sur un tablier.
   */
  roadAt(x: number, z: number): { height: number; distance: number; bridge: boolean } {
    let bestDistSq = Infinity
    let height = 0
    const dense = this.dense
    for (let i = 0; i < dense.length - 1; i++) {
      const a = dense[i]!
      const b = dense[i + 1]!
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
    return { height, distance: Math.sqrt(bestDistSq), bridge: this.nearestPoint(x, z).bridge }
  }

  private nearestPoint(x: number, z: number): PathPoint {
    let best = this.window[0]!
    let bestDistSq = Infinity
    for (const p of this.window) {
      const dx = p.position.x - x
      const dz = p.position.z - z
      const distSq = dx * dx + dz * dz
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = p
      }
    }
    return best
  }

  getPointAt(distance: number): { position: Vector3; tangent: Vector3 } {
    const first = this.window[0]!
    const lastPoint = last(this.window)
    const span = lastPoint.distance - first.distance
    const t = span > 0 ? (distance - first.distance) / span : 0
    const clampedT = Math.min(Math.max(t, 0), 1)
    return {
      position: this.curve.getPointAt(clampedT),
      tangent: this.curve.getTangentAt(clampedT),
    }
  }

  private refreshWindow(distance: number): boolean {
    const first = Math.floor((distance - BEHIND_BUFFER) / SEGMENT_LENGTH) * SEGMENT_LENGTH
    const lastDistance = Math.ceil((distance + AHEAD_BUFFER) / SEGMENT_LENGTH) * SEGMENT_LENGTH
    if (first === this.windowFirst && lastDistance === this.windowLast) return false
    this.ensure(Math.max(lastDistance, -first))
    this.windowFirst = first
    this.windowLast = lastDistance

    this.window = []
    for (let i = this.backward.length - 1; i >= 1; i--) {
      const p = this.backward[i]!
      if (p.distance >= first && p.distance <= lastDistance) this.window.push(p)
    }
    for (const p of this.forward) {
      if (p.distance >= first && p.distance <= lastDistance) this.window.push(p)
    }
    this.curve = new CatmullRomCurve3(this.window.map((p) => p.position))
    this.dense = this.curve.getSpacedPoints(this.window.length * DENSE_PER_POINT)
    return true
  }

  // Prolonge le bras le moins avancé tant que l'un des deux ne couvre pas `need`.
  private ensure(need: number) {
    while (Math.min(last(this.forward).distance, -last(this.backward).distance) < need) {
      if (last(this.forward).distance <= -last(this.backward).distance) this.grow(1)
      else this.grow(-1)
    }
  }

  private grow(direction: 1 | -1) {
    const arm = direction > 0 ? this.forward : this.backward
    const from = last(arm)
    const fromHeading = direction > 0 ? this.headingForward : this.headingBackward
    const preferredTurn = this.wander2D(from.distance * WANDER_FREQUENCY, 0) * MAX_TURN_PER_SEGMENT
    const baseHeading = direction > 0 ? 0 : Math.PI
    const targetHeading =
      baseHeading +
      this.direction2D(from.distance * GLOBAL_DIRECTION_FREQUENCY, 0) * GLOBAL_DIRECTION_RANGE

    const step = this.chooseStep(
      from.position,
      fromHeading,
      from.distance,
      direction,
      preferredTurn,
      targetHeading,
    )

    if (
      (step.obstacle || this.waterAhead(from.position, fromHeading)) &&
      this.canBridge(from.distance, direction)
    ) {
      const deck = this.tryBridge(from, fromHeading, direction)
      if (deck) {
        for (const p of deck) {
          arm.push(p)
          this.record(p.position, p.distance)
        }
        this.lastBridge[direction > 0 ? 'forward' : 'backward'] = from.distance
        return
      }
    }

    const point: PathPoint = {
      position: step.position,
      distance: from.distance + direction * SEGMENT_LENGTH,
      bridge: false,
    }
    arm.push(point)
    this.record(point.position, point.distance)
    if (direction > 0) this.headingForward = step.heading
    else this.headingBackward = step.heading
  }

  private waterAhead(from: Vector3, heading: number): boolean {
    const waterLevel = getLandscapeParams().waterLevel
    const forwardX = Math.sin(heading)
    const forwardZ = -Math.cos(heading)
    for (let d = SEGMENT_LENGTH; d <= WATER_LOOKAHEAD; d += SEGMENT_LENGTH) {
      if (landscapeHeight(from.x + forwardX * d, from.z + forwardZ * d) < waterLevel) return true
    }
    return false
  }

  private canBridge(distance: number, direction: 1 | -1): boolean {
    const previous = this.lastBridge[direction > 0 ? 'forward' : 'backward']
    return Math.abs(distance - previous) >= getLandscapeParams().bridgeSpacing
  }

  // Tablier droit : le plus court qui enjambe l'obstacle, dans le cap courant
  // ou un cap voisin, avec une pente acceptable et un dégagement au-dessus de l'eau.
  private tryBridge(from: PathPoint, heading: number, direction: 1 | -1): PathPoint[] | null {
    const waterLevel = getLandscapeParams().waterLevel
    for (const offset of BRIDGE_HEADING_OFFSETS) {
      for (let segments = BRIDGE_MIN_SEGMENTS; segments <= BRIDGE_MAX_SEGMENTS; segments++) {
        const deck = this.deckOf(from, heading + offset, segments, direction, waterLevel)
        if (!deck) continue
        if (deck.some((p) => this.collides(p.position.x, p.position.z, p.distance))) continue
        return deck
      }
    }
    return null
  }

  private deckOf(
    from: PathPoint,
    heading: number,
    segments: number,
    direction: 1 | -1,
    waterLevel: number,
  ): PathPoint[] | null {
    const forwardX = Math.sin(heading)
    const forwardZ = -Math.cos(heading)
    const startX = from.position.x
    const startY = from.position.y
    const startZ = from.position.z
    const span = segments * SEGMENT_LENGTH
    const endY = landscapeHeight(startX + forwardX * span, startZ + forwardZ * span)
    if (endY < waterLevel) return null
    if (Math.abs(endY - startY) / span > MAX_GRADE) return null

    const deck: PathPoint[] = []
    for (let k = 1; k <= segments; k++) {
      const offset = k * SEGMENT_LENGTH
      const x = startX + forwardX * offset
      const z = startZ + forwardZ * offset
      const y = startY + (endY - startY) * (k / segments)
      const ground = landscapeHeight(x, z)
      const clips =
        k < segments && (ground < waterLevel ? y < waterLevel + WATER_CLEARANCE : y < ground)
      if (clips) return null
      deck.push({
        position: new Vector3(x, y, z),
        distance: from.distance + direction * offset,
        bridge: true,
      })
    }
    return deck
  }

  private chooseStep(
    from: Vector3,
    fromHeading: number,
    fromDistance: number,
    direction: 1 | -1,
    preferredTurn: number,
    targetHeading: number,
  ): Candidate {
    const narrow = this.bestCandidate(
      from,
      fromHeading,
      fromDistance,
      direction,
      preferredTurn,
      targetHeading,
      CANDIDATE_TURNS,
    )
    if (!narrow.obstacle) return narrow
    return this.bestCandidate(
      from,
      fromHeading,
      fromDistance,
      direction,
      preferredTurn,
      targetHeading,
      [...CANDIDATE_TURNS, ...AVOIDANCE_TURNS],
    )
  }

  private bestCandidate(
    from: Vector3,
    fromHeading: number,
    fromDistance: number,
    direction: 1 | -1,
    preferredTurn: number,
    targetHeading: number,
    turns: number[],
  ): Candidate {
    const distance = fromDistance + direction * SEGMENT_LENGTH
    const nextDistance = distance + direction * SEGMENT_LENGTH
    let best: Candidate | null = null

    for (const turn of turns) {
      const first = this.evaluate(from, fromHeading, turn, distance, preferredTurn, targetHeading)
      let future = Infinity
      for (const nextTurn of turns) {
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

    const underWater = y < getLandscapeParams().waterLevel
    const steep = Math.abs(slopeAlong) > MAX_GRADE

    const cost =
      Math.abs(slopeAlong) +
      LATERAL_WEIGHT * Math.abs(slopeAcross) +
      TURN_WEIGHT * Math.abs(turn - preferredTurn) +
      GLOBAL_DIRECTION_WEIGHT * Math.abs(angleDifference(heading, targetHeading)) +
      (steep ? STEEP_PENALTY : 0) +
      (underWater ? WATER_PENALTY : 0) +
      (this.collides(x, z, distance) ? COLLISION_PENALTY : 0)

    return { heading, position: new Vector3(x, y, z), cost, obstacle: underWater || steep }
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
