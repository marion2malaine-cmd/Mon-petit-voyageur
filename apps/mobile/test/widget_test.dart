import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_petit_voyageur/main.dart';
import 'package:mon_petit_voyageur/api.dart';

class FakeApi extends TravelApi {
  @override
  Future<void> restore() async {}
  @override
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async =>
      path == '/api/auth/me' ? {'id': 1} : [];
}

void main() {
  testWidgets('travel bubbles remain selectable with the Riviera theme',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(TravelerApp(api: FakeApi()));
    await tester.pumpAndSettle();
    final culture = find.widgetWithText(FilterChip, 'Culture');
    await tester.scrollUntilVisible(culture, 200,
        scrollable: find.byType(Scrollable).first);
    await Scrollable.ensureVisible(tester.element(culture), alignment: .4);
    await tester.pumpAndSettle();
    await tester.tap(culture);
    await tester.pumpAndSettle();
    expect(tester.widget<FilterChip>(culture).selected, isTrue);
    expect(tester.takeException(), isNull);
    await expectLater(find.byType(MaterialApp),
        matchesGoldenFile('goldens/planner-bubbles.png'));
  });
  testWidgets('planner fits a small screen and accepts a description', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(TravelerApp(api: FakeApi()));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField).first,
      'Kyoto avec deux enfants',
    );
    expect(find.text('Kyoto avec deux enfants'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Globe is available offline on a narrow screen', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(home: PlanningScreen()));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Votre voyage prend forme'), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
