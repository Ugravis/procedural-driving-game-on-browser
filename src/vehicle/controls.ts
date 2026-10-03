const FORWARD_KEYS = ['ArrowUp', 'KeyW']
const BACK_KEYS = ['ArrowDown', 'KeyS']

// Commandes clavier : Haut/W accélère, Bas/S freine ou recule à l'arrêt.
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

  // Entre -1 (frein) et 1 (accélérateur), dans le sens du tracé.
  throttle(): number {
    const forward = FORWARD_KEYS.some((key) => this.pressed.has(key)) ? 1 : 0
    const back = BACK_KEYS.some((key) => this.pressed.has(key)) ? 1 : 0
    return forward - back
  }

  private handle(event: KeyboardEvent, down: boolean) {
    if (event.target instanceof HTMLInputElement) return
    if (![...FORWARD_KEYS, ...BACK_KEYS].includes(event.code)) return
    if (down) this.pressed.add(event.code)
    else this.pressed.delete(event.code)
    event.preventDefault()
  }
}
