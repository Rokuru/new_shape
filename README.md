# New Shape – suivi de musculation

Application web (PWA, hors-ligne, en français) pour suivre ta progression en musculation : programme personnalisé, carnet de séances, composition corporelle et nutrition.

## Fonctionnalités

- **Programme sur mesure** généré à partir du profil (objectif, niveau, jours, durée de séance, matériel, muscles prioritaires) :
  - split selon le nombre de séances : full body (2–3 j), upper/lower (4 j), upper/lower + PPL (5 j), PPL ×2 (6 j) ;
  - chaque muscle travaillé 2×/semaine, 10–20 séries hebdomadaires selon le niveau, plafonné par la durée de séance ;
  - aperçu du volume par muscle comparé aux repères MEV / MAV / MRV de Renaissance Periodization.
- **Bibliothèque de programmes** inspirés de méthodes connues : StrongLifts/Starting Strength 5×5, GZCLP, 5/3/1 BBB (Wendler), PHUL, PPL r/Fitness, Upper/Lower « science-based » (Nippard, Israetel, Schoenfeld), full body haltères.
- **Carnet de séance** : charges et reps pré-remplies, suggestion de surcharge progressive (progression linéaire ou double progression, décharge après 3 échecs), RIR, minuteur de repos, exercices libres, notes.
- **Composition corporelle** : poids lissé (moyenne mobile exponentielle), % de gras (saisi ou estimé par la méthode US Navy), masses grasse/maigre, FFMI, mensurations, graphiques.
- **Nutrition** : métabolisme (Mifflin-St Jeor ou Katch-McArdle), dépense totale, calories et macros selon l’objectif, **ajustement adaptatif** à partir de la tendance réelle du poids.
- **Progrès** : 1RM estimé par exercice, records, volume hebdomadaire par muscle, tonnage.
- Données stockées localement (navigateur), export / import JSON, thème clair / sombre.

## Démarrer

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # tests unitaires (calculs, progression, générateur)
npm run build     # build de production dans dist/
```

Le dossier `dist/` est statique : il peut être hébergé sur GitHub Pages, Netlify, Vercel… Sur mobile, « Ajouter à l’écran d’accueil » pour l’utiliser comme une app.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` teste, construit et publie `dist/` sur la branche `gh-pages` à chaque push.
Une seule fois : **Settings → Pages → Source : Deploy from a branch → `gh-pages` / `(root)`**.
L’app est alors servie sur `https://rokuru.github.io/new_shape/`.

## Structure

```
src/
  data/        exercices et programmes de référence
  lib/         calculs (calc), progression, générateur, store (zustand + localStorage)
  pages/       Accueil, Séance, Programmes, Corps, Nutrition, Progrès, Profil
  components/  UI partagée, formulaire de profil, barres de volume
```

Les valeurs calculées sont des estimations ; elles ne remplacent pas l’avis d’un professionnel de santé.
