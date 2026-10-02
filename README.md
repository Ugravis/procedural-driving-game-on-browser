# Procedural Driving Game

Jeu d'exploration chill dans le navigateur : avancer sur une route générée procéduralement à travers des paysages scandinaves, en vélo ou en van (ambiance roadtrip). Inspiré de [slowroads.io](https://slowroads.io).

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Three.js](https://threejs.org/) via [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei)
- [Zustand](https://github.com/pmndrs/zustand) pour l'état global
- [simplex-noise](https://github.com/jwagner/simplex-noise.js) pour la génération procédurale

## Structure

```
src/
  scene/     # scène 3D, caméra, éclairage, boucle de rendu
  state/     # store(s) Zustand
  ui/        # HUD et overlays React (DOM)
  procgen/   # génération procédurale (route, terrain, décor)
  vehicle/   # contrôleur du véhicule (vélo / van)
```

## Démarrer avec Docker

```bash
docker compose up
```

Lance le serveur de dev dans un conteneur, accessible sur http://localhost:5173 avec hot reload (le code est monté en volume).

Pour construire l'image de production (servie par nginx) :

```bash
docker build --target prod -t procedural-driving-game .
```

## Scripts

| Script                 | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Serveur de développement                                               |
| `npm run build`        | Build de production (typecheck inclus)                                 |
| `npm run preview`      | Prévisualise le build de production                                    |
| `npm run lint`         | Lint ESLint                                                            |
| `npm run lint:fix`     | Lint ESLint avec correction automatique                                |
| `npm run format`       | Formatage Prettier (écrit les fichiers)                                |
| `npm run format:check` | Vérifie le formatage sans écrire                                       |
| `npm run typecheck`    | Vérification des types TypeScript                                      |
| `npm run check-all`    | Lance lint + typecheck + format:check + build (= ce que la CI vérifie) |

## Workflow

Gitflow strict : `main` et `develop` ne reçoivent jamais de commit direct, tout le travail passe par des branches `feature/*` (voir [CLAUDE.md](./CLAUDE.md)).
