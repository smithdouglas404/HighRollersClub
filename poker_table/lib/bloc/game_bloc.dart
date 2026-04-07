// game_bloc.dart — Gemini's EXACT code
import 'package:flutter_bloc/flutter_bloc.dart';

// Events
abstract class GameEvent {}
class UpdateTurn extends GameEvent { final int seatIndex; UpdateTurn(this.seatIndex); }
class ReceiveSocketData extends GameEvent { final Map<String, dynamic> data; ReceiveSocketData(this.data); }

// State
class GameState {
  final int activeSeat;
  final List<double> playerStacks;
  GameState({required this.activeSeat, required this.playerStacks});
}

class GameBloc extends Bloc<GameEvent, GameState> {
  GameBloc() : super(GameState(activeSeat: 0, playerStacks: List.filled(10, 1000.0))) {
    on<UpdateTurn>((event, emit) => emit(GameState(
      activeSeat: event.seatIndex,
      playerStacks: state.playerStacks,
    )));

    on<ReceiveSocketData>((event, emit) {
      // Handle stack updates from WebSocket
      if (event.data.containsKey('stacks')) {
        emit(GameState(
          activeSeat: state.activeSeat,
          playerStacks: List<double>.from(event.data['stacks']),
        ));
      }
    });
  }
}
