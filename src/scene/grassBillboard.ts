import {
  CanvasTexture,
  DoubleSide,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SEASON_PALETTES, type Season } from './seasons'

const TUFT_WIDTH = 1.2 // m
const TUFT_HEIGHT = 0.7 // m

let geometry: ReturnType<typeof mergeGeometries> | null = null
let texture: CanvasTexture | null = null
const materials = new Map<Season, MeshLambertMaterial>()

// Deux plans en croix, pour qu'une touffe ait du volume sous n'importe quel angle.
export function grassGeometry() {
  if (!geometry) {
    const blade = new PlaneGeometry(TUFT_WIDTH, TUFT_HEIGHT)
    blade.translate(0, TUFT_HEIGHT / 2, 0)
    const crossed = blade.clone().rotateY(Math.PI / 2)
    geometry = mergeGeometries([blade, crossed])
  }
  return geometry
}

// Une seule silhouette de buisson, dessinée sur un canvas, fond transparent.
function grassTexture(): CanvasTexture {
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    const clumps = [
      [20, 40, 14],
      [36, 34, 18],
      [48, 42, 12],
      [30, 46, 14],
    ]
    for (const [x = 0, y = 0, radius = 0] of clumps) {
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
  }
  return texture
}

export function grassMaterial(season: Season): MeshLambertMaterial {
  let material = materials.get(season)
  if (!material) {
    material = new MeshLambertMaterial({
      map: grassTexture(),
      color: SEASON_PALETTES[season].foliage,
      alphaTest: 0.5,
      side: DoubleSide,
    })
    materials.set(season, material)
  }
  return material
}
