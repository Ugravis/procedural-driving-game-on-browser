import {
  CanvasTexture,
  DoubleSide,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SEASON_PALETTES, type Season } from './seasons'

const TUFT_WIDTH = 1 // m
const TUFT_HEIGHT = 0.9 // m

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

// Brins dessinés sur un canvas, fond transparent.
function grassTexture(): CanvasTexture {
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.strokeStyle = '#ffffff'
    context.lineCap = 'round'
    for (let blade = 0; blade < 14; blade++) {
      const x = 4 + ((blade * 37) % 56)
      const lean = ((blade * 13) % 11) - 5
      context.lineWidth = 2 + (blade % 3)
      context.beginPath()
      context.moveTo(x, 64)
      context.quadraticCurveTo(x + lean * 0.5, 36, x + lean, 6 + (blade % 5) * 4)
      context.stroke()
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
