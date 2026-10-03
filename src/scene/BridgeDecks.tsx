import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'

const DECK_OFFSET = 0.05 // m, léger décalage du tablier pour éviter le z-fighting avec le sol
const SAMPLES_PER_SEGMENT = 2
const BRIDGE_COLOR = '#ff2bd6' // couleur très voyante, pour repérer les ponts pendant les tests

// Seuls les tabliers sont des maillages : le reste de la route est peint dans
// le terrain. Chaque échantillon a deux sommets écartés de la demi-largeur de la
// route, perpendiculairement à la tangente en plan.
function buildDecks(): BufferGeometry {
  const curve = proceduralPath.getCurve()
  const points = proceduralPath.getWindow()
  const total = (points.length - 1) * SAMPLES_PER_SEGMENT

  const positions: number[] = []
  const indices: number[] = []

  for (let q = 0; q <= total; q++) {
    const t = q / total
    const p = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    const planLength = Math.hypot(tangent.x, tangent.z) || 1
    const rightX = -tangent.z / planLength
    const rightZ = tangent.x / planLength
    const y = p.y + DECK_OFFSET
    positions.push(
      p.x - rightX * ROAD_HALF_WIDTH,
      y,
      p.z - rightZ * ROAD_HALF_WIDTH,
      p.x + rightX * ROAD_HALF_WIDTH,
      y,
      p.z + rightZ * ROAD_HALF_WIDTH,
    )
    if (q < total && points[Math.floor(q / SAMPLES_PER_SEGMENT) + 1]!.bridge) {
      const a = q * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
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
