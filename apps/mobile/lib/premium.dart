import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
import 'package:uuid/uuid.dart';
import 'package:printing/printing.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';

Map<String, int> balances(List<String> people, List<dynamic> expenses) {
  final result = {for (final p in people) p: 0};
  for (final e in expenses) {
    final participants = List<String>.from(e['participants']);
    final cents = e['cents'] as int;
    result[e['payer']] = (result[e['payer']] ?? 0) + cents;
    for (var i = 0; i < participants.length; i++) {
      result[participants[i]] =
          (result[participants[i]] ?? 0) -
          cents ~/ participants.length -
          (i < cents % participants.length ? 1 : 0);
    }
  }
  return result;
}

List<Map<String, dynamic>> repayments(Map<String, int> amounts) {
  final debt = amounts.entries
      .where((e) => e.value < 0)
      .map((e) => [e.key, -e.value])
      .toList();
  final credit = amounts.entries
      .where((e) => e.value > 0)
      .map((e) => [e.key, e.value])
      .toList();
  final out = <Map<String, dynamic>>[];
  var i = 0, j = 0;
  while (i < debt.length && j < credit.length) {
    final d = debt[i][1] as int, c = credit[j][1] as int, n = d < c ? d : c;
    out.add({'from': debt[i][0], 'to': credit[j][0], 'cents': n});
    debt[i][1] = d - n;
    credit[j][1] = c - n;
    if (d == n) i++;
    if (c == n) j++;
  }
  return out;
}

String optimizePhoto(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) throw Exception('Format photo non pris en charge.');
  final resized = img.copyResize(
    decoded,
    width: decoded.width >= decoded.height ? 900 : null,
    height: decoded.height > decoded.width ? 900 : null,
  );
  for (final quality in [80, 60, 40, 20]) {
    final data =
        'data:image/jpeg;base64,${base64Encode(img.encodeJpg(resized, quality: quality))}';
    if (data.length <= 250000) return data;
  }
  throw Exception('Photo trop volumineuse. Choisissez une autre photo.');
}

class PremiumPage extends StatefulWidget {
  final TravelApi api;
  final int tripId;
  final String title;
  const PremiumPage({
    super.key,
    required this.api,
    required this.tripId,
    required this.title,
  });
  @override
  State<PremiumPage> createState() => _PremiumPageState();
}

class _PremiumPageState extends State<PremiumPage> {
  Map<String, dynamic>? data;
  bool busy = false;
  String? error;
  int tab = 0;
  final person = TextEditingController(),
      expenseTitle = TextEditingController(),
      cost = TextEditingController(),
      photoTitle = TextEditingController(),
      note = TextEditingController(),
      amount = TextEditingController(text: '10');
  String from = 'EUR', to = 'USD', kind = 'restaurant';
  String? payer;
  final participants = <String>{};
  Map? rate;
  List? places;
  @override
  void initState() {
    super.initState();
    run(load);
  }

