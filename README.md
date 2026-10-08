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
- **Marche** : au choix tapis (vitesse + durée + inclinaison) ou montre / podomètre (nombre de pas) → distance, dénivelé, pas et calories nettes (équation de marche ACSM). Graphique des calories dépensées sur 14 jours, musculation et marche empilées.
- **Nutrition** : métabolisme (Mifflin-St Jeor ou Katch-McArdle) × activité quotidienne hors sport, **+ moyenne sur 14 jours de la dépense des séances et de la marche** (cible stable chaque jour), calories et macros selon l’objectif, **ajustement adaptatif** à partir de la tendance réelle du poids.
- **Progrès** : 1RM estimé par exercice, records, volume hebdomadaire par muscle, tonnage.
- **Bilan de la semaine pour Claude** (accueil) : séances série par série, progression, volume par muscle, repas, pesées, composition, marche et comparaison avec la semaine précédente, réunis dans un texte qui contient déjà la demande d’analyse de coach. Copier, partager (iPhone : app Claude) ou télécharger ; rien n’est envoyé automatiquement et le prénom n’y figure pas.
- **Compte sans mot de passe** : Face ID / Touch ID (clé d’accès) ou GitHub. Les données sont enregistrées sur le serveur de l’app (Cloudflare D1) et synchronisées entre les appareils (fusion automatique si deux appareils ont été modifiés en parallèle, hors-ligne compris).
- **Amis** : chacun peut activer le partage de ses progrès (résumé : 1RM estimés, régularité, dernières séances et, au choix, poids et composition), visible **uniquement par ses amis mutuels**. On ajoute un ami par son pseudo pour comparer les courbes (en kg ou en % de progression), la régularité et l’évolution du poids.
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

Sur mobile, « Ajouter à l’écran d’accueil » pour l’utiliser comme une app.

## Hébergement et déploiement

- L’app et son serveur sont hébergés par **Cloudflare Pages** (gratuit) : `functions/api/[[path]].ts` et `server/` pour le serveur, base **D1** pour les données. Mise en place pas à pas : [DEPLOIEMENT.md](DEPLOIEMENT.md).
- **`main` = production** : chaque PR fusionnée est construite et publiée automatiquement par Cloudflare. Les PR sont vérifiées (tests + build) par `.github/workflows/deploy.yml`.
- L’ancienne adresse `https://rokuru.github.io/new_shape/` (GitHub Pages) sert une page de déménagement (`legacy/`) : redirection et transfert des données de l’appareil.
- `npm run dev:cf` : app + serveur + base D1 en local sur http://localhost:8788.

## Serveur (API)

| Route | Rôle |
| --- | --- |
| `GET /api/auth/github`, `/api/auth/github/callback` | Connexion, liaison ou import via GitHub (OAuth, jeton révoqué aussitôt) |
| `POST /api/passkey/register/*`, `/api/passkey/login/*` | Création de compte et connexion par Face ID / Touch ID (WebAuthn) |
| `GET /api/me`, `POST /api/logout`, `DELETE /api/account`, `DELETE /api/passkeys/:id` | Compte, session, clés d’accès |
| `GET` / `PUT /api/data` | Données de l’utilisateur (écriture conditionnelle par version, 409 en cas de conflit) |
| `PUT /api/share`, `GET /api/friends/:pseudo` | Partage entre amis mutuels |
| `GET` / `DELETE /api/import` | Données récupérées de l’ancien gist, en attente de fusion par l’app |

Voir [SECURITY.md](SECURITY.md) pour le modèle de sécurité (session HttpOnly, CSRF, CSP, validation, amis mutuels, limites connues).

## Structure

```
src/
  data/        exercices et programmes de référence
  lib/         calculs (calc), progression, générateur, store (zustand + localStorage),
               api (serveur, Face ID, GitHub), sync (synchronisation et fusion),
               share (partage et amis), transfer (déménagement), bia (balance Tanita)
  pages/       Accueil, Séance, Programmes, Corps, Nutrition, Progrès, Amis, Profil
  components/  UI partagée, logo, formulaire de profil, barres de volume
functions/     point d’entrée du serveur (Cloudflare Pages Functions)
server/        serveur : sessions, GitHub, clés d’accès, données, amis (+ tests avec une base SQLite en mémoire)
legacy/        page de déménagement publiée sur l’ancienne adresse GitHub Pages
scripts/       génération des icônes PNG à partir du logo
```

Les valeurs calculées sont des estimations ; elles ne remplacent pas l’avis d’un professionnel de santé.
