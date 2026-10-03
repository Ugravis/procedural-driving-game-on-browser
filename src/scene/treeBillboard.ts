import {
  CanvasTexture,
  DoubleSide,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'
import { SEASON_PALETTES, type Season } from './seasons'

const TREE_WIDTH = 2 // m
const TREE_HEIGHT = 3 // m, le pied de l'arbre est à y = 0

// Le vertex shader oriente le plan vers la caméra autour de l'axe Y : un seul
// plan par arbre, sans recalcul CPU à chaque frame.
const BILLBOARD_VERTEX = `
vec3 treeCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 toCamera = normalize(vec3(cameraPosition.x - treeCenter.x, 0.0, cameraPosition.z - treeCenter.z));
vec3 treeRight = vec3(toCamera.z, 0.0, -toCamera.x);
float treeScale = length(instanceMatrix[0].xyz);
vec3 treeWorld = treeCenter + treeRight * transformed.x * treeScale + vec3(0.0, transformed.y * treeScale, 0.0);
vec4 mvPosition = viewMatrix * vec4(treeWorld, 1.0);
gl_Position = projectionMatrix * mvPosition;
`

let geometry: PlaneGeometry | null = null
let texture: CanvasTexture | null = null
const materials = new Map<Season, MeshLambertMaterial>()

export function treeGeometry(): PlaneGeometry {
  if (!geometry) {
    geometry = new PlaneGeometry(TREE_WIDTH, TREE_HEIGHT)
    geometry.translate(0, TREE_HEIGHT / 2, 0)
  }
  return geometry
}

// Silhouette de conifère dessinée une fois sur un canvas, fond transparent.
function treeTexture(): CanvasTexture {
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 192
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.fillRect(60, 140, 8, 52)
    for (let tier = 0; tier < 4; tier++) {
      const bottom = 52 + tier * 32
      const half = 26 + tier * 7
      context.beginPath()
      context.moveTo(64, bottom - 44)
      context.lineTo(64 - half, bottom)
      context.lineTo(64 + half, bottom)
      context.closePath()
      context.fill()
    }
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
  }
  return texture
}

export function treeMaterial(season: Season): MeshLambertMaterial {
  let material = materials.get(season)
  if (!material) {
    material = new MeshLambertMaterial({
      map: treeTexture(),
      color: SEASON_PALETTES[season].foliage,
      alphaTest: 0.5,
      side: DoubleSide,
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        BILLBOARD_VERTEX,
      )
    }
    material.customProgramCacheKey = () => 'tree-billboard'
    materials.set(season, material)
  }
  return material
}
