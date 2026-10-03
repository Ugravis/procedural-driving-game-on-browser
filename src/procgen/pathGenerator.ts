import { createNoise2D, type NoiseFunction2D } from 'simplex-noise'
import { Vector3 } from 'three'
import { getLandscapeParams, landscapeHeight } from './landscape'
import { createRandom } from './random'

export const ROAD_HALF_WIDTH = 1.2 // m, demi-largeur de la route (rendu et aplanissement du terrain)

const SEGMENT_LENGTH = 10 // m, distance entre deux points de contrôle
const SUBSAMPLES = 4 // échantillons de courbe par segment de contrôle
const GENERATION_MARGIN = 800 // m, tracé généré au-delà de la position courante, dans les deux sens
const MAX_TURN_PER_SEGMENT = 0.35 // rad, virage max d'un segment à l'autre
const CANDIDATE_TURNS = [-0.7, -0.5, -0.35, -0.2, -0.1, 0, 0.1, 0.2, 0.35, 0.5, 0.7] // rad, caps testés à chaque segment
const AVOIDANCE_TURNS = [-1.3, -1.1, -0.9, 0.9, 1.1, 1.3] // rad, virages supplémentaires pour contourner un obstacle
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
const WATER_LOOKAHEAD = 120 // m, distance regardée devant pour anticiper un lac
const BRIDGE_MIN_SEGMENTS = 3 // segments, ~30 m
const BRIDGE_MAX_SEGMENTS = 30 // segments, ~300 m
const BRIDGE_HEADING_OFFSETS = [0, 0.1, -0.1, 0.2, -0.2, 0.3, -0.3] // rad, caps testés pour un tablier
const WATER_CLEARANCE = 1.5 // m, hauteur minimale du tablier au-dessus de l'eau

const WANDER_SALT = 1
const DIRECTION_SALT = 2

const TWO_PI = Math.PI * 2

export interface ControlPoint {
  position: Vector3
  bridge: boolean // vrai si le segment qui arrive à ce point est un tablier
}

export interface Sample {
  x: number
  y: number
  z: number
  bridge: boolean // vrai si le segment qui part de cet échantillon est un tablier
}

export interface RoadSegment {
  a: Sample
  b: Sample
}

interface Candidate {
  heading: number
  position: Vector3
  cost: number
  obstacle: boolean // eau ou pente au point candidat
}

