import { Sky } from '@react-three/drei'
import { GameClock } from './GameClock'
import { Lights } from './Lights'
import { RotatingBox } from './RotatingBox'

export function Scene() {
  return (
    <>
      <Sky sunPosition={[10, 10, 5]} />
      <fog attach="fog" args={['#cfe8e0', 10, 60]} />
      <Lights />
      <RotatingBox />
      <GameClock />
    </>
  )
}
