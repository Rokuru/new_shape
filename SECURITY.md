# Sécurité de New Shape

New Shape est une application web statique (GitHub Pages). Il n'y a ni serveur ni base de données :
les données restent dans le navigateur et, si l'utilisateur se connecte, dans **un gist de son propre compte GitHub**.
Aucune donnée de paiement n'est manipulée. Les données sensibles sont les données de santé (poids, composition, repas).

## Ce qui protège les données

| Risque | Protection |
| --- | --- |
| Se faire passer pour quelqu'un d'autre | L'identité vient uniquement de GitHub (`/user` avec le jeton de l'utilisateur). Le partage d'un ami est lu dans les gists publics **de son compte** : personne ne peut publier au nom d'un autre. Le nom et l'avatar affichés pour un ami viennent de l'API GitHub, jamais du fichier qu'il publie. |
| Lire les données d'un autre utilisateur | Les données complètes sont dans un gist **secret** du compte de chacun ; l'app ne lit que les gists du jeton connecté. Seul le partage (désactivé par défaut, explicitement activé) est public. |
| Vol du jeton GitHub | Politique de sécurité du contenu (CSP) stricte : seuls les scripts de l'app s'exécutent et les données ne peuvent partir que vers `api.github.com`, `gist.githubusercontent.com` et le proxy OAuth. Aucun HTML injecté (React échappe tout le texte), liens externes limités à `https`. Permission demandée minimale (`gist`). À la déconnexion, le jeton est révoqué chez GitHub (proxy à jour requis). |
| Connexion détournée (CSRF OAuth) | Paramètre `state` aléatoire (128 bits) vérifié au retour ; le code est retiré de l'URL immédiatement ; le secret OAuth n'existe que dans le Worker Cloudflare. Le Worker n'accepte que l'origine de l'app (et, une fois mis à jour, que son adresse de retour). |
| Fichier piégé (import, gist modifié, partage d'un « ami ») | Toutes les données externes sont revalidées champ par champ (`src/lib/sanitize.ts`, `parseShare`) : types, bornes, dates, liens `https`, tailles maximales ; les entrées invalides sont écartées. Un fichier importé ne peut pas activer le partage public. Si un écran plante malgré tout, un écran de secours permet de revenir à l'accueil ou de télécharger ses données. |
| Clickjacking | L'app refuse de s'afficher dans le cadre (iframe) d'un autre site. |
| Dépendances vulnérables | `npm audit` : 0 vulnérabilité connue ; dépendances à jour ; toutes issues du registre officiel npm (lockfile). |

## Limites connues (choix assumés)

- **Le jeton est stocké dans le navigateur** (`localStorage`). Une page statique ne peut pas utiliser de cookie
  protégé côté serveur. La CSP rend son vol très difficile ; se déconnecter le révoque.
- **La permission `gist` donne accès à tous les gists du compte**, pas seulement à celui de l'app : GitHub ne propose
  pas de permission plus fine pour les applications OAuth. Pour limiter ce risque, utiliser un compte dont les gists
  ne contiennent rien d'autre, ou un jeton personnel avec date d'expiration.
- **Un gist « secret » n'est pas chiffré** : il n'est pas listé ni indexé, mais quelqu'un qui connaîtrait son adresse
  exacte (identifiant aléatoire de 32 caractères, jamais publié par l'app) pourrait le lire. Un chiffrement de bout en bout
  imposerait une phrase secrète à saisir sur chaque appareil, sans récupération possible en cas d'oubli.
- **Le partage avec les amis est public** : toute personne connaissant le pseudo peut le lire. Il ne contient que des
  résumés (charges, séances par semaine, poids hebdomadaire si choisi), les jours mais plus les heures, et la liste d'amis
  sous forme d'empreintes plutôt qu'en clair. Les anciennes versions (historique public du gist) sont effacées : le gist de
  partage est recréé une fois lors du passage à ce format.
- **Pas de PKCE** dans la connexion OAuth : le `state` et la suppression immédiate du code couvrent les risques de ce
  parcours (redirection en https vers l'app elle-même).

## Mettre à jour le Worker (révocation du jeton, contrôles renforcés)

Le fichier `auth-worker/worker.js` du dépôt ajoute la révocation du jeton à la déconnexion (`POST /revoke`) et des contrôles
supplémentaires (adresse de retour, type de contenu, réponses non mises en cache). Pour l'activer :

- Tableau de bord Cloudflare → *Workers & Pages* → `new-shape-auth` → *Edit code* → coller `auth-worker/worker.js` → *Deploy* ;
- ou `cd auth-worker && npx wrangler deploy`.

Le secret `GITHUB_CLIENT_SECRET` déjà enregistré est conservé. Tant que le Worker n'est pas mis à jour, l'app fonctionne
normalement ; seule la révocation à la déconnexion est sans effet (on peut révoquer à la main dans
GitHub → *Settings → Applications → Authorized OAuth Apps*).

## Signaler un problème

Ouvrir une *issue* sur le dépôt sans y mettre de données personnelles ni de jeton.
