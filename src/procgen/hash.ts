// Hash déterministe (pas de Math.random) : un chunk redonne toujours la même
// végétation quand il est rechargé après avoir été déchargé.
export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return s - Math.floor(s)
}
