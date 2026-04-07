import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/game_bloc.dart';
import '../bloc/game_event.dart';
import '../models/game_state.dart';
import '../models/player_model.dart';
import '../theme/poker_theme.dart';
import 'player_seat.dart';
import 'community_cards.dart';
import 'pot_display.dart';
import 'effects/winner_particles.dart';

/// Seat positions as fractions of the table container (0.0–1.0).
/// Arranged in an ellipse, seat 0 = hero at 6 o'clock.
List<Offset> _seatPositions(int count) {
  const cx = 0.50, cy = 0.50;
  const rx = 0.40, ry = 0.42;
  final startAngle = pi / 2; // Start at bottom (hero seat)
  return List.generate(count, (i) {
    final angle = startAngle + (2 * pi * i) / count;
    return Offset(cx + rx * cos(angle), cy + ry * sin(angle));
  });
}

class PokerTableWidget extends StatefulWidget {
  const PokerTableWidget({super.key});

  @override
  State<PokerTableWidget> createState() => _PokerTableWidgetState();
}

class _PokerTableWidgetState extends State<PokerTableWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ambientController;

  @override
  void initState() {
    super.initState();
    _ambientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    // Start game simulation
    context.read<GameBloc>().add(const StartSimulationEvent());
  }

  @override
  void dispose() {
    _ambientController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<GameBloc, GameState>(
      builder: (context, state) {
        final seats = _seatPositions(10);

        return LayoutBuilder(
          builder: (context, constraints) {
            final w = constraints.maxWidth;
            final h = constraints.maxHeight;
            // Table ellipse dimensions
            final tableW = w * 0.62;
            final tableH = h * 0.55;
            final tableLeft = (w - tableW) / 2;
            final tableTop = (h - tableH) / 2;

            return Container(
              color: PokerTheme.background,
              child: Stack(
                children: [
                  // Ambient background glow
                  _buildAmbientGlow(w, h),

                  // Table felt surface
                  Positioned(
                    left: tableLeft,
                    top: tableTop,
                    width: tableW,
                    height: tableH,
                    child: _buildTableFelt(),
                  ),

                  // Community cards — center of table
                  Positioned(
                    left: w * 0.5 - (state.communityCards.length * 32),
                    top: h * 0.38,
                    child: CommunityCardsWidget(cards: state.communityCards),
                  ),

                  // Pot display — above community cards
                  if (state.pot > 0)
                    Positioned(
                      left: 0,
                      right: 0,
                      top: h * 0.28,
                      child: PotDisplay(pot: state.pot),
                    ),

                  // Player seats — positioned around the table
                  for (var i = 0; i < seats.length; i++)
                    if (i < state.players.length)
                      _buildPlayerSeat(state, state.players[i], seats[i], w, h, i),

                  // Winner particle effects
                  if (state.winnerSeat != null)
                    Positioned(
                      left: seats[state.winnerSeat!].dx * w - 80,
                      top: seats[state.winnerSeat!].dy * h - 80,
                      child: const WinnerParticles(),
                    ),

                  // Top-left info panel
                  Positioned(
                    left: 16,
                    top: 16,
                    child: _buildInfoPanel(state),
                  ),

                  // Phase indicator
                  Positioned(
                    left: 0,
                    right: 0,
                    top: h * 0.22,
                    child: _buildPhaseBar(state),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildPlayerSeat(GameState state, PlayerModel player, Offset pos, double w, double h, int index) {
    // Perspective scale — seats farther from hero are smaller
    final distFromHero = (index == 0) ? 0.0 : (index <= 5 ? index / 5.0 : (10 - index) / 5.0);
    final scale = 1.0 - (distFromHero * 0.18);
    final isActive = state.currentTurnSeat == player.seatIndex;
    final isWinner = state.winnerSeat == player.seatIndex;

    return Positioned(
      left: pos.dx * w - (75 * scale),
      top: pos.dy * h - (90 * scale),
      child: Transform.scale(
        scale: scale,
        child: PlayerSeatWidget(
          player: player,
          isActive: isActive,
          isWinner: isWinner,
          isHero: index == 0,
          seatColor: PokerTheme.seatColors[index % PokerTheme.seatColors.length],
        ),
      ),
    );
  }

  Widget _buildTableFelt() {
    return AnimatedBuilder(
      animation: _ambientController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(1000), // Full ellipse
            gradient: RadialGradient(
              center: Alignment(
                -0.1 + sin(_ambientController.value * 2 * pi) * 0.05,
                -0.2 + cos(_ambientController.value * 2 * pi) * 0.03,
              ),
              radius: 0.9,
              colors: const [
                Color(0xFF1A3A2A), // Light felt center
                Color(0xFF0F2A1C), // Medium
                Color(0xFF0A1F15), // Dark edge
                Color(0xFF071A10), // Very dark
                Color(0xFF040E08), // Near black edge
              ],
              stops: const [0.0, 0.3, 0.5, 0.7, 1.0],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.7),
                blurRadius: 40,
                offset: const Offset(0, 8),
              ),
              // Outer glow
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 100,
              ),
            ],
            border: Border.all(color: PokerTheme.gunmetal, width: 7),
          ),
          child: Container(
            margin: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(1000),
              border: Border.all(
                color: PokerTheme.gold.withValues(alpha: 0.3),
                width: 2.5,
              ),
            ),
            child: Container(
              margin: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(1000),
                border: Border.all(
                  color: PokerTheme.gold.withValues(alpha: 0.12),
                  width: 1,
                ),
              ),
              child: Center(
                child: Text(
                  'HIGH ROLLERS',
                  style: TextStyle(
                    color: PokerTheme.gold.withValues(alpha: 0.08),
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 12,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAmbientGlow(double w, double h) {
    return Stack(
      children: [
        Positioned(
          left: w * 0.1,
          top: -h * 0.2,
          child: Container(
            width: 600,
            height: 600,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  PokerTheme.cyan.withValues(alpha: 0.03),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        Positioned(
          right: w * 0.1,
          bottom: -h * 0.1,
          child: Container(
            width: 500,
            height: 500,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  Colors.purple.withValues(alpha: 0.02),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoPanel(GameState state) {
    final phaseLabel = switch (state.phase) {
      GamePhase.waiting => 'Waiting',
      GamePhase.preflop => 'Pre-Flop',
      GamePhase.flop => 'Flop',
      GamePhase.turn => 'Turn',
      GamePhase.river => 'River',
      GamePhase.showdown => 'Showdown',
      GamePhase.winner => 'Winner',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: PokerTheme.glassPanel(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'High Rollers Main',
            style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16,
            ),
          ),
          Text(
            '\$${state.smallBlind}/\$${state.bigBlind} NLH',
            style: const TextStyle(color: PokerTheme.cyan, fontSize: 11, fontFamily: 'monospace'),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Round: ', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11)),
              Text(phaseLabel, style: const TextStyle(color: PokerTheme.cyan, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
          Text(
            'Hand #${state.handNumber}',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 11, fontFamily: 'monospace'),
          ),
        ],
      ),
    );
  }

  Widget _buildPhaseBar(GameState state) {
    const phases = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'];
    final currentIdx = switch (state.phase) {
      GamePhase.preflop => 0,
      GamePhase.flop => 1,
      GamePhase.turn => 2,
      GamePhase.river => 3,
      _ => -1,
    };

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < phases.length; i++) ...[
          if (i > 0) Container(width: 20, height: 1, color: Colors.white.withValues(alpha: 0.1)),
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: i == currentIdx
                  ? PokerTheme.cyan.withValues(alpha: 0.2)
                  : Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(
                color: i == currentIdx
                    ? PokerTheme.cyan.withValues(alpha: 0.5)
                    : Colors.white.withValues(alpha: 0.1),
              ),
            ),
            child: Text(
              phases[i],
              style: TextStyle(
                color: i == currentIdx ? PokerTheme.cyan : Colors.white.withValues(alpha: 0.4),
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 1,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
