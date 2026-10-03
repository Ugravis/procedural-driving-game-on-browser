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
const DIRT = '#c9a66b'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const pan = useRef<Pan>({ x: 0, z: 0 })
  const drag = useRef<{
    x: number
    y: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const view = expanded ? EXPANDED : COMPACT

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const draw = () => drawMinimap(context, view, expanded ? pan.current : { x: 0, z: 0 })
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
    setExpanded(true)
  }

  return (
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
          (2 * EXPANDED.range) / event.currentTarget.getBoundingClientRect().width
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
  const wet: boolean[][] = []
  for (let j = 0; j < cells; j++) {
    const row: number[] = []
    const wetRow: boolean[] = []
    for (let i = 0; i < cells; i++) {
      const height = heightAt(
        originX + (i + 0.5) * cell,
        originZ + (j + 0.5) * cell,
        proceduralPath,
      )
      wetRow.push(height < waterLevel)
      row.push(Math.floor(height / CONTOUR_INTERVAL))
    }
    bands.push(row)
    wet.push(wetRow)
  }

  context.clearRect(0, 0, size, size)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      context.fillStyle = wet[j]![i] ? WATER : LAND
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

  const lineWidth = view === EXPANDED ? 3 : 2
  context.lineWidth = lineWidth
  context.lineCap = 'round'
  const road = proceduralPath.segmentsIn(originX, originX + 2 * range, originZ, originZ + 2 * range)
  for (const [dirt, colour] of [
    [false, ROAD],
    [true, DIRT],
  ] as const) {
    context.strokeStyle = colour
    context.beginPath()
    for (const { a, b } of road.filter((segment) => segment.dirt === dirt)) {
      context.moveTo(toPixelX(a.x), toPixelZ(a.z))
      context.lineTo(toPixelX(b.x), toPixelZ(b.z))
    }
    context.stroke()
  }

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
