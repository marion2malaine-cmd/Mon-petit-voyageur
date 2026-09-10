# Administration Mon Petit Voyageur

Adresse : https://admin.monpetitvoyageur.com

## Construction

Depuis la racine : `sh apps/admin/build.sh`.
Le point d’entrée `main.tsx` utilise `AdminWorkspace.tsx`. La base API vide est intentionnelle : le navigateur utilise les routes du même domaine, relayées par `server.mjs` vers l’API de production. Ne pas reconstruire sans cette configuration.

Le dossier de déploiement du service Railway `admin-dashboard` doit contenir `Dockerfile`, `server.mjs`, `railway.json` et `dist/` (avec le logo). L’exclusion globale `**/dist` du dépôt impose de préparer un dossier de livraison isolé.

## Backend requis

`admin.ts`, `adminManagement.ts` et `adminSecurity.ts` doivent être livrés ensemble. `server.ts` enregistre les générations et la date des webhooks traités. Les tables `admin_*` sont créées de manière additive dans la base SQLite existante.

Tests : `npm run test -w @mlt/api -- src/test/admin.test.ts src/test/adminManagement.test.ts`.

## Données et limites

- Les graphiques couvrent des jours UTC complets, y compris les jours sans inscription.
- Les fiches et les actions sont réservées aux identifiants `ADMIN_USER_IDS`. Les sessions expirent après 30 minutes et sont révocables.
- La double authentification par email est facultative. Son activation exige le mot de passe actuel et la validation d’un code. Codes valables 10 minutes, cinq essais maximum, usage unique. Une réinitialisation du mot de passe ne désactive pas le second facteur.
- Les notes privées, dépenses et actions de sécurité sont journalisées. Aucun mot de passe ni contenu de note n’est inscrit dans le journal.
- Les dépenses sont saisies manuellement : ce n’est pas une mesure automatique des consommations IA.
- Les revenus concernent uniquement les clients Stripe liés aux utilisateurs de l’application. Devises séparées ; MRR brut normalisé, hors remises, taxes et usage variable. Les limites de pagination sont explicites.
- Les pages vues ne sont pas des visiteurs uniques. La conversion des inscrits en créateurs de voyages porte sur une cohorte de comptes, pas sur les visiteurs anonymes.
- Les générations et webhooks ne disposent pas d’un historique antérieur à la mise en place de leur suivi. Une génération interrompue par un arrêt brutal peut rester « en cours ».
- SMTP : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Liens de récupération : `ADMIN_PUBLIC_URL=https://admin.monpetitvoyageur.com`.

## Livraison du 8 septembre 2026

- Backend : `65ec73b3-33ad-4d4d-a15e-4fe47e5effe5`.
- Administration : `4bc23e78-5dec-41f6-b908-ff1bb4fe2470`.
- Backend livré depuis un instantané de production avec uniquement les modifications d’administration, afin de préserver les autres travaux locaux.
