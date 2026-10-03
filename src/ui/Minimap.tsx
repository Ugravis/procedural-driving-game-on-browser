import { useEffect, useMemo, useRef, useState } from 'react'
import { BIOMES, biomeWeights, dominantBiome, mapColour, seaWeight } from '../procgen/biomes'
import { getLandscapeParams } from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'
import { CHUNK_SIZE, heightAt } from '../procgen/terrain'
import { scatterVegetation, treeDensity, type VegetationInstance } from '../procgen/vegetation'
import { useGameStore } from '../state/gameStore'

interface MapView {
  size: number // px
  range: number // m, demi-côté de la carte autour du véhicule
  cell: number // m, résolution du relief sur la carte
}

const COMPACT: MapView = { size: 200, range: 300, cell: 10 }
const EXPANDED_SIZE = 640
const ZOOM_RANGES = [250, 500, 1000, 2000, 4000, 8000, 16000] // m, demi-côté de la carte agrandie selon le zoom
const DEFAULT_ZOOM = 3
const CELLS_ACROSS = 100 // nombre de cellules de relief sur la largeur de la carte agrandie
const CONTOUR_INTERVAL = 10 // m, écart entre courbes de niveau
const REFRESH_MS = 250
const DEG_TO_RAD = Math.PI / 180

const WATER = '#1f4e6b'
const CONTOUR = 'rgba(210, 225, 180, 0.55)'
const FOREST_ALPHA = 0.7 // opacité maximale de la teinte forestière, à densité 1
const TREE_COLOUR = 'rgba(14, 50, 22, 0.9)'
const TREE_DOT_RANGE = 1000 // m, en dessous, les arbres sont dessinés un par un
const TREE_CACHE_LIMIT = 500 // chunks gardés en mémoire pour la minimap
const ROAD = '#f2f2f2'
const BRIDGE = '#ff2bd6'

interface Pan {
  x: number // m, décalage du centre de la carte par rapport au véhicule
  z: number
}

