import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_LANDSCAPE,
  setLandscapeParams,
  setLandscapeSeed,
  type LandscapeParams,
} from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'
import type { Season } from '../scene/seasons'

export interface PlayerState {
  position: [number, number, number]
  speed: number // km/h
  distanceTraveled: number // m, distance parcourue (compteur)
  grade: number // %, pente sous le véhicule dans le sens de déplacement
  heading: number // degrés, 0 = nord (-Z)
}

export interface DebugState {
  fps: number
  pathPointCount: number
}

export interface SettingsState {
  showContours: boolean
  lookMode: boolean // ambiance ombrée : soleil, ombres, rendu facetté
  season: Season
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
  toggleLookMode: () => void
  setSeason: (season: Season) => void
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

function applyWorld(seed: number, landscape: LandscapeParams) {
  setLandscapeParams(landscape)
  setLandscapeSeed(seed)
  proceduralPath.reset(seed)
}

const initialSeed = randomSeed()
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
      lookMode: false,
      season: 'été',
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
    setSeason: (season) => set((s) => ({ settings: { ...s.settings, season } })),
    toggleLookMode: () =>
      set((s) => ({ settings: { ...s.settings, lookMode: !s.settings.lookMode } })),
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
