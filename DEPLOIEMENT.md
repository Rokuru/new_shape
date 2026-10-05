# Mise en place sur Cloudflare (gratuit, ~10 minutes)

New Shape est hébergé par **Cloudflare Pages** : le site et son serveur (`functions/` + `server/`) sont à la même adresse,
et les données sont dans une base **Cloudflare D1**. L’offre gratuite suffit largement : 100 000 requêtes par jour et 5 Go de base.

Une fois configuré, tout est automatique : chaque PR fusionnée dans `main` est mise en production par Cloudflare.

## 1. Créer le projet Pages relié au dépôt

Tableau de bord Cloudflare → **Workers & Pages** → **Create** → onglet **Pages** (ou lien « Looking to deploy Pages? Get started »)
→ **Import an existing Git repository**.

⚠️ Ne pas créer un **Worker** : si l’écran propose « Deploy command » ou « Build token », ce n’est pas le bon type de projet.

- Dépôt : `Rokuru/new_shape` (autoriser Cloudflare à y accéder si demandé).
- **Project name : `new-shape`**. L’adresse sera `https://new-shape.pages.dev` ; si ce nom est pris, Cloudflare en propose un autre, voir l’étape 6.
- **Production branch** : `main`.
- **Framework preset** : `None`.
- **Build command** : `npm run build`.
- **Build output directory** : `dist`.
- **Root directory** : laisser vide.
- **Environment variables** : `NODE_VERSION` = `22`.

Cliquer **Save and Deploy**. Le premier déploiement peut se terminer avant que la base soit reliée : c’est normal.

## 2. Créer la base de données

**Storage & Databases** → **D1 SQL Database** → **Create** → nom `new-shape` → **Create**.

Les tables se créent toutes seules au premier appel : il n’y a aucun SQL à exécuter.

## 3. Relier la base au projet

Projet `new-shape` → **Settings** → **Bindings** → **Add** → **D1 database** :

- **Variable name** : `DB` (exactement).
- **D1 database** : `new-shape`.

Faire la même chose pour l’environnement **Preview** si Cloudflare le propose séparément, pour pouvoir tester avant la mise en production.

## 4. Connexion GitHub (facultatif mais recommandé)

GitHub → **Settings** → **Developer settings** → **OAuth Apps** → l’application New Shape existante (Client ID `Ov23liyZi5eEiCRHEjXB`) :

- **Homepage URL** : `https://new-shape.pages.dev`
- **Redirect URIs** (GitHub en accepte jusqu’à 10) :
  - `https://new-shape.pages.dev/api/auth/github/callback` (production) ;
  - `https://claude-muscu-tracker.new-shape.pages.dev/api/auth/github/callback` (adresse de test d’une branche, facultatif).
  - Laisser « Allow wildcard matching » **décoché**.
- **Generate a new client secret** et copier la valeur (elle ne s’affiche qu’une fois).

Puis Cloudflare → projet `new-shape` → **Settings** → **Variables and Secrets** :

- `GITHUB_CLIENT_ID` = `Ov23liyZi5eEiCRHEjXB` (type *Text*) ;
- `GITHUB_CLIENT_SECRET` = le secret copié (type **Secret**).

Les variables et la base doivent être définies pour **Production** et pour **Preview** si on veut tester une branche avant la fusion.

## 5. Redéployer

Projet `new-shape` → **Deployments** → sur le dernier déploiement : **⋯** → **Retry deployment**, pour que la base et les variables soient prises en compte.

**Pour vérifier** :
- `https://new-shape.pages.dev/api/me` doit répondre `{"error":"not_signed_in"}` ;
- `database_not_configured` veut dire que la base n’est pas reliée (étape 3) ;
- `github_not_configured` (à la connexion GitHub) veut dire que les variables de l’étape 4 manquent.

**Tester avant la mise en production** : chaque branche poussée sur GitHub est déployée à une adresse de test,
par exemple `https://claude-muscu-tracker.new-shape.pages.dev` (onglet *Deployments*, ligne « Preview »).
Tant que la PR n’est pas fusionnée, `new-shape.pages.dev` sert encore l’ancienne version : sa connexion GitHub n’y fonctionne pas, c’est normal.

## 6. Adresse différente de `new-shape.pages.dev`

Si Cloudflare a donné une autre adresse :

- GitHub → dépôt `Rokuru/new_shape` → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** :
  `NEW_APP_URL` = la vraie adresse, par exemple `https://new-shape-xyz.pages.dev`. La page de déménagement de l’ancienne adresse l’utilisera.
- Mettre cette adresse dans l’application OAuth GitHub (étape 4).

## 7. Après la mise en production

- **Ancienne adresse** (`rokuru.github.io/new_shape`) : elle affiche une page « New Shape a déménagé ».
  - Si l’appareil contient des données, elle propose de les **transférer** vers la nouvelle adresse (ou de les télécharger en fichier).
  - Sinon, elle redirige directement.
- **iPhone / iPad** : supprimer l’ancienne icône de l’écran d’accueil, puis ouvrir la nouvelle adresse dans Safari → **Partager** → **Sur l’écran d’accueil**.
- **Récupérer les données sauvegardées sur GitHub** : nouvelle adresse → **Profil** → se connecter → **Importer depuis mon gist**. L’ancien partage public avec les amis est supprimé au passage.
- **Ménage**, une fois que tout fonctionne :
  - supprimer le Worker `new-shape-auth` (Cloudflare → Workers & Pages) ;
  - si tu le souhaites, supprimer le gist secret `new-shape-data.json` sur https://gist.github.com.

## Développement local

```bash
npm run dev:cf   # build + serveur Cloudflare local (base D1 locale) sur http://localhost:8788
```

Face ID / Touch ID fonctionne aussi en local (`localhost`). Pour tester GitHub en local, créer une autre application OAuth avec
`http://localhost:8788/api/auth/github/callback` et lancer `wrangler pages dev dist --d1 DB --binding GITHUB_CLIENT_ID=… --binding GITHUB_CLIENT_SECRET=…`.
