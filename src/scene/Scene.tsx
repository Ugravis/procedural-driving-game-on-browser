import { Sky } from '@react-three/drei'
import { Lights } from './Lights'
import { PathPreviewVehicle } from './PathPreviewVehicle'
import { BridgeDecks } from './BridgeDecks'
import { Terrain } from './Terrain'
import { Water } from './Water'

export function Scene() {
  return (
    <>
      <Sky sunPosition={[10, 10, 5]} />
      <fog attach="fog" args={['#cfe8e0', 60, 240]} />
      <Lights />
      <Terrain />
      <BridgeDecks />
      <Water />
      <PathPreviewVehicle />
    </>
  )
}
