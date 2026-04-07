import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

/// WebSocket service for real-time multiplayer poker.
/// Connects to the existing Node.js backend.
class WebSocketService {
  WebSocketChannel? _channel;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  Timer? _reconnectTimer;
  String? _url;
  int _reconnectAttempts = 0;
  static const _maxReconnect = 4;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;
  bool get isConnected => _channel != null;

  /// Connect with exponential backoff retry (2s, 4s, 8s, 16s)
  Future<void> connect(String url) async {
    _url = url;
    _reconnectAttempts = 0;
    _doConnect(url);
  }

  void _doConnect(String url) {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      _channel!.stream.listen(
        (data) {
          _reconnectAttempts = 0;
          try {
            final msg = jsonDecode(data as String) as Map<String, dynamic>;
            _messageController.add(msg);
          } catch (_) {}
        },
        onError: (error) => _tryReconnect(),
        onDone: () => _tryReconnect(),
      );
    } catch (e) {
      _tryReconnect();
    }
  }

  void _tryReconnect() {
    if (_reconnectAttempts >= _maxReconnect || _url == null) return;
    final delay = Duration(seconds: 2 << _reconnectAttempts); // 2, 4, 8, 16
    _reconnectAttempts++;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () => _doConnect(_url!));
  }

  void send(Map<String, dynamic> data) {
    _channel?.sink.add(jsonEncode(data));
  }

  /// Send player action to server
  void sendAction(String action, {int amount = 0}) {
    send({'type': 'action', 'action': action, 'amount': amount});
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
