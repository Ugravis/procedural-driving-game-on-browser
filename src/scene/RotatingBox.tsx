import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

// Placeholder temporaire pour vérifier visuellement que la boucle de rendu
// (useFrame + delta time) tourne. À retirer une fois le véhicule/terrain en place.
export function RotatingBox() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.rotation.x += delta
    mesh.rotation.y += delta * 0.6
  })

  return (
    <mesh ref={meshRef} position={[0, 1, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}
