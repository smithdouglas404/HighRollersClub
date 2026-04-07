import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

void main() => runApp(const CyberPokerApp());

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

// --- STATE MANAGEMENT (BLoC) ---

class GameState {
  final int activeSeat;
  final List<double> stacks;
  final List<String> communityCards;
  final List<double> currentBets;
  final int? winnerSeat;
  final String phase; // preflop, flop, turn, river, showdown

  GameState({
    required this.activeSeat,
    required this.stacks,
    required this.communityCards,
    required this.currentBets,
    this.winnerSeat,
    this.phase = 'preflop',
  });

  factory GameState.initial() => GameState(
    activeSeat: 0,
    stacks: List.generate(10, (i) => 1500000.0 + i * 200000),
    communityCards: [],
    currentBets: List.filled(10, 0.0),
  );
}

abstract class GameEvent {}
class UpdateTurn extends GameEvent { final int seat; UpdateTurn(this.seat); }
class DealFlop extends GameEvent {}
class DealTurn extends GameEvent {}
class DealRiver extends GameEvent {}
class DeclareWinner extends GameEvent { final int seat; DeclareWinner(this.seat); }
class ResetHand extends GameEvent {}
class SocketMessageReceived extends GameEvent { final Map<String, dynamic> data; SocketMessageReceived(this.data); }

class GameBloc extends Bloc<GameEvent, GameState> {
  GameBloc() : super(GameState.initial()) {
    on<UpdateTurn>((event, emit) => emit(GameState(
      activeSeat: event.seat, stacks: state.stacks,
      communityCards: state.communityCards, currentBets: state.currentBets,
      phase: state.phase,
    )));
    on<DealFlop>((event, emit) => emit(GameState(
      activeSeat: state.activeSeat, stacks: state.stacks,
      communityCards: ['A♠', 'K♥', '10♣'], currentBets: state.currentBets,
      phase: 'flop',
    )));
    on<DealTurn>((event, emit) => emit(GameState(
      activeSeat: state.activeSeat, stacks: state.stacks,
      communityCards: [...state.communityCards, 'J♦'], currentBets: state.currentBets,
      phase: 'turn',
    )));
    on<DealRiver>((event, emit) => emit(GameState(
      activeSeat: state.activeSeat, stacks: state.stacks,
      communityCards: [...state.communityCards, '7♠'], currentBets: state.currentBets,
      phase: 'river',
    )));
    on<DeclareWinner>((event, emit) => emit(GameState(
      activeSeat: -1, stacks: state.stacks,
      communityCards: state.communityCards, currentBets: state.currentBets,
      winnerSeat: event.seat, phase: 'showdown',
    )));
    on<ResetHand>((event, emit) => emit(GameState.initial()));
  }
}

// --- THE POKER TABLE SCREEN ---

class PokerTableScreen extends StatefulWidget {
  const PokerTableScreen({super.key});

  @override
  State<PokerTableScreen> createState() => _PokerTableScreenState();
}

class _PokerTableScreenState extends State<PokerTableScreen> {
  @override
  void initState() {
    super.initState();
    // Auto-run game simulation
    _runSimulation();
  }

