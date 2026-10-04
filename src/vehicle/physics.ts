export const MAX_SPEED = 25 // m/s, environ 90 km/h
export const MAX_REVERSE_SPEED = 6 // m/s
const ACCELERATION = 3 // m/s², à l'arrêt
const BRAKING = 8 // m/s²
const ROLLING_RESISTANCE = 0.15 // m/s², freinage passif
const AERO_DRAG = 0.0006 // 1/m
const GRAVITY = 9.81 // m/s²
const STOP_THRESHOLD = 0.05 // m/s, en dessous, le véhicule est à l'arrêt
const HANDBRAKE_DECELERATION = 12 // m/s², frein à main serré

/**
 * Vitesse signée le long du tracé (positive = sens du tracé).
 * throttle : -1 (frein / marche arrière) à 1 (accélérateur), dans le sens du tracé.
 * grade : pente le long du tracé, en fraction (0,1 = 10 %).
 */
export function nextSpeed(
  speed: number,
  throttle: number,
  grade: number,
  dt: number,
  handbrake = false,
): number {
  if (handbrake) {
    const step = HANDBRAKE_DECELERATION * dt
    if (Math.abs(speed) <= step) return 0
    return speed - Math.sign(speed) * step
  }

  let acceleration = -GRAVITY * grade - AERO_DRAG * speed * Math.abs(speed)

  if (throttle > 0) {
    const headroom = Math.max(0, 1 - Math.max(speed, 0) / MAX_SPEED)
    acceleration += speed < 0 ? BRAKING * throttle : ACCELERATION * throttle * headroom
  } else if (throttle < 0) {
    const magnitude = -throttle
    if (speed > 0) {
      acceleration -= BRAKING * magnitude
    } else {
      const headroom = Math.max(0, 1 - Math.max(-speed, 0) / MAX_REVERSE_SPEED)
      acceleration -= ACCELERATION * magnitude * headroom
    }
  }

  if (throttle === 0 && Math.abs(speed) > STOP_THRESHOLD) {
    acceleration -= ROLLING_RESISTANCE * Math.sign(speed)
  }

  if (
    Math.abs(speed) <= STOP_THRESHOLD &&
    throttle === 0 &&
    Math.abs(acceleration) <= ROLLING_RESISTANCE
  ) {
    return 0
  }

  const next = speed + acceleration * dt
  if (throttle === 0 && speed !== 0 && Math.sign(next) !== Math.sign(speed)) return 0
  if (throttle < 0 && speed > 0 && next < 0) return 0
  return Math.min(Math.max(next, -MAX_REVERSE_SPEED), MAX_SPEED)
}
