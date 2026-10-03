import { useEffect, useRef } from 'react'
import { getLandscapeParams, landscapeHeight } from '../procgen/landscape'
import { proceduralPath } from '../procgen/pathGenerator'
import { useGameStore } from '../state/gameStore'

const SIZE = 200 // px
const RANGE = 300 // m, demi-côté de la carte autour du véhicule
const CELL = 10 // m, résolution du relief sur la carte
const CELLS = Math.round((2 * RANGE) / CELL)
const CONTOUR_INTERVAL = 10 // m, écart entre courbes de niveau
const REFRESH_MS = 250
const DEG_TO_RAD = Math.PI / 180

const LAND = '#4d6b3b'
const WATER = '#1f4e6b'
const CONTOUR = 'rgba(210, 225, 180, 0.55)'
const ROAD = '#f2f2f2'
const BRIDGE = '#ff2bd6'

// Carte orientée nord, centrée sur le véhicule. Redessinée 4 fois par seconde,
// en lisant directement le relief et le tracé déjà générés.
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const draw = () => drawMinimap(context)
    draw()
    const id = window.setInterval(draw, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="hud-minimap" aria-label="Carte">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  )
}

function drawMinimap(context: CanvasRenderingContext2D) {
  const player = useGameStore.getState().player
  const [playerX, , playerZ] = player.position
  const originX = playerX - RANGE
  const originZ = playerZ - RANGE
  const scale = SIZE / (2 * RANGE)
  const toPixelX = (x: number) => (x - originX) * scale
  const toPixelZ = (z: number) => (z - originZ) * scale
  const cellPx = CELL * scale
  const waterLevel = getLandscapeParams().waterLevel

  const bands: number[][] = []
  for (let j = 0; j < CELLS; j++) {
    const row: number[] = []
    for (let i = 0; i < CELLS; i++) {
      const height = landscapeHeight(originX + (i + 0.5) * CELL, originZ + (j + 0.5) * CELL)
      row.push(height < waterLevel ? -1 : Math.floor(height / CONTOUR_INTERVAL))
    }
    bands.push(row)
  }

  context.clearRect(0, 0, SIZE, SIZE)
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      context.fillStyle = bands[j]![i]! < 0 ? WATER : LAND
      context.fillRect(i * cellPx, j * cellPx, cellPx + 1, cellPx + 1)
    }
  }

  context.fillStyle = CONTOUR
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const band = bands[j]![i]!
      if (band < 0) continue
      if (i + 1 < CELLS && bands[j]![i + 1]! >= 0 && bands[j]![i + 1] !== band) {
        context.fillRect((i + 1) * cellPx, j * cellPx, 1, cellPx)
      }
      if (j + 1 < CELLS && bands[j + 1]![i]! >= 0 && bands[j + 1]![i] !== band) {
        context.fillRect(i * cellPx, (j + 1) * cellPx, cellPx, 1)
      }
    }
  }

  context.lineWidth = 2
  context.lineCap = 'round'
  const road = proceduralPath.segmentsIn(originX, originX + 2 * RANGE, originZ, originZ + 2 * RANGE)
  context.strokeStyle = ROAD
  context.beginPath()
  for (const { a, b } of road) {
    context.moveTo(toPixelX(a.x), toPixelZ(a.z))
    context.lineTo(toPixelX(b.x), toPixelZ(b.z))
  }
  context.stroke()

  context.strokeStyle = BRIDGE
  context.beginPath()
  for (const { a, b } of proceduralPath.bridgeSegments()) {
    if (a.x < originX || a.x > originX + 2 * RANGE || a.z < originZ || a.z > originZ + 2 * RANGE)
      continue
    context.moveTo(toPixelX(a.x), toPixelZ(a.z))
    context.lineTo(toPixelX(b.x), toPixelZ(b.z))
  }
  context.stroke()

  const heading = player.heading * DEG_TO_RAD
  const centre = SIZE / 2
  const dirX = Math.sin(heading)
  const dirZ = -Math.cos(heading)
  const tip = 9
  context.fillStyle = 'orange'
  context.beginPath()
  context.moveTo(centre + dirX * tip, centre + dirZ * tip)
  context.lineTo(centre - dirZ * 5 - dirX * 5, centre + dirX * 5 - dirZ * 5)
  context.lineTo(centre + dirZ * 5 - dirX * 5, centre - dirX * 5 - dirZ * 5)
  context.closePath()
  context.fill()
}
