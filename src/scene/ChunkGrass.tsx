import { useEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import { scatterGrass } from '../procgen/grass'
import { proceduralPath } from '../procgen/pathGenerator'
import { CHUNK_SIZE } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { grassGeometry, grassMaterial } from './grassBillboard'

const dummy = new Object3D()

interface ChunkGrassProps {
  chunkX: number
  chunkZ: number
}

// Une touffe = deux plans en croix, un seul InstancedMesh par chunk.
export function ChunkGrass({ chunkX, chunkZ }: ChunkGrassProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const season = useGameStore((s) => s.settings.season)
  const instances = useMemo(
    () => scatterGrass(chunkX, chunkZ, CHUNK_SIZE, proceduralPath),
    [chunkX, chunkZ],
  )

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    instances.forEach((instance, i) => {
      dummy.position.set(...instance.position)
      dummy.rotation.y = instance.rotationY
      dummy.scale.setScalar(instance.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [instances])

  if (instances.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[grassGeometry(), undefined, instances.length]}>
      <primitive object={grassMaterial(season)} attach="material" />
    </instancedMesh>
  )
}