  void _runSimulation() async {
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    context.read<GameBloc>().add(DealFlop());

    // Cycle turns
    for (var i = 0; i < 10; i++) {
      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;
      context.read<GameBloc>().add(UpdateTurn(i));
    }

    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;
    context.read<GameBloc>().add(DealTurn());

    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    context.read<GameBloc>().add(DealRiver());

    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    context.read<GameBloc>().add(DeclareWinner(3));

    await Future.delayed(const Duration(seconds: 4));
    if (!mounted) return;
    context.read<GameBloc>().add(ResetHand());
    _runSimulation();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GameBloc(),
      child: Builder(builder: (context) {
        // Start simulation after BlocProvider is available
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _runSimulation();
        });

        return Scaffold(
          backgroundColor: const Color(0xFF050A05),
          body: Stack(
            children: [
              // 1. BACKGROUND LAYER (Ambient Neon Room)
              const Positioned.fill(child: _CyberBackground()),

              // 2. THE GAME BOARD (10-Player Perspective)
              LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest;
                  final radiusX = size.width * 0.40;
                  final radiusY = size.height * 0.28;
                  final center = Offset(size.width / 2, size.height / 2 - 20);

                  return Stack(
                    children: [
                      // The Table Surface
                      Center(child: _TableSurface(width: radiusX * 2.2, height: radiusY * 2.4)),

                      // Community Cards & Pot — now BLoC-driven
                      Center(child: _CommunityCenterArea()),

                      // 10 Seats
                      ...List.generate(10, (index) {
                        double angle = (index * (2 * math.pi / 10)) + (math.pi / 2);
                        double x = center.dx + radiusX * math.cos(angle) - 60;
                        double y = center.dy + radiusY * math.sin(angle) - 80;

                        bool isUser = index == 0;
                        return AnimatedPositioned(
                          duration: const Duration(milliseconds: 500),
                          left: x,
                          top: y,
                          child: _PlayerSeat(
                            index: index,
                            isUser: isUser,
                            name: _dummyNames[index],
                          ),
                        );
                      }),
                    ],
                  );
                },
              ),

              // 3. UI OVERLAYS
              const Positioned(top: 20, right: 20, child: _AdminPanel()),
              const Positioned(bottom: 120, right: 40, child: _HandStrengthIndicator()),
              const Align(alignment: Alignment.bottomCenter, child: _BottomActionBar()),
            ],
          ),
        );
      }),
    );
  }
}

// --- PLAYER COMPONENT with BLoC ---

class _PlayerSeat extends StatelessWidget {
  final int index;
  final bool isUser;
  final String name;

  const _PlayerSeat({required this.index, required this.isUser, required this.name});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        bool isActive = state.activeSeat == index;
        bool isWinner = state.winnerSeat == index;

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Winner particles
            if (isWinner)
              const Icon(Icons.emoji_events, color: Colors.yellowAccent, size: 24)
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scale(begin: const Offset(1, 1), end: const Offset(1.3, 1.3), duration: 500.ms),

            // Avatar with shimmer + turn glow
            Container(
              height: isUser ? 100 : 70,
              width: 80,
              decoration: BoxDecoration(
                image: DecorationImage(
                  image: AssetImage('assets/images/avatar-full-${(index % 8) + 1}.png'),
                  fit: BoxFit.contain,
                ),
                boxShadow: isActive ? [
                  BoxShadow(color: Colors.greenAccent.withValues(alpha: 0.6), blurRadius: 20, spreadRadius: 5),
                ] : isWinner ? [
                  BoxShadow(color: Colors.yellowAccent.withValues(alpha: 0.7), blurRadius: 25, spreadRadius: 8),
                ] : [],
              ),
            ).animate(onPlay: (c) => c.repeat()).shimmer(duration: 3.seconds, color: Colors.greenAccent.withValues(alpha: 0.2)),

            // Glassmorphism Info Box — BLoC-driven stack
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: isWinner ? Colors.yellowAccent : isActive ? Colors.greenAccent : Colors.white24,
                  width: 1.5,
                ),
                boxShadow: isActive ? [const BoxShadow(color: Colors.greenAccent, blurRadius: 8)]
                    : isWinner ? [const BoxShadow(color: Colors.yellowAccent, blurRadius: 10)] : [],
              ),
              child: Column(
                children: [
                  Text(name, style: GoogleFonts.rajdhani(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                  Text(
                    "\$${_formatStack(state.stacks[index].toInt())}",
                    style: GoogleFonts.shareTechMono(fontSize: 12, color: isWinner ? Colors.yellowAccent : Colors.greenAccent),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  String _formatStack(int amount) {
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(1)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(0)},000';
    return amount.toString();
  }
}

// --- UI ELEMENTS ---

class _TableSurface extends StatelessWidget {
  final double width, height;
  const _TableSurface({required this.width, required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFF132318),
        borderRadius: BorderRadius.all(Radius.elliptical(width, height)),
        border: Border.all(color: const Color(0xFF4A3A2F), width: 10),
        boxShadow: [
          BoxShadow(color: Colors.greenAccent.withValues(alpha: 0.05), blurRadius: 100, spreadRadius: 20),
          const BoxShadow(color: Colors.black, blurRadius: 40, offset: Offset(0, 20)),
        ],
      ),
    );
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
            Text("HIGH ROLLERS CLUB", style: GoogleFonts.orbitron(letterSpacing: 4, color: Colors.white24, fontSize: 14, fontWeight: FontWeight.w900)),
            const SizedBox(height: 20),
            // Community cards — animated entrance
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(5, (index) {
                final hasCard = index < state.communityCards.length;
                return hasCard
                    ? _AnimatedCard(label: state.communityCards[index], delay: index * 150)
                    : _Card(isFlipped: false);
              }),
            ),
            if (state.winnerSeat != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  '${_dummyNames[state.winnerSeat!]} WINS!',
                  style: GoogleFonts.orbitron(color: Colors.yellowAccent, fontSize: 16, fontWeight: FontWeight.bold),
                ).animate().fadeIn(duration: 500.ms).scale(),
              ),
          ],
        );
      },
    );
  }
}

