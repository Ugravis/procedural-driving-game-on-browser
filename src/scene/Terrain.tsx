import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { proceduralPath } from '../procgen/pathGenerator'
import { CHUNK_SIZE, RENDER_RADIUS_CHUNKS } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { ChunkGrass } from './ChunkGrass'
import { ChunkVegetation } from './ChunkVegetation'
import { TerrainChunk } from './TerrainChunk'

interface ChunkCoord {
  key: string
  chunkX: number
  chunkZ: number
}

// Version de chaque chunk : incrémentée quand du tracé nouveau le touche, pour
// que React le refasse avec la route complète.
const chunkVersions = new Map<string, number>()

function versionOf(chunkX: number, chunkZ: number): number {
  return chunkVersions.get(`${chunkX}:${chunkZ}`) ?? 0
}

function markChunksWithNewRoad(): boolean {
  const dirty = new Set<string>()
  for (const { x, z } of proceduralPath.drainNewSamples()) {
    const cx = Math.round(x / CHUNK_SIZE)
    const cz = Math.round(z / CHUNK_SIZE)
    for (let dz = -1; dz <= 1; dz++) {
      for (const dx of [-1, 0, 1]) dirty.add(`${cx + dx}:${cz + dz}`)
    }
  }
  for (const id of dirty) chunkVersions.set(id, (chunkVersions.get(id) ?? 0) + 1)
  return dirty.size > 0
}

function computeVisibleChunks(x: number, z: number, generation: number): ChunkCoord[] {
  const centerX = Math.round(x / CHUNK_SIZE)
  const centerZ = Math.round(z / CHUNK_SIZE)
  const chunks: ChunkCoord[] = []
  for (let dz = -RENDER_RADIUS_CHUNKS; dz <= RENDER_RADIUS_CHUNKS; dz++) {
    for (let dx = -RENDER_RADIUS_CHUNKS; dx <= RENDER_RADIUS_CHUNKS; dx++) {
      const chunkX = centerX + dx
      const chunkZ = centerZ + dz
      const version = versionOf(chunkX, chunkZ)
      chunks.push({
        key: `${generation}:${chunkX}:${chunkZ}:${version}`,
        chunkX,
        chunkZ,
      })
    }
  }
  return chunks
}

// Streaming par chunks : on ne recalcule l'ensemble visible que lorsque le
// joueur change de chunk, ou qu'un chunk visible reçoit du tracé nouveau.
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
    const roadChanged = markChunksWithNewRoad()
    if (!roadChanged && centerKey === lastCenterKey.current) return
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
      {visibleChunks.map(({ key, chunkX, chunkZ }) => (
        <ChunkGrass key={key} chunkX={chunkX} chunkZ={chunkZ} />
      ))}
    </>
  )
}
