import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class TravelApi {
  final http.Client client;
  final FlutterSecureStorage storage;
  String? _cookie;
  void Function()? onSessionExpired;
  static const base = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://api.monpetitvoyageur.com',
  );
  TravelApi({http.Client? client, this.storage = const FlutterSecureStorage()})
    : client = client ?? http.Client();
  Future<void> restore() async {
    _cookie = await storage.read(key: 'session');
  }

  Future<void> forget() async {
    _cookie = null;
    await storage.delete(key: 'session');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final req = http.Request(method, Uri.parse('$base$path'));
    if (_cookie != null) req.headers['Cookie'] = _cookie!;
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    final res = await http.Response.fromStream(
      await client.send(req).timeout(const Duration(seconds: 30)),
    ).timeout(const Duration(seconds: 30));
    dynamic data;
    try {
      data = jsonDecode(res.body);
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 400) {
      if (res.statusCode == 401 &&
          !path.endsWith('/login') &&
          !path.endsWith('/register')) {
        await forget();
        onSessionExpired?.call();
      }
      throw ApiException(res.statusCode, switch (res.statusCode) {
        401 =>
          path.endsWith('/login')
              ? 'Email ou mot de passe incorrect.'
              : 'Reconnectez-vous pour continuer. Votre description est conservée.',
        402 => 'Un abonnement actif est nécessaire pour créer un voyage.',
        403 => 'Votre compte ne dispose pas de cet accès.',
        429 => 'Trop de demandes. Réessayez dans un instant.',
        _ =>
          data is Map && data['error'] is String
              ? data['error']
              : 'Service indisponible. Réessayez.',
      });
    }
    final cookie = RegExp(
      r'mlt_token=([^; ,]+)',
    ).firstMatch(res.headers['set-cookie'] ?? '');
    if (cookie != null) {
      _cookie = 'mlt_token=${cookie.group(1)}';
      await storage.write(key: 'session', value: _cookie);
    }
    return data;
  }

  Future<Map<String, dynamic>> plan(
    String message,
    Map<String, dynamic> preferences, {
    required bool Function() active,
    Duration interval = const Duration(seconds: 3),
  }) async {
    final start = await request(
      '/api/trips/plan',
      method: 'POST',
      body: {'message': message, 'locale': 'fr', 'preferences': preferences},
    );
    final deadline = DateTime.now().add(const Duration(minutes: 10));
    while (active() && DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(interval);
      if (!active()) break;
      dynamic job;
      try {
        job = await request('/api/trips/plan/${start['job_id']}');
      } on ApiException catch (e) {
        if (e.status == 404) {
          throw ApiException(
            404,
            'Le suivi a été interrompu. Consultez Mes voyages avant de relancer.',
          );
        }
        if (e.status < 500 && e.status != 429 && e.status != 408) rethrow;
        continue;
      } on TimeoutException {
        continue;
      } on http.ClientException {
        continue;
      }
      if (job['status'] == 'done') {
        return Map<String, dynamic>.from(job['result']);
      }
      if (job['status'] == 'error') {
        throw ApiException(
          500,
          'Le voyage n’a pas pu être créé. Réessayez dans quelques instants.',
        );
      }
    }
    throw ApiException(
      408,
      'Le suivi est terminé. Retrouvez le résultat dans Mes voyages une fois la préparation finie.',
    );
  }

  Future<Uint8List> pdf(int tripId) async {
    final response = await client
        .get(
          Uri.parse('$base/api/trips/$tripId/guide.pdf?locale=fr'),
          headers: {'Cookie': ?_cookie},
        )
        .timeout(const Duration(minutes: 2));
    if (response.statusCode != 200) {
      throw ApiException(
        response.statusCode,
        'Le PDF est indisponible. Réessayez.',
      );
    }
    return response.bodyBytes;
  }

  void close() => client.close();
}
