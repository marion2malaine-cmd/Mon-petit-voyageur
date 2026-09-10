import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mon_petit_voyageur/api.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('session cookie is persisted and sent to the existing API', () async {
    var calls = 0;
    final api = TravelApi(
      client: MockClient((r) async {
        calls++;
        if (calls == 1) {
          return http.Response(
            '{}',
            200,
            headers: {
              'set-cookie': 'mlt_token=example; HttpOnly; Secure; Path=/',
            },
          );
        }
        expect(r.headers['Cookie'], 'mlt_token=example');
        return http.Response('{}', 200);
      }),
    );
    await api.request(
      '/api/auth/login',
      method: 'POST',
      body: {'email': 'test@example.com', 'password': 'test'},
    );
    await api.request('/api/auth/me');
    expect(
      await const FlutterSecureStorage().read(key: 'session'),
      'mlt_token=example',
    );
    api.close();
  });
  test(
    'authorization failure terminates planning instead of looping',
    () async {
      var calls = 0;
      final api = TravelApi(
        client: MockClient((r) async {
          calls++;
          return calls == 1
              ? http.Response(jsonEncode({'job_id': 'one'}), 202)
              : http.Response('{}', 401);
        }),
      );
      await expectLater(
        api.plan('Paris', {}, active: () => true, interval: Duration.zero),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)),
      );
      expect(calls, 2);
      api.close();
    },
  );
  test(
    'transient failure retries only the poll, then returns the trip',
    () async {
      var calls = 0;
      final api = TravelApi(
        client: MockClient((r) async {
          calls++;
          if (calls == 1) return http.Response('{"job_id":"one"}', 202);
          if (calls == 2) return http.Response('{}', 503);
          return http.Response('{"status":"done","result":{"trip_id":3}}', 200);
        }),
      );
      expect(
        (await api.plan(
          'Paris',
          {},
          active: () => true,
          interval: Duration.zero,
        ))['trip_id'],
        3,
      );
      api.close();
    },
  );
}
