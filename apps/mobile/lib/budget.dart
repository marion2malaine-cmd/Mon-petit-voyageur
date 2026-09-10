import 'package:flutter/material.dart';

class BudgetChoices extends StatefulWidget {
  final Map structured;
  final bool busy;
  final Future<void> Function(Map<String, dynamic>) onSave;
  const BudgetChoices({
    super.key,
    required this.structured,
    required this.busy,
    required this.onSave,
  });
  @override
  State<BudgetChoices> createState() => _BudgetChoicesState();
}

class _BudgetChoicesState extends State<BudgetChoices> {
  late final people = TextEditingController(
    text:
        '${widget.structured['budget_choices']?['people'] ?? widget.structured['brief']?['travelers_count'] ?? 1}',
  );
  late final rooms = TextEditingController(
    text: '${widget.structured['budget_choices']?['rooms'] ?? 1}',
  );
  late final nights = TextEditingController(
    text:
        '${widget.structured['budget_choices']?['nights'] ?? ((widget.structured['itinerary']?['itinerary_by_day'] as List? ?? []).length - 1).clamp(0, 365)}',
  );
  late final transport = TextEditingController(
    text: '${widget.structured['budget_choices']?['transport'] ?? ''}',
  );
  String? error;
  @override
  void dispose() {
    for (final c in [people, rooms, nights, transport]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final research = widget.structured['research'] as Map? ?? {};
    final stays = research['recommended_stays'] as List? ?? [];
    final index = research['chosen_stay_index'];
    final hotel = index is int && index >= 0 && index < stays.length
        ? stays[index]
        : null;
    final activity =
        [
          for (final d
              in widget.structured['itinerary']?['itinerary_by_day'] as List? ??
                  [])
            for (final p in d['paid_options'] as List? ?? [])
              if (p['selected'] == true) p,
        ].fold<double>(
          0,
          (n, p) =>
              n +
              ((p['price_from_eur'] as num?)?.toDouble() ?? 0) *
                  (int.tryParse(people.text) ?? 1),
        );
    final lodging =
        hotel?['currency'] == 'EUR' && hotel?['price_per_night'] is num
        ? (hotel['price_per_night'] as num) *
              (int.tryParse(rooms.text) ?? 1) *
              (int.tryParse(nights.text) ?? 0)
        : null;
    final transit = double.tryParse(transport.text.replaceAll(',', '.'));
    return Card(
      child: ExpansionTile(
        title: const Text('Budget de mes choix'),
        subtitle: Text(
          '${(activity + (lodging ?? 0) + (transit ?? 0)).toStringAsFixed(2)} € · sous-total connu',
        ),
        childrenPadding: const EdgeInsets.all(16),
        children: [
          for (final f in [
            ('Voyageurs', people),
            ('Chambres', rooms),
            ('Nuits', nights),
            ('Transports et vols : total en €', transport),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: f.$2,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(labelText: f.$1),
              ),
            ),
          const Text(
            'Sous-total des activités sélectionnées, de l’hôtel choisi et du transport renseigné. Les montants inconnus et repas ne sont pas inclus.',
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          FilledButton(
            onPressed: widget.busy
                ? null
                : () async {
                    final p = int.tryParse(people.text),
                        r = int.tryParse(rooms.text),
                        n = int.tryParse(nights.text);
                    if (p == null ||
                        p < 1 ||
                        p > 100 ||
                        r == null ||
                        r < 1 ||
                        r > 100 ||
                        n == null ||
                        n < 0 ||
                        n > 365 ||
                        (transport.text.isNotEmpty &&
                            (transit == null ||
                                !transit.isFinite ||
                                transit < 0))) {
                      setState(() => error = 'Vérifiez les nombres saisis.');
                      return;
                    }
                    setState(() => error = null);
                    await widget.onSave({
                      'people': p,
                      'rooms': r,
                      'nights': n,
                      'transport': transit,
                    });
                  },
            child: const Text('Enregistrer mes hypothèses'),
          ),
        ],
      ),
    );
  }
}
