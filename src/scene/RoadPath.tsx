import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Mesh } from 'three'
import { proceduralPath, ROAD_HALF_WIDTH } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

const SURFACE_OFFSET = 0.05 // m, évite le z-fighting avec le terrain aplani
const SAMPLES_PER_SEGMENT = 2
const ROAD_COLOR = '#3a3f44'
const BRIDGE_COLOR = '#ff2bd6' // couleur très voyante, pour repérer les ponts pendant les tests

interface RibbonGeometries {
  road: BufferGeometry
  bridge: BufferGeometry
}

// Bande plate posée sur le tracé : pour chaque échantillon, deux sommets
// écartés de la demi-largeur de la route, perpendiculairement à la tangente
// en plan. Les triangles d'un segment de tablier vont dans une géométrie à part.
function buildRibbons(): RibbonGeometries {
  const curve = proceduralPath.getCurve()
  const points = proceduralPath.getWindow()
  const segments = points.length - 1
  const total = segments * SAMPLES_PER_SEGMENT

  const positions: number[] = []
  const roadIndices: number[] = []
  const bridgeIndices: number[] = []

  for (let q = 0; q <= total; q++) {
    const t = q / total
    const p = curve.getPoint(t)
    const tangent = curve.getTangent(t)
    const planLength = Math.hypot(tangent.x, tangent.z) || 1
    const rightX = -tangent.z / planLength
    const rightZ = tangent.x / planLength
    const y = p.y + SURFACE_OFFSET
    positions.push(
      p.x - rightX * ROAD_HALF_WIDTH,
      y,
      p.z - rightZ * ROAD_HALF_WIDTH,
      p.x + rightX * ROAD_HALF_WIDTH,
      y,
      p.z + rightZ * ROAD_HALF_WIDTH,
    )
    if (q < total) {
      const a = q * 2
      const target = points[Math.floor(q / SAMPLES_PER_SEGMENT) + 1]!.bridge
        ? bridgeIndices
        : roadIndices
      target.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }

  return {
    road: toGeometry(positions, roadIndices),
    bridge: toGeometry(positions, bridgeIndices),
  }
}

function toGeometry(positions: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

// La géométrie n'est reconstruite que lorsque le chemin a réellement changé
// (extension ou recyclage de points), pas à chaque frame.
export function RoadPath() {
  const roadRef = useRef<Mesh>(null)
  const bridgeRef = useRef<Mesh>(null)
  const lastRevision = useRef(proceduralPath.revision)
  const initial = useMemo(buildRibbons, [])

  useFrame(() => {
    if (proceduralPath.revision === lastRevision.current) return
    lastRevision.current = proceduralPath.revision

    const next = buildRibbons()
    if (roadRef.current) {
      roadRef.current.geometry.dispose()
      roadRef.current.geometry = next.road
    }
    if (bridgeRef.current) {
      bridgeRef.current.geometry.dispose()
      bridgeRef.current.geometry = next.bridge
    }
    useGameStore.getState().setPathPointCount(proceduralPath.pointCount)
  })

  return (
    <>
      <mesh ref={roadRef} geometry={initial.road}>
        <meshStandardMaterial color={ROAD_COLOR} side={DoubleSide} />
      </mesh>
      <mesh ref={bridgeRef} geometry={initial.bridge}>
        <meshStandardMaterial
          color={BRIDGE_COLOR}
          emissive={BRIDGE_COLOR}
          emissiveIntensity={0.5}
          side={DoubleSide}
        />
      </mesh>
    </>
  )
}
