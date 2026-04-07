// Gemini's EXACT "Complete Flutter High Rollers Engine"
// with full-body avatars wired into the seats

import 'dart:math' as math;
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

// --- 1. STATE MANAGEMENT (BLoC) ---

class GameState {
  final int activeSeat;
  final List<double> stacks;
  final List<String> communityCards;
  final List<double> currentBets;

  GameState({
    required this.activeSeat,
    required this.stacks,
    required this.communityCards,
    required this.currentBets,
  });

  factory GameState.initial() => GameState(
    activeSeat: 0,
    stacks: List.generate(10, (index) => 1500000.0),
    communityCards: ['As', 'Ks', 'Qh'],
    currentBets: List.generate(10, (index) => 0.0),
  );
}

abstract class GameEvent {}
class UpdateTurn extends GameEvent { final int seat; UpdateTurn(this.seat); }
class SocketMessageReceived extends GameEvent { final Map<String, dynamic> data; SocketMessageReceived(this.data); }

class GameBloc extends Bloc<GameEvent, GameState> {
  GameBloc() : super(GameState.initial()) {
    on<UpdateTurn>((event, emit) => emit(GameState(
      activeSeat: event.seat,
      stacks: state.stacks,
      communityCards: state.communityCards,
      currentBets: state.currentBets,
    )));
    on<SocketMessageReceived>((event, emit) {
      // Parse server JSON for bets and cards
      if (event.data.containsKey('stacks')) {
        emit(GameState(
          activeSeat: state.activeSeat,
          stacks: List<double>.from(event.data['stacks']),
          communityCards: state.communityCards,
          currentBets: state.currentBets,
        ));
      }
    });
  }
}

// --- AVATAR AND PLAYER DATA ---

const _avatarAssets = [
  'assets/images/avatar-full-1.png',
  'assets/images/avatar-full-2.png',
  'assets/images/avatar-full-3.png',
  'assets/images/avatar-full-4.png',
  'assets/images/avatar-full-5.png',
  'assets/images/avatar-full-6.png',
  'assets/images/avatar-full-7.png',
  'assets/images/avatar-full-8.png',
  'assets/images/avatar-full-1.png',
  'assets/images/avatar-full-2.png',
];

const _playerNames = [
  'CyberDeck', 'Vortek', 'Mystic', 'SilverHand', 'PosRire',
  'Pond', 'MISTIC1', 'Mystic75', 'NeonViper', 'ShadowKng',
];

// --- 2. THE POKER TABLE UI ---

void main() => runApp(MaterialApp(
  home: HighRollersTable(),
  theme: ThemeData.dark(),
  debugShowCheckedModeBanner: false,
));

class HighRollersTable extends StatelessWidget {
  const HighRollersTable({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => GameBloc(),
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0F0D),
        body: Stack(
          children: [
            // Background Shader/Image Layer
            const Positioned.fill(child: _BackgroundLayer()),

            // The Table Layout Builder
            LayoutBuilder(
              builder: (context, constraints) {
                final size = constraints.biggest;
                // PERSPECTIVE MATH: Narrower Y radius creates the tilted table look
                final radiusX = size.width * 0.42;
                final radiusY = size.height * 0.28;
                final center = Offset(size.width / 2, size.height / 2);

                return Stack(
                  children: [
                    // The Center Table Graphic
                    Center(child: _TableFelt(width: radiusX * 2.2, height: radiusY * 2.5)),

                    // Community Cards
                    Center(child: _CommunityArea()),

                    // 10 Seats distributed in a perspective oval
                    ...List.generate(10, (index) {
                      // Adjust angle so Seat 0 is at bottom center
                      double angle = (index * (2 * math.pi / 10)) + (math.pi / 2);
                      double x = center.dx + radiusX * math.cos(angle) - 60;
                      double y = center.dy + radiusY * math.sin(angle) - 80;

                      return AnimatedPositioned(
                        duration: const Duration(milliseconds: 500),
                        left: x,
                        top: y,
                        child: PlayerSeatWidget(index: index),
                      );
                    }),
                  ],
                );
              },
            ),

            // HIGH ROLLERS CLUB logo
            Positioned(
              top: 16,
              left: 0, right: 0,
              child: Center(
                child: Text(
                  'HIGH ROLLERS\nCLUB',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.orbitron(
                    color: const Color(0xCCD4AF37),
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 4,
                    height: 1.2,
                  ),
                ),
              ),
            ),

            // Bottom Action Bar
            const Align(
              alignment: Alignment.bottomCenter,
              child: _ActionBar(),
            ),
          ],
        ),
      ),
    );
  }
}

