import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'admin_api.dart';

bool firebaseReady = false;
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (const bool.fromEnvironment('FIREBASE_CONFIGURED')) {
    try {
      await Firebase.initializeApp();
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(false);
      firebaseReady = true;
    } catch (_) {
      firebaseReady = false;
    }
  }
  runApp(const AdminApp());
}

const forest = Color(0xff214b39), paper = Color(0xfff4f6f2);
const titles = [
  'Vue d’ensemble',
  'Utilisateurs',
  'Abonnements',
  'Voyages',
  'Clics & trafic',
  'Revenus',
  'Connexions',
];
const icons = [
  Icons.space_dashboard_outlined,
  Icons.people_outline,
  Icons.credit_card,
  Icons.travel_explore,
  Icons.ads_click,
  Icons.receipt_long_outlined,
  Icons.settings_outlined,
];
const statuses = {
  'none': 'Sans abonnement',
  'active': 'Actif',
  'trialing': 'Essai',
  'past_due': 'Impayé',
  'canceled': 'Annulé',
  'paid': 'Payée',
  'open': 'À payer',
  'draft': 'Brouillon',
  'void': 'Annulée',
  'uncollectible': 'Irrécouvrable',
};
String status(dynamic s) => statuses[s] ?? s?.toString() ?? '—';
String date(dynamic s) {
  final d = DateTime.tryParse(s?.toString().replaceFirst(' ', 'T') ?? '');
  return d == null
      ? '—'
      : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

List<Map<String, dynamic>> rows(dynamic s) =>
    s is List ? s.map((r) => Map<String, dynamic>.from(r)).toList() : [];

class AdminApp extends StatelessWidget {
  const AdminApp({super.key});
  @override
  Widget build(BuildContext c) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'MPV Admin',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: forest,
        primary: forest,
        surface: Colors.white,
      ),
      scaffoldBackgroundColor: paper,
      appBarTheme: const AppBarTheme(
        backgroundColor: paper,
        foregroundColor: forest,
        scrolledUnderElevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    ),
    home: Home(api: AdminApi()),
  );
}

class Home extends StatefulWidget {
  final AdminApi api;
  const Home({super.key, required this.api});
  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> with WidgetsBindingObserver {
  Map<String, dynamic>? data, invoices;
  String? error, paymentError;
  int page = 0, days = 30;
  String search = '', filter = '';
  bool busy = false, hidden = false, diagnostics = false;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    setState(() => hidden = s != AppLifecycleState.resumed);
    if (s == AppLifecycleState.resumed &&
        data != null &&
        !widget.api.authenticated) {
      logout();
    }
  }

  void logout() {
    timer?.cancel();
    widget.api.logout();
    setState(() {
      data = null;
      invoices = null;
      error = null;
      page = 0;
      search = '';
      filter = '';
    });
  }

  Future<void> login(String email, String password) async {
    await widget.api.login(email, password);
    final d = await widget.api.dashboard(days);
    if (!mounted) return;
    setState(() => data = d);
    timer?.cancel();
    timer = Timer(const Duration(minutes: 29), () {
      if (mounted) logout();
    });
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final d = await widget.api.dashboard(days);
      if (mounted) setState(() => data = d);
      if (page == 5) await payments();
    } on AdminException catch (e) {
      if (mounted) {
        if (e.status == 401) {
          logout();
          return;
        }
        setState(() => error = e.message);
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> payments() async {
    setState(() {
      invoices = null;
      paymentError = null;
    });
    if (data?['sources']['stripe'] != true) return;
    try {
      final d = await widget.api.payments(days);
      if (mounted) setState(() => invoices = d);
    } on AdminException catch (e) {
      if (mounted) {
        if (e.status == 401) {
          logout();
          return;
        }
        setState(() => paymentError = e.message);
      }
    }
  }

  void go(int i) {
    setState(() {
      page = i;
      search = '';
      filter = '';
    });
    if (i == 5) unawaited(payments());
  }

  void snack(String s) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
    }
  }

  Future<void> open(String url) async {
    final u = Uri.tryParse(url);
    if (u == null || u.scheme != 'https') return;
    try {
      if (!await launchUrl(u, mode: LaunchMode.externalApplication)) {
        snack('Impossible d’ouvrir ce lien.');
      }
    } catch (_) {
      snack('Impossible d’ouvrir ce lien.');
    }
  }