// Card with 3D flip entrance animation
class _AnimatedCard extends StatelessWidget {
  final String label;
  final int delay;
  const _AnimatedCard({required this.label, required this.delay});

  @override
  Widget build(BuildContext context) {
    final isRed = label.contains('♥') || label.contains('♦');
    return Container(
      width: 50, height: 75,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 6, offset: const Offset(0, 3))],
      ),
      child: Center(
        child: Text(label, style: TextStyle(color: isRed ? Colors.red.shade700 : Colors.black, fontSize: 16, fontWeight: FontWeight.w900)),
      ),
    ).animate(delay: Duration(milliseconds: delay))
        .flipV(duration: 400.ms, curve: Curves.easeOut)
        .fadeIn(duration: 300.ms);
  }
}

class _Card extends StatelessWidget {
  final bool isFlipped;
  const _Card({super.key, required this.isFlipped});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 50, height: 75,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: isFlipped ? Colors.white : Colors.black45,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white24),
      ),
      child: isFlipped ? const Center(child: Icon(Icons.style, color: Colors.black)) : null,
    );
  }
}

class _BottomActionBar extends StatelessWidget {
  const _BottomActionBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 90,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.8)]),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _cyberButton("FOLD", Colors.white30),
          const SizedBox(width: 15),
          _cyberButton("CALL 60", Colors.greenAccent),
          const SizedBox(width: 15),
          _cyberButton("RAISE", Colors.greenAccent),
        ],
      ),
    );
  }

  Widget _cyberButton(String text, Color color) {
    return Container(
      width: 120, height: 45,
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color, width: 2),
      ),
      child: Center(child: Text(text, style: GoogleFonts.orbitron(color: color, fontWeight: FontWeight.bold, fontSize: 13))),
    );
  }
}

class _HandStrengthIndicator extends StatelessWidget {
  const _HandStrengthIndicator();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.yellowAccent.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: [
          Text("Current Hand Strength", style: GoogleFonts.rajdhani(fontSize: 10, color: Colors.white54)),
          Text("FLUSH DRAW", style: GoogleFonts.orbitron(fontSize: 16, color: Colors.yellowAccent, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _AdminPanel extends StatelessWidget {
  const _AdminPanel();
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 180, padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _adminItem("Admin Control", isHeader: true),
          _adminItem("Pause Game"),
          _adminItem("Manage Table"),
          _adminItem("Approve New Players"),
        ],
      ),
    );
  }

  Widget _adminItem(String text, {bool isHeader = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(text, style: TextStyle(color: isHeader ? Colors.yellowAccent : Colors.white70, fontSize: 12)),
    );
  }
}

class _CyberBackground extends StatelessWidget {
  const _CyberBackground();
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(center: Alignment.center, radius: 1.5, colors: [Color(0xFF0A2213), Color(0xFF020502)]),
      ),
      child: Opacity(opacity: 0.1, child: CustomPaint(painter: _GridPainter())),
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    var paint = Paint()..color = Colors.greenAccent..strokeWidth = 0.5;
    for (var i = 0; i < size.width; i += 40) {
      canvas.drawLine(Offset(i.toDouble(), 0), Offset(i.toDouble(), size.height), paint);
    }
    for (var i = 0; i < size.height; i += 40) {
      canvas.drawLine(Offset(0, i.toDouble()), Offset(size.width, i.toDouble()), paint);
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

const _dummyNames = ["PosRire", "Vortek", "CyberDeck", "Mystic", "SilverHand", "Pond", "MISTIC1", "Mystic75", "Mystic", "User"];
