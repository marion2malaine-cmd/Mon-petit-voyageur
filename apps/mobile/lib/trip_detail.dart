import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'offers.dart';
import 'premium.dart';
import 'budget.dart';

class TripDetail extends StatefulWidget {
  final TravelApi api;
  final Map<String, dynamic> plan;
  final String title;
  final int? tripId;
  final Map<String, dynamic> user;
  final VoidCallback? onChanged;
  const TripDetail({
    super.key,
    required this.api,
    required this.plan,
    required this.title,
    required this.user,
    this.tripId,
    this.onChanged,
  });
  @override
  State<TripDetail> createState() => _TripDetailState();
}

class _TripDetailState extends State<TripDetail> {
  late Map<String, dynamic> plan = widget.plan, user = widget.user;
  bool busy = false;
  String? error;
  int tab = 0;
  int? get id => widget.tripId ?? plan['trip_id'] as int?;
  Map get structured => plan['structured_json'] as Map? ?? {};
  List get days =>
      (structured['itinerary'] as Map? ?? {})['itinerary_by_day'] as List? ??
      [];
  Future<void> run(Future<void> Function() action) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is ApiException
              ? e.message
              : 'Action impossible. Réessayez avec une connexion Internet.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> edit(Map<String, dynamic> body) async {
    final next = await widget.api.request(
      '/api/trips/$id/itinerary',
      method: 'PATCH',
      body: body,
    );
    if (mounted) {
      setState(() => plan = Map<String, dynamic>.from(next));
      widget.onChanged?.call();
    }
  }

  Future<void> link(String value) async {
    final uri = Uri.tryParse(value);
    if (uri == null || !['https', 'http'].contains(uri.scheme)) return;
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw ApiException(400, 'Impossible d’ouvrir le lien.');
    }
  }

  void offers() => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => OffersPage(
        api: widget.api,
        user: user,
        onUser: (u) => setState(() => user = u),
      ),
    ),
  );
  List<Map> get located => [
    for (final d in days)
      for (final k in ['free_visits', 'paid_options', 'restaurants'])
        for (final item in d[k] as List? ?? [])
          if (item['coordinates']?['lat'] is num &&
              item['coordinates']?['lon'] is num)
            {...item, 'day': d['day']},
  ];
  Widget item(Map day, String collection, int index, Map value) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('${value['name'] ?? value['title'] ?? ''}'),
            subtitle: Text(
              '${value['description'] ?? value['why'] ?? value['address'] ?? ''}',
            ),
            leading: id == null
                ? null
                : Checkbox(
                    value: value['completed'] == true,
                    onChanged: busy
                        ? null
                        : (v) => run(
                            () => edit({
                              'action': 'complete',
                              'day': day['day'],
                              'collection': collection,
                              'index': index,
                              'completed': v,
                            }),
                          ),
                  ),
            trailing: id == null
                ? null
                : PopupMenuButton<String>(
                    enabled: !busy,
                    onSelected: (action) async {
                      if (action == 'move') {
                        final target = await showDialog<int>(
                          context: context,
                          builder: (c) => SimpleDialog(
                            title: const Text('Déplacer vers'),
                            children: [
                              for (final d in days)
                                if (d['day'] != day['day'])
                                  SimpleDialogOption(
                                    onPressed: () => Navigator.pop(c, d['day']),
                                    child: Text(
                                      'Jour ${d['day']} · ${d['title']}',
                                    ),
                                  ),
                            ],
                          ),
                        );
                        if (target != null) {
                          run(
                            () => edit({
                              'action': 'move',
                              'day': day['day'],
                              'collection': collection,
                              'index': index,
                              'targetDay': target,
                            }),
                          );
                        }
                      } else {
                        run(
                          () => edit({
                            'action': 'remove',
                            'day': day['day'],
                            'collection': collection,
                            'index': index,
                          }),
                        );
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(
                        value: 'move',
                        child: Text('Changer de jour'),
                      ),
                      PopupMenuItem(
                        value: 'remove',
                        child: Text('Retirer du programme'),
                      ),
                    ],
                  ),
          ),
          if (collection == 'paid_options' && id != null)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Retenir cette activité'),
              value: value['selected'] == true,
              onChanged: busy
                  ? null
                  : (v) => run(
                      () => edit({
                        'action': 'select',
                        'day': day['day'],
                        'collection': collection,
                        'index': index,
                        'selected': v,
                      }),
                    ),
            ),
          for (final b in value['booking_links'] as List? ?? [])
            TextButton.icon(
              onPressed: () => run(() => link('${b['url']}')),
              icon: const Icon(Icons.open_in_new),
              label: Text('${b['label'] ?? b['provider'] ?? 'Réserver'}'),
            ),
          if (value['maps_url'] is String)
            TextButton(
              onPressed: () => run(() => link(value['maps_url'])),
              child: const Text('Voir sur la carte'),
            ),
          if (value['website'] is String)
            TextButton(
              onPressed: () => run(() => link(value['website'])),
              child: const Text('Site officiel'),
            ),
        ],
      ),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final research = structured['research'] as Map? ?? {};
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (id != null)
            PopupMenuButton<String>(
              enabled: !busy,
              onSelected: (v) => run(() async {
                if (v == 'pdf') {
                  await Printing.sharePdf(
                    bytes: await widget.api.pdf(id!),
                    filename: 'mon-voyage.pdf',
                  );
                }
                if (v == 'email') {
                  await widget.api.request(
                    '/api/trips/$id/guide/email',
                    method: 'POST',
                    body: {'locale': 'fr', 'embed': true},
                  );
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Guide envoyé à votre adresse email.'),
                      ),
                    );
                  }
                }
                if (v == 'undo') await edit({'action': 'undo'});
              }),
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'pdf',
                  child: Text('Partager le guide PDF'),
                ),
                const PopupMenuItem(
                  value: 'email',
                  child: Text('Recevoir le guide par email'),
                ),
                if (structured['previous_itinerary'] != null)
                  const PopupMenuItem(
                    value: 'undo',
                    child: Text('Annuler la dernière modification'),
                  ),
              ],
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (v) => setState(() => tab = v),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.route), label: 'Programme'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Carte'),
          NavigationDestination(
            icon: Icon(Icons.hotel_outlined),
            label: 'Réserver',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (busy) const LinearProgressIndicator(),
            if (error != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(error!, style: const TextStyle(color: Colors.red)),
              ),
            Expanded(
              child: tab == 1
                  ? map()
                  : Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 900),
                        child: ListView(
                          padding: const EdgeInsets.all(20),
                          children: [
                            if (tab == 0) ...[
                              Text(
                                '${plan['traveler_summary'] ?? widget.title}',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 16),
                              if (structured['budget_estimate']?['estimated_total']
                                  is Map)
                                Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Text(
                                      'Budget estimé : ${structured['budget_estimate']['estimated_total']['min']} – ${structured['budget_estimate']['estimated_total']['max']} ${structured['budget_estimate']['estimated_total']['currency']}',
                                    ),
                                  ),
                                ),
                              if (id != null)
                                BudgetChoices(
                                  structured: structured,
                                  busy: busy,
                                  onSave: (values) => run(
                                    () => edit({
                                      'action': 'budget',
                                      'values': values,
                                    }),
                                  ),
                                ),
                              if (id != null && user['has_premium'] == true)
                                FilledButton.icon(
                                  onPressed: () => Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => PremiumPage(
                                        api: widget.api,
                                        tripId: id!,
                                        title: widget.title,
                                      ),
                                    ),
                                  ),
                                  icon: const Icon(Icons.auto_awesome),
                                  label: const Text(
                                    'Ouvrir mon compagnon Premium',
                                  ),
                                )
                              else
                                PremiumUpsell(onTap: offers),
                              for (final d in days) ...[
                                const SizedBox(height: 24),
                                Text(
                                  'Jour ${d['day']} · ${d['title']}',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.headlineSmall,
                                ),
                                if (d['date'] != null) Text(d['date']),
                                for (final k in [
                                  'morning',
                                  'afternoon',
                                  'evening',
                                ])
                                  if (d[k] is String &&
                                      (d[k] as String).isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 8,
                                      ),
                                      child: Text(d[k]),
                                    ),
                                for (final k in [
                                  'free_visits',
                                  'paid_options',
                                  'restaurants',
                                ])
                                  for (
                                    var i = 0;
                                    i < (d[k] as List? ?? []).length;
                                    i++
                                  )
                                    item(d, k, i, d[k][i]),
                                if (d['travel_note'] != null)
                                  Text(d['travel_note']),
                                for (final tip
                                    in d['practical_tips'] as List? ?? [])
                                  Text('• $tip'),
                              ],
                            ] else ...[
                              Text(
                                'Vols et hébergements',
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineMedium,
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Les prix peuvent évoluer. Vérifiez le montant et les conditions chez le partenaire avant de réserver.',
                              ),
                              for (final f
                                  in research['recommended_flights'] as List? ??
                                      [])
                                Card(
                                  child: ListTile(
                                    title: Text('${f['label']}'),
                                    subtitle: Text(
                                      f['price'] == null
                                          ? 'Prix à vérifier'
                                          : '${f['price']} ${f['currency'] ?? 'EUR'}',
                                    ),
                                    onTap: f['booking_url'] is String
                                        ? () =>
                                              run(() => link(f['booking_url']))
                                        : null,
                                  ),
                                ),
                              for (
                                var i = 0;
                                i <
                                    (research['recommended_stays'] as List? ??
                                            [])
                                        .length;
                                i++
                              ) ...[
                                Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${research['recommended_stays'][i]['name']}',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.titleLarge,
                                        ),
                                        Text(
                                          '${research['recommended_stays'][i]['area'] ?? ''}',
                                        ),
                                        Text(
                                          research['recommended_stays'][i]['price_per_night'] ==
                                                  null
                                              ? 'Tarif à vérifier'
                                              : '${research['recommended_stays'][i]['price_per_night']} € / nuit',
                                        ),
                                        if (research['recommended_stays'][i]['booking_url']
                                            is String)
                                          TextButton(
                                            onPressed: () => run(
                                              () => link(
                                                research['recommended_stays'][i]['booking_url'],
                                              ),
                                            ),
                                            child: const Text('Voir l’offre'),
                                          ),
                                        if (id != null)
                                          OutlinedButton(
                                            onPressed: busy
                                                ? null
                                                : () => run(() async {
                                                    await widget.api.request(
                                                      '/api/trips/$id/stay',
                                                      method: 'PATCH',
                                                      body: {'index': i},
                                                    );
                                                    if (mounted) {
                                                      setState(
                                                        () =>
                                                            research['chosen_stay_index'] =
                                                                i,
                                                      );
                                                    }
                                                  }),
                                            child: Text(
                                              research['chosen_stay_index'] == i
                                                  ? 'Hôtel choisi'
                                                  : 'Choisir cet hôtel',
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                              for (final b
                                  in research['search_links'] as List? ?? [])
                                TextButton(
                                  onPressed: () =>
                                      run(() => link('${b['url']}')),
                                  child: Text('${b['label']}'),
                                ),
                            ],
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget map() {
    final points = located;
    if (points.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Aucune coordonnée disponible pour ce voyage. Les adresses restent accessibles dans le programme.',
          ),
        ),
      );
    }
    LatLng coordinate(Map p) => LatLng(
      (p['coordinates']['lat'] as num).toDouble(),
      (p['coordinates']['lon'] as num).toDouble(),
    );
    return FlutterMap(
      options: MapOptions(
        initialCenter: coordinate(points.first),
        initialZoom: 12,
        initialCameraFit: points.length > 1
            ? CameraFit.bounds(
                bounds: LatLngBounds.fromPoints(
                  points.map(coordinate).toList(),
                ),
                padding: const EdgeInsets.all(50),
              )
            : null,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'fr.monpetitvoyageur.mon_petit_voyageur',
        ),
        MarkerLayer(
          markers: [
            for (final p in points)
              Marker(
                point: coordinate(p),
                width: 48,
                height: 48,
                child: IconButton(
                  tooltip: 'Jour ${p['day']} · ${p['name'] ?? p['title']}',
                  icon: const Icon(
                    Icons.location_on,
                    color: Color(0xFF123746),
                    size: 36,
                  ),
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    builder: (c) => SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${p['name'] ?? p['title']}',
                              style: Theme.of(c).textTheme.titleLarge,
                            ),
                            Text('Jour ${p['day']}'),
                            FilledButton(
                              onPressed: () => run(
                                () => link(
                                  'https://www.google.com/maps/dir/?api=1&destination=${coordinate(p).latitude},${coordinate(p).longitude}',
                                ),
                              ),
                              child: const Text(
                                'Itinéraire depuis ma position',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        RichAttributionWidget(
          attributions: [
            TextSourceAttribution(
              'OpenStreetMap contributors',
              onTap: () => link('https://www.openstreetmap.org/copyright'),
            ),
          ],
        ),
      ],
    );
  }
}
