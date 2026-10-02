import './Hud.css'
import { DebugPanel } from './DebugPanel'
import { SpeedReadout } from './SpeedReadout'

export function Hud() {
  return (
    <div className="hud">
      <SpeedReadout />
      <DebugPanel />
    </div>
  )
}
