import { Sky } from '@react-three/drei'
import { Lights } from './Lights'
import { PathPreviewVehicle } from './PathPreviewVehicle'
import { RoadPath } from './RoadPath'

export function Scene() {
  return (
    <>
      <Sky sunPosition={[10, 10, 5]} />
      <fog attach="fog" args={['#cfe8e0', 10, 60]} />
      <Lights />
      <RoadPath />
      <PathPreviewVehicle />
    </>
  )
}
