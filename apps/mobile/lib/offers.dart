import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';

class OffersPage extends StatefulWidget {
  final TravelApi api;
  final bool embedded;
  final Map<String, dynamic> user;
  final ValueChanged<Map<String, dynamic>> onUser;
  const OffersPage({
    super.key,
    required this.api,
    this.embedded = false,
    required this.user,
    required this.onUser,
  });
  @override
  State<OffersPage> createState() => _OffersPageState();
}

class _OffersPageState extends State<OffersPage> with WidgetsBindingObserver {
  late Map<String, dynamic> user = widget.user;
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  Future<void> refresh() async {
    try {
      final next = Map<String, dynamic>.from(
        await widget.api.request('/api/auth/me'),
      );
      if (mounted) {
        setState(() => user = next);
        widget.onUser(next);
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> checkout(String plan) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final active = [
        'active',
        'trialing',
      ].contains(user['subscription_status']);
      final result = await widget.api.request(
        active ? '/api/billing/portal' : '/api/billing/checkout',
        method: 'POST',
        body: active ? null : {'plan': plan},
      );
      final uri = Uri.parse(result['url']);
      if (uri.scheme != 'https' ||
          !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('Impossible d’ouvrir le paiement sécurisé.');
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: widget.embedded ? null : AppBar(title: const Text('Votre formule')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            user['has_premium'] == true
                ? 'Vous voyagez en Premium'
                : 'Avant le départ. Pendant le voyage.',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 12),
          Text(
            'Formule actuelle : ${const {'monthly': 'Mensuelle', 'annual': 'Annuelle', 'premium': 'Premium'}[user['subscription_plan']] ?? 'Aucune'} · ${const {'active': 'Active', 'trialing': 'Essai en cours', 'past_due': 'Paiement à régulariser', 'canceled': 'Résiliée'}[user['subscription_status']] ?? 'Sans abonnement'}',
          ),
          if (user['billing_enabled'] != true)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'Les offres sont présentées ci-dessous. Les paiements ne sont pas encore activés ; aucun achat ne peut être effectué pour le moment.',
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          for (final offer in [
            (
              'monthly',
              'Planification mensuelle',
              '5,99 € / mois',
              'Voyages personnalisés, programme détaillé et guides.',
            ),
            (
              'annual',
              'Planification annuelle',
              '49 € / an',
              'Les mêmes fonctions, avec 32 % d’économie sur le tarif mensuel.',
            ),
            (
              'premium',
              'Voyage Premium',
              '9,99 € / mois',
              'Planification et compagnon sur place : conversion de devises, comptes entre amis, carnet photo et découvertes à proximité.',
            ),
          ])
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (offer.$1 == 'premium')
                      const Chip(label: Text('PENDANT LE VOYAGE')),
                    Text(
                      offer.$2,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      offer.$3,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    Text(offer.$4),
                    const SizedBox(height: 16),
                    if (user['subscription_plan'] == offer.$1 &&
                        user['has_access'] == true)
                      const Text('Votre formule actuelle')
                    else
                      FilledButton(
                        onPressed: busy || user['billing_enabled'] != true
                            ? null
                            : () => checkout(offer.$1),
                        child: Text(
                          [
                                'active',
                                'trialing',
                              ].contains(user['subscription_status'])
                              ? 'Modifier ma formule'
                              : 'Choisir cette formule',
                        ),
                      ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),
          const Text(
            'Abonnement renouvelé automatiquement jusqu’à résiliation. Le montant, les conditions et l’éventuel essai sont confirmés sur la page de paiement avant validation. Vous pouvez gérer votre formule depuis votre compte.',
          ),
          TextButton(
            onPressed: busy || user['billing_enabled'] != true
                ? null
                : () => checkout('monthly'),
            child: const Text('Gérer mon abonnement'),
          ),
          OutlinedButton.icon(
            onPressed: refresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Actualiser mes droits'),
          ),
          TextButton(
            onPressed: () => launchUrl(
              Uri.parse('https://www.monpetitvoyageur.com/?legal=sales'),
              mode: LaunchMode.externalApplication,
            ),
            child: const Text('Conditions de vente'),
          ),
        ],
      ),
    ),
  );
}

class PremiumUpsell extends StatelessWidget {
  final VoidCallback onTap;
  const PremiumUpsell({super.key, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    color: const Color(0xFF123746),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.auto_awesome, color: Color(0xFFE9C88E)),
          const SizedBox(height: 12),
          const Text(
            'Votre compagnon sur place',
            style: TextStyle(color: Colors.white, fontSize: 22),
          ),
          const SizedBox(height: 8),
          const Text(
            'Comptes entre amis, souvenirs photo, devises et bonnes adresses à proximité.',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: onTap,
            child: const Text('Découvrir Premium · 9,99 €/mois'),
          ),
        ],
      ),
    ),
  );
}
