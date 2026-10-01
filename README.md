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
- **Balance à bio-impédance (Tanita BC-545N…)** : saisie des valeurs dans l’ordre d’affichage de la balance (% gras, eau, muscle, masse physique, os, calories, âge métabolique, graisse viscérale) et de l’analyse segmentaire (bras, jambes, tronc), avec tendances lissées, interprétation et détection d’asymétries.
- **Marche** : au choix tapis (vitesse + durée + inclinaison) ou montre / podomètre (nombre de pas) → distance, dénivelé, pas et calories nettes (équation de marche ACSM), historique sur 14 jours.
- **Nutrition** : métabolisme (Mifflin-St Jeor ou Katch-McArdle), dépense totale, calories et macros selon l’objectif, **ajustement adaptatif** à partir de la tendance réelle du poids.
- **Progrès** : 1RM estimé par exercice, records, volume hebdomadaire par muscle, tonnage.
- **Connexion GitHub** : les données sont sauvegardées dans un gist secret du compte de l’utilisateur et synchronisées entre ses appareils (fusion automatique si deux appareils ont été modifiés en parallèle, hors-ligne compris).
- **Amis** : chacun peut activer le partage de ses progrès (gist **public** de son compte, résumé : 1RM estimés, régularité, dernières séances et, au choix, poids et composition). On ajoute un ami par son pseudo GitHub pour comparer les courbes (en kg ou en % de progression), la régularité et l’évolution du poids.
- Sans connexion : données dans le navigateur, export / import JSON. Thème clair / sombre.

## Démarrer

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # tests unitaires (calculs, progression, générateur)
npm run build     # build de production dans dist/
```

Le dossier `dist/` est statique : il peut être hébergé sur GitHub Pages, Netlify, Vercel… Sur mobile, « Ajouter à l’écran d’accueil » pour l’utiliser comme une app.

## Déploiement GitHub Pages

- **`main` = production** : chaque push sur `main` (en pratique, chaque PR fusionnée) teste, construit et publie `dist/` sur la branche `gh-pages`.
- **Évolutions par pull request** : travailler sur une branche, ouvrir une PR vers `main` ; le workflow `.github/workflows/deploy.yml` y lance les tests et le build, sans déployer.
Une seule fois : **Settings → Pages → Source : Deploy from a branch → `gh-pages` / `(root)`**.
L’app est alors servie sur `https://rokuru.github.io/new_shape/`.

## Connexion GitHub

Les données de chaque utilisateur sont stockées dans **un gist secret de son propre compte** (`new-shape-data.json`) : pas de base de données à héberger.

Deux façons de se connecter :

1. **Jeton d’accès** (fonctionne sans configuration) : l’utilisateur crée un jeton avec la seule permission `gist` et le colle dans Profil → Compte GitHub.
2. **Bouton « Se connecter avec GitHub »** (OAuth) : à activer une fois, car l’échange du code OAuth exige un secret qui ne peut pas être dans une page statique.
   1. Créer une OAuth App : GitHub → Settings → Developer settings → OAuth Apps → *New OAuth App*
      - Homepage URL et **Authorization callback URL** : `https://rokuru.github.io/new_shape/`
      - Noter le *Client ID* et générer un *Client secret*.
   2. Créer le Worker Cloudflare (offre gratuite) : *Workers & Pages → Create → Hello World*, nom `new-shape-auth`,
      coller le code de `auth-worker/worker.js` (Client ID et origine y sont écrits), puis dans
      *Settings → Variables and Secrets* (variables d’exécution, pas « Build ») : `GITHUB_CLIENT_SECRET` (type Secret).
      (Ou en ligne de commande : `cd auth-worker && npx wrangler deploy && npx wrangler secret put GITHUB_CLIENT_SECRET`.)
   3. Renseigner le Client ID et l’URL du Worker dans `.env.production` (valeurs publiques) et pousser.

Configuration actuelle : Client ID `Ov23liyZi5eEiCRHEjXB`, Worker `https://new-shape-auth.vincent-pedussel.workers.dev`.

Le jeton reste dans le navigateur de l’utilisateur (localStorage) et ne sert qu’à lire / écrire son gist.

### Amis

- Les données complètes restent dans le gist **secret** `new-shape-data.json`.
- Le partage (désactivé par défaut) publie un résumé dans un gist **public** `new-shape-share.json` ; le désactiver supprime ce gist.
- Trouver un ami = lire les gists publics de son compte (`/users/{pseudo}/gists`). La liste d’amis est synchronisée avec le reste des données ; « Ami mutuel » s’affiche quand l’ami vous suit aussi.

## Structure

```
src/
  data/        exercices et programmes de référence
  lib/         calculs (calc), progression, générateur, store (zustand + localStorage),
               github (API, OAuth), sync (synchronisation et fusion),
               share (partage public et amis), bia (balance Tanita)
  pages/       Accueil, Séance, Programmes, Corps, Nutrition, Progrès, Amis, Profil
  components/  UI partagée, formulaire de profil, barres de volume
auth-worker/   proxy OAuth (Cloudflare Worker)
```

Les valeurs calculées sont des estimations ; elles ne remplacent pas l’avis d’un professionnel de santé.
