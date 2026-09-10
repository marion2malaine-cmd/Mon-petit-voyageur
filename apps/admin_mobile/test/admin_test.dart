import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mpv_admin/admin_api.dart';
import 'package:mpv_admin/main.dart';

void main(){
 test('only authenticated requests carry the session, expiry clears access',()async{
  final client=MockClient((r)async{
   if(r.url.path.endsWith('/login')){expect(r.headers['Authorization'],isNull);expect(jsonDecode(r.body)['email'],'owner@example.com');return http.Response('{"token":"session"}',200);}
   expect(r.headers['Authorization'],'Bearer session');return http.Response('{"error":"Session expirée"}',401);
  });
  final api=AdminApi(client:client);
  await expectLater(api.dashboard(30),throwsA(isA<AdminException>()));
  await api.login(' owner@example.com ','password');expect(api.authenticated,isTrue);
  await expectLater(api.dashboard(30),throwsA(isA<AdminException>()));expect(api.authenticated,isFalse);
 });
 test('exports neutralize spreadsheet formulas and escape quotes',(){
  final csv=csvExport([{'name':'=SUM(1,2)','note':'A "quote"'}],['name','note']);
  expect(csv,contains("'=SUM"));expect(csv,contains('A ""quote""'));
 });
 testWidgets('login and recovery are usable without authenticating',(tester)async{
  await tester.pumpWidget(MaterialApp(home:Login(onLogin:(_,_)async{},onForgot:(_)async=>'Email envoyé')));
  expect(find.text('Bon retour, Marion.'),findsOneWidget);
  await tester.ensureVisible(find.text('Mot de passe oublié ?'));
  await tester.tap(find.text('Mot de passe oublié ?'));await tester.pump();
  expect(find.text('Un nouveau départ.'),findsOneWidget);expect(find.text('Recevoir le lien'),findsOneWidget);
 });
}
