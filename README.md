# TDAFocus

Application PWA simple pour gérer des tâches, micro-étapes et sessions focus.

## Version

Clean GitHub v1

## Fonctionnalités

- Tableau de tâches local
- Vue Focus du jour
- Vue toutes les tâches
- Priorités et projets
- Micro-étapes
- Timer Focus / pause
- Statistiques locales
- Sauvegarde dans le navigateur via `localStorage`
- PWA installable
- Service worker pour un usage hors-ligne basique

## Installation locale

Le projet est statique. Tu peux l’ouvrir avec un serveur local simple :

```bash
python3 -m http.server 5173
```

Puis ouvrir :

```text
http://localhost:5173
```

## Déploiement Netlify

Deux méthodes :

1. Glisser-déposer le dossier complet dans Netlify.
2. Envoyer le dossier sur GitHub puis connecter le dépôt à Netlify.

Le fichier `netlify.toml` publie directement la racine du projet.

## Important IA

La fonction “Décomposer avec l’IA” appelle actuellement l’API Anthropic depuis le navigateur. Pour une vraie mise en production, il faut passer par une fonction serveur Netlify afin de ne jamais exposer de clé API côté client.

## Structure

```text
index.html
app.js
manifest.json
sw.js
netlify.toml
icons/
```

## Notes

Cette version garde le design d’origine mais retire les emojis visibles pour un rendu plus sobre, plus propre et plus adapté à GitHub.
