import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface PlayerState {
  position: [number, number, number]
  speed: number // km/h
}

export interface DebugState {
  fps: number
}

export interface SettingsState {
  debugOverlay: boolean
}

interface GameStore {
  player: PlayerState
  debug: DebugState
  settings: SettingsState
  setPlayerState: (position: PlayerState['position'], speed: number) => void
  setFps: (fps: number) => void
  toggleDebugOverlay: () => void
}

// subscribeWithSelector permet aux composants HUD de s'abonner à une seule
// valeur (ex: speed) et de la lire via un listener plutôt qu'un hook React,
// pour éviter un re-render à chaque frame sur les valeurs qui changent en continu.
export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set) => ({
    player: { position: [0, 1, 0], speed: 0 },
    debug: { fps: 0 },
    settings: { debugOverlay: false },
    setPlayerState: (position, speed) => set({ player: { position, speed } }),
    setFps: (fps) => set({ debug: { fps } }),
    toggleDebugOverlay: () =>
      set((s) => ({ settings: { debugOverlay: !s.settings.debugOverlay } })),
  })),
)
