// Touches par lettre (AZERTY : Z avance, S recule, Q gauche, D droite) et flèches.
const FORWARD = ['z', 'w', 'arrowup']
const BACK = ['s', 'arrowdown']
const LEFT = ['q', 'a', 'arrowleft']
const RIGHT = ['d', 'arrowright']
const GAME_KEYS = [...FORWARD, ...BACK, ...LEFT, ...RIGHT]

export class KeyboardControls {
  private pressed = new Set<string>()
  private onKeyDown = (event: KeyboardEvent) => this.handle(event, true)
  private onKeyUp = (event: KeyboardEvent) => this.handle(event, false)
  private onBlur = () => this.pressed.clear()

  attach(target: Window) {
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    target.addEventListener('blur', this.onBlur)
    return () => {
      target.removeEventListener('keydown', this.onKeyDown)
      target.removeEventListener('keyup', this.onKeyUp)
      target.removeEventListener('blur', this.onBlur)
    }
  }

  // Entre -1 (frein / marche arrière) et 1 (accélérateur).
  throttle(): number {
    return this.held(FORWARD) - this.held(BACK)
  }

  // Entre -1 (gauche) et 1 (droite).
  steer(): number {
    return this.held(RIGHT) - this.held(LEFT)
  }

  private held(keys: string[]): number {
    return keys.some((key) => this.pressed.has(key)) ? 1 : 0
  }

  private handle(event: KeyboardEvent, down: boolean) {
    if (event.target instanceof HTMLInputElement) return
    const key = event.key.toLowerCase()
    if (!GAME_KEYS.includes(key)) return
    if (down) this.pressed.add(key)
    else this.pressed.delete(key)
    event.preventDefault()
  }
}
