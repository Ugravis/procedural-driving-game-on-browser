import { Sky } from '@react-three/drei'
import { Lights } from './Lights'
import { Vehicle } from './Vehicle'
import { BridgeDecks } from './BridgeDecks'
import { Terrain } from './Terrain'
import { Water } from './Water'
import { SEASON_PALETTES } from './seasons'
import { useGameStore } from '../state/gameStore'

export function Scene() {
  const season = useGameStore((s) => s.settings.season)
  return (
    <>
      <Sky sunPosition={[10, 10, 5]} />
      <fog attach="fog" args={[SEASON_PALETTES[season].fog, 60, 240]} />
      <Lights />
      <Terrain />
      <BridgeDecks />
      <Water />
      <Vehicle />
    </>
  )
}
