// socket_service.dart — Gemini's EXACT WebSocket code
// with sequence_id sync tracking added per Gemini's "Final Architecture Checklist"
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter/foundation.dart';
import 'dart:convert';
import '../bloc/game_bloc.dart';

class PokerSocketService extends ChangeNotifier {
  late WebSocketChannel channel;
  final GameBloc bloc;

  // Gemini: "Your backend sends a sequence_id with every packet.
  // If the Flutter app receives id: 10 but the last one was id: 8,
  // show a small 'Syncing...' spinner while it requests the missing data."
  int _lastSequenceId = 0;
  bool _isSyncing = false;
  bool _isConnected = false;

  bool get isSyncing => _isSyncing;
  bool get isConnected => _isConnected;

  PokerSocketService(this.bloc);

  void connect() {
    // In 2026, use wss:// for secure production web traffic
    channel = WebSocketChannel.connect(Uri.parse('ws://your-backend-url.com/game'));
    _isConnected = true;
    notifyListeners();

    channel.stream.listen((message) {
      final data = jsonDecode(message);

      // Gemini: sequence_id tracking
      if (data.containsKey('sequence_id')) {
        final seqId = data['sequence_id'] as int;
        if (seqId > _lastSequenceId + 1) {
          // Gap detected — show syncing spinner
          _isSyncing = true;
          notifyListeners();
          // Request missing data from server
          sendAction('REQUEST_SYNC', {'from': _lastSequenceId + 1, 'to': seqId});
        }
        _lastSequenceId = seqId;
        _isSyncing = false;
        notifyListeners();
      }

      bloc.add(ReceiveSocketData(data));

      if (data['action'] == 'NEXT_TURN') {
        bloc.add(UpdateTurn(data['seat_index']));
      }
    }, onDone: () {
      _isConnected = false;
      notifyListeners();
    }, onError: (_) {
      _isConnected = false;
      notifyListeners();
    });
  }

  void sendAction(String action, dynamic payload) {
    channel.sink.add(jsonEncode({'action': action, 'payload': payload}));
  }
}
