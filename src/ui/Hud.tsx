import './Hud.css'
import { CommandsPanel } from './Commands'
import { EnvironmentPanel } from './EnvironmentPanel'
import { Minimap } from './Minimap'
import { SettingsPanel } from './SettingsPanel'

export function Hud() {
  return (
    <div className="hud">
      <div className="hud-bottom-left">
        <CommandsPanel />
        <EnvironmentPanel />
        <SettingsPanel />
      </div>
      <Minimap />
    </div>
  )
}
