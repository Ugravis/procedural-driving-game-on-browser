import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'

// Le panneau debug lui-même se base sur un hook réactif classique (le toggle
// change rarement, le coût de re-render est négligeable). Les valeurs qui
// changent en continu (fps, position, nb de points du chemin) sont écrites
// directement dans le DOM via subscribe, comme pour SpeedReadout.
export function DebugPanel() {
  const debugOverlay = useGameStore((s) => s.settings.debugOverlay)
  const toggleDebugOverlay = useGameStore((s) => s.toggleDebugOverlay)
  const fpsRef = useRef<HTMLSpanElement>(null)
  const positionRef = useRef<HTMLSpanElement>(null)
  const pathPointCountRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const unsubFps = useGameStore.subscribe(
      (s) => s.debug.fps,
      (fps) => {
        if (fpsRef.current) fpsRef.current.textContent = String(fps)
      },
      { fireImmediately: true },
    )
    const unsubPosition = useGameStore.subscribe(
      (s) => s.player.position,
      (position) => {
        if (positionRef.current) {
          positionRef.current.textContent = position.map((v) => v.toFixed(1)).join(', ')
        }
      },
      { fireImmediately: true },
    )
    const unsubPathPointCount = useGameStore.subscribe(
      (s) => s.debug.pathPointCount,
      (count) => {
        if (pathPointCountRef.current) pathPointCountRef.current.textContent = String(count)
      },
      { fireImmediately: true },
    )
    return () => {
      unsubFps()
      unsubPosition()
      unsubPathPointCount()
    }
  }, [])

  return (
    <div className="hud-debug">
      <button type="button" onClick={toggleDebugOverlay}>
        {debugOverlay ? 'Masquer debug' : 'Debug'}
      </button>
      {debugOverlay && (
        <div className="hud-debug-panel">
          <div>
            FPS : <span ref={fpsRef} />
          </div>
          <div>
            Position : <span ref={positionRef} />
          </div>
          <div>
            Points du chemin : <span ref={pathPointCountRef} />
          </div>
        </div>
      )}
    </div>
  )
}
