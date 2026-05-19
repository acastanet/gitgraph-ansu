# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm run dev       # Serveur de développement sur http://localhost:3000
npm run build     # Build de production (TypeScript + Vite)
npm run lint      # Vérification des types TypeScript (tsc --noEmit)
npm run preview   # Prévisualiser le build de production
```

Pas de framework de test configuré. La vérification se fait uniquement via `npm run lint`.

## Architecture

GitGraph est un éditeur visuel de graphes Git basé sur React Flow (`@xyflow/react`). Il permet de créer et manipuler des graphes de commits/branches pour illustrer des workflows Git.

### Flux de données

```
useGitStore (Zustand + Zundo + persist)
       │
       ▼
GitGraph.tsx  ──(useEffect)──▶  nodes[] + edges[]  ──▶  ReactFlow
```

`useGitStore` (`src/store/useGitStore.ts`) est la **seule source de vérité**. Il stocke `commits` et `branches` sous forme de `Record<string, T>`. `GitGraph.tsx` transforme ces données en nœuds/arêtes React Flow à chaque changement via un `useEffect`.

### Modèle de données (`src/types/git.ts`)

- **`Commit`** : `id` (8 chars UUID), `parents[]` (DAG), `branch` (branchId), `position` (x/y libre), `parentColors`, `messageRotated`, `hideId`
- **`Branch`** : `id`, `name`, `head` (commitId), `color`, `order` (tri), `customLaneIndex` (override de colonne)

### Types de nœuds React Flow

| Type | Composant | Rôle |
|------|-----------|------|
| `commit` | `CommitNode.tsx` | Cercle représentant un commit, avec étiquette de message |
| `lane` | `LaneNode.tsx` | Ligne verticale/horizontale représentant une branche |
| `gitEdge` | `GitEdge.tsx` | Arête en L arrondi style metro/GitKraken |

### Système de lanes

Les branches sont assignées à des **lanes** (colonnes en mode vertical, lignes en mode horizontal). Le placement est calculé dans `GitGraph.tsx` :
- `main` est toujours en lane 0
- Les autres branches suivent leur `order`, sauf si `customLaneIndex` est défini
- Espacement : 50px entre lanes en vertical, 80px en horizontal
- Les commits sont **verrouillés sur leur lane** (axe X en vertical, axe Y en horizontal), seul l'axe temporel est libre au drag

### Persistance et historique

- **`persist`** (zustand/middleware) : sauvegarde automatique dans `localStorage` (clé `git-graph-storage`)
- **`temporal`** (zundo) : undo/redo limité à 50 états, accessible via `useGitStore.temporal.getState().undo/redo()`

### Interactions utilisateur clés

- **Double-clic vide** : crée un commit sur la branche la plus proche (ou une nouvelle branche)
- **Double-clic sur commit** : ouvre dialog d'édition du message
- **Clic-droit sur commit** : ouvre dialog de création de branche
- **Clic-droit sur lane** : ouvre dialog de renommage/couleur de branche
- **Drag commit → commit** : ajoute un lien parent (merge manuel)
- **Clic-droit sur arête** : change la couleur de l'arête

### Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner `GEMINI_API_KEY` (utilisé pour une intégration Google Genai, non centrale à l'éditeur GitGraph lui-même).
