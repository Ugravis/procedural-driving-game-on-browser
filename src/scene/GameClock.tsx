import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useGameStore } from '../state/gameStore'

// Alimente le store avec une position/vitesse simulées, en attendant le vrai
// contrôleur de véhicule (étape 5). Ne rend rien : composant logique pur.
export function GameClock() {
  const fpsAccumulator = useRef({ frames: 0, elapsed: 0 })

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    const speed = 20 + Math.sin(elapsed * 0.5) * 15
    const position: [number, number, number] = [0, 1, elapsed * 2]
    useGameStore.getState().setPlayerState(position, speed)

    const acc = fpsAccumulator.current
    acc.frames += 1
    acc.elapsed += delta
    if (acc.elapsed >= 0.5) {
      useGameStore.getState().setFps(Math.round(acc.frames / acc.elapsed))
      acc.frames = 0
      acc.elapsed = 0
    }
  })

  return null
}
