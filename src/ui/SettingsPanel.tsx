import { useGameStore } from '../state/gameStore'
import { LANDSCAPE_PRESETS } from '../procgen/landscape'

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
  const seedDraft = useGameStore((s) => s.seedDraft)
  const toggleContours = useGameStore((s) => s.toggleContours)
  const toggleDrivingReverse = useGameStore((s) => s.toggleDrivingReverse)
  const toggleLookMode = useGameStore((s) => s.toggleLookMode)
  const setCameraDistance = useGameStore((s) => s.setCameraDistance)
  const setCameraHeight = useGameStore((s) => s.setCameraHeight)
  const setCameraYaw = useGameStore((s) => s.setCameraYaw)
  const setSeedDraft = useGameStore((s) => s.setSeedDraft)
  const setDraft = useGameStore((s) => s.setLandscapeDraft)
  const regenerate = useGameStore((s) => s.regenerate)
  const randomizeSeed = useGameStore((s) => s.randomizeSeed)

  return (
    <section className="hud-panel" aria-label="Réglages">
      <h2>Réglages</h2>

      <label className="hud-check">
        <input type="checkbox" checked={settings.showContours} onChange={toggleContours} />
        Courbes de niveau
      </label>

      <label className="hud-check">
        <input type="checkbox" checked={settings.drivingReverse} onChange={toggleDrivingReverse} />
        Rouler en arrière
      </label>

      <label className="hud-check">
        <input type="checkbox" checked={settings.lookMode} onChange={toggleLookMode} />
        Ambiance ombrée (test)
      </label>

      <Slider
        label="Recul caméra (m)"
        value={settings.cameraDistance}
        min={4}
        max={150}
        step={1}
        onChange={setCameraDistance}
      />
      <Slider
        label="Rotation caméra (°)"
        value={settings.cameraYaw}
        min={-180}
        max={180}
        step={5}
        onChange={setCameraYaw}
      />
      <Slider
        label="Hauteur caméra (m)"
        value={settings.cameraHeight}
        min={1}
        max={12}
        step={0.5}
        onChange={setCameraHeight}
      />

      <details className="hud-fold">
        <summary>Génération</summary>

        <h3>Graine</h3>
        <div className="hud-seed">
          <input
            type="number"
            min={0}
            step={1}
            value={seedDraft}
            aria-label="Graine"
            onChange={(e) => setSeedDraft(Number(e.target.value) >>> 0)}
          />
          <button type="button" className="hud-button" onClick={randomizeSeed}>
            Aléatoire
          </button>
        </div>

        <h3>Relief</h3>
        <div className="hud-presets">
          {(Object.keys(LANDSCAPE_PRESETS) as (keyof typeof LANDSCAPE_PRESETS)[]).map((name) => (
            <button
              key={name}
              type="button"
              className="hud-button"
              onClick={() => {
                setDraft(LANDSCAPE_PRESETS[name])
                regenerate()
              }}
            >
              {name}
            </button>
          ))}
        </div>
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
          label="Niveau d'eau (m)"
          value={draft.waterLevel}
          min={-80}
          max={20}
          step={1}
          onChange={(waterLevel) => setDraft({ waterLevel })}
        />
        <Slider
          label="Espacement des ponts (m)"
          value={draft.bridgeSpacing}
          min={500}
          max={10000}
          step={250}
          onChange={(bridgeSpacing) => setDraft({ bridgeSpacing })}
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
          Régénérer le monde
        </button>
      </details>
    </section>
  )
}
