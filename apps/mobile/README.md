# Mon Petit Voyageur — Flutter

Client natif iOS/Android du serveur Mon Petit Voyageur, indépendant du site React.

## Fonctions intégrées

- Inscription, connexion email, session conservée dans le stockage sécurisé, retour à la connexion en cas d’expiration.
- Préparation de voyage : préférences, globe embarqué, suivi de génération borné et reprise sur erreur réseau temporaire.
- Brouillon de description, destination, départ et budget conservé après fermeture de l’application.
- Voyages enregistrés, programme, vols, hébergements, liens de réservation.
- Carte interactive OpenStreetMap avec marqueurs et itinéraire vers chaque adresse dans Google Maps. Les marqueurs représentent des lieux, pas un trajet calculé entre les arrêts.
- Activités terminées, sélection des options payantes, déplacement entre jours, retrait et annulation de la dernière modification.
- Choix d’hôtel, budget des activités/hôtel/transports renseignés, sauvegarde des hypothèses.
- Guide PDF partagé via la feuille native et envoi du guide à l’email du compte sur demande explicite.
- Compagnon Premium par voyage : devises, dépenses de groupe en EUR, remboursements au centime, carnet de 30 photos, prise de vue/galerie, export PDF du carnet et découvertes à proximité.
- Upsells contextuels avant le départ et depuis le voyage ; écran Compte avec mensuel 5,99 €, annuel 49 € et Premium 9,99 €/mois. Un abonné existant est dirigé vers la gestion de formule pour éviter un second abonnement. Les droits sont actualisés au retour du navigateur.

Les dépenses ne déclenchent aucun transfert bancaire ; le propriétaire du compte gère le groupe. Les cartes et la recherche à proximité nécessitent le réseau. Le stockage des photos est limité à 30 images optimisées par voyage. Les erreurs de révision empêchent d’écraser une modification concurrente et proposent de recharger les données.

## État des intégrations externes au 8 septembre 2026

Les routes Premium du serveur public ont été déployées et leur protection a été vérifiée (401 sans session). Les 105 tests API passent.

**Stripe n’est pas configuré** dans l’environnement de production : `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_PREMIUM` sont absents. Les boutons d’achat restent désactivés lorsque le serveur annonce cette indisponibilité. Pour activer : créer/configurer les trois prix récurrents et le webhook Stripe sur `/api/billing/webhook`, puis configurer le portail client pour les changements de formule. Premium est une formule donnant aussi accès à la planification, pas un cumul automatique de deux souscriptions. Son prix est contrôlé côté serveur : 999 centimes EUR/mois.

**Google Places n’est pas configuré** : `GOOGLE_MAPS_API_KEY` est absent en production. Activer Places API (New) et sa facturation dans le projet Google, puis renseigner la clé côté serveur uniquement. La fonction affiche l’indisponibilité réelle tant que cette configuration manque. La carte OpenStreetMap et les liens externes ne nécessitent pas cette clé.

Le client de test utilise Stripe dans le navigateur. **StoreKit / Google Play Billing et leur validation serveur ne sont pas implémentés** ; la distribution en boutique nécessite de préparer le canal de paiement adapté et les signatures. Aucun achat ni abonnement réel n’a été souscrit pendant le développement. Google OAuth n’est pas encore porté dans le client natif ; les comptes email utilisent l’API existante.

## Commandes

Utiliser le SDK Flutter et son Dart associé :

```sh
flutter pub get
flutter analyze
flutter test
flutter run
flutter build apk --release --split-per-abi
flutter build ios --simulator
```

API HTTPS de production par défaut. Surcharge : `--dart-define=API_URL=https://votre-api.example`. Aucune clé privée fournisseur dans l’application.

- APK optimisé ARM64 : `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`.
- iOS Simulator : `build/ios/iphonesimulator/Runner.app`.

Les APK utilisent la clé de test ; pas de signature de distribution. Conserver la signature ad hoc du simulateur : `--no-codesign` peut bloquer Keychain. Le binaire simulateur ne s’installe pas sur un iPhone physique.

## Validation

`flutter analyze` sans anomalie ; 9 tests Flutter réussis : session, refus d’accès, reprise réseau, saisie et globe sur écran étroit, sommes et remboursements, achats désactivés sans Stripe et formulaire Premium sur petit écran. Les tests de services utilisent des réponses simulées. Les tests avec achat réel, compte abonné réel, caméra physique et permissions sur appareils réels restent nécessaires avant distribution.
