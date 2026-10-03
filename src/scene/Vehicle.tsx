import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Object3D, Vector3, type Group } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'
import { heightAt } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { KeyboardControls } from '../vehicle/controls'
import { nextSpeed } from '../vehicle/physics'

const CAR_WIDTH = 1.8 // m
const CAR_LENGTH = 4.2 // m
const WHEEL_RADIUS = 0.35 // m, l'origine du véhicule est au centre des roues
const WHEEL_WIDTH = 0.25 // m
const CHASSIS_BOTTOM = 0.2 // m, le châssis chevauche le haut des roues
const CHASSIS_HEIGHT = 0.5 // m
const CHASSIS_Y = CHASSIS_BOTTOM + CHASSIS_HEIGHT / 2
const CHASSIS_TOP = CHASSIS_BOTTOM + CHASSIS_HEIGHT
const CAB_LENGTH = 1.5 // m, cabine courte à l'avant
const CAB_WIDTH = 1.7 // m
const CAB_HEIGHT = 0.5 // m
const CAB_Z = 1.35 // m, centre de la cabine, au-dessus de l'essieu avant
const CAB_Y = CHASSIS_TOP + CAB_HEIGHT / 2
const BED_LENGTH = 2.6 // m, plateau arrière long et ouvert
const BED_Z = -0.8 // m, centre du plateau
const BED_FLOOR_Y = CHASSIS_TOP + 0.04
const BED_WALL_HEIGHT = 0.3 // m
const BED_WALL_THICKNESS = 0.06 // m
const LIGHT_Y = CHASSIS_Y // m, hauteur des feux
const VEHICLE_LIFT = WHEEL_RADIUS // m, origine au centre des roues, au-dessus du sol
const TURN_RATE = 1.2 // rad/s, braquage à pleine vitesse
const FULL_STEER_SPEED = 5 // m/s, en dessous le braquage est réduit
const ON_ROAD_DISTANCE = 30 // m, au-delà on considère qu'on a quitté la route
const GRADE_SAMPLE = 2 // m, distance d'échantillonnage de la pente devant
const RAD_TO_DEG = 180 / Math.PI
const WHEEL_POSITIONS: [number, number][] = [
  [CAR_WIDTH / 2 - 0.05, 1.45],
  [-(CAR_WIDTH / 2 - 0.05), 1.45],
  [CAR_WIDTH / 2 - 0.05, -1.45],
  [-(CAR_WIDTH / 2 - 0.05), -1.45],
]
const MS_TO_KMH = 3.6
const HEADLIGHT_OFF = 0.1
const HEADLIGHT_ON = 1.5
const BEAM_INTENSITY = 60 // candela, faisceau des projecteurs allumés
const BEAM_REACH = 80 // m
const BEAM_X = [0.6, -0.6]
const REARLIGHT_OFF = 0.2
const REARLIGHT_ON = 2

