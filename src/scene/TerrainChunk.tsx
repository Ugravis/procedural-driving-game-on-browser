import { useEffect, useMemo } from 'react'
import { buildContourGeometry } from '../procgen/contours'
import { proceduralPath } from '../procgen/pathGenerator'
import { buildRoadSurface } from '../procgen/roadSurface'
import { buildChunkGeometry, CHUNK_RESOLUTION, CHUNK_SIZE } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { terrainMaterial } from './seasons'

const CONTOUR_INTERVAL = 5 // m

interface TerrainChunkProps {
  chunkX: number
  chunkZ: number
}

export function TerrainChunk({ chunkX, chunkZ }: TerrainChunkProps) {
  const showContours = useGameStore((s) => s.settings.showContours)
  const lookMode = useGameStore((s) => s.settings.lookMode)
  const season = useGameStore((s) => s.settings.season)
  const geometry = useMemo(
    () => buildChunkGeometry(chunkX, chunkZ, proceduralPath),
    [chunkX, chunkZ],
  )
  const roadGeometry = useMemo(
    () => buildRoadSurface(chunkX, chunkZ, proceduralPath),
    [chunkX, chunkZ],
  )
  const contours = useMemo(
    () =>
      showContours ? buildContourGeometry(geometry, CHUNK_RESOLUTION + 1, CONTOUR_INTERVAL) : null,
    [geometry, showContours],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => roadGeometry.dispose(), [roadGeometry])
  useEffect(() => () => contours?.dispose(), [contours])

  const position: [number, number, number] = [chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE]

  return (
    <group position={position}>
      <mesh geometry={geometry} receiveShadow material={terrainMaterial(season, lookMode)} />
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#3a3f44" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {contours && (
        <lineSegments geometry={contours}>
          <lineBasicMaterial color="#c8d8ff" transparent opacity={0.55} />
        </lineSegments>
      )}
    </group>
  )
}
