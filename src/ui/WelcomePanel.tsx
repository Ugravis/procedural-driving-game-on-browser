import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STORAGE_KEY = 'welcome-panel-seen'

// Les éléments de « prochaines étapes » sont des évolutions prévues, pas des bugs.
const KNOWN_ISSUES = [
  'La génération de la route peut être chaotique (virages brusques, tracé peu lisible).',
  'Pas encore de retour en arrière possible sur le chemin (#16).',
  'Terrain : montagnes et lacets encore absents (#20).',
  'Textures réalistes pas encore intégrées (#53).',
]

const UPCOMING = ['Textures réalistes pour le terrain, les arbres et l’herbe (#53).']

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Stockage indisponible (navigation privée, données bloquées) : le panneau réapparaîtra.
  }
}

export function WelcomePanel() {
  const [open, setOpen] = useState(() => !readSeen())

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) writeSeen()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="pointer-events-auto fixed left-4 top-4 bg-black/60 text-white"
        onClick={() => setOpen(true)}
      >
        Aide
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bienvenue dans le générateur de paysages</DialogTitle>
            <DialogDescription>
              Conduisez sur une route générée procéduralement et contemplez les paysages. Version v0
              : sans textures.
            </DialogDescription>
          </DialogHeader>

          <section className="grid gap-2 text-sm">
            <h3 className="font-semibold">Bugs connus</h3>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
              {KNOWN_ISSUES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="grid gap-2 text-sm">
            <h3 className="font-semibold">Prochaines étapes</h3>
            <ul className="list-disc space-y-1 pl-5 text-white/80">
              {UPCOMING.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Commencer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
