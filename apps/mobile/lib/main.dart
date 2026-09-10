import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'offers.dart';
import 'premium.dart';
import 'trip_detail.dart';
import 'drafts.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TravelerApp());
}

const ink = Color(0xFF09394D);
const cream = Color(0xFFFAF7EF);
const terracotta = Color(0xFFC9694F);
const softBorder = Color(0xFFD8DDD9);

class TravelerApp extends StatelessWidget {
  final TravelApi? api;
  const TravelerApp({super.key, this.api});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Mon Petit Voyageur',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme:
              ColorScheme.fromSeed(seedColor: ink, surface: cream).copyWith(
            primary: ink,
            secondary: terracotta,
            onSurface: ink,
          ),
          scaffoldBackgroundColor: cream,
          textTheme: const TextTheme(
            headlineLarge: TextStyle(
                fontFamily: 'Georgia',
                fontFamilyFallback: ['Noto Serif'],
                fontSize: 34,
                height: 1.15,
                color: ink),
            headlineMedium: TextStyle(
                fontFamily: 'Georgia',
                fontFamilyFallback: ['Noto Serif'],
                fontSize: 28,
                height: 1.2,
                color: ink),
            bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: ink),
            bodyMedium:
                TextStyle(fontSize: 15, height: 1.45, color: Color(0xFF60727B)),
          ),
          appBarTheme: const AppBarTheme(
              backgroundColor: cream,
              foregroundColor: ink,
              elevation: 0,
              scrolledUnderElevation: 0,
              centerTitle: true),
          navigationBarTheme: NavigationBarThemeData(
            backgroundColor: Colors.white,
            indicatorColor: const Color(0xFFE3EFF1),
            elevation: 0,
            labelTextStyle: WidgetStateProperty.resolveWith((states) =>
                TextStyle(
                    fontSize: 11,
                    color: ink,
                    fontWeight: states.contains(WidgetState.selected)
                        ? FontWeight.w700
                        : FontWeight.w500)),
          ),
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: softBorder)),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: softBorder)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: const BorderSide(color: ink, width: 1.5)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
            labelStyle: const TextStyle(color: Color(0xFF60727B), fontSize: 15),
            filled: true,
            fillColor: Colors.white,
          ),
          chipTheme: ChipThemeData(
            backgroundColor: Colors.white,
            selectedColor: ink,
            checkmarkColor: Colors.white,
            shape: const StadiumBorder(),
            side: const BorderSide(color: softBorder),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            labelStyle: const TextStyle(fontSize: 15, color: ink),
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
                minimumSize: const Size(48, 54),
                backgroundColor: terracotta,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18))),
          ),
        ),
        home: Home(api: api ?? TravelApi()),
      );
}

class Home extends StatefulWidget {
  final TravelApi api;
  const Home({super.key, required this.api});
  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  final description = TextEditingController(),
      email = TextEditingController(),
      password = TextEditingController();
  final destination = TextEditingController(),
      departure = TextEditingController(),
      budget = TextEditingController();
  Map<String, dynamic>? user;
  List<dynamic> trips = [];
  bool initializing = true, busy = false, register = false, planning = false;
  String? error;
  int page = 0, days = 7, travelers = 2, generation = 0;
  String pace = 'moderate', shape = 'base';
  final styles = <String>{};
  final drafts = const DraftStore();
  Timer? draftTimer;
  Future<void> restoreDraft() async {
    final d = await drafts.read();
    if (!mounted) return;
    description.text = d['description'] as String? ?? '';
    destination.text = d['destination'] as String? ?? '';
    departure.text = d['departure'] as String? ?? '';
    budget.text = d['budget'] as String? ?? '';
    for (final c in [description, destination, departure, budget]) {
      c.addListener(saveDraft);
    }
  }

  void saveDraft() {
    draftTimer?.cancel();
    draftTimer = Timer(const Duration(milliseconds: 400), () {
      unawaited(
        drafts.write({
          'description': description.text,
          'destination': destination.text,
          'departure': departure.text,
          'budget': budget.text,
        }).catchError((_) {}),
      );
    });
  }

