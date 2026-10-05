# Sécurité de New Shape

New Shape est une application web hébergée par **Cloudflare Pages**. Le site et son serveur sont à la même adresse :
le serveur est dans `functions/` et `server/`, les données dans une base **Cloudflare D1**.
Aucune donnée de paiement n’est manipulée. Les données sensibles sont des données de santé : poids, composition, repas.

## Connexion sans mot de passe

- **Face ID / Touch ID (clé d’accès, WebAuthn)** :
  - la clé privée ne quitte jamais l’appareil ; elle est synchronisée par le trousseau iCloud ou Google ;
  - le serveur ne garde que la clé publique, inutile à un voleur ;
  - la vérification de l’utilisateur (biométrie ou code) est exigée ;
  - chaque défi est aléatoire, à usage unique et valable 5 minutes ;
  - implémentation : `@simplewebauthn/server`.
- **GitHub** : GitHub sert uniquement à prouver l’identité.
  - Connexion et liaison : **aucune permission demandée**. Le jeton GitHub est utilisé côté serveur pour lire le profil, puis **révoqué immédiatement**. Il n’arrive jamais dans le navigateur.
  - Import de l’ancien gist : permission `gist` le temps de l’import uniquement, puis jeton révoqué.
  - Paramètre `state` aléatoire (192 bits) vérifié contre un cookie HttpOnly. Le secret OAuth n’existe que dans les secrets Cloudflare.

## Session

- Cookie `__Host-ns_session` : **HttpOnly** (illisible par le JavaScript de la page, donc impossible à voler par un script injecté), **Secure**, **SameSite=Lax**, valable 60 jours.
- La base ne stocke que le **hachage SHA-256** du jeton de session : une fuite de la base ne permet pas de se connecter.
- Déconnexion : la session est supprimée côté serveur. Un cookie copié ne sert plus à rien.
- Rien de sensible dans le stockage du navigateur : ni jeton, ni mot de passe.

## Ce qui protège les données

| Risque | Protection |
| --- | --- |
| Lire les données d’un autre | Chaque requête est liée au compte de la session. Aucune route ne prend d’identifiant de compte en paramètre, sauf la lecture d’un ami, qui renvoie seulement son résumé et seulement entre amis mutuels. |
| Se faire passer pour quelqu’un | L’identité vient de la session. Le nom et l’avatar d’un ami viennent de son compte sur le serveur, jamais de son partage. Les pseudos sont uniques sans tenir compte de la casse, et les comptes reliés à GitHub sont marqués comme tels. |
| Voir les progrès d’un inconnu | Un partage n’est lisible **qu’entre amis mutuels** : chacun a ajouté l’autre. Il n’y a plus de gist public. La liste d’amis n’est jamais publiée. |
| Requête forcée depuis un autre site (CSRF) | Cookie SameSite=Lax. Toute écriture exige un en-tête `Origin` égal à l’adresse de l’app (403 sinon) et un corps `application/json`. |
| Vol par script injecté (XSS) | React échappe tout le texte. Une CSP stricte en en-tête HTTP n’autorise que les scripts de l’app et n’autorise les connexions que vers son propre serveur. De toute façon, le cookie de session n’est pas lisible par un script. |
| Affichage dans un cadre (clickjacking) | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, et une vérification dans l’app. |
| Données piégées (import, transfert, partage d’un ami) | Tout est revalidé champ par champ (`src/lib/sanitize.ts`, `parseShare`). Tailles limitées : 1,9 Mo de données, 512 Ko de partage, 200 amis. Le transfert depuis l’ancienne adresse n’accepte que les messages venant exactement de `https://rokuru.github.io`. |
| Écrasement entre deux appareils | Écriture conditionnelle (numéro de version) : un appareil en retard reçoit un conflit et fusionne au lieu d’écraser. |
| Données privées en cache | Le service worker ne met jamais en cache les réponses du serveur (`/api/`). Le serveur répond `Cache-Control: no-store`. |
| Dépendances vulnérables | `npm audit` : 0 vulnérabilité connue. Toutes les dépendances viennent du registre officiel npm (lockfile). |

## Tes droits

- **Supprimer son compte** (Profil → Supprimer mon compte) efface définitivement du serveur le compte, les données, le partage, les clés et les sessions, ainsi que les liens d’amitié qui le visent.
- **Export** des données à tout moment (Profil → Exporter).

## Limites connues

- **Données non chiffrées de bout en bout** : elles sont protégées par Cloudflare (chiffrement au repos, accès réservé au compte Cloudflare du propriétaire de l’app). Un chiffrement de bout en bout imposerait une phrase secrète sans récupération possible.
- **Pas de limitation du nombre de créations de compte** par adresse IP. On peut ajouter une règle de *Rate limiting* gratuite dans Cloudflare (Security → WAF) sur `/api/passkey/register/*` si besoin.
- **Pseudo réservé** : un compte Face ID peut choisir un pseudo identique à celui d’un compte GitHub qui n’est pas encore inscrit. Le compte GitHub reçoit alors un pseudo suffixé `-gh`, et le badge GitHub permet de les distinguer.

## Signaler un problème

Ouvrir une *issue* sur le dépôt, sans y mettre de données personnelles.
