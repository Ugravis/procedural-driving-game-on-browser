import { useEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { CHUNK_SIZE } from '../procgen/terrain'
import { scatterVegetation } from '../procgen/vegetation'
import { useGameStore } from '../state/gameStore'
import { treeGeometry, treeMaterial } from './treeBillboard'

const dummy = new Object3D()

interface ChunkVegetationProps {
  chunkX: number
  chunkZ: number
}

// Un seul InstancedMesh par chunk : chaque arbre est un plan orienté vers la caméra.
export function ChunkVegetation({ chunkX, chunkZ }: ChunkVegetationProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const season = useGameStore((s) => s.settings.season)
  const instances = useMemo(
    () => scatterVegetation(chunkX, chunkZ, CHUNK_SIZE, proceduralPath),
    [chunkX, chunkZ],
  )

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    instances.forEach((instance, i) => {
      dummy.position.set(...instance.position)
      dummy.scale.setScalar(instance.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [instances])

  if (instances.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[treeGeometry(), treeMaterial(season), instances.length]} />
  )
}
