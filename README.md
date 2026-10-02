# New Shape – suivi de musculation

Application web (PWA, hors-ligne, en français) pour suivre ta progression en musculation : programme personnalisé, carnet de séances, composition corporelle et nutrition.

## Fonctionnalités

- **Programme sur mesure** généré à partir du profil (objectif, niveau, jours, durée de séance, matériel, muscles prioritaires) :
  - split selon le nombre de séances : full body (2–3 j), upper/lower (4 j), upper/lower + PPL (5 j), PPL ×2 (6 j) ;
  - chaque muscle travaillé 2×/semaine, 10–20 séries hebdomadaires selon le niveau, plafonné par la durée de séance ;
  - aperçu du volume par muscle comparé aux repères MEV / MAV / MRV de Renaissance Periodization.
- **Bibliothèque de 26 programmes** inspirés de coachs et de chercheurs reconnus, chacun avec ses sources et une analyse au regard des méta-analyses (volume, fréquence, proximité de l’échec) :
  - force : StrongLifts 5×5, Starting Strength (Rippetoe), Texas Method (Rippetoe & Kilgore), Madcow 5×5 (Bill Starr), 5/3/1 BBB (Wendler) ;
  - force + muscle : GZCLP (Lefever), PHUL (Campbell), PHAT (Layne Norton) ;
  - hypertrophie : Muscle & Strength Pyramid (Eric Helms), Generic Bulking Routine (Lyle McDonald), German Volume Training (Poliquin), FST-7 (Hany Rambod), Golden Six (attribué à Arnold), Strong Curves (Bret Contreras), PPL r/Fitness, Upper/Lower « science-based », full body haltères ;
  - haute intensité : Blood & Guts (Dorian Yates) ; poids du corps : Recommended Routine (r/bodyweightfitness, Steven Low) ;
  - séances courtes (15–30 min) : 7-Minute Workout (Klika & Jordan, ACSM), Minimum efficace en supersets (Iversen, Schoenfeld et al. 2021), Easy Strength (Dan John & Pavel Tsatsouline), Simple & Sinister et Power to the People (Pavel Tsatsouline, StrongFirst), Armor Building Complex (Dan John), Tabata au poids du corps ;
  - filtres par méthode, tableau comparatif calculé (séries dures / semaine, fréquence par muscle, part de séries lourdes, durée, muscles sous le minimum efficace) et tri selon le niveau, le matériel, l’objectif et le nombre de séances.
- **Carnet de séance** : charges et reps pré-remplies, suggestion de surcharge progressive (progression linéaire ou double progression, décharge après 3 échecs), RIR, minuteur de repos, exercices libres, notes.
- **Composition corporelle** : poids lissé (moyenne mobile exponentielle), % de gras (saisi ou estimé par la méthode US Navy), masses grasse/maigre, FFMI, mensurations, graphiques.
- **Balance à bio-impédance (Tanita BC-545N…)** : saisie des valeurs dans l’ordre d’affichage de la balance (% gras, eau, muscle, masse physique, os, calories, âge métabolique, graisse viscérale) et de l’analyse segmentaire (bras, jambes, tronc), avec tendances lissées, interprétation et détection d’asymétries.
- **Marche** : au choix tapis (vitesse + durée + inclinaison) ou montre / podomètre (nombre de pas) → distance, dénivelé, pas et calories nettes (équation de marche ACSM), historique sur 14 jours.
- **Nutrition** : métabolisme (Mifflin-St Jeor ou Katch-McArdle) × activité quotidienne hors sport, **+ moyenne sur 14 jours de la dépense des séances et de la marche** (cible stable chaque jour), calories et macros selon l’objectif, **ajustement adaptatif** à partir de la tendance réelle du poids.
- **Progrès** : 1RM estimé par exercice, records, volume hebdomadaire par muscle, tonnage.
- **Connexion GitHub** : les données sont sauvegardées dans un gist secret du compte de l’utilisateur et synchronisées entre ses appareils (fusion automatique si deux appareils ont été modifiés en parallèle, hors-ligne compris).
- **Amis** : chacun peut activer le partage de ses progrès (gist **public** de son compte, résumé : 1RM estimés, régularité, dernières séances et, au choix, poids et composition). On ajoute un ami par son pseudo GitHub pour comparer les courbes (en kg ou en % de progression), la régularité et l’évolution du poids.
- Sans connexion : données dans le navigateur, export / import JSON. Thème clair / sombre.

## Design

- **Logo** : un kettlebell traversé par une courbe qui monte (la musculation + la progression), en dégradé bleu → vert. Source : `public/icon.svg` ; les icônes PNG de l’app (iPhone, Android) se régénèrent avec `node scripts/icons.cjs` (Playwright).
- **Typographie** : Barlow pour le texte, Barlow Condensed pour les titres, le logo et les chiffres (licence SIL OFL), auto-hébergées via Fontsource : pas d’appel à Google Fonts, l’app reste utilisable hors-ligne.
- **Couleurs** : bleu `#2563eb`, vert `#10b981`, bouton d’action vert `#22c55e`, barres de navigation bleu nuit. Contrastes vérifiés (WCAG AA) et palette des graphiques validée pour le daltonisme.
- **Responsive** : onglets en bas sur iPhone (zones sûres de l’encoche gérées), rail d’icônes à gauche sur iPad, barre latérale complète sur ordinateur ; 16 px minimum dans les champs pour éviter le zoom de Safari iOS.
- Inspirations : Whoop (chiffres massifs, mode sombre), Strava (cartes et bouton d’action franc), Nike Training Club (titres condensés en capitales), Apple Fitness (anneau de régularité), Hevy / Strong (séries validées en vert).

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
  components/  UI partagée, logo, formulaire de profil, barres de volume
auth-worker/   proxy OAuth (Cloudflare Worker)
scripts/       génération des icônes PNG à partir du logo
```

Les valeurs calculées sont des estimations ; elles ne remplacent pas l’avis d’un professionnel de santé.
