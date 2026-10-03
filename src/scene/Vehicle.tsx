import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'
import { nextSpeed } from '../vehicle/physics'
import { KeyboardControls } from '../vehicle/controls'

const VEHICLE_LIFT = 0.5 // m, au-dessus de la route
const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180
const MS_TO_KMH = 3.6

// Véhicule posé sur le tracé : sa vitesse suit la physique (accélération, frein,
// pente, résistances) et il avance le long de la route. La caméra le suit.
export function Vehicle() {
  const { camera } = useThree()
  const meshRef = useRef<Mesh>(null)
  const distanceRef = useRef(0)
  const speedRef = useRef(0)
  const generationRef = useRef(useGameStore.getState().generation)
  const fpsAccumulator = useRef({ frames: 0, elapsed: 0 })
  const pathRevisionRef = useRef(-1)
  const controls = useRef(new KeyboardControls()).current

  useEffect(() => controls.attach(window), [controls])

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    if (state.generation !== generationRef.current) {
      generationRef.current = state.generation
      distanceRef.current = 0
      speedRef.current = 0
    }

    const reverseSign = state.settings.drivingReverse ? -1 : 1
    const throttle = controls.throttle() * reverseSign

    proceduralPath.update(distanceRef.current)
    const probe = proceduralPath.getPointAt(distanceRef.current)
    const planProbe = Math.hypot(probe.tangent.x, probe.tangent.z) || 1
    const grade = probe.tangent.y / planProbe

    speedRef.current = nextSpeed(speedRef.current, throttle, grade, delta)
    distanceRef.current += speedRef.current * delta

    proceduralPath.update(distanceRef.current)
    const { position, tangent: pathTangent } = proceduralPath.getPointAt(distanceRef.current)
    const travel = speedRef.current < -0.01 ? -1 : speedRef.current > 0.01 ? 1 : reverseSign
    const tangent = pathTangent.clone().multiplyScalar(travel)
    const planLength = Math.hypot(tangent.x, tangent.z) || 1
    const forwardX = tangent.x / planLength
    const forwardZ = tangent.z / planLength
    const travelGrade = (tangent.y / planLength) * 100
    const heading = Math.atan2(forwardX, -forwardZ) * RAD_TO_DEG

    if (pathRevisionRef.current !== proceduralPath.revision) {
      pathRevisionRef.current = proceduralPath.revision
      state.setPathPointCount(proceduralPath.pointCount)
    }

    const mesh = meshRef.current
    if (mesh) {
      const target = new Vector3(position.x, position.y + VEHICLE_LIFT, position.z)
      mesh.position.copy(target)
      mesh.lookAt(target.clone().add(tangent))

      const { cameraDistance, cameraHeight, cameraYaw } = state.settings
      const yaw = cameraYaw * DEG_TO_RAD
      const backX = -forwardX
      const backZ = -forwardZ
      const offsetX = backX * Math.cos(yaw) - backZ * Math.sin(yaw)
      const offsetZ = backX * Math.sin(yaw) + backZ * Math.cos(yaw)
      camera.position.set(
        target.x + offsetX * cameraDistance,
        target.y + cameraHeight,
        target.z + offsetZ * cameraDistance,
      )
      camera.lookAt(target)
    }

    state.setPlayerState(
      [position.x, position.y, position.z],
      Math.abs(speedRef.current) * MS_TO_KMH,
      distanceRef.current,
      travelGrade,
      heading,
    )

    const acc = fpsAccumulator.current
    acc.frames += 1
    acc.elapsed += delta
    if (acc.elapsed >= 0.5) {
      state.setFps(Math.round(acc.frames / acc.elapsed))
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