  @override
  void dispose() {
    for (final c in [person, expenseTitle, cost, photoTitle, note, amount]) {
      c.dispose();
    }
    super.dispose();
  }

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
              : 'Action impossible. Vérifiez votre connexion ou les données saisies.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> load() async {
    final next = Map<String, dynamic>.from(
      await widget.api.request('/api/premium/trips/${widget.tripId}'),
    );
    if (mounted) {
      setState(() {
        data = next;
        payer = (next['people'] as List).first;
        participants.addAll(List<String>.from(next['people']));
      });
    }
  }

  Future<void> save(Map<String, dynamic> next) async {
    final saved = await widget.api.request(
      '/api/premium/trips/${widget.tripId}',
      method: 'PUT',
      body: next,
    );
    if (mounted) setState(() => data = Map<String, dynamic>.from(saved));
  }

  Future<void> addPhoto(ImageSource source) async {
    final file = await ImagePicker().pickImage(
      source: source,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 85,
    );
    if (file == null) return;
    final image = await compute(optimizePhoto, await file.readAsBytes());
    await save({
      ...data!,
      'photos': [
        ...data!['photos'],
        {
          'id': const Uuid().v4(),
          'title': photoTitle.text.trim(),
          'note': note.text.trim(),
          'date': DateTime.now().toUtc().toIso8601String(),
          'image': image,
        },
      ],
    });
    photoTitle.clear();
    note.clear();
  }

  Future<void> exportPhotos() async {
    final doc = pw.Document();
    for (final p in data!['photos']) {
      doc.addPage(
        pw.Page(
          build: (_) => pw.Column(
            children: [
              pw.Text(p['title'], style: const pw.TextStyle(fontSize: 24)),
              pw.SizedBox(height: 16),
              pw.Expanded(
                child: pw.Image(
                  pw.MemoryImage(
                    base64Decode((p['image'] as String).split(',').last),
                  ),
                  fit: pw.BoxFit.contain,
                ),
              ),
              pw.SizedBox(height: 16),
              pw.Text(p['note']),
              pw.Text((p['date'] as String).split('T').first),
            ],
          ),
        ),
      );
    }
    await Printing.sharePdf(
      bytes: await doc.save(),
      filename: 'mon-carnet-photo.pdf',
    );
  }

  Future<void> nearby() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw ApiException(
        400,
        'Activez la localisation dans les réglages du téléphone.',
      );
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw ApiException(
        400,
        'La localisation est refusée. Vous pouvez l’autoriser dans les réglages.',
      );
    }
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        timeLimit: Duration(seconds: 15),
      ),
    );
    final r = await widget.api.request(
      '/api/premium/nearby',
      method: 'POST',
      body: {'lat': p.latitude, 'lon': p.longitude, 'kind': kind},
    );
    if (mounted) setState(() => places = r['places'] ?? []);
  }

  Widget field(
    String label,
    TextEditingController c, {
    int lines = 1,
    int? max,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: TextField(
      controller: c,
      enabled: !busy,
      onChanged: (_) {
        if (c == amount) setState(() => rate = null);
      },
      maxLines: lines,
      maxLength: max,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
    ),
  );
  Widget heading(String s) => Padding(
    padding: const EdgeInsets.only(top: 20, bottom: 12),
    child: Text(s, style: Theme.of(context).textTheme.headlineSmall),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: busy ? null : (i) => setState(() => tab = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.currency_exchange),
          label: 'Devises',
        ),
        NavigationDestination(
          icon: Icon(Icons.groups_outlined),
          label: 'Comptes',
        ),
        NavigationDestination(
          icon: Icon(Icons.photo_camera_outlined),
          label: 'Carnet',
        ),
        NavigationDestination(
          icon: Icon(Icons.near_me_outlined),
          label: 'Autour',
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (busy) const LinearProgressIndicator(),
              if (error != null)
                Text(error!, style: const TextStyle(color: Colors.red)),
              if (data == null) ...[
                const Text('Votre compagnon de voyage'),
                TextButton(
                  onPressed: busy ? null : () => run(load),
                  child: const Text('Réessayer'),
                ),
              ] else ...[
                if (tab == 0) ...[
                  heading('Convertisseur'),
                  field(
                    'Montant',
                    amount,
                    keyboard: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                  for (final isFrom in [true, false])
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: DropdownButtonFormField<String>(
                        initialValue: isFrom ? from : to,
                        decoration: InputDecoration(
                          labelText: isFrom
                              ? 'Devise de départ'
                              : 'Devise d’arrivée',
                        ),
                        items: [
                          for (final c in [
                            'EUR',
                            'USD',
                            'GBP',
                            'JPY',
                            'CHF',
                            'CAD',
                            'AUD',
                            'THB',
                            'VND',
                            'MAD',
                            'MXN',
                            'IDR',
                            'INR',
                            'CNY',
                          ])
                            DropdownMenuItem(value: c, child: Text(c)),
                        ],
                        onChanged: busy
                            ? null
                            : (v) => setState(() {
                                if (isFrom) {
                                  from = v!;
                                } else {
                                  to = v!;
                                }
                                rate = null;
                              }),
                      ),
                    ),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            final n = double.tryParse(
                              amount.text.replaceAll(',', '.'),
                            );
                            if (n == null || n < 0) {
                              throw ApiException(
                                400,
                                'Indiquez un montant valide.',
                              );
                            }
                            final r = await widget.api.request(
                              '/api/premium/rate?from=$from&to=$to',
                            );
                            if (mounted) {
                              setState(
                                () => rate = {
                                  ...r,
                                  'converted': n * (r['rate'] as num),
                                },
                              );
                            }
                          }),
                    child: const Text('Convertir'),
                  ),
                  if (rate != null) ...[
                    heading(
                      '${(rate!['converted'] as num).toStringAsFixed(2)} $to',
                    ),
                    Text(
                      'Taux du ${rate!['date']} · Frankfurter · hors frais de change',
                    ),
                  ],
                ],
                if (tab == 1) ...[
                  heading('Les comptes du voyage'),
                  const Text(
                    'Dépenses en euros, réparties entre les participants sélectionnés.',
                  ),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final p in data!['people']) Chip(label: Text(p)),
                    ],
                  ),
                  field('Ajouter un participant', person, max: 50),
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            final name = person.text.trim();
                            if (name.isEmpty ||
                                (data!['people'] as List).contains(name)) {
                              throw ApiException(
                                400,
                                'Choisissez un prénom distinct.',
                              );
                            }
                            await save({
                              ...data!,
                              'people': [...data!['people'], name],
                            });
                            participants.add(name);
                            person.clear();
                          }),
                    child: const Text('Ajouter'),
                  ),
                  heading('Nouvelle dépense'),
                  field('Libellé', expenseTitle, max: 100),
                  field(
                    'Montant en €',
                    cost,
                    keyboard: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: payer,
                    decoration: const InputDecoration(labelText: 'Payé par'),
                    items: [
                      for (final p in data!['people'])
                        DropdownMenuItem(value: p as String, child: Text(p)),
                    ],
                    onChanged: busy ? null : (v) => setState(() => payer = v),
                  ),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final p in data!['people'])
                        FilterChip(
                          label: Text(p),
                          selected: participants.contains(p),
                          onSelected: busy
                              ? null
                              : (v) => setState(() {
                                  v
                                      ? participants.add(p)
                                      : participants.remove(p);
                                }),
                        ),
                    ],
                  ),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => run(() async {
                            final cents =
                                ((double.tryParse(
                                              cost.text.replaceAll(',', '.'),
                                            ) ??
                                            0) *
                                        100)
                                    .round();
                            if (cents <= 0 ||
                                expenseTitle.text.trim().isEmpty ||
                                participants.isEmpty) {
                              throw ApiException(
                                400,
                                'Indiquez un libellé, un montant positif et au moins un participant.',
                              );
                            }
                            await save({
                              ...data!,
                              'expenses': [
                                ...data!['expenses'],
                                {
                                  'id': const Uuid().v4(),
                                  'title': expenseTitle.text.trim(),
                                  'cents': cents,
                                  'payer': payer,
                                  'participants': participants.toList(),
                                },
                              ],
                            });
                            cost.clear();
                            expenseTitle.clear();
                          }),
                    child: const Text('Enregistrer'),
                  ),
                  for (final e in data!['expenses'])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${e['title']} · ${(e['cents'] / 100).toStringAsFixed(2)} €',
                      ),
                      subtitle: Text('Payé par ${e['payer']}'),
                      trailing: IconButton(
                        tooltip: 'Retirer',
                        onPressed: busy
                            ? null
                            : () => run(
                                () => save({
                                  ...data!,
                                  'expenses': (data!['expenses'] as List)
                                      .where((x) => x['id'] != e['id'])
                                      .toList(),
                                }),
                              ),
                        icon: const Icon(Icons.delete_outline),
                      ),
                    ),
                  heading('Qui rembourse qui ?'),
                  for (final r in repayments(
                    balances(
                      List<String>.from(data!['people']),
                      data!['expenses'],
                    ),
                  ))
                    Text(
                      '${r['from']} → ${r['to']} : ${(r['cents'] / 100).toStringAsFixed(2)} €',
                    ),
                  const SizedBox(height: 12),
                  const Text(
                    'Aucun transfert bancaire n’est effectué. Le groupe est géré par le propriétaire du compte.',
                  ),
                ],
                if (tab == 2) ...[
                  heading('Mon carnet photo'),
                  Text('${(data!['photos'] as List).length}/30 souvenirs'),
                  field('Titre du souvenir', photoTitle, max: 120),
                  field('Votre souvenir', note, lines: 3, max: 1000),
                  Wrap(
                    spacing: 8,
                    children: [
                      FilledButton.icon(
                        onPressed:
                            busy || (data!['photos'] as List).length >= 30
                            ? null
                            : () => run(() => addPhoto(ImageSource.camera)),
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Prendre une photo'),
                      ),
                      OutlinedButton(
                        onPressed:
                            busy || (data!['photos'] as List).length >= 30
                            ? null
                            : () => run(() => addPhoto(ImageSource.gallery)),
                        child: const Text('Choisir une photo'),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: busy || (data!['photos'] as List).isEmpty
                        ? null
                        : () => run(exportPhotos),
                    icon: const Icon(Icons.ios_share),
                    label: const Text('Exporter mon carnet en PDF'),
                  ),
                  for (final p in data!['photos'])
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Image.memory(
                              base64Decode(
                                (p['image'] as String).split(',').last,
                              ),
                              height: 220,
                              width: double.infinity,
                              fit: BoxFit.cover,
                            ),
                            Text(p['title']),
                            Text(p['note']),
                            TextButton(
                              onPressed: busy
                                  ? null
                                  : () => run(
                                      () => save({
                                        ...data!,
                                        'photos': (data!['photos'] as List)
                                            .where((x) => x['id'] != p['id'])
                                            .toList(),
                                      }),
                                    ),
                              child: const Text('Retirer'),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
                if (tab == 3) ...[
                  heading('Autour de moi'),
                  const Text(
                    'Recherchez des adresses dans un rayon de 2 km. Votre position est transmise à Google Maps uniquement lorsque vous lancez la recherche.',
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: kind,
                    items: const [
                      DropdownMenuItem(
                        value: 'restaurant',
                        child: Text('Restaurants'),
                      ),
                      DropdownMenuItem(
                        value: 'tourist_attraction',
                        child: Text('Activités et lieux'),
                      ),
                    ],
                    onChanged: busy
                        ? null
                        : (v) => setState(() {
                            kind = v!;
                            places = null;
                          }),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: busy ? null : () => run(nearby),
                    child: const Text('Rechercher autour de moi'),
                  ),
                  if (places?.isEmpty == true)
                    const Text('Aucune adresse trouvée.'),
                  for (final p in places ?? [])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${p['displayName']?['text'] ?? ''}'),
                      subtitle: Text('${p['formattedAddress'] ?? ''}'),
                      onTap: () => launchUrl(
                        Uri.parse(p['googleMapsUri']),
                        mode: LaunchMode.externalApplication,
                      ),
                    ),
                  if (places != null)
                    const Text('Adresses fournies par Google Maps'),
                ],
                if (error != null)
                  TextButton(
                    onPressed: busy ? null : () => run(load),
                    child: const Text('Recharger les données'),
                  ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
