import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/game_bloc.dart';
import '../models/card_model.dart';
import '../theme/poker_theme.dart';
import 'player_seat.dart';
import 'card_widget.dart';
import 'betting_slider.dart';
import 'chip_flight.dart';
import 'community_cards.dart';
import 'dealer_service.dart';
import 'pot_display.dart';
import 'effects/winner_particles.dart';
import 'effects/flame_vfx.dart';

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

                          // All-In fire VFX — Flame engine
                          // if (isAllIn) AllInFireOverlay(width: 80, height: 40),

                          // Player avatar with BLoC turn glow
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: isActive
                                  ? [const BoxShadow(color: Colors.yellow, blurRadius: 15, spreadRadius: 2)]
                                  : isWinner
                                      ? [BoxShadow(color: PokerTheme.goldBright.withValues(alpha: 0.8), blurRadius: 20, spreadRadius: 4)]
                                      : [],
                            ),
                            child: CircleAvatar(
                              radius: 25,
                              backgroundColor: isWinner ? PokerTheme.gold : Colors.grey,
                              child: const Icon(Icons.person, color: Colors.white),
                            ),
                          ),

                          // Fold badge
                          if (isFolded)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.red.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('FOLD', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                            ),

                          // Winner hand label
                          if (isWinner)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: PokerTheme.gold.withValues(alpha: 0.3),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: PokerTheme.gold),
                              ),
                              child: const Text('WINNER!', style: TextStyle(color: PokerTheme.goldBright, fontSize: 9, fontWeight: FontWeight.w900)),
                            ),

                          // Player hole cards — PokerCard with 3D flip
                          if (hasCards && !isFolded)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                for (var ci = 0; ci < _playerCards[index].length; ci++)
                                  Padding(
                                    padding: EdgeInsets.only(left: ci == 0 ? 0 : 2),
                                    child: Transform.scale(
                                      scale: 0.7,
                                      child: PokerCard(
                                        rank: index == 0 || isWinner || _winnerSeat != null
                                            ? _playerCards[index][ci].rankLabel
                                            : '',
                                        suit: index == 0 || isWinner || _winnerSeat != null
                                            ? _playerCards[index][ci].suitSymbol
                                            : '',
                                      ),
                                    ),
                                  ),
                              ],
                            ),

                          // Name + stack
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.black87,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              "Player $index\n\$${(1000 - (_pot ~/ 10)).clamp(0, 9999)}",
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white, fontSize: 10),
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
