import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/game_bloc.dart';
import 'player_seat.dart';
import 'card_widget.dart';
import 'betting_slider.dart';

/// Gemini's EXACT "Center-Out" coordinate system — verbatim
class PokerTable extends StatelessWidget {
  final int totalSeats = 10;

  const PokerTable({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GameBloc(),
      child: Scaffold(
        backgroundColor: const Color(0xFF1A3626), // Classic felt green
        body: LayoutBuilder(
          builder: (context, constraints) {
            // Calculate center and radius based on screen size
            final size = constraints.biggest;
            final centerX = size.width / 2;
            final centerY = size.height / 2;
            final radiusX = size.width * 0.35; // Oval width
            final radiusY = size.height * 0.25; // Oval height

            return Stack(
              children: [
                // 1. The Physical Table Graphic
                Center(
                  child: Container(
                    width: radiusX * 2.2,
                    height: radiusY * 2.4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2C5E41),
                      borderRadius: BorderRadius.all(Radius.elliptical(radiusX * 2, radiusY * 2)),
                      border: Border.all(color: const Color(0xFF5D4037), width: 15),
                      boxShadow: const [BoxShadow(blurRadius: 20, color: Colors.black54)],
                    ),
                  ),
                ),

                // 2. The Pot / Community Cards Area
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      BlocBuilder<GameBloc, GameState>(
                        builder: (context, state) {
                          return Text(
                            "POT: \$${state.playerStacks.isNotEmpty ? state.playerStacks.reduce((a, b) => a + b).toInt() ~/ 10 : 0}",
                            style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold),
                          );
                        },
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(5, (index) => _buildCommunityCardSlot()),
                      ),
                    ],
                  ),
                ),

                // 3. Dynamic Player Positioning (The 10 Seats)
                // Gemini: "Math: Distribute players in an ellipse.
                // Start from the bottom (index 0) and go clockwise"
                ...List.generate(totalSeats, (index) {
                  double angle = (index * (2 * math.pi / totalSeats)) + (math.pi / 2);
                  double x = centerX + radiusX * math.cos(angle) - 40; // 40 is half widget width
                  double y = centerY + radiusY * math.sin(angle) - 40;

                  return AnimatedPositioned(
                    duration: const Duration(milliseconds: 500),
                    left: x,
                    top: y,
                    child: PlayerSeat(seatIndex: index),
                  );
                }),

                // 4. The Betting Overlay (Only shows when it's YOUR turn)
                BlocBuilder<GameBloc, GameState>(
                  builder: (context, state) {
                    // Assuming "Player 0" is the local user
                    if (state.activeSeat == 0) {
                      return Align(
                        alignment: Alignment.bottomCenter,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 50),
                          child: BettingSlider(
                            minBet: 20,
                            maxStack: state.playerStacks.isNotEmpty ? state.playerStacks[0] : 1000,
                            onBetConfirmed: (amount) {
                              // Send bet to WebSocket!
                              // context.read<PokerSocketService>().sendAction('PLACE_BET', amount);
                            },
                          ),
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),

                // 5. Connection Status Indicator
                const Positioned(
                  top: 10, right: 10,
                  child: Icon(Icons.wifi, color: Colors.greenAccent, size: 14),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildCommunityCardSlot() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: 40,
      height: 60,
      decoration: BoxDecoration(
        color: Colors.black26,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white10),
      ),
    );
  }
}
