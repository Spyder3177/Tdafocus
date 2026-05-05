# TDAFocus V2

Application PWA simple en HTML/CSS/JS pour gérer des tâches avec un mode focus, un timer et des templates rapides.

## Nouveautés V2

- Bottom navigation type app iPhone.
- Écran Aujourd'hui avec Top 3.
- Mode Focus complet : tâche active, étape actuelle, timer, progression.
- Templates rapides : KDP, couverture KDP, Leboncoin, colis, URSSAF, rangement, sport.
- Design clean sans dépendance externe.
- Sauvegarde locale via localStorage.
- PWA installable sur iPhone.
- Service worker v2 avec cache offline.
- IA supprimée côté frontend pour éviter l'exposition d'une clé API.

## Déploiement Netlify

Build command : laisser vide
Publish directory : `.`

## Installation iPhone

Ouvre l'URL Netlify dans Safari, puis : Partager > Sur l'écran d'accueil.

## Structure

- `index.html` : interface + styles
- `app.js` : logique tâches, focus, timer, templates
- `manifest.json` : configuration PWA
- `sw.js` : cache offline
- `netlify.toml` : configuration Netlify
