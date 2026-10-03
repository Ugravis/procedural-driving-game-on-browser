import { useEffect, useMemo } from 'react'
import { buildContourGeometry } from '../procgen/contours'
import { proceduralPath } from '../procgen/pathGenerator'
import { buildChunkGeometry, CHUNK_RESOLUTION, CHUNK_SIZE } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'

const CONTOUR_INTERVAL = 5 // m

interface TerrainChunkProps {
  chunkX: number
  chunkZ: number
}

export function TerrainChunk({ chunkX, chunkZ }: TerrainChunkProps) {
  const showContours = useGameStore((s) => s.settings.showContours)
  const geometry = useMemo(
    () => buildChunkGeometry(chunkX, chunkZ, proceduralPath),
    [chunkX, chunkZ],
  )
  const contours = useMemo(
    () =>
      showContours ? buildContourGeometry(geometry, CHUNK_RESOLUTION + 1, CONTOUR_INTERVAL) : null,
    [geometry, showContours],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => contours?.dispose(), [contours])

  const position: [number, number, number] = [chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE]

  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors />
      </mesh>
      {contours && (
        <lineSegments geometry={contours}>
          <lineBasicMaterial color="#c8d8ff" transparent opacity={0.55} />
        </lineSegments>
      )}
    </group>
  )
}
