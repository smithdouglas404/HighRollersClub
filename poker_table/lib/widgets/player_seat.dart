// player_seat.dart — Gemini's EXACT code with BLoC turn glow
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/game_bloc.dart';

class PlayerSeat extends StatelessWidget {
  final int seatIndex;
  const PlayerSeat({super.key, required this.seatIndex});

  @override
  Widget build(BuildContext context) {
    // Gemini: "Inside PlayerSeat Widget — BlocBuilder listens to GameBloc"
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        final bool isMyTurn = state.activeSeat == seatIndex;
        return Column(
          children: [
            // Gemini: "isMyTurn → yellow glow boxShadow"
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: isMyTurn
                    ? [const BoxShadow(color: Colors.yellow, blurRadius: 15, spreadRadius: 2)]
                    : [],
              ),
              child: const CircleAvatar(
                radius: 25,
                backgroundColor: Colors.grey,
                child: Icon(Icons.person, color: Colors.white),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                "Player $seatIndex\n\$${state.playerStacks.length > seatIndex ? state.playerStacks[seatIndex].toInt() : 0}",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 10),
              ),
            ),
          ],
        );
      },
    );
  }
}
