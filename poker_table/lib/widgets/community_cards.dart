import 'dart:math';
import 'package:flutter/material.dart';
import '../models/card_model.dart';
import '../theme/poker_theme.dart';

/// Gemini recommendations implemented:
/// 1. AnimatedSwitcher: "Great for when a card changes from Face Down to Face Up"
/// 2. TweenAnimationBuilder: Card entrance with 3D flip
/// 3. AnimatedRotation: Cards dealt at angle to different seats
/// 4. Transform with Y-axis rotation by π radians for realistic 3D card flip

class CommunityCardsWidget extends StatelessWidget {
  final List<PlayingCard> cards;
  final VoidCallback? onCardFlip;

  const CommunityCardsWidget({super.key, required this.cards, this.onCardFlip});

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < cards.length; i++)
          // Gemini: TweenAnimationBuilder for card entrance
          TweenAnimationBuilder<double>(
            key: ValueKey('comm_entrance_$i'),
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 350 + i * 100),
            curve: Curves.easeOutBack,
            builder: (context, entranceValue, child) {
              return Transform(
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001) // perspective
                  // ignore: deprecated_member_use
                  ..translate(0.0, -40 * (1 - entranceValue), 0.0),
                alignment: Alignment.center,
                child: Opacity(
                  opacity: entranceValue.clamp(0.0, 1.0),
                  child: child,
                ),
              );
            },
            // Gemini: AnimatedSwitcher wraps each card for face-down → face-up
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              transitionBuilder: (child, animation) {
                // Gemini: "Use GestureDetector to trigger a Tween animation
                // that rotates the Y-axis by π radians (180°)"
                final rotateAnim = Tween(begin: pi, end: 0.0).animate(
                  CurvedAnimation(parent: animation, curve: Curves.easeInOut),
                );
                return AnimatedBuilder(
                  animation: rotateAnim,
                  builder: (context, child) {
                    // Hide back face when rotation > 90°
                    final isBack = rotateAnim.value > pi / 2;
                    return Transform(
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.001)
                        ..rotateY(rotateAnim.value),
                      alignment: Alignment.center,
                      child: isBack
                          ? const SizedBox.shrink()
                          : child,
                    );
                  },
                  child: child,
                );
              },
              child: cards[i].faceUp
                  ? _FaceUpCard(key: ValueKey('up_$i'), card: cards[i])
                  : _FaceDownCard(key: ValueKey('down_$i')),
              layoutBuilder: (currentChild, previousChildren) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    ...previousChildren,
                    if (currentChild != null) currentChild,
                  ],
                );
              },
            ),
          ),
      ],
    );
  }
}

class _FaceUpCard extends StatelessWidget {
  final PlayingCard card;
  const _FaceUpCard({super.key, required this.card});

  @override
  Widget build(BuildContext context) {
    final isRed = card.isRed;
    final color = isRed ? Colors.red.shade700 : Colors.grey.shade900;

    return Container(
      width: 56, height: 80,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade300.withValues(alpha: 0.5), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.7), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 6, top: 4),
            child: Align(
              alignment: Alignment.topLeft,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.rankLabel, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w900, height: 1)),
                  Text(card.suitSymbol, style: TextStyle(color: color, fontSize: 12, height: 1)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(card.suitSymbol, style: TextStyle(color: color, fontSize: 28)),
          ),
        ],
      ),
    );
  }
}

class _FaceDownCard extends StatelessWidget {
  const _FaceDownCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56, height: 80,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1E3A5F),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: PokerTheme.cyan.withValues(alpha: 0.3), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.7), blurRadius: 12, offset: const Offset(0, 4)),
          BoxShadow(color: PokerTheme.cyan.withValues(alpha: 0.15), blurRadius: 8),
        ],
      ),
      child: Center(
        child: Container(
          width: 32, height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            border: Border.all(color: PokerTheme.cyan.withValues(alpha: 0.25), width: 2),
            color: PokerTheme.cyan.withValues(alpha: 0.06),
          ),
          child: Center(
            child: Text('S', style: TextStyle(color: PokerTheme.cyan.withValues(alpha: 0.3), fontSize: 18, fontWeight: FontWeight.w900)),
          ),
        ),
      ),
    );
  }
}
