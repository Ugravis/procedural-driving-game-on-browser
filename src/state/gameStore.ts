import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_LANDSCAPE,
  setLandscapeParams,
  setLandscapeSeed,
  type LandscapeParams,
} from '../procgen/landscape'
import { findNearestBiome } from '../procgen/biomes'
import { getLandscapeParams, landscapeHeight } from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'
import type { Season } from '../scene/seasons'

const DRY_MARGIN = 5 // m, au-dessus du niveau de l'eau pour une téléportation

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
  night: boolean // mode nuit : soleil couché, ciel et brouillard sombres
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
  lightsOn: boolean // feux allumés (touche L)
  handbrake: boolean // frein à main engagé (touche P, interrupteur)
  braking: boolean // feux stop allumés : freinage ou frein à main
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
  setNight: (night: boolean) => void
  setSeason: (season: Season) => void
  setCameraDistance: (value: number) => void
  setCameraHeight: (value: number) => void
  setCameraYaw: (value: number) => void
  setSeedDraft: (seed: number) => void
  setLandscapeDraft: (partial: Partial<LandscapeParams>) => void
  regenerate: () => void
  randomizeSeed: () => void
  teleportTarget: { x: number; z: number } | null // demande de téléportation, consommée par le véhicule
  teleportToBiome: (biomeIndex: number) => void
  consumeTeleport: () => void
  toggleLights: () => void
  toggleHandbrake: () => void
  setBraking: (braking: boolean) => void
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
      night: false,
      season: 'été',
      cameraDistance: 8,
      cameraHeight: 3,
      cameraYaw: 0,
    },
    seed: initialSeed,
    seedDraft: initialSeed,
    landscape: DEFAULT_LANDSCAPE,
    landscapeDraft: DEFAULT_LANDSCAPE,
    generation: 0,
    lightsOn: false,
    handbrake: true,
    braking: false,
    teleportTarget: null,
    teleportToBiome: (biomeIndex) => {
      const [x, , z] = get().player.position
      const waterLevel = getLandscapeParams().waterLevel
      const target = findNearestBiome(
        biomeIndex,
        x,
        z,
        (tx, tz) => landscapeHeight(tx, tz) > waterLevel + DRY_MARGIN,
      )
      if (target) set({ teleportTarget: target })
    },
    consumeTeleport: () => set({ teleportTarget: null }),
    toggleLights: () => set((s) => ({ lightsOn: !s.lightsOn })),
    toggleHandbrake: () => set((s) => ({ handbrake: !s.handbrake })),
    setBraking: (braking) => set({ braking }),
    setPlayerState: (position, speed, distanceTraveled, grade, heading) =>
      set({ player: { position, speed, distanceTraveled, grade, heading } }),
    setFps: (fps) => set((s) => ({ debug: { ...s.debug, fps } })),
    setPathPointCount: (pathPointCount) => set((s) => ({ debug: { ...s.debug, pathPointCount } })),
    toggleContours: () =>
      set((s) => ({ settings: { ...s.settings, showContours: !s.settings.showContours } })),
    setSeason: (season) => set((s) => ({ settings: { ...s.settings, season } })),
    setNight: (night) => set((s) => ({ settings: { ...s.settings, night } })),
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
