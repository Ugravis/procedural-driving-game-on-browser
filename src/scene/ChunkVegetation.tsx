import { useEffect, useMemo, useRef } from 'react'
import { Object3D, type InstancedMesh } from 'three'
import { proceduralPath } from '../procgen/pathGenerator'
import { CHUNK_SIZE } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'
import { foliageMaterial } from './seasons'
import { scatterVegetation } from '../procgen/vegetation'

const dummy = new Object3D()

interface ChunkVegetationProps {
  chunkX: number
  chunkZ: number
}

// Un seul InstancedMesh par chunk pour tous ses arbres (pas un mesh par
// arbre) : un draw call rend des dizaines d'instances.
export function ChunkVegetation({ chunkX, chunkZ }: ChunkVegetationProps) {
  const meshRef = useRef<InstancedMesh>(null)
  const lookMode = useGameStore((s) => s.settings.lookMode)
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
      dummy.rotation.y = instance.rotationY
      dummy.scale.setScalar(instance.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [instances])

  if (instances.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instances.length]}
      castShadow
      receiveShadow
    >
      <coneGeometry args={[1, 3, 6]} />
      <primitive object={foliageMaterial(season, lookMode)} attach="material" />
    </instancedMesh>
  )
}
