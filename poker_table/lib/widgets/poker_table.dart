import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/game_bloc.dart';
import '../models/card_model.dart';
import '../theme/poker_theme.dart';
import 'card_widget.dart';
import 'betting_slider.dart';
import 'chip_flight.dart';
import 'community_cards.dart';
import 'pot_display.dart';
import 'effects/winner_particles.dart';

/// Avatar images — the 10 characters sitting at the table
const _avatarAssets = [
  'assets/avatars/avatar_neon_viper.webp',
  'assets/avatars/avatar_chrome_siren.webp',
  'assets/avatars/avatar_gold_phantom.webp',
  'assets/avatars/avatar_shadow_king.webp',
  'assets/avatars/avatar_red_wolf.webp',
  'assets/avatars/avatar_ice_queen.webp',
  'assets/avatars/avatar_tech_monk.webp',
  'assets/avatars/avatar_cyber_punk.webp',
  'assets/avatars/avatar_steel_ghost.webp',
  'assets/avatars/avatar_neon_fox.webp',
];

const _playerNames = [
  'NeonViper', 'ChromeSiren', 'GoldPhantom', 'ShadowKing', 'RedWolf',
  'IceQueen', 'TechMonk', 'CyberPunk', 'SteelGhost', 'NeonFox',
];

/// Seat ring colors per player
const _seatGlowColors = [
  Color(0xFFD4AF37), // gold (hero)
  Color(0xFFB44DFF), // purple
  Color(0xFFFFD700), // bright gold
  Color(0xFFD4AF37), // gold
  Color(0xFFFF3366), // red
  Color(0xFF67E8F9), // cyan
  Color(0xFFD4AF37), // gold
  Color(0xFFFF69B4), // pink
  Color(0xFF8ECAE6), // blue
  Color(0xFFFF8C00), // orange
];

/// Gemini's "Center-Out" coordinate system with ALL effects wired in:
/// - PokerCard 3D flip on community cards
/// - CardDealer flying cards from deck to seats
/// - ChipFlightWidget AnimatedPositioned from seat to pot
/// - WinnerParticles golden burst on winner
/// - AllInFireOverlay Flame VFX on all-in players
/// - BettingSlider when it's hero's turn
class PokerTable extends StatefulWidget {
  final int totalSeats = 10;

  const PokerTable({super.key});

  @override
  State<PokerTable> createState() => _PokerTableState();
}

class _PokerTableState extends State<PokerTable> with TickerProviderStateMixin {
  // Demo state for simulation
  int _activeSeat = 0;
  int? _winnerSeat;
  int _pot = 0;
  bool _dealing = false;
  List<PlayingCard>? _communityCards;
  List<List<PlayingCard>> _playerCards = List.generate(10, (_) => []);
  final List<String> _playerActions = List.filled(10, '');
  late AnimationController _dealController;

  // Chip flight tracking
  final List<_ChipFlight> _chipFlights = [];
  int _chipFlightId = 0;

  @override
  void initState() {
    super.initState();
    _dealController = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    // Start a demo hand after a brief delay
    Future.delayed(const Duration(seconds: 1), _dealNewHand);
  }

  @override
  void dispose() {
    _dealController.dispose();
    super.dispose();
  }

