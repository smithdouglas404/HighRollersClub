import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

void main() => runApp(const CyberPokerApp());

// --- 1. ENHANCED STATE MANAGEMENT ---

class GameState {
  final int activeSeat;
  final List<double> stacks;
  final List<String> communityCards;
  final List<double> currentBets;
  final int? winnerSeat;
  final bool isDealing;

  GameState({
    required this.activeSeat,
    required this.stacks,
    required this.communityCards,
    required this.currentBets,
    this.winnerSeat,
    this.isDealing = false,
  });

  factory GameState.initial() => GameState(
    activeSeat: 0,
    stacks: List.generate(10, (i) => 1500000.0),
    communityCards: [],
    currentBets: List.filled(10, 0.0),
  );
}

// Events
abstract class GameEvent {}
class UpdateTurn extends GameEvent { final int seat; UpdateTurn(this.seat); }
class PlaceBet extends GameEvent { final int seat; final double amount; PlaceBet(this.seat, this.amount); }
class DealCommunityCard extends GameEvent { final String card; DealCommunityCard(this.card); }

class GameBloc extends Bloc<GameEvent, GameState> {
  GameBloc() : super(GameState.initial()) {
    on<UpdateTurn>((event, emit) => emit(_copy(activeSeat: event.seat)));
    on<PlaceBet>((event, emit) {
      final newStacks = List<double>.from(state.stacks);
      final newBets = List<double>.from(state.currentBets);
      newStacks[event.seat] -= event.amount;
      newBets[event.seat] += event.amount;
      emit(_copy(stacks: newStacks, currentBets: newBets));
    });
    on<DealCommunityCard>((event, emit) => emit(_copy(
      communityCards: [...state.communityCards, event.card],
    )));
  }

  GameState _copy({int? activeSeat, List<double>? stacks, List<String>? communityCards, List<double>? currentBets}) {
    return GameState(
      activeSeat: activeSeat ?? state.activeSeat,
      stacks: stacks ?? state.stacks,
      communityCards: communityCards ?? state.communityCards,
      currentBets: currentBets ?? state.currentBets,
    );
  }
}

// --- 2. THE MAIN TABLE SCREEN ---

class PokerTableScreen extends StatelessWidget {
  const PokerTableScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GameBloc(),
      child: Scaffold(
        backgroundColor: const Color(0xFF020502),
        body: Stack(
          children: [
            const Positioned.fill(child: _CyberBackground()),

            LayoutBuilder(
              builder: (context, constraints) {
                final size = constraints.biggest;
                final radiusX = size.width * 0.42;
                final radiusY = size.height * 0.26;
                final center = Offset(size.width / 2, size.height / 2);

                return Stack(
                  children: [
                    // LAYER 1: Back Players (Seats 3-7) - These sit BEHIND the table
                    ..._buildSeats(context, [3, 4, 5, 6, 7], center, radiusX, radiusY),

                    // LAYER 2: The Table Surface
                    Center(child: _TableSurface(width: radiusX * 2.2, height: radiusY * 2.6)),

                    // LAYER 3: Community Area & Chips
                    Center(child: _CommunityCenterArea()),

                    // LAYER 4: Front Players (Seats 0, 1, 2, 8, 9) - These sit IN FRONT of table
                    ..._buildSeats(context, [8, 9, 0, 1, 2], center, radiusX, radiusY),
                  ],
                );
              },
            ),

            // LAYER 5: UI Overlays
            const Positioned(top: 30, right: 30, child: _AdminPanel()),
            const Align(alignment: Alignment.bottomCenter, child: _PlayerControls()),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildSeats(BuildContext context, List<int> indices, Offset center, double rx, double ry) {
    return indices.map((index) {
      double angle = (index * (2 * math.pi / 10)) + (math.pi / 2);
      double x = center.dx + rx * math.cos(angle) - 60;
      double y = center.dy + ry * math.sin(angle) - 90;

      return Positioned(
        left: x,
        top: y,
        child: _PlayerSeat(index: index, name: _dummyNames[index]),
      );
    }).toList();
  }
}

// --- 3. THE PLAYER COMPONENT ---

class _PlayerSeat extends StatelessWidget {
  final int index;
  final String name;

  const _PlayerSeat({required this.index, required this.name});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        final bool isTurn = state.activeSeat == index;
        final double currentBet = state.currentBets[index];

        return Column(
          children: [
            // Character with Glow
            Container(
              height: 90,
              width: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: isTurn ? [
                  BoxShadow(color: Colors.greenAccent.withOpacity(0.4), blurRadius: 25, spreadRadius: 5)
                ] : [],
              ),
              child: CircleAvatar(
                backgroundColor: Colors.transparent,
                backgroundImage: AssetImage('assets/images/avatar-full-${(index % 8) + 1}.png'),
              ),
            ).animate(target: isTurn ? 1 : 0).shimmer(color: Colors.greenAccent),

            // Bet Tag (If betting)
            if (currentBet > 0)
              _BetChipTag(amount: currentBet),

            // Info Box
            Container(
              width: 110,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.85),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: isTurn ? Colors.greenAccent : Colors.white12),
              ),
              child: Column(
                children: [
                  Text(name, style: GoogleFonts.rajdhani(fontSize: 11, fontWeight: FontWeight.bold)),
                  Text("\$${state.stacks[index].toInt()}", style: GoogleFonts.shareTechMono(color: Colors.greenAccent)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

// --- 4. NEW: BETTING CONTROLS & SLIDER ---

class _PlayerControls extends StatefulWidget {
  const _PlayerControls();

  @override
  State<_PlayerControls> createState() => _PlayerControlsState();
}

class _PlayerControlsState extends State<_PlayerControls> {
  double _raiseAmount = 5000;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 180,
      width: 450,
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Raise Slider
          Row(
            children: [
              Text("RAISE: \$${_raiseAmount.toInt()}", style: GoogleFonts.orbitron(color: Colors.yellowAccent, fontSize: 12)),
              Expanded(
                child: Slider(
                  value: _raiseAmount,
                  min: 5000,
                  max: 100000,
                  activeColor: Colors.greenAccent,
                  onChanged: (v) => setState(() => _raiseAmount = v),
                ),
              ),
            ],
          ),
          // Action Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _actionBtn("FOLD", Colors.white24),
              _actionBtn("CALL 5k", Colors.blueAccent),
              _actionBtn("RAISE", Colors.greenAccent, onHold: () {
                context.read<GameBloc>().add(PlaceBet(0, _raiseAmount));
              }),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, {VoidCallback? onHold}) {
    return GestureDetector(
      onTap: onHold,
      child: Container(
        width: 110, height: 45,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color, width: 2),
          color: Colors.black45,
        ),
        child: Center(child: Text(label, style: GoogleFonts.orbitron(fontSize: 12, color: color))),
      ),
    );
  }
}

// --- 5. VISUAL HELPERS ---

class _BetChipTag extends StatelessWidget {
  final double amount;
  const _BetChipTag({required this.amount});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFD4AF37), Color(0xFF996515)]),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
      ),
      child: Text("\$${amount.toInt()}", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black)),
    ).animate().scale(duration: 200.ms, curve: Curves.bounceOut);
  }
}

