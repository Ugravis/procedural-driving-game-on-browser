import { useEffect, useMemo } from 'react'
import { proceduralPath } from '../procgen/pathGenerator'
import { buildChunkGeometry, CHUNK_SIZE } from '../procgen/terrain'

interface TerrainChunkProps {
  chunkX: number
  chunkZ: number
}

export function TerrainChunk({ chunkX, chunkZ }: TerrainChunkProps) {
  const geometry = useMemo(
    () => buildChunkGeometry(chunkX, chunkZ, proceduralPath),
    [chunkX, chunkZ],
  )

  // Libère la géométrie GPU quand le chunk est déchargé (hors du rayon de rendu).
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh position={[chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE]} geometry={geometry}>
      <meshStandardMaterial color="#4a6b4a" />
    </mesh>
  )
}
