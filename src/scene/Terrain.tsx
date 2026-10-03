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

function computeVisibleChunks(x: number, z: number, generation: number): ChunkCoord[] {
  const centerX = Math.round(x / CHUNK_SIZE)
  const centerZ = Math.round(z / CHUNK_SIZE)
  const chunks: ChunkCoord[] = []
  for (let dz = -RENDER_RADIUS_CHUNKS; dz <= RENDER_RADIUS_CHUNKS; dz++) {
    for (let dx = -RENDER_RADIUS_CHUNKS; dx <= RENDER_RADIUS_CHUNKS; dx++) {
      const chunkX = centerX + dx
      const chunkZ = centerZ + dz
      chunks.push({ key: `${generation}:${chunkX}:${chunkZ}`, chunkX, chunkZ })
    }
  }
  return chunks
}

// Streaming par chunks : on ne recalcule l'ensemble visible que lorsque le
// joueur change de chunk ou que le relief est régénéré (la génération fait
// partie de la clé de chaque chunk, donc React remonte tout le terrain).
export function Terrain() {
  const [visibleChunks, setVisibleChunks] = useState<ChunkCoord[]>(() =>
    computeVisibleChunks(0, 0, useGameStore.getState().generation),
  )
  const lastCenterKey = useRef('')

  useFrame(() => {
    const { player, generation } = useGameStore.getState()
    const centerX = Math.round(player.position[0] / CHUNK_SIZE)
    const centerZ = Math.round(player.position[2] / CHUNK_SIZE)
    const centerKey = `${generation}:${centerX}:${centerZ}`
    if (centerKey === lastCenterKey.current) return
    lastCenterKey.current = centerKey
    setVisibleChunks(computeVisibleChunks(player.position[0], player.position[2], generation))
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
