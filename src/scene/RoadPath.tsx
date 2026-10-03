import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

const SURFACE_OFFSET = 0.05 // m, évite le z-fighting avec le terrain aplani
const SAMPLES_PER_POINT = 2

// Bande plate posée sur le tracé : pour chaque échantillon, deux sommets
// écartés de la demi-largeur de la route, perpendiculairement à la tangente
// en plan.
function buildRibbon(): BufferGeometry {
  const curve = proceduralPath.getCurve()
  const divisions = Math.max(proceduralPath.pointCount * SAMPLES_PER_POINT, 16)
  const samples = curve.getSpacedPoints(divisions)

  const positions: number[] = []
  const indices: number[] = []

  samples.forEach((p, i) => {
    const t = curve.getTangentAt(i / divisions)
    const planLength = Math.hypot(t.x, t.z) || 1
    const rightX = -t.z / planLength
    const rightZ = t.x / planLength
    const y = p.y + SURFACE_OFFSET
    positions.push(
      p.x - rightX * ROAD_HALF_WIDTH,
      y,
      p.z - rightZ * ROAD_HALF_WIDTH,
      p.x + rightX * ROAD_HALF_WIDTH,
      y,
      p.z + rightZ * ROAD_HALF_WIDTH,
    )
    if (i < divisions) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, b, c, b, d, c)
    }
  })

  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

// La géométrie n'est reconstruite que lorsque le chemin a réellement changé
// (extension ou recyclage de points), pas à chaque frame.
export function RoadPath() {
  const meshRef = useRef<Mesh>(null)
  const lastRevision = useRef(proceduralPath.revision)
  const initialGeometry = useMemo(buildRibbon, [])

  useFrame(() => {
    if (proceduralPath.revision === lastRevision.current) return
    lastRevision.current = proceduralPath.revision

    const mesh = meshRef.current
    if (mesh) {
      mesh.geometry.dispose()
      mesh.geometry = buildRibbon()
    }
    useGameStore.getState().setPathPointCount(proceduralPath.pointCount)
  })

  return (
    <mesh ref={meshRef} geometry={initialGeometry}>
      <meshStandardMaterial color="#3a3f44" side={DoubleSide} />
    </mesh>
  )
}
