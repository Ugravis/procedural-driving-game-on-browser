import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

// La vitesse change à chaque frame (60/s). On met à jour le texte directement
// via une ref (hors du cycle de rendu React) plutôt qu'avec useState, pour ne
// pas re-render ce composant 60 fois par seconde.
export function SpeedReadout() {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(
    () =>
      useGameStore.subscribe(
        (s) => s.player.speed,
        (speed) => {
          if (spanRef.current) spanRef.current.textContent = `${Math.round(speed)} km/h`
        },
        { fireImmediately: true },
      ),
    [],
  )

  return (
    <div className="hud-speed">
      <span ref={spanRef} />
    </div>
  )
}