// --- 3. THE CYBERPUNK PLAYER COMPONENT ---
// Gemini's EXACT PlayerSeatWidget with full-body avatar images

class PlayerSeatWidget extends StatelessWidget {
  final int index;
  const PlayerSeatWidget({super.key, required this.index});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        bool isActive = state.activeSeat == index;

        return SizedBox(
          width: 120,
          height: 200,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. THE TURN GLOW (Only shows when it's their turn)
              // Gemini: "When your WebSocket says it's 'CyberDeck's' turn,
              // the BLoC updates activeSeat. isCurrentTurn flips to true,
              // and the Green Glow triggers instantly."
              if (isActive)
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.greenAccent.withValues(alpha: 0.5),
                        blurRadius: 30,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                ),

              // 2. THE AVATAR (The Cyborg/Robot) — full-body image
              // Gemini: "Full 3D high-fidelity avatars (cyborgs, robots)"
              Positioned(
                top: 0,
                child: Image.asset(
                  _avatarAssets[index % _avatarAssets.length],
                  height: 120,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Container(
                    height: 120,
                    width: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.black54,
                      boxShadow: isActive
                          ? [BoxShadow(color: Colors.greenAccent.withValues(alpha: 0.6), blurRadius: 20, spreadRadius: 5)]
                          : [],
                    ),
                    child: const Icon(Icons.psychology, color: Colors.greenAccent, size: 40),
                  ),
                ),
              ),

              // 3. THE INFO BOX (Cyberpunk Glass Style)
              // Gemini: "dark metal texture and green border gradient"
              Positioned(
                bottom: 10,
                child: _buildInfoBox(state, isActive),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoBox(GameState state, bool isActive) {
    return Container(
      width: 110,
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      decoration: BoxDecoration(
        // Dark semi-transparent background
        color: Colors.black.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isActive ? Colors.greenAccent : Colors.white24,
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Gemini: "Use Rajdhani font for cyberpunk feel"
          Text(
            _playerNames[index % _playerNames.length].toUpperCase(),
            style: GoogleFonts.rajdhani(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          // Gemini: "Use ShareTechMono for money — monospace feels more cyber"
          Text(
            "\$${_formatStack(state.stacks[index].toInt())}",
            style: GoogleFonts.shareTechMono(
              color: Colors.greenAccent,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  String _formatStack(int amount) {
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(1)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(0)},000';
    return amount.toString();
  }
}

// --- 4. SUB-WIDGETS (VISUALS) ---

class _TableFelt extends StatelessWidget {
  final double width, height;
  const _TableFelt({required this.width, required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFF1B3022),
        borderRadius: BorderRadius.all(Radius.elliptical(width, height)),
        border: Border.all(color: const Color(0xFF3A2A1F), width: 12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 40)],
      ),
    );
  }
}

class _CommunityArea extends StatelessWidget {
  const _CommunityArea();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) => Container(
        width: 45, height: 65,
        margin: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.black38,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: Colors.white10),
        ),
        child: i < 3 ? const Center(child: Text("?", style: TextStyle(color: Colors.greenAccent))) : null,
      )),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
      color: Colors.black87,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _pokerButton("FOLD", Colors.redAccent),
          _pokerButton("CALL", Colors.blueAccent),
          _pokerButton("RAISE", Colors.greenAccent),
        ],
      ),
    );
  }

  Widget _pokerButton(String label, Color color) {
    return Container(
      width: 100, height: 40,
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(child: Text(label, style: GoogleFonts.orbitron(fontSize: 12, color: color))),
    );
  }
}

class _BackgroundLayer extends StatelessWidget {
  const _BackgroundLayer();
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment.center,
          colors: [Color(0xFF1A2A20), Color(0xFF050505)],
          radius: 1.2,
        ),
      ),
    );
  }
}
