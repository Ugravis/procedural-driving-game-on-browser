import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { TubeGeometry, type Mesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

const ROAD_RADIUS = 1.2
const RADIAL_SEGMENTS = 8

function buildGeometry() {
  return new TubeGeometry(
    proceduralPath.getCurve(),
    Math.max(proceduralPath.pointCount * 2, 16),
    ROAD_RADIUS,
    RADIAL_SEGMENTS,
    false,
  )
}

// Rend le chemin généré par ProceduralPath sous forme de tube. La géométrie
// n'est reconstruite que lorsque le chemin a réellement changé (extension ou
// recyclage de points), pas à chaque frame, pour éviter du travail GPU inutile.
export function RoadPath() {
  const meshRef = useRef<Mesh>(null)
  const lastRevision = useRef(proceduralPath.revision)
  const initialGeometry = useMemo(buildGeometry, [])

  useFrame(() => {
    if (proceduralPath.revision === lastRevision.current) return
    lastRevision.current = proceduralPath.revision

    const mesh = meshRef.current
    if (mesh) {
      mesh.geometry.dispose()
      mesh.geometry = buildGeometry()
    }
    useGameStore.getState().setPathPointCount(proceduralPath.pointCount)
  })

  return (
    <mesh ref={meshRef} geometry={initialGeometry}>
      <meshStandardMaterial color="#3a3f44" />
    </mesh>
  )
}