// Carte orientée nord, centrée sur le véhicule. Un clic l'agrandit ; en grand
// format, on fait glisser la carte à la souris pour explorer, et M, Échap ou le
// bouton Fermer la referment.
export function Minimap() {
  const [expanded, setExpanded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const biomeLabel = useRef<HTMLSpanElement>(null)
  const altitudeLabel = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pan = useRef<Pan>({ x: 0, z: 0 })
  const drag = useRef<{
    x: number
    y: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const range = ZOOM_RANGES[zoom]!
  const view = useMemo<MapView>(
    () => (expanded ? { size: EXPANDED_SIZE, range, cell: (2 * range) / CELLS_ACROSS } : COMPACT),
    [expanded, range],
  )

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const draw = () => {
      drawMinimap(context, view, expanded ? pan.current : { x: 0, z: 0 })
      updateLabels(biomeLabel.current, altitudeLabel.current)
    }
    draw()
    const id = window.setInterval(draw, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [view, expanded])

  useEffect(() => {
    const open = () => {
      pan.current = { x: 0, z: 0 }
      setExpanded(true)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      const key = event.key.toLowerCase()
      if (key === 'm') setExpanded((value) => !value)
      else if (key === 'escape') setExpanded(false)
      else if (key === 'enter' && document.activeElement === containerRef.current) open()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const open = () => {
    pan.current = { x: 0, z: 0 }
    setZoom(DEFAULT_ZOOM)
    setExpanded(true)
  }

  return (
    <div className={expanded ? 'hud-minimap-wrap is-expanded' : 'hud-minimap-wrap'}>
      <div className="hud-minimap-label">
        <span className="hud-minimap-biome" ref={biomeLabel} /> · <span ref={altitudeLabel} />
      </div>
      <div
        ref={containerRef}
        className={expanded ? 'hud-minimap is-expanded' : 'hud-minimap'}
        aria-label="Carte"
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!expanded) open()
        }}
        onPointerDown={(event) => {
          if (!expanded) return
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current) return
          const metresPerPixel =
            (2 * view.range) / event.currentTarget.getBoundingClientRect().width
          const dx = event.clientX - current.x
          const dy = event.clientY - current.y
          pan.current = {
            x: pan.current.x - dx * metresPerPixel,
            z: pan.current.z - dy * metresPerPixel,
          }
          current.x = event.clientX
          current.y = event.clientY
          if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 3) {
            current.moved = true
          }
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <canvas ref={canvasRef} width={view.size} height={view.size} />
        {expanded && (
          <div className="hud-minimap-controls" onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                pan.current = { x: 0, z: 0 }
              }}
            >
              Recentrer
            </button>
            <button
              type="button"
              aria-label="Zoomer"
              onClick={(event) => {
                event.stopPropagation()
                setZoom((value) => Math.max(0, value - 1))
              }}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Dézoomer"
              onClick={(event) => {
                event.stopPropagation()
                setZoom((value) => Math.min(ZOOM_RANGES.length - 1, value + 1))
              }}
            >
              −
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded(false)
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function drawMinimap(context: CanvasRenderingContext2D, view: MapView, pan: Pan) {
  const player = useGameStore.getState().player
  const [playerX, , playerZ] = player.position
  const viewCentreX = playerX + pan.x
  const viewCentreZ = playerZ + pan.z
  const { size, range, cell } = view
  const cells = Math.round((2 * range) / cell)
  const originX = viewCentreX - range
  const originZ = viewCentreZ - range
  const scale = size / (2 * range)
  const toPixelX = (x: number) => (x - originX) * scale
  const toPixelZ = (z: number) => (z - originZ) * scale
  const cellPx = cell * scale
  const waterLevel = getLandscapeParams().waterLevel

  // Même hauteur que le terrain 3D (route aplanie comprise), pour que l'eau coïncide.
  const bands: number[][] = []
  const heights: number[][] = []
  const wet: boolean[][] = []
  const land: string[][] = []
  for (let j = 0; j < cells; j++) {
    const row: number[] = []
    const wetRow: boolean[] = []
    const landRow: string[] = []
    const heightRow: number[] = []
    for (let i = 0; i < cells; i++) {
      const worldX = originX + (i + 0.5) * cell
      const worldZ = originZ + (j + 0.5) * cell
      const height = heightAt(worldX, worldZ, proceduralPath)
      heightRow.push(height)
      wetRow.push(height < waterLevel)
      row.push(Math.floor(height / CONTOUR_INTERVAL))
      landRow.push(mapColour(biomeWeights(worldX, worldZ)))
    }
    bands.push(row)
    heights.push(heightRow)
    wet.push(wetRow)
    land.push(landRow)
  }

  context.clearRect(0, 0, size, size)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      context.fillStyle = wet[j]![i] ? WATER : land[j]![i]!
      context.fillRect(i * cellPx, j * cellPx, cellPx + 1, cellPx + 1)
    }
  }

  context.fillStyle = CONTOUR
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      if (wet[j]![i]) continue
      const band = bands[j]![i]!
      if (i + 1 < cells && !wet[j]![i + 1] && bands[j]![i + 1] !== band) {
        context.fillRect((i + 1) * cellPx, j * cellPx, 1, cellPx)
      }
      if (j + 1 < cells && !wet[j + 1]![i] && bands[j + 1]![i] !== band) {
        context.fillRect(i * cellPx, (j + 1) * cellPx, cellPx, 1)
      }
    }
  }

  drawForest(context, heights, wet, cell, cellPx, originX, originZ)
  if (range <= TREE_DOT_RANGE) {
    drawTrees(context, originX, originZ, range, toPixelX, toPixelZ, scale)
  }

  const lineWidth = view.size > COMPACT.size ? 3 : 2
  context.lineWidth = lineWidth
  context.lineCap = 'round'
  context.strokeStyle = ROAD
  context.beginPath()
  for (const { a, b } of proceduralPath.segmentsIn(
    originX,
    originX + 2 * range,
    originZ,
    originZ + 2 * range,
  )) {
    context.moveTo(toPixelX(a.x), toPixelZ(a.z))
    context.lineTo(toPixelX(b.x), toPixelZ(b.z))
  }
  context.stroke()

  context.strokeStyle = BRIDGE
  context.beginPath()
  for (const { a, b } of proceduralPath.bridgeSegments()) {
    if (a.x < originX || a.x > originX + 2 * range || a.z < originZ || a.z > originZ + 2 * range)
      continue
    context.moveTo(toPixelX(a.x), toPixelZ(a.z))
    context.lineTo(toPixelX(b.x), toPixelZ(b.z))
  }
  context.stroke()

  const heading = player.heading * DEG_TO_RAD
  const arrowX = toPixelX(playerX)
  const arrowY = toPixelZ(playerZ)
  const dirX = Math.sin(heading)
  const dirZ = -Math.cos(heading)
  const arrow = size / 40
  context.fillStyle = 'orange'
  context.beginPath()
  context.moveTo(arrowX + dirX * arrow * 1.8, arrowY + dirZ * arrow * 1.8)
  context.lineTo(arrowX - dirZ * arrow - dirX * arrow, arrowY + dirX * arrow - dirZ * arrow)
  context.lineTo(arrowX + dirZ * arrow - dirX * arrow, arrowY - dirX * arrow - dirZ * arrow)
  context.closePath()
  context.fill()
}