  Future<void> export(
    List<Map<String, dynamic>> list,
    List<String> keys,
  ) async {
    try {
      final width = MediaQuery.sizeOf(context).width;
      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              Uint8List.fromList(utf8.encode(csvExport(list, keys))),
              mimeType: 'text/csv',
              name: 'mpv-admin.csv',
            ),
          ],
          fileNameOverrides: ['mpv-admin.csv'],
          sharePositionOrigin: Rect.fromLTWH(width / 2, 80, 1, 1),
        ),
      );
    } catch (_) {
      snack('Le fichier n’a pas pu être partagé.');
    }
  }

  @override
  Widget build(BuildContext c) {
    if (data == null) return Login(onLogin: login, onForgot: widget.api.forgot);
    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: Text(
              titles[page],
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 21),
            ),
            actions: [
              PopupMenuButton<int>(
                tooltip: 'Période',
                icon: const Icon(Icons.calendar_month_outlined),
                onSelected: (v) {
                  setState(() => days = v);
                  unawaited(load());
                },
                itemBuilder: (_) => [
                  for (final n in [7, 30, 365])
                    PopupMenuItem(value: n, child: Text('$n derniers jours')),
                ],
              ),
              IconButton(
                tooltip: 'Actualiser',
                onPressed: busy ? null : load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          drawer: Drawer(
            child: SafeArea(
              child: Column(
                children: [
                  ListTile(
                    leading: Image.asset(
                      'assets/branding/icon.png',
                      width: 56,
                      semanticLabel: 'Logo Mon Petit Voyageur',
                    ),
                    title: const Text('Mon Petit Voyageur'),
                    subtitle: const Text('Administration privée'),
                  ),
                  const Divider(),
                  ...List.generate(
                    titles.length,
                    (i) => ListTile(
                      selected: page == i,
                      leading: Icon(icons[i]),
                      title: Text(titles[i]),
                      onTap: () {
                        Navigator.pop(context);
                        go(i);
                      },
                    ),
                  ),
                  const Spacer(),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Déconnexion'),
                    onTap: () {
                      Navigator.pop(context);
                      logout();
                    },
                  ),
                ],
              ),
            ),
          ),
          body: RefreshIndicator(
            onRefresh: load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (busy) const LinearProgressIndicator(),
                if (error != null) Notice(error!, warning: true),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'DONNÉES RÉELLES · $days JOURS',
                    style: const TextStyle(
                      fontSize: 11,
                      letterSpacing: 1.5,
                      color: Colors.grey,
                    ),
                  ),
                ),
                ...content(),
              ],
            ),
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: page == 0
                ? 0
                : page == 1 || page == 2
                ? 1
                : page == 3
                ? 2
                : 3,
            onDestinationSelected: (i) => go([0, 1, 3, 6][i]),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.dashboard_outlined),
                label: 'Accueil',
              ),
              NavigationDestination(
                icon: Icon(Icons.people_outline),
                label: 'Clients',
              ),
              NavigationDestination(
                icon: Icon(Icons.luggage_outlined),
                label: 'Voyages',
              ),
              NavigationDestination(icon: Icon(Icons.tune), label: 'Plus'),
            ],
          ),
        ),
        if (hidden)
          const Positioned.fill(
            child: ColoredBox(
              color: forest,
              child: Center(
                child: Icon(Icons.lock_outline, color: Colors.white, size: 48),
              ),
            ),
          ),
      ],
    );
  }

  List<Widget> content() {
    switch (page) {
      case 0:
        return overview();
      case 1:
      case 2:
        return users();
      case 3:
        return trips();
      case 4:
        return traffic();
      case 5:
        return revenue();
      default:
        return settings();
    }
  }

  Widget detail(String title, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(title, style: const TextStyle(color: Colors.grey)),
        ),
        Expanded(
          child: Text(value?.toString() ?? '—', textAlign: TextAlign.end),
        ),
      ],
    ),
  );
  List<Widget> overview() {
    final t = data!['totals'];
    return [
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: forest,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'VOTRE ESPACE DE PILOTAGE',
              style: TextStyle(
                color: Color(0xffb9cea5),
                letterSpacing: 1.3,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Bonjour Marion.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 29,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '${t['registrations']} nouvelle(s) inscription(s) sur la période.',
              style: const TextStyle(color: Color(0xffd6e0d3), height: 1.5),
            ),
            const SizedBox(height: 18),
            Text(
              'Mis à jour le ${date(data!['updated_at'])}',
              style: const TextStyle(color: Color(0xffb9cea5), fontSize: 12),
            ),
          ],
        ),
      ),
      const SizedBox(height: 18),
      LayoutBuilder(
        builder: (c, s) => Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final item in [
              ('Utilisateurs', t['users'], 1),
              ('Abonnements actifs', t['active'], 2),
              ('Voyages', t['trips'], 3),
              ('Essais en cours', t['trialing'], 2),
            ])
              SizedBox(
                width: (s.maxWidth - 12) / 2,
                child: Card(
                  margin: EdgeInsets.zero,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => go(item.$3),
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(icons[item.$3], color: forest),
                          const SizedBox(height: 16),
                          Text(
                            '${item.$2}',
                            style: const TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            item.$1,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      const SectionTitle('À surveiller'),
      Card(
        child: ListTile(
          leading: const Icon(Icons.payment_outlined, color: Colors.orange),
          title: Text('${t['past_due']} paiement(s) en retard'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            go(2);
            setState(() => filter = 'past_due');
          },
        ),
      ),
      if (data!['sources']['stripe'] != true)
        const Notice(
          'Stripe n’est pas encore relié à l’API. Les revenus sont indisponibles.',
          warning: true,
        ),
      const SectionTitle('Accès rapides'),
      Wrap(
        spacing: 8,
        children: [
          ActionChip(
            label: const Text('Clics & trafic'),
            onPressed: () => go(4),
          ),
          ActionChip(label: const Text('Factures'), onPressed: () => go(5)),
        ],
      ),
      const SectionTitle('Inscriptions'),
      if (rows(data!['registrations']).isEmpty)
        const Notice('Aucune inscription sur cette période.'),
      ...rows(data!['registrations']).map(
        (r) => ListTile(
          title: Text(date(r['day'])),
          trailing: Text('${r['count']}'),
        ),
      ),
    ];
  }

  List<Widget> users() {
    final list = rows(data!['users'])
        .where(
          (u) =>
              u['email'].toString().toLowerCase().contains(
                search.toLowerCase(),
              ) &&
              (filter.isEmpty || u['subscription_status'] == filter),
        )
        .toList();
    return [
      TextField(
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'Rechercher par email',
        ),
        onChanged: (v) => setState(() => search = v),
      ),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(
        initialValue: filter,
        decoration: const InputDecoration(labelText: 'Statut'),
        items: [
          const DropdownMenuItem(value: '', child: Text('Tous les statuts')),
          ...statuses.entries
              .take(5)
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))),
        ],
        onChanged: (v) => setState(() => filter = v ?? ''),
      ),
      Row(
        children: [
          Expanded(child: Text('${list.length} compte(s)')),
          TextButton.icon(
            onPressed: () => export(list, [
              'id',
              'email',
              'subscription_status',
              'subscription_plan',
              'created_at',
              'trips',
            ]),
            icon: const Icon(Icons.ios_share, size: 16),
            label: const Text('Exporter'),
          ),
        ],
      ),
      if (list.isEmpty) const Notice('Aucun utilisateur trouvé.'),
      ...list.map(
        (u) => Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(14),
            leading: const CircleAvatar(
              backgroundColor: paper,
              child: Icon(Icons.person_outline, color: forest),
            ),
            title: Text(
              u['email'].toString(),
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            subtitle: Text(
              '${status(u['subscription_status'])} · ${u['trips']} voyage(s)',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showModalBottomSheet(
              context: context,
              useSafeArea: true,
              isScrollControlled: true,
              showDragHandle: true,
              builder: (c) => SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      u['email'],
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                    const SizedBox(height: 18),
                    detail('Statut', status(u['subscription_status'])),
                    detail('Formule', u['subscription_plan'] ?? 'Aucune'),
                    detail('Échéance', date(u['current_period_end'])),
                    detail('Inscription', date(u['created_at'])),
                    detail('Voyages', u['trips']),
                    if (u['stripe_customer_id'] != null)
                      FilledButton.icon(
                        onPressed: () => open(
                          'https://dashboard.stripe.com/customers/${Uri.encodeComponent(u['stripe_customer_id'])}',
                        ),
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('Gérer dans Stripe'),
                      ),
                    const Notice(
                      'Les résiliations et modifications de facturation se font dans Stripe.',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
      Text(
        'Jusqu’à ${data!['limits']['users']} comptes affichés sur ${data!['totals']['users']} au total.',
        style: const TextStyle(color: Colors.grey, fontSize: 12),
      ),
    ];
  }

  List<Widget> trips() {
    final list = rows(data!['trips'])
        .where(
          (t) => '${t['title']} ${t['email']}'.toLowerCase().contains(
            search.toLowerCase(),
          ),
        )
        .toList();
    return [
      TextField(
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'Destination, titre ou email',
        ),
        onChanged: (v) => setState(() => search = v),
      ),
      TextButton.icon(
        onPressed: () =>
            export(list, ['id', 'title', 'email', 'created_at', 'updated_at']),
        icon: const Icon(Icons.ios_share),
        label: Text('Exporter ${list.length} voyage(s)'),
      ),
      if (list.isEmpty) const Notice('Aucun voyage trouvé.'),
      ...list.map(
        (t) => Card(
          child: ExpansionTile(
            leading: const Icon(Icons.flight_takeoff, color: forest),
            title: Text(t['title'] ?? 'Voyage'),
            subtitle: Text(
              t['email'] ?? '',
              style: const TextStyle(fontSize: 12),
            ),
            childrenPadding: const EdgeInsets.all(16),
            children: [
              detail('Créé le', date(t['created_at'])),
              detail('Modifié le', date(t['updated_at'])),
              detail('Référence', t['id']),
            ],
          ),
        ),
      ),
      Text(
        'Jusqu’à ${data!['limits']['trips']} voyages affichés.',
        style: const TextStyle(color: Colors.grey, fontSize: 12),
      ),
    ];
  }

  List<Widget> traffic() {
    final list = rows(data!['metrics']);
    return [
      const SectionTitle('Clics & pages vues'),
      Notice(
        'Mesures depuis le ${date(data!['sources']['tracking_since'])}. Il s’agit d’événements, pas de visiteurs uniques. Les robots et bloqueurs peuvent affecter ces mesures.',
      ),
      if (list.isEmpty) const Notice('Aucun événement sur cette période.'),
      ...list.map(
        (r) => Card(
          child: ListTile(
            leading: Icon(
              r['kind'] == 'click'
                  ? Icons.ads_click
                  : Icons.visibility_outlined,
            ),
            title: Text(
              {
                    'home': 'Accueil',
                    'planner': 'Création de voyage',
                    'booking': 'Réservation',
                    'guide': 'Guide',
                    'other_external': 'Lien externe',
                  }[r['target']] ??
                  r['target'],
            ),
            subtitle: Text(r['kind'] == 'click' ? 'Clics' : 'Pages vues'),
            trailing: Text(
              '${r['count']}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
            ),
          ),
        ),
      ),
    ];
  }

  List<Widget> revenue() {
    if (data!['sources']['stripe'] != true) {
      return [
        const Notice(
          'Stripe n’est pas configuré sur le serveur. Aucun revenu estimé n’est affiché.',
          warning: true,
        ),
        OutlinedButton.icon(
          onPressed: () => open('https://dashboard.stripe.com'),
          icon: const Icon(Icons.open_in_new),
          label: const Text('Ouvrir Stripe'),
        ),
      ];
    }
    if (paymentError != null) {
      return [
        Notice(paymentError!, warning: true),
        TextButton(onPressed: payments, child: const Text('Réessayer')),
      ];
    }
    if (invoices == null) {
      return [const Center(child: CircularProgressIndicator())];
    }
    final list = rows(invoices!['invoices']);
    return [
      if (invoices!['test_mode'] == true)
        const Notice(
          'Mode test Stripe : ces factures ne sont pas des paiements réels.',
          warning: true,
        ),
      Text('Factures créées sur les $days derniers jours.'),
      if (invoices!['has_more'] == true)
        const Notice(
          '100 factures affichées. Consultez Stripe pour les suivantes.',
        ),
      if (list.isEmpty) const Notice('Aucune facture sur cette période.'),
      ...list.map(
        (i) => Card(
          child: ListTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: Text(i['email'] ?? 'Client'),
            subtitle: Text(status(i['status'])),
            trailing: Text(
              '${((i['amount'] as num) / 100).toStringAsFixed(2)} ${i['currency'].toString().toUpperCase()}',
            ),
            onTap: i['url'] == null ? null : () => open(i['url']),
          ),
        ),
      ),
    ];
  }

  List<Widget> settings() => [
    ...List.generate(
      titles.length - 1,
      (i) => Card(
        child: ListTile(
          leading: Icon(icons[i]),
          title: Text(titles[i]),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => go(i),
        ),
      ),
    ),
    const SectionTitle('Connexions'),
    detail('Base de données', 'Railway · Production'),
    detail(
      'Stripe API',
      data!['sources']['stripe'] == true ? 'Configurée' : 'À configurer',
    ),
    detail(
      'Notifications Stripe',
      data!['sources']['webhook'] == true ? 'Configurées' : 'À configurer',
    ),
    detail('Firebase', firebaseReady ? 'Connecté' : 'Configuration en attente'),
    if (firebaseReady)
      SwitchListTile(
        title: const Text('Rapports de plantage'),
        subtitle: const Text(
          'Autoriser Firebase Crashlytics sur cet appareil.',
        ),
        value: diagnostics,
        onChanged: (v) async {
          await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(v);
          setState(() => diagnostics = v);
        },
      ),
    const Notice(
      'Application réservée aux administrateurs autorisés. Votre session expire après 30 minutes.',
    ),
    OutlinedButton.icon(
      onPressed: () =>
          open('https://admin-dashboard-production-b0b2.up.railway.app/'),
      icon: const Icon(Icons.open_in_new),
      label: const Text('Administration web'),
    ),
    TextButton.icon(
      onPressed: logout,
      icon: const Icon(Icons.logout),
      label: const Text('Se déconnecter'),
    ),
  ];
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});
  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.fromLTRB(0, 22, 0, 12),
    child: Text(
      text,
      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
    ),
  );
}

