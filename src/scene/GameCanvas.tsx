import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'

export function GameCanvas() {
  return (
    <Canvas camera={{ position: [0, 2, 6], fov: 60 }}>
      <Scene />
    </Canvas>
  )
}