// Véhicule en conduite libre : position et cap, la hauteur vient du terrain.
// La route est un chemin praticable, pas un rail. Le tracé est généré jusqu'à
// la portion de route la plus proche, donc la route suit le joueur même s'il s'en écarte.
export function Vehicle() {
  const { camera } = useThree()
  const meshRef = useRef<Group>(null)
  const pose = useRef({ x: 0, z: 0, heading: 0, speed: 0, odometer: 0, horizon: 0 })
  const placeAtStart = () => {
    const spawn = proceduralPath.findSpawn()
    Object.assign(pose.current, {
      x: spawn.x,
      z: spawn.z,
      heading: spawn.heading,
      speed: 0,
      odometer: 0,
      horizon: spawn.arc,
    })
  }
  const generationRef = useRef(useGameStore.getState().generation)
  const fpsAccumulator = useRef({ frames: 0, elapsed: 0 })
  const controls = useRef(new KeyboardControls()).current

  useEffect(() => controls.attach(window), [controls])
  useEffect(placeAtStart, [])

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    const p = pose.current
    if (state.teleportTarget) {
      p.x = state.teleportTarget.x
      p.z = state.teleportTarget.z
      p.speed = 0
      state.consumeTeleport()
    }
    if (state.generation !== generationRef.current) {
      generationRef.current = state.generation
      placeAtStart()
    }

    const sinHeading = Math.sin(p.heading)
    const cosHeading = Math.cos(p.heading)
    const here = heightAt(p.x, p.z, proceduralPath)
    const ahead = heightAt(
      p.x + sinHeading * GRADE_SAMPLE,
      p.z - cosHeading * GRADE_SAMPLE,
      proceduralPath,
    )
    const grade = (ahead - here) / GRADE_SAMPLE

    if (controls.consumeLightsToggle()) state.toggleLights()
    if (controls.consumeHandbrakeToggle()) state.toggleHandbrake()
    const { handbrake } = useGameStore.getState()
    const throttle = handbrake ? 0 : controls.throttle()
    p.speed = nextSpeed(p.speed, throttle, grade, delta, handbrake)
    const braking = handbrake || throttle < 0
    if (useGameStore.getState().braking !== braking) state.setBraking(braking)
    if (Math.abs(p.speed) > 0.01) {
      const turnAuthority = Math.min(Math.abs(p.speed) / FULL_STEER_SPEED, 1)
      p.heading += controls.steer() * TURN_RATE * turnAuthority * Math.sign(p.speed) * delta
    }
    const moveX = Math.sin(p.heading)
    const moveZ = -Math.cos(p.heading)
    p.x += moveX * p.speed * delta
    p.z += moveZ * p.speed * delta
    p.odometer += Math.abs(p.speed) * delta

    const road = proceduralPath.roadAt(p.x, p.z)
    if (road.distance < ON_ROAD_DISTANCE) p.horizon = road.arc
    proceduralPath.update(p.horizon)

    const groundY =
      road.bridge && road.distance < ROAD_HALF_WIDTH + 0.5
        ? road.height
        : heightAt(p.x, p.z, proceduralPath)
    const target = new Vector3(p.x, groundY + VEHICLE_LIFT, p.z)

    const mesh = meshRef.current
    if (mesh) {
      mesh.position.copy(target)
      mesh.lookAt(target.x + moveX, target.y, target.z + moveZ)

      const { cameraDistance, cameraHeight, cameraYaw } = state.settings
      const yaw = (cameraYaw * Math.PI) / 180
      const backX = -moveX
      const backZ = -moveZ
      const offsetX = backX * Math.cos(yaw) - backZ * Math.sin(yaw)
      const offsetZ = backX * Math.sin(yaw) + backZ * Math.cos(yaw)
      camera.position.set(
        target.x + offsetX * cameraDistance,
        target.y + cameraHeight,
        target.z + offsetZ * cameraDistance,
      )
      camera.lookAt(target)
    }

    const headingDeg = (((p.heading * RAD_TO_DEG) % 360) + 360) % 360
    state.setPlayerState(
      [p.x, groundY, p.z],
      Math.abs(p.speed) * MS_TO_KMH,
      p.odometer,
      grade * 100 * Math.sign(p.speed || 1),
      headingDeg,
    )

    const acc = fpsAccumulator.current
    acc.frames += 1
    acc.elapsed += delta
    if (acc.elapsed >= 0.5) {
      state.setFps(Math.round(acc.frames / acc.elapsed))
      state.setPathPointCount(proceduralPath.pointCount)
      acc.frames = 0
      acc.elapsed = 0
    }
  })

  const lightsOn = useGameStore((s) => s.lightsOn)
  const braking = useGameStore((s) => s.braking)
  const headlight = lightsOn ? HEADLIGHT_ON : HEADLIGHT_OFF
  const beamTargets = useMemo(() => BEAM_X.map(() => new Object3D()), [])
  const rearlight = lightsOn || braking ? REARLIGHT_ON : REARLIGHT_OFF

  return (
    <group ref={meshRef}>
      <mesh castShadow position={[0, CHASSIS_Y, 0]}>
        <boxGeometry args={[CAR_WIDTH, CHASSIS_HEIGHT, CAR_LENGTH]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <mesh castShadow position={[0, CAB_Y, CAB_Z]}>
        <boxGeometry args={[CAB_WIDTH, CAB_HEIGHT, CAB_LENGTH]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <mesh position={[0, CAB_Y + 0.05, CAB_Z + CAB_LENGTH / 2 - 0.1]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[CAB_WIDTH - 0.2, CAB_HEIGHT * 0.8, 0.02]} />
        <meshStandardMaterial color="#2b3a42" />
      </mesh>
      <mesh position={[0, BED_FLOOR_Y, BED_Z]} castShadow>
        <boxGeometry args={[CAR_WIDTH - 2 * BED_WALL_THICKNESS, 0.08, BED_LENGTH]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {[1, -1].map((side) => (
        <mesh
          key={`bed-side-${side}`}
          castShadow
          position={[
            side * (CAR_WIDTH / 2 - BED_WALL_THICKNESS / 2),
            BED_FLOOR_Y + BED_WALL_HEIGHT / 2,
            BED_Z,
          ]}
        >
          <boxGeometry args={[BED_WALL_THICKNESS, BED_WALL_HEIGHT, BED_LENGTH]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      ))}
      <mesh castShadow position={[0, BED_FLOOR_Y + BED_WALL_HEIGHT / 2, BED_Z - BED_LENGTH / 2]}>
        <boxGeometry
          args={[CAR_WIDTH - 2 * BED_WALL_THICKNESS, BED_WALL_HEIGHT, BED_WALL_THICKNESS]}
        />
        <meshStandardMaterial color="orange" />
      </mesh>
      {WHEEL_POSITIONS.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12]} />
          <meshStandardMaterial color="#1e1e1e" />
        </mesh>
      ))}
      {BEAM_X.map((x, i) => (
        <group key={`beam-${x}`}>
          <spotLight
            position={[x, LIGHT_Y, CAR_LENGTH / 2]}
            target={beamTargets[i]!}
            intensity={lightsOn ? BEAM_INTENSITY : 0}
            angle={0.45}
            penumbra={0.5}
            distance={BEAM_REACH}
            decay={1.5}
            color="#fff3d0"
          />
          <primitive object={beamTargets[i]!} position={[x, 0, BEAM_REACH / 2]} />
        </group>
      ))}
      {BEAM_X.map((x) => (
        <mesh key={`head-${x}`} position={[x, LIGHT_Y, CAR_LENGTH / 2 + 0.01]}>
          <boxGeometry args={[0.3, 0.15, 0.02]} />
          <meshStandardMaterial color="#fff6c8" emissive="#fff6c8" emissiveIntensity={headlight} />
        </mesh>
      ))}
      {BEAM_X.map((x) => (
        <mesh key={`tail-${x}`} position={[x, LIGHT_Y, -CAR_LENGTH / 2 - 0.01]}>
          <boxGeometry args={[0.3, 0.15, 0.02]} />
          <meshStandardMaterial color="#c81e1e" emissive="#ff1a1a" emissiveIntensity={rearlight} />
        </mesh>
      ))}
    </group>
  )
}
