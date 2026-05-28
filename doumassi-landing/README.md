# DOUMASSI Landing

Mini-site statique déployé sur Vercel à `https://doumassi.app/`. Sert :

- La page d'accueil — placeholder boutons stores (à brancher quand l'app sera publiée)
- Les fichiers `.well-known/` requis pour les **universal links** iOS et **app links** Android (#56)
- Une route catch-all (`/post/:id`, `/profile/:id`, `/story/:id`) qui sert le même `index.html` avec un bandeau « ouvrez l'app » personnalisé selon le contenu

## Déploiement

Vercel auto-déploie sur chaque push vers `dev` ou `main`. Aucune build step (HTML statique).

**Root directory** : `doumassi-landing/` (configurable dans Settings > General du projet Vercel).

## :warning: Placeholders à compléter avant la mise en prod

Les 2 fichiers `.well-known/` contiennent des placeholders à remplacer par les vraies valeurs avant que les universal links / app links ne fonctionnent réellement :

### `apple-app-site-association`

`TEAMID_PLACEHOLDER` → ton **Apple Developer Team ID** (10 caractères alphanumériques).
Récupérer via :

```bash
eas credentials -p ios
# ou Apple Developer → Account → Membership Details
```

### `assetlinks.json`

`SHA256_FINGERPRINT_PLACEHOLDER` → le **SHA-256 fingerprint** du certificat de signature Android.
Récupérer via :

```bash
eas credentials -p android
# ou keytool -list -v -keystore <keystore-path> -alias <alias>
```

## Tests de validation

Une fois déployé sur le domaine `doumassi.app` :

- **iOS AASA** : https://branch.io/resources/aasa-validator/?domain=doumassi.app
- **Android assetlinks** : https://developers.google.com/digital-asset-links/tools/generator

Ces 2 validateurs téléchargent les fichiers `.well-known/` et confirment leur conformité.
