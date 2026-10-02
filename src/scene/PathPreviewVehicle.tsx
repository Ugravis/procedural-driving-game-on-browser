import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Mesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

// Stand-in pour le futur véhicule (étape 5) : avance le long du chemin généré
// à une vitesse simulée. Sert à valider visuellement la génération procédurale
// (le chemin doit s'étendre devant et se recycler derrière sans à-coup) et à
// alimenter le store en attendant le vrai contrôleur. Fait aussi suivre la
// caméra (sans lissage, juste pour pouvoir observer le chemin défiler) : la
// vraie caméra de poursuite arrive à l'étape 5. À retirer à ce moment-là.
export function PathPreviewVehicle() {
  const { camera } = useThree()
  const meshRef = useRef<Mesh>(null)
  const distanceRef = useRef(0)
  const fpsAccumulator = useRef({ frames: 0, elapsed: 0 })

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    const speed = 20 + Math.sin(elapsed * 0.3) * 12 // km/h, démo
    distanceRef.current += (speed / 3.6) * delta // km/h -> m/s

    proceduralPath.update(distanceRef.current)
    const { position, tangent } = proceduralPath.getPointAt(distanceRef.current)

    const mesh = meshRef.current
    if (mesh) {
      mesh.position.set(position.x, position.y + 0.5, position.z)
      mesh.lookAt(new Vector3(position.x, position.y + 0.5, position.z).add(tangent))
      camera.position.set(mesh.position.x, mesh.position.y + 3, mesh.position.z + 8)
      camera.lookAt(mesh.position)
    }

    useGameStore
      .getState()
      .setPlayerState([position.x, position.y, position.z], speed, distanceRef.current)

    const acc = fpsAccumulator.current
    acc.frames += 1
    acc.elapsed += delta
    if (acc.elapsed >= 0.5) {
      useGameStore.getState().setFps(Math.round(acc.frames / acc.elapsed))
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