interface Visited {
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

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / GRID_CELL)}:${Math.floor(z / GRID_CELL)}`
}

// Le tracé est généré dans les deux sens à partir de l'origine, par pas
// synchronisés : un pas ne dépend que de ce qui est déjà généré, donc un même
// couple (graine, distance) donne toujours le même tracé. Tout le tracé généré
// reste disponible : la route peut être interrogée en n'importe quel point.
export class ProceduralPath {
  private wander2D!: NoiseFunction2D
  private direction2D!: NoiseFunction2D
  private forward: ControlPoint[] = [] // forward[i] à la distance +i * SEGMENT_LENGTH
  private backward: ControlPoint[] = [] // backward[i] à la distance -i * SEGMENT_LENGTH
  private headingForward = 0
  private headingBackward = Math.PI
  private lastBridge = { forward: -Infinity, backward: -Infinity }
  private visited = new Map<string, Visited[]>()
  private samples = new Map<number, Sample>() // indexé par distance / SAMPLE_SPACING
  private sampleCells = new Map<string, number[]>()
  private newSamples: { x: number; z: number }[] = []
  private segmentLow = 0 // plus petit segment de contrôle échantillonné
  private segmentHigh = -1 // plus grand segment de contrôle échantillonné
  revision = 0

  constructor(seed: number) {
    this.reset(seed)
  }

  reset(seed: number) {
    this.wander2D = createNoise2D(createRandom(seed + WANDER_SALT))
    this.direction2D = createNoise2D(createRandom(seed + DIRECTION_SALT))
    const origin: ControlPoint = {
      position: new Vector3(0, landscapeHeight(0, 0), 0),
      bridge: false,
    }
    this.forward = [origin]
    this.backward = [origin]
    this.headingForward = 0
    this.headingBackward = Math.PI
    this.lastBridge = { forward: -Infinity, backward: -Infinity }
    this.visited = new Map()
    this.recordVisited(origin.position, 0)
    this.samples = new Map()
    this.sampleCells = new Map()
    this.newSamples = []
    this.segmentLow = 0
    this.segmentHigh = -1
    this.addSample(0, origin.position, false)
    this.revision++
    this.update(0)
  }

  /** À appeler une fois par frame avec la distance signée courante. */
  update(currentDistance: number) {
    const count = Math.ceil((Math.abs(currentDistance) + GENERATION_MARGIN) / SEGMENT_LENGTH) + 2
    if (this.ensure(count)) this.revision++
  }

  /** Points de route générés depuis le dernier appel : les zones du terrain qui les touchent doivent être refaites. */
  drainNewSamples(): { x: number; z: number }[] {
    const drained = this.newSamples
    this.newSamples = []
    return drained
  }

  get pointCount() {
    return this.forward.length + this.backward.length - 1
  }

  /**
   * Altitude de la route à la projection de (x, z), distance planaire à la
   * route, et vrai si la projection tombe sur un tablier. Vaut Infinity si la
   * route n'est pas dans les environs.
   */
  roadAt(x: number, z: number): { height: number; distance: number; bridge: boolean } {
    let bestDistSq = Infinity
    let height = 0
    let bridge = false
    const cx = Math.floor(x / GRID_CELL)
    const cz = Math.floor(z / GRID_CELL)
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        for (const index of this.sampleCells.get(`${i}:${j}`) ?? []) {
          const a = this.samples.get(index)!
          const b = this.samples.get(index + 1)
          if (!b) continue
          const abx = b.x - a.x
          const abz = b.z - a.z
          const lengthSq = abx * abx + abz * abz
          const t =
            lengthSq > 0
              ? Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0), 1)
              : 0
          const dx = a.x + abx * t - x
          const dz = a.z + abz * t - z
          const distSq = dx * dx + dz * dz
          if (distSq < bestDistSq) {
            bestDistSq = distSq
            height = a.y + (b.y - a.y) * t
            bridge = a.bridge && b.bridge
          }
        }
      }
    }
    return { height, distance: Math.sqrt(bestDistSq), bridge }
  }

  /** Segments de route (hors tabliers) dont au moins une extrémité touche la zone. */
  segmentsIn(minX: number, maxX: number, minZ: number, maxZ: number): RoadSegment[] {
    const indices = new Set<number>()
    for (let i = Math.floor(minX / GRID_CELL); i <= Math.floor(maxX / GRID_CELL); i++) {
      for (let j = Math.floor(minZ / GRID_CELL); j <= Math.floor(maxZ / GRID_CELL); j++) {
        for (const index of this.sampleCells.get(`${i}:${j}`) ?? []) {
          indices.add(index - 1)
          indices.add(index)
        }
      }
    }
    const segments: RoadSegment[] = []
    for (const index of indices) {
      const a = this.samples.get(index)
      const b = this.samples.get(index + 1)
      if (!a || !b || (a.bridge && b.bridge)) continue
      segments.push({ a, b })
    }
    return segments
  }

  /** Tous les segments de tablier générés. */
  bridgeSegments(): RoadSegment[] {
    const segments: RoadSegment[] = []
    for (const [index, a] of this.samples) {
      const b = this.samples.get(index + 1)
      if (b && a.bridge && b.bridge) segments.push({ a, b })
    }
    return segments
  }

  /** Position et tangente du tracé à la distance signée donnée (même spline que les échantillons). */
  getPointAt(distance: number): { position: Vector3; tangent: Vector3 } {
    const k = Math.floor(distance / SEGMENT_LENGTH)
    const u = distance / SEGMENT_LENGTH - k
    return this.spline(k, u)
  }

  // Spline de Catmull-Rom uniforme entre les points de contrôle k et k+1.
  private spline(k: number, u: number): { position: Vector3; tangent: Vector3 } {
    const p0 = this.control(k - 1).position
    const p1 = this.control(k).position
    const p2 = this.control(k + 1).position
    const p3 = this.control(k + 2).position
    const u2 = u * u
    const u3 = u2 * u
    const position = new Vector3()
    const tangent = new Vector3()
    for (const axis of ['x', 'y', 'z'] as const) {
      const a = p0[axis]
      const b = p1[axis]
      const c = p2[axis]
      const d = p3[axis]
      const c1 = -a + c
      const c2 = 2 * a - 5 * b + 4 * c - d
      const c3 = -a + 3 * b - 3 * c + d
      position[axis] = 0.5 * (2 * b + c1 * u + c2 * u2 + c3 * u3)
      tangent[axis] = 0.5 * (c1 + 2 * c2 * u + 3 * c3 * u2)
    }
    return { position, tangent }
  }

  private control(index: number): ControlPoint {
    if (index >= 0) return this.forward[Math.min(index, this.forward.length - 1)]!
    return this.backward[Math.min(-index, this.backward.length - 1)]!
  }

  private addSample(index: number, position: Vector3, bridge: boolean) {
    this.samples.set(index, { x: position.x, y: position.y, z: position.z, bridge })
    this.newSamples.push({ x: position.x, z: position.z })
    const key = cellKey(position.x, position.z)
    const cell = this.sampleCells.get(key)
    if (cell) cell.push(index)
    else this.sampleCells.set(key, [index])
  }

  // Échantillonne les segments de contrôle dont la spline est entièrement connue.
  private sampleSegments() {
    while (this.segmentHigh < this.forward.length - 3) {
      this.segmentHigh++
      this.sampleSegment(this.segmentHigh)
    }
    while (this.segmentLow > -this.backward.length + 2) {
      this.segmentLow--
      this.sampleSegment(this.segmentLow)
    }
  }

  private sampleSegment(k: number) {
    const bridge = this.control(k).bridge && this.control(k + 1).bridge
    const offsets = k >= 0 ? [1, 2, 3, 4] : [0, 1, 2, 3]
    for (const m of offsets) {
      const index = SUBSAMPLES * k + m
      const { position } = this.spline(k, m / SUBSAMPLES)
      this.addSample(index, position, bridge)
    }
  }

  // Prolonge les deux bras jusqu'à `count` points de contrôle. Retourne vrai si le tracé a grandi.
  private ensure(count: number): boolean {
    let grew = false
    while (this.forward.length <= count) {
      this.grow(1)
      this.grow(-1)
      grew = true
    }
    if (grew) this.sampleSegments()
    return grew
  }

  private grow(direction: 1 | -1) {
    const arm = direction > 0 ? this.forward : this.backward
    const from = last(arm)
    const fromDistance = direction * (arm.length - 1) * SEGMENT_LENGTH
    const fromHeading = direction > 0 ? this.headingForward : this.headingBackward
    const preferredTurn = this.wander2D(fromDistance * WANDER_FREQUENCY, 0) * MAX_TURN_PER_SEGMENT
    const baseHeading = direction > 0 ? 0 : Math.PI
    const targetHeading =
      baseHeading +
      this.direction2D(fromDistance * GLOBAL_DIRECTION_FREQUENCY, 0) * GLOBAL_DIRECTION_RANGE

    const step = this.chooseStep(
      from.position,
      fromHeading,
      fromDistance,
      direction,
      preferredTurn,
      targetHeading,
    )

    if (
      (step.obstacle || this.waterAhead(from.position, fromHeading)) &&
      this.canBridge(fromDistance, direction)
    ) {
      const deck = this.tryBridge(from.position, fromHeading, direction, fromDistance)
      if (deck) {
        deck.forEach((p, i) => {
          arm.push(p)
          this.recordVisited(p.position, fromDistance + direction * (i + 1) * SEGMENT_LENGTH)
        })
        this.lastBridge[direction > 0 ? 'forward' : 'backward'] = fromDistance
        return
      }
    }

    const point: ControlPoint = { position: step.position, bridge: false }
    arm.push(point)
    this.recordVisited(point.position, fromDistance + direction * SEGMENT_LENGTH)
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
  private tryBridge(
    from: Vector3,
    heading: number,
    direction: 1 | -1,
    fromDistance: number,
  ): ControlPoint[] | null {
    const waterLevel = getLandscapeParams().waterLevel
    for (const offset of BRIDGE_HEADING_OFFSETS) {
      for (let segments = BRIDGE_MIN_SEGMENTS; segments <= BRIDGE_MAX_SEGMENTS; segments++) {
        const deck = this.deckOf(from, heading + offset, segments, waterLevel)
        if (!deck) continue
        const distances = deck.map((_, i) => fromDistance + direction * (i + 1) * SEGMENT_LENGTH)
        if (
          deck.some((_, i) =>
            this.collides(deck[i]!.position.x, deck[i]!.position.z, distances[i]!),
          )
        )
          continue
        return deck
      }
    }
    return null
  }

  private deckOf(
    from: Vector3,
    heading: number,
    segments: number,
    waterLevel: number,
  ): ControlPoint[] | null {
    const forwardX = Math.sin(heading)
    const forwardZ = -Math.cos(heading)
    const span = segments * SEGMENT_LENGTH
    const endY = landscapeHeight(from.x + forwardX * span, from.z + forwardZ * span)
    if (endY < waterLevel) return null
    if (Math.abs(endY - from.y) / span > MAX_GRADE) return null

    const deck: ControlPoint[] = []
    for (let k = 1; k <= segments; k++) {
      const offset = k * SEGMENT_LENGTH
      const x = from.x + forwardX * offset
      const z = from.z + forwardZ * offset
      const y = from.y + (endY - from.y) * (k / segments)
      const ground = landscapeHeight(x, z)
      const clips =
        k < segments && (ground < waterLevel ? y < waterLevel + WATER_CLEARANCE : y < ground)
      if (clips) return null
      deck.push({ position: new Vector3(x, y, z), bridge: true })
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

  private recordVisited(position: Vector3, distance: number) {
    const key = cellKey(position.x, position.z)
    const visited: Visited = { x: position.x, z: position.z, distance }
    const cell = this.visited.get(key)
    if (cell) cell.push(visited)
    else this.visited.set(key, [visited])
  }

  private collides(x: number, z: number, distance: number): boolean {
    const cx = Math.floor(x / GRID_CELL)
    const cz = Math.floor(z / GRID_CELL)
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cz - 1; j <= cz + 1; j++) {
        for (const visited of this.visited.get(`${i}:${j}`) ?? []) {
          if (Math.abs(visited.distance - distance) <= MIN_SEPARATION) continue
          const dx = visited.x - x
          const dz = visited.z - z
          if (dx * dx + dz * dz < CLEARANCE * CLEARANCE) return true
        }
      }
    }
    return false
  }
}

export const proceduralPath = new ProceduralPath(0)
