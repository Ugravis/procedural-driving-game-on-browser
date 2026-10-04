import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Object3D, Vector3, type DirectionalLight } from 'three'
import { useGameStore } from '../state/gameStore'
import { SEASON_PALETTES } from './seasons'

const SUN_DIRECTION = new Vector3(10, 10, 5).normalize()
const SUN_DISTANCE = 120 // m, distance du soleil au joueur
const SHADOW_HALF_SIZE = 60 // m, zone couverte par les ombres autour du joueur
const NIGHT_AMBIENT = '#8fa6d6' // lumière de nuit, plus froide que le jour

// Le soleil suit le joueur pour que les ombres restent nettes autour de lui.
export function Lights() {
  const sunRef = useRef<DirectionalLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const look = useGameStore((s) => s.settings.lookMode)
  const palette = SEASON_PALETTES[useGameStore((s) => s.settings.season)]
  const night = useGameStore((s) => s.settings.night)

  useFrame(() => {
    const sun = sunRef.current
    if (!sun) return
    const [x, y, z] = useGameStore.getState().player.position
    target.position.set(x, y, z)
    sun.position.set(
      x + SUN_DIRECTION.x * SUN_DISTANCE,
      y + SUN_DIRECTION.y * SUN_DISTANCE,
      z + SUN_DIRECTION.z * SUN_DISTANCE,
    )
  })

  return (
    <>
      <ambientLight
        color={night ? NIGHT_AMBIENT : '#ffffff'}
        intensity={night ? 0.25 : look ? 0.35 : 0.4}
      />
      {look && <hemisphereLight args={['#bfe3ff', '#3d5a2a', 0.8]} />}
      <directionalLight
        ref={sunRef}
        target={target}
        color={palette.sun}
        intensity={night ? 0 : palette.sunIntensity * (look ? 1.6 : 0.8)}
        castShadow={look}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_HALF_SIZE}
        shadow-camera-right={SHADOW_HALF_SIZE}
        shadow-camera-top={SHADOW_HALF_SIZE}
        shadow-camera-bottom={-SHADOW_HALF_SIZE}
        shadow-camera-far={300}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />
      <primitive object={target} />
    </>
  )
}
