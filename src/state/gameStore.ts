import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface PlayerState {
  position: [number, number, number]
  speed: number // km/h
  distanceTraveled: number // m, le long du chemin généré
}

export interface DebugState {
  fps: number
  pathPointCount: number
}

export interface SettingsState {
  debugOverlay: boolean
}

interface GameStore {
  player: PlayerState
  debug: DebugState
  settings: SettingsState
  setPlayerState: (
    position: PlayerState['position'],
    speed: number,
    distanceTraveled: number,
  ) => void
  setFps: (fps: number) => void
  setPathPointCount: (count: number) => void
  toggleDebugOverlay: () => void
}

// subscribeWithSelector permet aux composants HUD de s'abonner à une seule
// valeur (ex: speed) et de la lire via un listener plutôt qu'un hook React,
// pour éviter un re-render à chaque frame sur les valeurs qui changent en continu.
export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set) => ({
    player: { position: [0, 1, 0], speed: 0, distanceTraveled: 0 },
    debug: { fps: 0, pathPointCount: 0 },
    settings: { debugOverlay: false },
    setPlayerState: (position, speed, distanceTraveled) =>
      set({ player: { position, speed, distanceTraveled } }),
    setFps: (fps) => set((s) => ({ debug: { ...s.debug, fps } })),
    setPathPointCount: (pathPointCount) => set((s) => ({ debug: { ...s.debug, pathPointCount } })),
    toggleDebugOverlay: () =>
      set((s) => ({ settings: { debugOverlay: !s.settings.debugOverlay } })),
  })),
)
