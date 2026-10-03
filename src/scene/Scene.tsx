import { Sky } from '@react-three/drei'
import { Lights } from './Lights'
import { Vehicle } from './Vehicle'
import { BridgeDecks } from './BridgeDecks'
import { Terrain } from './Terrain'
import { Water } from './Water'
import { SEASON_PALETTES } from './seasons'
import { useGameStore } from '../state/gameStore'

const DAY_SUN_POSITION: [number, number, number] = [10, 10, 5]
const NIGHT_SUN_POSITION: [number, number, number] = [10, -10, 5]
const NIGHT_FOG = '#111a2b'

export function Scene() {
  const season = useGameStore((s) => s.settings.season)
  const night = useGameStore((s) => s.settings.night)
  return (
    <>
      <Sky sunPosition={night ? NIGHT_SUN_POSITION : DAY_SUN_POSITION} />
      <fog attach="fog" args={[night ? NIGHT_FOG : SEASON_PALETTES[season].fog, 60, 240]} />
      <Lights />
      <Terrain />
      <BridgeDecks />
      <Water />
      <Vehicle />
    </>
  )
}
