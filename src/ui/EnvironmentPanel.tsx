import { useEffect, useState } from 'react'
import { useGameStore } from '../state/gameStore'

const REFRESH_MS = 250

interface Readout {
  seed: number
  speed: number
  altitude: number
  grade: number
  heading: number
  distance: number
  x: number
  z: number
  fps: number
  pathPoints: number
}

function snapshot(): Readout {
  const { player, debug, seed } = useGameStore.getState()
  return {
    seed,
    speed: player.speed,
    altitude: player.position[1],
    grade: player.grade,
    heading: player.heading,
    distance: player.distanceTraveled,
    x: player.position[0],
    z: player.position[2],
    fps: debug.fps,
    pathPoints: debug.pathPointCount,
  }
}

// Affichage de lecture seule. Les valeurs sont relues 4 fois par seconde plutôt
// qu'à chaque frame : un re-render React à 60 Hz ne sert à rien ici.
export function EnvironmentPanel() {
  const [data, setData] = useState<Readout>(snapshot)

  useEffect(() => {
    const id = window.setInterval(() => setData(snapshot()), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  const rows: [string, string][] = [
    ['Graine', String(data.seed)],
    ['Vitesse', `${data.speed.toFixed(0)} km/h`],
    ['Altitude', `${data.altitude.toFixed(1)} m`],
    ['Pente', `${data.grade.toFixed(1)} %`],
    ['Cap', `${data.heading.toFixed(0)}°`],
    ['Distance', `${data.distance.toFixed(0)} m`],
    ['Position', `${data.x.toFixed(0)}, ${data.z.toFixed(0)}`],
    ['FPS', String(data.fps)],
    ['Points du chemin', String(data.pathPoints)],
  ]

  return (
    <section className="hud-panel" aria-label="Environnement">
      <h2>Environnement</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
