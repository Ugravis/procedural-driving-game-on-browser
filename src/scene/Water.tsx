import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { CHUNK_SIZE, RENDER_RADIUS_CHUNKS } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'

const EXTENT = (2 * RENDER_RADIUS_CHUNKS + 1) * CHUNK_SIZE

// Plan d'eau unique : le niveau est global, donc une seule surface plane suffit.
// Elle suit le joueur par pas de chunk, et le relief qui dépasse la masque.
export function Water() {
  const meshRef = useRef<Mesh>(null)
  const level = useGameStore((s) => s.landscape.waterLevel)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const [x, , z] = useGameStore.getState().player.position
    mesh.position.x = Math.round(x / CHUNK_SIZE) * CHUNK_SIZE
    mesh.position.z = Math.round(z / CHUNK_SIZE) * CHUNK_SIZE
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]}>
      <planeGeometry args={[EXTENT, EXTENT]} />
      <meshStandardMaterial color="#2a6f97" transparent opacity={0.85} roughness={0.2} />
    </mesh>
  )
}
