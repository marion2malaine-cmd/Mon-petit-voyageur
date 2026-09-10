import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class DraftStore {
  final FlutterSecureStorage storage;
  const DraftStore({this.storage = const FlutterSecureStorage()});
  Future<Map<String, dynamic>> read() async {
    try {
      final raw = await storage.read(key: 'trip_draft');
      return raw == null ? {} : Map<String, dynamic>.from(jsonDecode(raw));
    } catch (_) {
      return {};
    }
  }

  Future<void> write(Map<String, dynamic> value) =>
      storage.write(key: 'trip_draft', value: jsonEncode(value));
}