function updateLabels(biome: HTMLSpanElement | null, altitude: HTMLSpanElement | null) {
  const [x, y, z] = useGameStore.getState().player.position
  if (biome)
    biome.textContent =
      seaWeight(x, z) > 0.5 ? 'mer' : (BIOMES[dominantBiome(biomeWeights(x, z))] ?? '')
  if (altitude) altitude.textContent = `altitude ${Math.round(y) || 0} m`
}

// Teinte par cellule selon la densité d'arbres : une forêt reste visible même
// quand les arbres sont trop petits pour être dessinés un par un.
function drawForest(
  context: CanvasRenderingContext2D,
  heights: number[][],
  wet: boolean[][],
  cell: number,
  cellPx: number,
  originX: number,
  originZ: number,
) {
  const last = heights.length - 1
  for (let j = 0; j <= last; j++) {
    for (let i = 0; i <= last; i++) {
      if (wet[j]![i]) continue
      const slope =
        Math.hypot(
          heights[j]![Math.min(i + 1, last)]! - heights[j]![Math.max(i - 1, 0)]!,
          heights[Math.min(j + 1, last)]![i]! - heights[Math.max(j - 1, 0)]![i]!,
        ) /
        (2 * cell)
      const density = treeDensity(originX + (i + 0.5) * cell, originZ + (j + 0.5) * cell, slope)
      if (density <= 0) continue
      context.fillStyle = `rgba(18, 52, 24, ${Math.min(density, 1) * FOREST_ALPHA})`
      context.fillRect(i * cellPx, j * cellPx, cellPx + 1, cellPx + 1)
    }
  }
}

const treeCache = new Map<string, VegetationInstance[]>()
let treeCacheSeed = Number.NaN

function treesInChunk(chunkX: number, chunkZ: number): VegetationInstance[] {
  if (proceduralPath.seed !== treeCacheSeed || treeCache.size > TREE_CACHE_LIMIT) {
    treeCache.clear()
    treeCacheSeed = proceduralPath.seed
  }
  const key = `${chunkX}:${chunkZ}`
  let trees = treeCache.get(key)
  if (!trees) {
    trees = scatterVegetation(chunkX, chunkZ, CHUNK_SIZE, proceduralPath)
    treeCache.set(key, trees)
  }
  return trees
}

function drawTrees(
  context: CanvasRenderingContext2D,
  originX: number,
  originZ: number,
  range: number,
  toPixelX: (x: number) => number,
  toPixelZ: (z: number) => number,
  scale: number,
) {
  const minX = Math.floor((originX - CHUNK_SIZE / 2) / CHUNK_SIZE)
  const maxX = Math.ceil((originX + 2 * range + CHUNK_SIZE / 2) / CHUNK_SIZE)
  const minZ = Math.floor((originZ - CHUNK_SIZE / 2) / CHUNK_SIZE)
  const maxZ = Math.ceil((originZ + 2 * range + CHUNK_SIZE / 2) / CHUNK_SIZE)
  context.fillStyle = TREE_COLOUR
  for (let cz = minZ; cz <= maxZ; cz++) {
    for (let cx = minX; cx <= maxX; cx++) {
      for (const tree of treesInChunk(cx, cz)) {
        const [x, , z] = tree.position
        context.beginPath()
        context.arc(toPixelX(x), toPixelZ(z), Math.max(1.2, tree.scale * scale), 0, Math.PI * 2)
        context.fill()
      }
    }
  }
}