class _CommunityCenterArea extends StatelessWidget {
  const _CommunityCenterArea();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("HIGH ROLLERS CLUB", style: GoogleFonts.orbitron(letterSpacing: 8, color: Colors.white10, fontSize: 18)),
            const SizedBox(height: 20),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(5, (i) {
                bool hasCard = i < state.communityCards.length;
                return Container(
                  width: 55, height: 80,
                  margin: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: hasCard ? Center(child: Text(state.communityCards[i], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold))) : null,
                ).animate(target: hasCard ? 1 : 0).flipH(duration: 400.ms).fadeIn();
              }),
            ),
          ],
        );
      },
    );
  }
}

// Static Components (Background, Table, Admin)
class _TableSurface extends StatelessWidget {
  final double width, height;
  const _TableSurface({required this.width, required this.height});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: width, height: height,
      decoration: BoxDecoration(
        color: const Color(0xFF0F1A13),
        borderRadius: BorderRadius.all(Radius.elliptical(width, height)),
        border: Border.all(color: const Color(0xFF3D2B1F), width: 15),
        boxShadow: [const BoxShadow(color: Colors.black87, blurRadius: 50)],
      ),
    );
  }
}

class _AdminPanel extends StatelessWidget {
  const _AdminPanel();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160, padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.black87, border: Border.all(color: Colors.white10), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("ADMIN CONTROL", style: GoogleFonts.rajdhani(color: Colors.yellowAccent, fontWeight: FontWeight.bold)),
          const Divider(color: Colors.white12),
          const Text("PAUSE GAME", style: TextStyle(fontSize: 10)),
          const Text("MANAGE TABLE", style: TextStyle(fontSize: 10)),
        ],
      ),
    );
  }
}

class _CyberBackground extends StatelessWidget {
  const _CyberBackground();
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: RadialGradient(colors: [Color(0xFF132318), Color(0xFF000000)], radius: 1.2)),
    );
  }
}

const _dummyNames = ["PosRire", "Vortek", "CyberDeck", "Mystic", "SilverHand", "Pond", "MISTIC1", "Mystic75", "Mystic", "User"];

class CyberPokerApp extends StatelessWidget {
  const CyberPokerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: const PokerTableScreen(),
    );
  }
}
