import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class AdminException implements Exception {
  final String message;
  final int? status;
  const AdminException(this.message, [this.status]);
  @override
  String toString() => message;
}

class AdminApi {
  final http.Client client;
  String? token;
  DateTime? expires;
  AdminApi({http.Client? client}) : client = client ?? http.Client();
  bool get authenticated =>
      token != null && expires != null && DateTime.now().isBefore(expires!);
  void logout() {
    token = null;
    expires = null;
  }

  Future<Map<String, dynamic>> request(String path,
      {Map<String, dynamic>? body, bool public = false}) async {
    if (!public && !authenticated) {
      throw const AdminException(
          'Votre session a expiré. Reconnectez-vous.', 401);
    }
    final uri = Uri.parse('https://api.monpetitvoyageur.com$path');
    final headers = {
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (!public) 'Authorization': 'Bearer $token'
    };
    try {
      final r = await (body == null
              ? client.get(uri, headers: headers)
              : client.post(uri, headers: headers, body: jsonEncode(body)))
          .timeout(const Duration(seconds: 25));
      Map<String, dynamic> data;
      try {
        data = jsonDecode(r.body) as Map<String, dynamic>;
      } catch (_) {
        throw const AdminException(
            'Le serveur est momentanément indisponible.');
      }
      if (r.statusCode >= 400) {
        if (r.statusCode == 401 && !public) logout();
        throw AdminException(
            data['error']?.toString() ?? 'Une erreur est survenue.',
            r.statusCode);
      }
      return data;
    } on TimeoutException {
      throw const AdminException(
          'Le serveur met trop de temps à répondre. Réessayez.');
    } on http.ClientException {
      throw const AdminException(
          'Connexion impossible. Vérifiez votre accès à Internet.');
    }
  }

  Future<void> login(String email, String password) async {
    final d = await request('/api/admin/login',
        public: true, body: {'email': email.trim(), 'password': password});
    if (d['token'] is! String) {
      throw const AdminException('Connexion non validée.');
    }
    token = d['token'];
    expires = DateTime.now().add(const Duration(minutes: 29));
  }

  Future<Map<String, dynamic>> dashboard(int days) =>
      request('/api/admin/dashboard?days=$days');
  Future<Map<String, dynamic>> payments(int days) =>
      request('/api/admin/payments?days=$days');
  Future<String> forgot(String email) async =>
      (await request('/api/admin/forgot-password',
          public: true, body: {'email': email.trim()}))['message'] as String;
}

String csvExport(List<Map<String, dynamic>> rows, List<String> keys) {
  String cell(dynamic value) {
    var text = value?.toString() ?? '';
    if (RegExp(r'^[=+@\-\t\r]').hasMatch(text)) text = "'$text";
    return '"${text.replaceAll('"', '""')}"';
  }

  return '\uFEFF${[
    keys,
    ...rows.map((r) => keys.map((k) => r[k]).toList())
  ].map((r) => r.map(cell).join(';')).join('\r\n')}';
}
