import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'

const DECK_OFFSET = 0.05 // m, léger décalage du tablier pour éviter le z-fighting avec le sol
const BRIDGE_COLOR = '#ff2bd6' // couleur très voyante, pour repérer les ponts pendant les tests

// Seuls les tabliers sont des maillages : le reste de la route est posé sur le
// terrain (roadSurface.ts). Chaque segment de tablier est un quad à hauteur réelle.
function buildDecks(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (const { a, b } of proceduralPath.bridgeSegments()) {
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz) || 1
    const rx = (-dz / length) * ROAD_HALF_WIDTH
    const rz = (dx / length) * ROAD_HALF_WIDTH
    const base = positions.length / 3
    positions.push(
      a.x - rx,
      a.y + DECK_OFFSET,
      a.z - rz,
      a.x + rx,
      a.y + DECK_OFFSET,
      a.z + rz,
      b.x - rx,
      b.y + DECK_OFFSET,
      b.z - rz,
      b.x + rx,
      b.y + DECK_OFFSET,
      b.z + rz,
    )
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

// La géométrie n'est reconstruite que lorsque le chemin a réellement changé.
export function BridgeDecks() {
  const meshRef = useRef<Mesh>(null)
  const lastRevision = useRef(proceduralPath.revision)
  const initial = useMemo(buildDecks, [])

  useFrame(() => {
    if (proceduralPath.revision === lastRevision.current) return
    lastRevision.current = proceduralPath.revision
    const mesh = meshRef.current
    if (mesh) {
      mesh.geometry.dispose()
      mesh.geometry = buildDecks()
    }
  })

  return (
    <mesh ref={meshRef} geometry={initial}>
      <meshStandardMaterial
        color={BRIDGE_COLOR}
        emissive={BRIDGE_COLOR}
        emissiveIntensity={0.5}
        side={DoubleSide}
      />
    </mesh>
  )
}
