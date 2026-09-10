import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_petit_voyageur/api.dart';
import 'package:mon_petit_voyageur/offers.dart';
import 'package:mon_petit_voyageur/premium.dart';

class WalletApi extends TravelApi {
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async => {
    'revision': 0,
    'currency': 'EUR',
    'people': ['Moi'],
    'expenses': [],
    'photos': [],
  };
}

void main() {
  testWidgets('offers disclose missing billing and disable purchase', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: OffersPage(
          api: TravelApi(),
          user: const {'billing_enabled': false},
          onUser: (_) {},
        ),
      ),
    );
    expect(
      find.textContaining('paiements ne sont pas encore activés'),
      findsOneWidget,
    );
    for (final button in tester.widgetList<FilledButton>(
      find.byType(FilledButton),
    )) {
      expect(button.onPressed, isNull);
    }
  });
  testWidgets('premium accounts forms fit a narrow screen', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: PremiumPage(api: WalletApi(), tripId: 1, title: 'Kyoto'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Comptes'));
    await tester.pumpAndSettle();
    expect(find.text('Les comptes du voyage'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
