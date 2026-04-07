// socket_service.dart — Gemini's EXACT WebSocket code
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';
import '../bloc/game_bloc.dart';

class PokerSocketService {
  late WebSocketChannel channel;
  final GameBloc bloc;

  PokerSocketService(this.bloc);

  void connect() {
    // In 2026, use wss:// for secure production web traffic
    channel = WebSocketChannel.connect(Uri.parse('ws://your-backend-url.com/game'));

    channel.stream.listen((message) {
      final data = jsonDecode(message);
      bloc.add(ReceiveSocketData(data));

      if (data['action'] == 'NEXT_TURN') {
        bloc.add(UpdateTurn(data['seat_index']));
      }
    });
  }

  void sendAction(String action, dynamic payload) {
    channel.sink.add(jsonEncode({'action': action, 'payload': payload}));
  }
}
