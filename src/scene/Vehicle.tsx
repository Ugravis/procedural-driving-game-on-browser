import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'
import { heightAt } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { KeyboardControls } from '../vehicle/controls'
import { nextSpeed } from '../vehicle/physics'

const VEHICLE_LIFT = 0.5 // m, au-dessus du sol
const TURN_RATE = 1.2 // rad/s, braquage à pleine vitesse
const FULL_STEER_SPEED = 5 // m/s, en dessous le braquage est réduit
const ON_ROAD_DISTANCE = 30 // m, au-delà on considère qu'on a quitté la route
const GRADE_SAMPLE = 2 // m, distance d'échantillonnage de la pente devant
const RAD_TO_DEG = 180 / Math.PI
const MS_TO_KMH = 3.6

// Véhicule en conduite libre : position et cap, la hauteur vient du terrain.
// La route est un chemin praticable, pas un rail. Le tracé est généré jusqu'à
// la portion de route la plus proche, donc la route suit le joueur même s'il s'en écarte.
export function Vehicle() {
  const { camera } = useThree()
  const meshRef = useRef<Mesh>(null)
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

    p.speed = nextSpeed(p.speed, controls.throttle(), grade, delta)
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

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[1, 1, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
