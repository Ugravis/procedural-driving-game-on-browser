import { useGameStore } from '../state/gameStore'

function Key({ label }: { label: string }) {
  return <kbd className="hud-key">{label}</kbd>
}

export function CommandsPanel() {
  const handbrake = useGameStore((s) => s.handbrake)
  const lightsOn = useGameStore((s) => s.lightsOn)
  return (
    <section className="hud-panel" aria-label="Commandes">
      <h2>Commandes</h2>
      <dl>
        <div>
          <dt>Avancer / reculer</dt>
          <dd>
            <Key label="Z" /> <Key label="S" />
          </dd>
        </div>
        <div>
          <dt>Tourner</dt>
          <dd>
            <Key label="Q" /> <Key label="D" />
          </dd>
        </div>
        <div className={handbrake ? 'is-active' : undefined}>
          <dt>Frein à main</dt>
          <dd>
            <Key label="P" />
          </dd>
        </div>
        <div className={lightsOn ? 'is-active' : undefined}>
          <dt>Feux</dt>
          <dd>
            <Key label="L" />
          </dd>
        </div>
      </dl>
    </section>
  )
}
