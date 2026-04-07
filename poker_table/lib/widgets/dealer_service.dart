// dealer_service.dart — Gemini's EXACT "Dealer's Flight" math
import 'package:flutter/material.dart';
import 'card_widget.dart';

class CardDealer {
  // Animates a card from [deckPosition] to [playerSeatPosition]
  static Widget buildFlyingCard({
    required Offset start,
    required Offset end,
    required Animation<double> animation,
  }) {
    // Relative position calculation
    final pos = Offset.lerp(start, end, animation.value)!;

    return Positioned(
      left: pos.dx,
      top: pos.dy,
      child: Transform.rotate(
        angle: animation.value * 2 * 3.1415, // Spins twice while flying
        child: const PokerCard(rank: '', suit: ''), // Face down while flying
      ),
    );
  }
}
