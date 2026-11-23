# Cap Trail

Appli web personnelle de gestion d'entraînement (trail et renfo), saison 2026-2027.

- Un seul fichier `index.html`, sans serveur ni compte.
- Données stockées dans le navigateur (localStorage), sauvegarde et analyse via export JSON.
- Synchronisation Strava via un petit relais Cloudflare (`worker/strava-relay.js`).
- Import CSV Runalyze : distance, s, elevationUp, elevationDown, vo2max, pulseAvg, pulseMax, sportid, percentageHilly, time, title.

En ligne : https://ratapouik.github.io/cap-trail/

## Configurer la synchro Strava (une seule fois, ~20 min)

### 1. Créer l'application Strava
1. Aller sur https://www.strava.com/settings/api
2. Remplir : nom « Cap Trail », catégorie « Training », site web `https://ratapouik.github.io/cap-trail/`,
   **Authorization Callback Domain : `ratapouik.github.io`**.
3. Noter le **Client ID** et le **Client Secret**.

### 2. Déployer le relais Cloudflare
1. Créer un compte gratuit sur https://dash.cloudflare.com
2. Menu **Compute (Workers) > Workers & Pages > Create > Create Worker** (modèle « Hello World »),
   nom : `cap-trail-strava`, puis **Deploy**.
3. **Edit code** : remplacer tout le contenu par celui de `worker/strava-relay.js`, puis **Deploy**.
4. Onglet **Settings > Variables and Secrets** :
   - `STRAVA_CLIENT_ID` (type Text) = Client ID
   - `STRAVA_CLIENT_SECRET` (type **Secret**) = Client Secret
   puis **Deploy**.
5. Noter l'URL du worker (ex. `https://cap-trail-strava.<compte>.workers.dev`).
   En l'ouvrant dans le navigateur, on doit lire « Relais Strava Cap Trail opérationnel » et `"configure": true`.

### 3. Connecter l'appli
1. Ouvrir l'appli > onglet **Import / Export**.
2. Coller le Client ID et l'URL du relais, cliquer **Connecter Strava**, autoriser l'accès sur Strava.
3. Au retour, l'appli récupère automatiquement les 6 derniers mois d'activités.
   Ensuite, le bouton **↻ Strava** du journal récupère les nouvelles séances.

### Sécurité
- La clé secrète ne quitte jamais Cloudflare ; le relais n'accepte que les requêtes venant de `ratapouik.github.io`
  et ne fait que de la lecture.
- Les jetons Strava restent dans le navigateur et ne figurent pas dans l'export JSON.
- Accès révocable à tout moment : Strava > Paramètres > Mes applications.