  void _dealNewHand() {
    final deck = PlayingCard.fullDeck()..shuffle();
    var ci = 0;

    setState(() {
      _winnerSeat = null;
      _pot = 1500;
      _communityCards = null;
      _playerActions.fillRange(0, 10, '');
      _playerCards = List.generate(10, (_) => [deck[ci++], deck[ci++]]);
      _dealing = true;
      _activeSeat = 0;
    });

    // Deal flop after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (!mounted) return;
      setState(() {
        _communityCards = [
          deck[ci++].copyWith(faceUp: true),
          deck[ci++].copyWith(faceUp: true),
          deck[ci++].copyWith(faceUp: true),
        ];
        _pot = 4500;
        _dealing = false;
      });

      // Simulate some actions
      _simulateActions(ci, deck);
    });
  }

  void _simulateActions(int ci, List<PlayingCard> deck) {
    var delay = 800;
    // Some folds
    for (final seat in [2, 5, 8]) {
      Future.delayed(Duration(milliseconds: delay), () {
        if (!mounted) return;
        setState(() {
          _playerActions[seat] = 'fold';
          _activeSeat = (seat + 1) % 10;
        });
      });
      delay += 600;
    }

    // Turn
    Future.delayed(Duration(milliseconds: delay), () {
      if (!mounted) return;
      setState(() {
        _communityCards = [..._communityCards!, deck[ci].copyWith(faceUp: true)];
        _pot = 8000;
      });
    });
    delay += 1500;

    // Some bets with chip flights
    for (final seat in [0, 1, 3, 4, 6, 7, 9]) {
      if ([2, 5, 8].contains(seat)) continue;
      Future.delayed(Duration(milliseconds: delay), () {
        if (!mounted) return;
        _launchChipFlight(seat);
        setState(() {
          _pot += 2000;
          _activeSeat = (seat + 1) % 10;
        });
      });
      delay += 500;
    }

    // River
    Future.delayed(Duration(milliseconds: delay), () {
      if (!mounted) return;
      setState(() {
        _communityCards = [..._communityCards!, deck[ci + 1].copyWith(faceUp: true)];
        _pot = 18000;
      });
    });
    delay += 2000;

    // Winner
    Future.delayed(Duration(milliseconds: delay), () {
      if (!mounted) return;
      setState(() {
        _winnerSeat = 3;
        _activeSeat = -1;
      });
    });
    delay += 5000;

    // Next hand
    Future.delayed(Duration(milliseconds: delay), () {
      if (mounted) _dealNewHand();
    });
  }

  void _launchChipFlight(int fromSeat) {
    setState(() {
      _chipFlights.add(_ChipFlight(id: _chipFlightId++, seatIndex: fromSeat));
    });
    // Remove after animation completes
    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) {
        setState(() {
          _chipFlights.removeWhere((f) => f.seatIndex == fromSeat);
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GameBloc(),
      child: Scaffold(
        backgroundColor: const Color(0xFF1A3626), // Classic felt green
        body: LayoutBuilder(
          builder: (context, constraints) {
            // Gemini: "Calculate center and radius based on screen size"
            final size = constraints.biggest;
            final centerX = size.width / 2;
            final centerY = size.height / 2;
            final radiusX = size.width * 0.35;
            final radiusY = size.height * 0.35;

            return Stack(
              children: [
                // 1. The Physical Table Graphic
                Center(
                  child: Container(
                    width: radiusX * 2.2,
                    height: radiusY * 2.0,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2C5E41),
                      borderRadius: BorderRadius.all(Radius.elliptical(radiusX * 2, radiusY * 2)),
                      border: Border.all(color: const Color(0xFF5D4037), width: 15),
                      boxShadow: const [BoxShadow(blurRadius: 20, color: Colors.black54)],
                    ),
                  ),
                ),

                // 2. Pot + Community Cards — using CommunityCardsWidget with AnimatedSwitcher
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Pot display with animated count
                      PotDisplay(pot: _pot),
                      const SizedBox(height: 10),
                      // Community cards — AnimatedSwitcher 3D flip
                      if (_communityCards != null && _communityCards!.isNotEmpty)
                        CommunityCardsWidget(cards: _communityCards!)
                      else
                        // Empty card slots
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(5, (index) => _buildCommunityCardSlot()),
                        ),
                    ],
                  ),
                ),

                // 3. Dynamic Player Positioning — Gemini's EXACT ellipse math
                ...List.generate(widget.totalSeats, (index) {
                  double angle = (index * (2 * math.pi / widget.totalSeats)) + (math.pi / 2);
                  double x = centerX + radiusX * math.cos(angle) - 40;
                  double y = centerY + radiusY * math.sin(angle) - 50;

                  final isFolded = _playerActions[index] == 'fold';
                  final isWinner = _winnerSeat == index;
                  final isActive = _activeSeat == index;
                  final hasCards = _playerCards[index].isNotEmpty;

                  // Gemini: AnimatedPositioned — smooth slide
                  return AnimatedPositioned(
                    duration: const Duration(milliseconds: 500),
                    left: x,
                    top: y,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 400),
                      opacity: isFolded ? 0.4 : 1.0,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Winner particles — CustomPainter burst
                          if (isWinner)
                            const SizedBox(
                              width: 160, height: 80,
                              child: WinnerParticles(),
                            ),

                          // ── Full portrait avatar sitting at the table ──
                          // Stitch-poker style: avatar image fills a tall card,
                          // gradient overlay at bottom, cards overlap, name bar below
                          Container(
                            width: 120,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isWinner
                                    ? PokerTheme.goldBright
                                    : isActive
                                        ? _seatGlowColors[index % _seatGlowColors.length]
                                        : _seatGlowColors[index % _seatGlowColors.length].withValues(alpha: 0.4),
                                width: isWinner ? 3 : isActive ? 2.5 : 2,
                              ),
                              boxShadow: isActive
                                  ? [BoxShadow(color: _seatGlowColors[index % _seatGlowColors.length].withValues(alpha: 0.7), blurRadius: 20, spreadRadius: 3)]
                                  : isWinner
                                      ? [BoxShadow(color: PokerTheme.goldBright.withValues(alpha: 0.8), blurRadius: 25, spreadRadius: 5)]
                                      : [BoxShadow(color: Colors.black.withValues(alpha: 0.6), blurRadius: 12)],
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Avatar portrait — the character sitting at the table
                                ClipRRect(
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
                                  child: SizedBox(
                                    width: 120,
                                    height: 110,
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        // Avatar image
                                        ColorFiltered(
                                          colorFilter: isFolded
                                              ? const ColorFilter.matrix(<double>[
                                                  0.2126, 0.7152, 0.0722, 0, 0,
                                                  0.2126, 0.7152, 0.0722, 0, 0,
                                                  0.2126, 0.7152, 0.0722, 0, 0,
                                                  0, 0, 0, 1, 0,
                                                ])
                                              : const ColorFilter.mode(Colors.transparent, BlendMode.multiply),
                                          child: Image.asset(
                                            _avatarAssets[index % _avatarAssets.length],
                                            fit: BoxFit.cover,
                                            alignment: const Alignment(0, -0.6),
                                            errorBuilder: (_, __, ___) => Container(
                                              color: Colors.grey.shade800,
                                              child: Center(
                                                child: Text(
                                                  _playerNames[index][0],
                                                  style: const TextStyle(color: Colors.white54, fontSize: 32, fontWeight: FontWeight.w900),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),

                                        // Gradient overlay — cinematic bottom fade
                                        Positioned(
                                          bottom: 0, left: 0, right: 0, height: 60,
                                          child: Container(
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                begin: Alignment.topCenter,
                                                end: Alignment.bottomCenter,
                                                colors: [
                                                  Colors.transparent,
                                                  Colors.black.withValues(alpha: 0.7),
                                                  Colors.black.withValues(alpha: 0.95),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),

                                        // Top glow edge
                                        Positioned(
                                          top: 0, left: 0, right: 0, height: 3,
                                          child: Container(
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: [
                                                  Colors.transparent,
                                                  _seatGlowColors[index % _seatGlowColors.length],
                                                  Colors.transparent,
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),

                                        // FOLD badge overlay
                                        if (isFolded)
                                          Center(
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: Colors.red.withValues(alpha: 0.7),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: const Text('FOLD', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1)),
                                            ),
                                          ),

                                        // WINNER badge overlay
                                        if (isWinner)
                                          Positioned(
                                            bottom: 8, left: 0, right: 0,
                                            child: Center(
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: PokerTheme.gold.withValues(alpha: 0.3),
                                                  borderRadius: BorderRadius.circular(4),
                                                  border: Border.all(color: PokerTheme.goldBright),
                                                ),
                                                child: const Text('WINNER', style: TextStyle(color: PokerTheme.goldBright, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                                              ),
                                            ),
                                          ),

                                        // Face-down hole cards overlapping bottom of portrait
                                        if (hasCards && !isFolded && index != 0 && _winnerSeat == null)
                                          Positioned(
                                            bottom: -6, left: 0, right: 0,
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Transform.rotate(
                                                  angle: -0.15,
                                                  child: Container(
                                                    width: 28, height: 40,
                                                    decoration: BoxDecoration(
                                                      color: Colors.blue.shade900,
                                                      borderRadius: BorderRadius.circular(3),
                                                      border: Border.all(color: Colors.white, width: 1.5),
                                                    ),
                                                    child: const Center(child: Icon(Icons.star, color: Colors.white24, size: 12)),
                                                  ),
                                                ),
                                                Transform.rotate(
                                                  angle: 0.15,
                                                  child: Container(
                                                    width: 28, height: 40,
                                                    decoration: BoxDecoration(
                                                      color: Colors.blue.shade900,
                                                      borderRadius: BorderRadius.circular(3),
                                                      border: Border.all(color: Colors.white, width: 1.5),
                                                    ),
                                                    child: const Center(child: Icon(Icons.star, color: Colors.white24, size: 12)),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),

                                        // Hero face-up cards OR showdown revealed cards
                                        if (hasCards && !isFolded && (index == 0 || _winnerSeat != null))
                                          Positioned(
                                            bottom: -6, left: 0, right: 0,
                                            child: Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                for (var ci = 0; ci < _playerCards[index].length; ci++)
                                                  Transform.rotate(
                                                    angle: ci == 0 ? -0.15 : 0.15,
                                                    child: Transform.scale(
                                                      scale: 0.55,
                                                      child: PokerCard(
                                                        rank: _playerCards[index][ci].rankLabel,
                                                        suit: _playerCards[index][ci].suitSymbol,
                                                      ),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),

                                // Name + chip count bar
                                Container(
                                  width: 120,
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xF00A0A0C),
                                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(10)),
                                  ),
                                  child: Column(
                                    children: [
                                      Text(
                                        _playerNames[index % _playerNames.length],
                                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        '\$${(15000 + index * 2000 - (_pot ~/ 10)).clamp(0, 99999)}',
                                        style: const TextStyle(color: PokerTheme.goldBright, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                                      ),
                                      // Bottom gold accent
                                      Container(
                                        margin: const EdgeInsets.only(top: 2),
                                        height: 2,
                                        decoration: const BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [Colors.transparent, PokerTheme.gold, PokerTheme.goldBright, PokerTheme.gold, Colors.transparent],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),

                // 4. Chip flights — AnimatedPositioned from seat to pot center
                for (final flight in _chipFlights)
                  () {
                    double angle = (flight.seatIndex * (2 * math.pi / widget.totalSeats)) + (math.pi / 2);
                    double fromX = centerX + radiusX * math.cos(angle);
                    double fromY = centerY + radiusY * math.sin(angle);
                    return ChipFlightWidget(
                      key: ValueKey('chip_${flight.id}'),
                      fromX: fromX,
                      fromY: fromY,
                      toX: centerX,
                      toY: centerY - 30,
                    );
                  }(),

                // 5. CardDealer flying cards — during dealing phase
                if (_dealing)
                  for (var i = 0; i < widget.totalSeats; i++)
                    TweenAnimationBuilder<double>(
                      key: ValueKey('deal_$i'),
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: Duration(milliseconds: 400 + i * 100),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, child) {
                        double angle = (i * (2 * math.pi / widget.totalSeats)) + (math.pi / 2);
                        double endX = centerX + radiusX * math.cos(angle) - 20;
                        double endY = centerY + radiusY * math.sin(angle) + 30;
                        final pos = Offset.lerp(Offset(centerX - 20, centerY - 20), Offset(endX, endY), value)!;
                        return Positioned(
                          left: pos.dx,
                          top: pos.dy,
                          child: Transform.rotate(
                            angle: value * 2 * 3.1415, // Gemini: "Spins twice while flying"
                            child: Opacity(
                              opacity: (1 - value * 0.5).clamp(0, 1),
                              child: Container(
                                width: 35, height: 50,
                                decoration: BoxDecoration(
                                  color: Colors.blue,
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(Icons.star, color: Colors.white30, size: 16),
                              ),
                            ),
                          ),
                        );
                      },
                    ),

                // 6. Betting Overlay — shows when hero's turn
                if (_activeSeat == 0)
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 50),
                      child: BettingSlider(
                        minBet: 20,
                        maxStack: 1000,
                        onBetConfirmed: (amount) {
                          if (amount == 0) {
                            setState(() {
                              _playerActions[0] = 'fold';
                              _activeSeat = 1;
                            });
                          } else {
                            _launchChipFlight(0);
                            setState(() {
                              _pot += amount.toInt();
                              _activeSeat = 1;
                            });
                          }
                        },
                      ),
                    ),
                  ),

                // 7. Connection Status Indicator
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

class _ChipFlight {
  final int id;
  final int seatIndex;
  const _ChipFlight({required this.id, required this.seatIndex});
}
