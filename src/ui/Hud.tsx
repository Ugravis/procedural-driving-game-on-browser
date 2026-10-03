import './Hud.css'
import { DebugPanel } from './DebugPanel'
import { EnvironmentPanel } from './EnvironmentPanel'
import { SettingsPanel } from './SettingsPanel'
import { SpeedReadout } from './SpeedReadout'

export function Hud() {
  return (
    <div className="hud">
      <SpeedReadout />
      <DebugPanel />
      <div className="hud-bottom-left">
        <EnvironmentPanel />
        <SettingsPanel />
      </div>
    </div>
  )
}
