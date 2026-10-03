import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_LANDSCAPE,
  reseedLandscape,
  setLandscapeParams,
  type LandscapeParams,
} from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'

export interface PlayerState {
  position: [number, number, number]
  speed: number // km/h
  distanceTraveled: number // m, le long du chemin généré
  grade: number // %, pente de la route sous le véhicule
  heading: number // degrés, 0 = nord (-Z)
}

export interface DebugState {
  fps: number
  pathPointCount: number
}

export interface SettingsState {
  debugOverlay: boolean
  showContours: boolean
  cameraDistance: number // m, recul de la caméra derrière le véhicule
  cameraHeight: number // m, hauteur de la caméra
}

interface GameStore {
  player: PlayerState
  debug: DebugState
  settings: SettingsState
  landscape: LandscapeParams // appliqué
  landscapeDraft: LandscapeParams // en cours d'édition
  generation: number // incrémenté à chaque régénération
  setPlayerState: (
    position: PlayerState['position'],
    speed: number,
    distanceTraveled: number,
    grade: number,
    heading: number,
  ) => void
  setFps: (fps: number) => void
  setPathPointCount: (count: number) => void
  toggleDebugOverlay: () => void
  toggleContours: () => void
  setCameraDistance: (value: number) => void
  setCameraHeight: (value: number) => void
  setLandscapeDraft: (partial: Partial<LandscapeParams>) => void
  regenerate: () => void
}

// subscribeWithSelector permet aux composants HUD de s'abonner à une seule
// valeur (ex: speed) et de la lire via un listener plutôt qu'un hook React,
// pour éviter un re-render à chaque frame sur les valeurs qui changent en continu.
export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    player: { position: [0, 0, 0], speed: 0, distanceTraveled: 0, grade: 0, heading: 0 },
    debug: { fps: 0, pathPointCount: 0 },
    settings: {
      debugOverlay: false,
      showContours: false,
      cameraDistance: 11,
      cameraHeight: 4,
    },
    landscape: DEFAULT_LANDSCAPE,
    landscapeDraft: DEFAULT_LANDSCAPE,
    generation: 0,
    setPlayerState: (position, speed, distanceTraveled, grade, heading) =>
      set({ player: { position, speed, distanceTraveled, grade, heading } }),
    setFps: (fps) => set((s) => ({ debug: { ...s.debug, fps } })),
    setPathPointCount: (pathPointCount) => set((s) => ({ debug: { ...s.debug, pathPointCount } })),
    toggleDebugOverlay: () =>
      set((s) => ({ settings: { ...s.settings, debugOverlay: !s.settings.debugOverlay } })),
    toggleContours: () =>
      set((s) => ({ settings: { ...s.settings, showContours: !s.settings.showContours } })),
    setCameraDistance: (cameraDistance) =>
      set((s) => ({ settings: { ...s.settings, cameraDistance } })),
    setCameraHeight: (cameraHeight) => set((s) => ({ settings: { ...s.settings, cameraHeight } })),
    setLandscapeDraft: (partial) =>
      set((s) => ({ landscapeDraft: { ...s.landscapeDraft, ...partial } })),
    regenerate: () => {
      const next = { ...get().landscapeDraft }
      setLandscapeParams(next)
      reseedLandscape()
      proceduralPath.reset()
      set((s) => ({ landscape: next, generation: s.generation + 1 }))
    },
  })),
)
