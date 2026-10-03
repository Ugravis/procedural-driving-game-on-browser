import { useEffect, useRef, useState } from 'react'
import { getLandscapeParams } from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'
import { heightAt } from '../procgen/terrain'
import { useGameStore } from '../state/gameStore'

interface MapView {
  size: number // px
  range: number // m, demi-côté de la carte autour du véhicule
  cell: number // m, résolution du relief sur la carte
}

const COMPACT: MapView = { size: 200, range: 300, cell: 10 }
const EXPANDED: MapView = { size: 640, range: 1000, cell: 20 }
const CONTOUR_INTERVAL = 10 // m, écart entre courbes de niveau
const REFRESH_MS = 250
const DEG_TO_RAD = Math.PI / 180

const LAND = '#4d6b3b'
const WATER = '#1f4e6b'
const CONTOUR = 'rgba(210, 225, 180, 0.55)'
const ROAD = '#f2f2f2'
const BRIDGE = '#ff2bd6'

// Carte orientée nord, centrée sur le véhicule. Un clic l'agrandit au centre de
// l'écran ; un second clic ou Échap la referme.
export function Minimap() {
  const [expanded, setExpanded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = expanded ? EXPANDED : COMPACT

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const draw = () => drawMinimap(context, view)
    draw()
    const id = window.setInterval(draw, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [view])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      const key = event.key.toLowerCase()
      if (key === 'm') setExpanded((value) => !value)
      else if (key === 'escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className={expanded ? 'hud-minimap is-expanded' : 'hud-minimap'}
      aria-label="Carte"
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') setExpanded((value) => !value)
      }}
    >
      <canvas ref={canvasRef} width={view.size} height={view.size} />
    </div>
  )
}

function drawMinimap(context: CanvasRenderingContext2D, view: MapView) {
  const player = useGameStore.getState().player
  const [playerX, , playerZ] = player.position
  const { size, range, cell } = view
  const cells = Math.round((2 * range) / cell)
  const originX = playerX - range
  const originZ = playerZ - range
  const scale = size / (2 * range)
  const toPixelX = (x: number) => (x - originX) * scale
  const toPixelZ = (z: number) => (z - originZ) * scale
  const cellPx = cell * scale
  const waterLevel = getLandscapeParams().waterLevel

  // Même hauteur que le terrain 3D (route aplanie comprise), pour que l'eau coïncide.
  const bands: number[][] = []
  for (let j = 0; j < cells; j++) {
    const row: number[] = []
    for (let i = 0; i < cells; i++) {
      const height = heightAt(
        originX + (i + 0.5) * cell,
        originZ + (j + 0.5) * cell,
        proceduralPath,
      )
      row.push(height < waterLevel ? -1 : Math.floor(height / CONTOUR_INTERVAL))
    }
    bands.push(row)
  }

  context.clearRect(0, 0, size, size)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      context.fillStyle = bands[j]![i]! < 0 ? WATER : LAND
      context.fillRect(i * cellPx, j * cellPx, cellPx + 1, cellPx + 1)
    }
  }

  context.fillStyle = CONTOUR
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const band = bands[j]![i]!
      if (band < 0) continue
      if (i + 1 < cells && bands[j]![i + 1]! >= 0 && bands[j]![i + 1] !== band) {
        context.fillRect((i + 1) * cellPx, j * cellPx, 1, cellPx)
      }
      if (j + 1 < cells && bands[j + 1]![i]! >= 0 && bands[j + 1]![i] !== band) {
        context.fillRect(i * cellPx, (j + 1) * cellPx, cellPx, 1)
      }
    }
  }

  const lineWidth = view === EXPANDED ? 3 : 2
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
  const centre = size / 2
  const dirX = Math.sin(heading)
  const dirZ = -Math.cos(heading)
  const scaleArrow = size / 40
  context.fillStyle = 'orange'
  context.beginPath()
  context.moveTo(centre + dirX * scaleArrow * 1.8, centre + dirZ * scaleArrow * 1.8)
  context.lineTo(
    centre - dirZ * scaleArrow - dirX * scaleArrow,
    centre + dirX * scaleArrow - dirZ * scaleArrow,
  )
  context.lineTo(
    centre + dirZ * scaleArrow - dirX * scaleArrow,
    centre - dirX * scaleArrow - dirZ * scaleArrow,
  )
  context.closePath()
  context.fill()
}
