import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

const SPEED_KMH = 27
const VEHICLE_LIFT = 0.5 // m, au-dessus de la route
const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

// Stand-in pour le futur véhicule (étape 5) : avance le long du chemin à vitesse
// constante et fait suivre la caméra derrière lui. À remplacer par le vrai
// contrôleur et la vraie caméra de poursuite.
export function PathPreviewVehicle() {
  const { camera } = useThree()
  const meshRef = useRef<Mesh>(null)
  const distanceRef = useRef(0)
  const generationRef = useRef(useGameStore.getState().generation)
  const fpsAccumulator = useRef({ frames: 0, elapsed: 0 })

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    if (state.generation !== generationRef.current) {
      generationRef.current = state.generation
      distanceRef.current = 0
    }

    const direction = state.settings.drivingReverse ? -1 : 1
    distanceRef.current += direction * (SPEED_KMH / 3.6) * delta

    proceduralPath.update(distanceRef.current)
    const { position, tangent: pathTangent } = proceduralPath.getPointAt(distanceRef.current)
    const tangent = pathTangent.clone().multiplyScalar(direction)
    const planLength = Math.hypot(tangent.x, tangent.z) || 1
    const forwardX = tangent.x / planLength
    const forwardZ = tangent.z / planLength
    const grade = (tangent.y / planLength) * 100
    const heading = Math.atan2(forwardX, -forwardZ) * RAD_TO_DEG

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
      SPEED_KMH,
      distanceRef.current,
      grade,
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
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