  @override
  void initState() {
    super.initState();
    widget.api.onSessionExpired = () {
      if (mounted) {
        setState(() => user = null);
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    };
    restoreDraft();
    boot();
  }

  Future<void> boot() async {
    try {
      await widget.api.restore();
      user = Map<String, dynamic>.from(
        await widget.api.request('/api/auth/me'),
      );
      await loadTrips();
    } on ApiException catch (e) {
      if (e.status != 401) error = e.message;
    } catch (_) {
      error = 'Connexion impossible. Vérifiez votre connexion Internet.';
    } finally {
      if (mounted) setState(() => initializing = false);
    }
  }

  Future<void> loadTrips() async {
    final list = await widget.api.request('/api/trips');
    if (mounted) setState(() => trips = list as List);
  }

  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          error = e.message;
          if (e.status == 401) user = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'Connexion interrompue. Réessayez dans un instant.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> authenticate() => run(() async {
        final account = await widget.api.request(
          '/api/auth/${register ? 'register' : 'login'}',
          method: 'POST',
          body: {
            'email': email.text.trim(),
            'password': password.text,
            if (register) 'preferred_language': 'fr',
          },
        );
        if (!mounted) return;
        setState(() {
          user = Map<String, dynamic>.from(account);
          password.clear();
        });
        await loadTrips();
      });
  Future<void> plan() async {
    if (user?['has_access'] == false) {
      setState(() => page = 3);
      return;
    }
    if (description.text.trim().isEmpty && destination.text.trim().isEmpty) {
      setState(
        () => error = 'Décrivez votre voyage ou choisissez une destination.',
      );
      return;
    }
    final amount = budget.text.trim().isEmpty
        ? null
        : double.tryParse(budget.text.replaceAll(',', '.'));
    if (budget.text.isNotEmpty && (amount == null || amount <= 0)) {
      setState(() => error = 'Indiquez un budget positif en euros.');
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    final current = ++generation;
    setState(() => planning = true);
    await run(() async {
      final result = await widget.api.plan(
        description.text.trim().isEmpty
            ? 'Prépare un voyage selon mes critères.'
            : description.text.trim(),
        {
          'destination':
              destination.text.trim().isEmpty ? null : destination.text.trim(),
          'departure_city':
              departure.text.trim().isEmpty ? null : departure.text.trim(),
          'budget_total': amount,
          'duration_days': days,
          'travelers_count': travelers,
          'travel_styles': styles.toList(),
          'pace': pace,
          'trip_shape': shape,
        },
        active: () => mounted && current == generation,
      );
      if (!mounted) return;
      setState(() => planning = false);
      unawaited(loadTrips().catchError((_) {}));
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TripDetail(
            api: widget.api,
            onChanged: () => unawaited(loadTrips().catchError((_) {})),
            user: user!,
            plan: result,
            title: destination.text.isEmpty ? 'Votre voyage' : destination.text,
          ),
        ),
      );
    });
    if (mounted) setState(() => planning = false);
  }

  @override
  void dispose() {
    generation++;
    draftTimer?.cancel();
    for (final c in [
      description,
      email,
      password,
      destination,
      departure,
      budget,
    ]) {
      c.dispose();
    }
    widget.api.close();
    super.dispose();
  }

  Widget field(
    String label,
    TextEditingController controller, {
    bool secret = false,
    int lines = 1,
    TextInputType? keyboard,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextField(
          controller: controller,
          obscureText: secret,
          maxLines: lines,
          keyboardType: keyboard,
          autocorrect: !secret,
          decoration: InputDecoration(labelText: label),
        ),
      );
  @override
  Widget build(BuildContext context) {
    if (initializing) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (planning) return const PlanningScreen();
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 76,
        title: Image.asset('assets/logo.png',
            height: 62, semanticLabel: 'Mon Petit Voyageur'),
        actions: [
          if (user != null)
            IconButton(
              tooltip: 'Déconnexion',
              onPressed: busy
                  ? null
                  : () => run(() async {
                        await widget.api.request(
                          '/api/auth/logout',
                          method: 'POST',
                        );
                        await widget.api.forget();
                        if (mounted) {
                          setState(() {
                            user = null;
                            trips = [];
                          });
                        }
                      }),
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      bottomNavigationBar: user == null
          ? null
          : NavigationBar(
              selectedIndex: page,
              onDestinationSelected: (i) {
                setState(() {
                  page = i;
                  error = null;
                });
                if (i == 1) run(loadTrips);
              },
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.explore_outlined),
                  label: 'Planifier',
                ),
                NavigationDestination(
                  icon: Icon(Icons.luggage_outlined),
                  label: 'Mes voyages',
                ),
                NavigationDestination(
                  icon: Icon(Icons.auto_awesome),
                  label: 'Premium',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  label: 'Compte',
                ),
              ],
            ),
      body: user != null && page == 2
          ? premiumHome()
          : user != null && page == 3
              ? OffersPage(
                  embedded: true,
                  api: widget.api,
                  user: user!,
                  onUser: (u) => setState(() => user = u),
                )
              : SafeArea(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: ListView(
                        padding: const EdgeInsets.all(24),
                        children: [
                          if (error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Semantics(
                                liveRegion: true,
                                child: Card(
                                  color: const Color(0xFFFFE9DF),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Text(error!),
                                  ),
                                ),
                              ),
                            ),
                          if (user == null) ...[
                            Image.asset('assets/logo.png', height: 130),
                            const SizedBox(height: 24),
                            Text(
                              register
                                  ? 'Votre prochaine aventure commence ici'
                                  : 'Heureux de vous retrouver',
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                            const SizedBox(height: 24),
                            field(
                              'Email',
                              email,
                              keyboard: TextInputType.emailAddress,
                            ),
                            field('Mot de passe', password, secret: true),
                            FilledButton(
                              onPressed: busy ? null : authenticate,
                              child: Text(
                                busy
                                    ? 'Connexion…'
                                    : register
                                        ? 'Créer mon compte'
                                        : 'Se connecter',
                              ),
                            ),
                            TextButton(
                              onPressed: busy
                                  ? null
                                  : () => setState(() => register = !register),
                              child: Text(
                                register
                                    ? 'J’ai déjà un compte'
                                    : 'Créer un compte',
                              ),
                            ),
                            TextButton(
                              onPressed: () => openLink(
                                context,
                                'https://www.monpetitvoyageur.com/?legal=privacy',
                              ),
                              child: const Text('Confidentialité'),
                            ),
                          ] else if (page == 0) ...[
                            Text(
                              'Où vous emmène votre curiosité ?',
                              style: Theme.of(context).textTheme.headlineLarge,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'Un voyage pensé pour vos envies, votre rythme et votre budget.',
                            ),
                            const SizedBox(height: 28),
                            Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                    width: 48,
                                    height: 3,
                                    margin: const EdgeInsets.only(bottom: 24),
                                    color: terracotta)),
                            field('Décrivez votre voyage', description,
                                lines: 4),
                            field('Destination (facultatif)', destination),
                            field('Ville de départ', departure),
                            field(
                              'Budget total en € (facultatif)',
                              budget,
                              keyboard: const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                            ),
                            Row(
                              children: [
                                Expanded(
                                  child: counter(
                                    'Jours',
                                    days,
                                    1,
                                    60,
                                    (v) => setState(() => days = v),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: counter(
                                    'Voyageurs',
                                    travelers,
                                    1,
                                    20,
                                    (v) => setState(() => travelers = v),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final entry in {
                                  'culture': 'Culture',
                                  'discovery': 'Découverte',
                                  'relax': 'Détente',
                                  'food': 'Gastronomie',
                                  'sport': 'Sport',
                                }.entries)
                                  FilterChip(
                                    label: Text(entry.value,
                                        style: TextStyle(
                                            color: styles.contains(entry.key)
                                                ? Colors.white
                                                : ink,
                                            fontWeight:
                                                styles.contains(entry.key)
                                                    ? FontWeight.w600
                                                    : FontWeight.w400)),
                                    avatar: styles.contains(entry.key)
                                        ? null
                                        : Icon(
                                            switch (entry.key) {
                                              'culture' =>
                                                Icons.museum_outlined,
                                              'discovery' =>
                                                Icons.explore_outlined,
                                              'relax' =>
                                                Icons.wb_sunny_outlined,
                                              'food' =>
                                                Icons.restaurant_outlined,
                                              _ => Icons.hiking_outlined,
                                            },
                                            size: 18,
                                            color: terracotta),
                                    selected: styles.contains(entry.key),
                                    onSelected: (on) => setState(() {
                                      on
                                          ? styles.add(entry.key)
                                          : styles.remove(entry.key);
                                    }),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              initialValue: pace,
                              decoration: const InputDecoration(
                                labelText: 'Rythme',
                              ),
                              items: const [
                                DropdownMenuItem(
                                  value: 'slow',
                                  child: Text('Tranquille'),
                                ),
                                DropdownMenuItem(
                                  value: 'moderate',
                                  child: Text('Équilibré'),
                                ),
                                DropdownMenuItem(
                                  value: 'fast',
                                  child: Text('Soutenu'),
                                ),
                              ],
                              onChanged: (v) => setState(() => pace = v!),
                            ),
                            const SizedBox(height: 16),
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              title: const Text('Voyage itinérant'),
                              subtitle: const Text(
                                'Changer d’hébergement au fil du parcours',
                              ),
                              value: shape == 'roadtrip',
                              onChanged: (v) => setState(
                                  () => shape = v ? 'roadtrip' : 'base'),
                            ),
                            const SizedBox(height: 20),
                            FilledButton.icon(
                              onPressed: busy ? null : plan,
                              icon: const Icon(Icons.flight_takeoff),
                              label: const Text('Créer mon voyage'),
                            ),
                          ] else ...[
                            Text(
                              'Mes voyages',
                              style: Theme.of(context).textTheme.headlineLarge,
                            ),
                            const SizedBox(height: 16),
                            if (busy) const LinearProgressIndicator(),
                            if (trips.isEmpty && !busy)
                              const Padding(
                                padding: EdgeInsets.all(24),
                                child: Text(
                                  'Vos voyages apparaîtront ici après leur préparation.',
                                ),
                              ),
                            for (final trip in trips)
                              Card(
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(16),
                                  leading: const Icon(Icons.public),
                                  title: Text('${trip['title'] ?? 'Voyage'}'),
                                  subtitle: const Text('Ouvrir le programme'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: trip['plan_json'] is Map
                                      ? () => Navigator.of(context).push(
                                            MaterialPageRoute<void>(
                                              builder: (_) => TripDetail(
                                                api: widget.api,
                                                onChanged: () => unawaited(
                                                  loadTrips()
                                                      .catchError((_) {}),
                                                ),
                                                user: user!,
                                                tripId: trip['id'] as int,
                                                plan: Map<String, dynamic>.from(
                                                  trip['plan_json'],
                                                ),
                                                title:
                                                    '${trip['title'] ?? 'Voyage'}',
                                              ),
                                            ),
                                          )
                                      : null,
                                ),
                              ),
                            TextButton.icon(
                              onPressed: busy ? null : () => run(loadTrips),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Actualiser'),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget premiumHome() => SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              'Pendant mon voyage',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            if (user!['has_premium'] != true)
              PremiumUpsell(onTap: () => setState(() => page = 3))
            else ...[
              const Text(
                'Choisissez un voyage pour retrouver votre carnet et vos comptes.',
              ),
              if (trips.isEmpty)
                FilledButton(
                  onPressed: () => setState(() => page = 0),
                  child: const Text('Créer mon premier voyage'),
                ),
              for (final t in trips)
                Card(
                  child: ListTile(
                    title: Text('${t['title']}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => PremiumPage(
                          api: widget.api,
                          tripId: t['id'],
                          title: '${t['title']}',
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ],
        ),
      );

  Widget counter(
    String title,
    int value,
    int min,
    int max,
    ValueChanged<int> change,
  ) =>
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: softBorder)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                IconButton(
                  tooltip: 'Réduire $title',
                  onPressed: value > min ? () => change(value - 1) : null,
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$value',
                    style: const TextStyle(
                        color: ink, fontSize: 18, fontWeight: FontWeight.w600)),
                IconButton(
                  tooltip: 'Augmenter $title',
                  onPressed: value < max ? () => change(value + 1) : null,
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ],
        ),
      );
}

class PlanningScreen extends StatefulWidget {
  const PlanningScreen({super.key});
  @override
  State<PlanningScreen> createState() => _PlanningScreenState();
}

class _PlanningScreenState extends State<PlanningScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  )..repeat();
  @override
  void dispose() {
    motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        child: Scaffold(
          backgroundColor: ink,
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedBuilder(
                      animation: motion,
                      builder: (context, _) => Transform.rotate(
                        angle: MediaQuery.disableAnimationsOf(context)
                            ? 0
                            : math.sin(motion.value * math.pi * 2) * .08,
                        child: ClipOval(
                          child: Image.asset(
                            'assets/earth.jpg',
                            width: 220,
                            height: 220,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                    const Icon(Icons.flight, color: Colors.white, size: 36),
                    const SizedBox(height: 20),
                    const Text(
                      'Votre voyage prend forme',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 28),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Nous préparons votre programme et recherchons les bonnes adresses. Cela peut prendre quelques minutes.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 16),
                    ),
                    const SizedBox(height: 28),
                    const LinearProgressIndicator(),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

Future<void> openLink(BuildContext context, String value) async {
  final uri = Uri.tryParse(value);
  if (uri == null || !['https', 'http'].contains(uri.scheme)) return;
  try {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception();
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible d’ouvrir ce lien.')),
      );
    }
  }
}

String? itemLink(Map item) {
  final links = item['booking_links'] as List? ?? [];
  final value = item['booking_url'] ??
      item['url'] ??
      item['website'] ??
      item['maps_url'] ??
      (links.isNotEmpty ? links.first['url'] : null);
  return value is String ? value : null;
}
