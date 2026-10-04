import './App.css'
import { GameCanvas } from './scene/GameCanvas'
import { Hud } from './ui/Hud'

function App() {
  return (
    <main className="app-canvas-container">
      <GameCanvas />
      <Hud />
    </main>
  )
}

export default App