class Notice extends StatelessWidget {
  final String text;
  final bool warning;
  const Notice(this.text, {super.key, this.warning = false});
  @override
  Widget build(BuildContext c) => Container(
    margin: const EdgeInsets.symmetric(vertical: 12),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: warning ? const Color(0xfffff2e6) : const Color(0xffe7eee2),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: warning ? const Color(0xff8b5526) : forest,
        height: 1.5,
      ),
    ),
  );
}

class Login extends StatefulWidget {
  final Future<void> Function(String, String) onLogin;
  final Future<String> Function(String) onForgot;
  const Login({super.key, required this.onLogin, required this.onForgot});
  @override
  State<Login> createState() => _LoginState();
}

class _LoginState extends State<Login> {
  final email = TextEditingController(), password = TextEditingController();
  final form = GlobalKey<FormState>();
  bool forgot = false, busy = false, visible = false;
  String? error, message;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      if (forgot) {
        final m = await widget.onForgot(email.text);
        if (mounted) setState(() => message = m);
      } else {
        await widget.onLogin(email.text, password.text);
        if (mounted) password.clear();
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Image.asset(
                      'assets/branding/logo.png',
                      width: 120,
                      fit: BoxFit.contain,
                      semanticLabel: 'Logo Mon Petit Voyageur',
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Mon Petit Voyageur',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          Text(
                            'ADMINISTRATION PRIVÉE',
                            style: TextStyle(
                              fontSize: 10,
                              letterSpacing: 1.5,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 60),
                Text(
                  forgot ? 'Un nouveau départ.' : 'Bon retour, Marion.',
                  style: const TextStyle(
                    fontSize: 33,
                    fontFamily: 'Georgia',
                    color: forest,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  forgot
                      ? 'Recevez un lien de réinitialisation pour votre accès administrateur.'
                      : 'Votre activité, vos voyageurs et vos abonnements, à portée de main.',
                  style: const TextStyle(
                    color: Colors.grey,
                    height: 1.6,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 25),
                if (error != null) Notice(error!, warning: true),
                if (message != null) Notice(message!),
                Form(
                  key: form,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: email,
                        autocorrect: false,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        decoration: const InputDecoration(
                          labelText: 'Adresse email',
                          prefixIcon: Icon(Icons.alternate_email),
                        ),
                        validator: (s) => s != null && s.contains('@')
                            ? null
                            : 'Indiquez une adresse email valide.',
                      ),
                      if (!forgot) ...[
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: password,
                          obscureText: !visible,
                          enableSuggestions: false,
                          autocorrect: false,
                          autofillHints: const [AutofillHints.password],
                          decoration: InputDecoration(
                            labelText: 'Mot de passe',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              tooltip: visible ? 'Masquer' : 'Afficher',
                              onPressed: () =>
                                  setState(() => visible = !visible),
                              icon: Icon(
                                visible
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                            ),
                          ),
                          validator: (s) => s != null && s.isNotEmpty
                              ? null
                              : 'Indiquez votre mot de passe.',
                          onFieldSubmitted: (_) => submit(),
                        ),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: busy ? null : submit,
                        child: Text(
                          busy
                              ? 'Un instant…'
                              : forgot
                              ? 'Recevoir le lien'
                              : 'Accéder à mon espace',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: busy
                      ? null
                      : () => setState(() {
                          forgot = !forgot;
                          error = null;
                          message = null;
                        }),
                  child: Text(
                    forgot ? 'Revenir à la connexion' : 'Mot de passe oublié ?',
                  ),
                ),
                const SizedBox(height: 40),
                const Text(
                  'Accès sécurisé · Réservé à la gestionnaire',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
