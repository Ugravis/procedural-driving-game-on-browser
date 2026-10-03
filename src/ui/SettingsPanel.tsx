import { useGameStore } from '../state/gameStore'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <label className="hud-slider">
      <span>
        {label} <strong>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings)
  const draft = useGameStore((s) => s.landscapeDraft)
  const toggleContours = useGameStore((s) => s.toggleContours)
  const setCameraDistance = useGameStore((s) => s.setCameraDistance)
  const setCameraHeight = useGameStore((s) => s.setCameraHeight)
  const setDraft = useGameStore((s) => s.setLandscapeDraft)
  const regenerate = useGameStore((s) => s.regenerate)

  return (
    <section className="hud-panel" aria-label="Réglages">
      <h2>Réglages</h2>

      <label className="hud-check">
        <input type="checkbox" checked={settings.showContours} onChange={toggleContours} />
        Courbes de niveau
      </label>

      <Slider
        label="Recul caméra (m)"
        value={settings.cameraDistance}
        min={4}
        max={30}
        step={1}
        onChange={setCameraDistance}
      />
      <Slider
        label="Hauteur caméra (m)"
        value={settings.cameraHeight}
        min={1}
        max={12}
        step={0.5}
        onChange={setCameraHeight}
      />

      <h3>Relief</h3>
      <Slider
        label="Amplitude (m)"
        value={draft.heightScale}
        min={0}
        max={150}
        step={1}
        onChange={(heightScale) => setDraft({ heightScale })}
      />
      <Slider
        label="Fréquence"
        value={draft.frequency}
        min={0.0002}
        max={0.006}
        step={0.0001}
        onChange={(frequency) => setDraft({ frequency })}
      />
      <Slider
        label="Octaves"
        value={draft.octaves}
        min={1}
        max={4}
        step={1}
        onChange={(octaves) => setDraft({ octaves })}
      />
      <Slider
        label="Persistance"
        value={draft.persistence}
        min={0.1}
        max={0.8}
        step={0.05}
        onChange={(persistence) => setDraft({ persistence })}
      />

      <button type="button" className="hud-button" onClick={regenerate}>
        Régénérer le relief
      </button>
    </section>
  )
}
