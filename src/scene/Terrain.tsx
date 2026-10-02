import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { CHUNK_SIZE, RENDER_RADIUS_CHUNKS } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { ChunkVegetation } from './ChunkVegetation'
import { TerrainChunk } from './TerrainChunk'

interface ChunkCoord {
  key: string
  chunkX: number
  chunkZ: number
}

function computeVisibleChunks(x: number, z: number): ChunkCoord[] {
  const centerX = Math.round(x / CHUNK_SIZE)
  const centerZ = Math.round(z / CHUNK_SIZE)
  const chunks: ChunkCoord[] = []
  for (let dz = -RENDER_RADIUS_CHUNKS; dz <= RENDER_RADIUS_CHUNKS; dz++) {
    for (let dx = -RENDER_RADIUS_CHUNKS; dx <= RENDER_RADIUS_CHUNKS; dx++) {
      const chunkX = centerX + dx
      const chunkZ = centerZ + dz
      chunks.push({ key: `${chunkX}:${chunkZ}`, chunkX, chunkZ })
    }
  }
  return chunks
}

// Streaming par chunks : on ne recalcule l'ensemble visible que lorsque le
// joueur change de chunk (pas à chaque frame). React se charge de monter les
// nouveaux chunks et de démonter ceux qui sortent du rayon — chaque chunk
// libère sa géométrie dans son propre effet de nettoyage (TerrainChunk).
export function Terrain() {
  const [visibleChunks, setVisibleChunks] = useState<ChunkCoord[]>(() => computeVisibleChunks(0, 0))
  const lastCenterKey = useRef('0:0')

  useFrame(() => {
    const { position } = useGameStore.getState().player
    const centerX = Math.round(position[0] / CHUNK_SIZE)
    const centerZ = Math.round(position[2] / CHUNK_SIZE)
    const centerKey = `${centerX}:${centerZ}`
    if (centerKey === lastCenterKey.current) return
    lastCenterKey.current = centerKey
    setVisibleChunks(computeVisibleChunks(position[0], position[2]))
  })

  return (
    <>
      {visibleChunks.map(({ key, chunkX, chunkZ }) => (
        <TerrainChunk key={key} chunkX={chunkX} chunkZ={chunkZ} />
      ))}
      {visibleChunks.map(({ key, chunkX, chunkZ }) => (
        <ChunkVegetation key={key} chunkX={chunkX} chunkZ={chunkZ} />
      ))}
    </>
  )
}
