# Applications Mon Petit Voyageur

Les projets natifs Capacitor partagent l’interface React du site :
- iOS : `apps/web/ios/App/App.xcodeproj`
- Android : `apps/web/android`
- Compagnon Premium : route `/mobile`, accessible depuis la navigation.

## Préparer les applications

```sh
npm ci
npm run build -w @mlt/contracts
VITE_API_BASE_URL=https://api.monpetitvoyageur.com npm run build -w @mlt/web
npm exec -w @mlt/web -- cap sync
npm exec -w @mlt/web -- cap open ios
npm exec -w @mlt/web -- cap open android
```

Android nécessite Android Studio, le SDK 36 et une version Java compatible avec le Gradle généré. iOS nécessite Xcode. Ne pas publier un bundle utilisant l’API localhost.

## État et limites avant publication

- Mode Premium : conversion Frankfurter, dépenses en EUR à parts égales, carnet de 30 photos optimisées et recherche Google Places dans un rayon de 2 km.
- Groupe de dépenses géré par le propriétaire du compte : pas encore d’invitations multi-comptes ni de transferts bancaires. Aucune intégration à une API Tricount.
- L’accès serveur exige une souscription Premium active et non expirée. Les offres existantes ne donnent pas cet accès.
- Configurer `STRIPE_PRICE_PREMIUM` sur un prix EUR récurrent de 999 centimes/mois pour les achats web. Aucun achat natif n’est implémenté : il faut intégrer StoreKit/Google Play Billing et valider les achats côté serveur avant lancement en boutique.
- Configurer Google Places API (New) et sa facturation. Les appels de proximité peuvent être facturés par Google.
- Déployer les nouveaux endpoints API avant de distribuer les applications. L’origine Android `https://localhost` est autorisée côté API, comme `capacitor://localhost` sur iOS.
- À vérifier sur appareils réels : connexion persistante, capture/choix de photo, refus de localisation, export du carnet (actuellement téléchargement HTML web), reprise réseau, achats/restauration et expiration des droits.
- Finaliser icônes/splash natifs, signature iOS et Android, politique de confidentialité, suppression de compte et fiches des boutiques. Les projets générés ne constituent pas une publication App Store/Play Store.
- Le contrôle des dépendances a signalé 14 vulnérabilités dans l’arbre existant lors de l’installation ; audit et correction contrôlée requis avant diffusion.

Le déploiement web/API, les comptes développeur, les produits des boutiques et les clés de signature ne sont pas créés par ces commandes.

## Correctifs du 7 septembre 2026 — saisie, chargement et responsive

- Description isolée du reste de la page : les frappes successives ne recalculent plus les listes de destinations ni les résultats. Le texte exact reste disponible après une reconnexion dans la même page.
- Globe : emplacement de hauteur explicite, caméra adaptée au format portrait et image de secours conservée jusqu’au chargement de la texture ; animation respectant la préférence de réduction des mouvements.
- Grilles rétractables sur petit écran, contrôles de saisie à 16 px sur mobile et retour à la ligne des contenus longs.
- Suivi de génération : reprise sur incident réseau temporaire, arrêt sur refus d’accès, limite de dix minutes et message de reconnexion sur session expirée. Une erreur de rafraîchissement de la liste ne fait plus échouer un voyage déjà créé.
- Administration et compagnon Premium chargés à l’ouverture de leur page.
- La commande de compilation impose le mode production, même avec la configuration de développement de l’API dans le fichier partagé. Les fichiers natifs ont été contrôlés pour exclure React en mode développement et une adresse API localhost.

Validation : 105 tests API et 10 tests web réussis ; compilation web de production et synchronisation Capacitor iOS/Android réussies ; compilation iOS Simulator réussie avec Xcode 26.6, sans signature. SDK Android absent de cet environnement : compilation Android et essais sur appareils réels restent à effectuer. Aucun parcours de génération avec services payants ni contrôle visuel sur appareil réel n’a été exécuté pendant cette correction.

La référence Sites du dossier web correspond au tableau de bord administrateur. Le site voyageur utilise le service Railway `frontend-web` ; ne pas publier son interface sur le site Sites de l’administration.

## Application Flutter

Le client natif Flutter est désormais dans `apps/mobile`. Consulter `apps/mobile/README.md` pour les fonctions portées, les commandes et les versions de test. Il utilise le serveur existant sans remplacer le site React.

### Extension Flutter — 8 septembre 2026

Carte, modifications du programme, choix d’hôtel, budget des choix, partage PDF, demande d’envoi du guide, brouillon persistant et compagnon Premium sont intégrés. Les trois formules existantes sont présentées dans Compte et les upsells Premium apparaissent dans le parcours voyage. Le serveur public dispose maintenant des routes Premium protégées. Stripe et Google Places restent à configurer ; les achats natifs Apple/Google ne sont pas implémentés. Voir `apps/mobile/README.md` pour les détails et limites vérifiées.
