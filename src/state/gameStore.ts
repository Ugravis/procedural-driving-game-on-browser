import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_LANDSCAPE,
  setLandscapeParams,
  setLandscapeSeed,
  type LandscapeParams,
} from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'

export interface PlayerState {
  position: [number, number, number]
  speed: number // km/h
  distanceTraveled: number // m, signée : négative quand on roule vers l'arrière
  grade: number // %, pente de la route sous le véhicule dans le sens de conduite
  heading: number // degrés, 0 = nord (-Z)
}

export interface DebugState {
  fps: number
  pathPointCount: number
}

export interface SettingsState {
  showContours: boolean
  drivingReverse: boolean
  lookMode: boolean // ambiance ombrée : soleil, ombres, rendu facetté
  cameraDistance: number // m, recul de la caméra derrière le véhicule
  cameraHeight: number // m, hauteur de la caméra
  cameraYaw: number // degrés, rotation de la caméra autour du véhicule
}

interface GameStore {
  player: PlayerState
  debug: DebugState
  settings: SettingsState
  seed: number // graine appliquée
  seedDraft: number // graine en cours d'édition
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
  toggleContours: () => void
  toggleDrivingReverse: () => void
  toggleLookMode: () => void
  setCameraDistance: (value: number) => void
  setCameraHeight: (value: number) => void
  setCameraYaw: (value: number) => void
  setSeedDraft: (seed: number) => void
  setLandscapeDraft: (partial: Partial<LandscapeParams>) => void
  regenerate: () => void
  randomizeSeed: () => void
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000)
}

function seedFromUrl(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed')
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed >>> 0 : null
}

function applyWorld(seed: number, landscape: LandscapeParams) {
  setLandscapeParams(landscape)
  setLandscapeSeed(seed)
  proceduralPath.reset(seed)
}

const initialSeed = seedFromUrl() ?? randomSeed()
applyWorld(initialSeed, DEFAULT_LANDSCAPE)

// subscribeWithSelector permet aux composants HUD de s'abonner à une seule
// valeur (ex: speed) et de la lire via un listener plutôt qu'un hook React,
// pour éviter un re-render à chaque frame sur les valeurs qui changent en continu.
export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    player: { position: [0, 0, 0], speed: 0, distanceTraveled: 0, grade: 0, heading: 0 },
    debug: { fps: 0, pathPointCount: 0 },
    settings: {
      showContours: false,
      drivingReverse: false,
      lookMode: false,
      cameraDistance: 11,
      cameraHeight: 4,
      cameraYaw: 0,
    },
    seed: initialSeed,
    seedDraft: initialSeed,
    landscape: DEFAULT_LANDSCAPE,
    landscapeDraft: DEFAULT_LANDSCAPE,
    generation: 0,
    setPlayerState: (position, speed, distanceTraveled, grade, heading) =>
      set({ player: { position, speed, distanceTraveled, grade, heading } }),
    setFps: (fps) => set((s) => ({ debug: { ...s.debug, fps } })),
    setPathPointCount: (pathPointCount) => set((s) => ({ debug: { ...s.debug, pathPointCount } })),
    toggleContours: () =>
      set((s) => ({ settings: { ...s.settings, showContours: !s.settings.showContours } })),
    toggleLookMode: () =>
      set((s) => ({ settings: { ...s.settings, lookMode: !s.settings.lookMode } })),
    toggleDrivingReverse: () =>
      set((s) => ({ settings: { ...s.settings, drivingReverse: !s.settings.drivingReverse } })),
    setCameraDistance: (cameraDistance) =>
      set((s) => ({ settings: { ...s.settings, cameraDistance } })),
    setCameraHeight: (cameraHeight) => set((s) => ({ settings: { ...s.settings, cameraHeight } })),
    setCameraYaw: (cameraYaw) => set((s) => ({ settings: { ...s.settings, cameraYaw } })),
    setSeedDraft: (seedDraft) => set({ seedDraft }),
    setLandscapeDraft: (partial) =>
      set((s) => ({ landscapeDraft: { ...s.landscapeDraft, ...partial } })),
    regenerate: () => {
      const { seedDraft, landscapeDraft } = get()
      const landscape = { ...landscapeDraft }
      applyWorld(seedDraft, landscape)
      set((s) => ({ seed: seedDraft, landscape, generation: s.generation + 1 }))
    },
    randomizeSeed: () => {
      set({ seedDraft: randomSeed() })
      get().regenerate()
    },
  })),
)
