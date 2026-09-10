import 'package:flutter_test/flutter_test.dart';
import 'package:mon_petit_voyageur/premium.dart';

void main() {
  test('odd cents remain balanced and reimbursements settle exactly', () {
    final b = balances(
      ['A', 'B', 'C'],
      [
        {
          'payer': 'A',
          'cents': 100,
          'participants': ['A', 'B', 'C'],
        },
      ],
    );
    expect(b, {'A': 66, 'B': -33, 'C': -33});
    for (final r in repayments(b)) {
      b[r['from']] = b[r['from']]! + (r['cents'] as int);
      b[r['to']] = b[r['to']]! - (r['cents'] as int);
    }
    expect(b.values.every((n) => n == 0), isTrue);
  });
  test('only selected participants share an expense', () {
    expect(
      balances(
        ['A', 'B', 'C'],
        [
          {
            'payer': 'A',
            'cents': 101,
            'participants': ['B', 'C'],
          },
        ],
      ),
      {'A': 101, 'B': -51, 'C': -50},
    );
  });
}
