import { getLandscapeParams, landscapeHeight } from './landscape'

export function isUnderWater(x: number, z: number): boolean {
  return landscapeHeight(x, z) < getLandscapeParams().waterLevel
}
