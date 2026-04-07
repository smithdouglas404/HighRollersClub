import 'dart:math';
import 'package:flutter/material.dart';
import '../models/card_model.dart';
import '../theme/poker_theme.dart';

/// Community cards with animated dealing using TweenAnimationBuilder.
/// GPU-accelerated via Skwasm on web — elite performance per Gemini recommendation.
class CommunityCardsWidget extends StatelessWidget {
  final List<PlayingCard> cards;

  const CommunityCardsWidget({super.key, required this.cards});

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < cards.length; i++)
          TweenAnimationBuilder<double>(
            key: ValueKey('comm_$i'),
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 350 + i * 100),
            curve: Curves.easeOutBack,
            builder: (context, value, child) {
              // Card flies in from above and flips
              return Transform(
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001) // perspective
                  // ignore: deprecated_member_use
                  ..translate(0.0, -40 * (1 - value), 0.0)
                  ..rotateY((1 - value) * pi), // 3D flip
                alignment: Alignment.center,
                child: Opacity(
                  opacity: value.clamp(0.0, 1.0),
                  child: child,
                ),
              );
            },
            child: _CommunityCard(card: cards[i]),
          ),
      ],
    );
  }
}

class _CommunityCard extends StatelessWidget {
  final PlayingCard card;

  const _CommunityCard({required this.card});

  @override
  Widget build(BuildContext context) {
    final isRed = card.isRed;
    final color = isRed ? Colors.red.shade700 : Colors.grey.shade900;

    return Container(
      width: 56,
      height: 80,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: card.faceUp ? Colors.white : const Color(0xFF1E3A5F),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: card.faceUp
              ? Colors.grey.shade300.withValues(alpha: 0.5)
              : PokerTheme.cyan.withValues(alpha: 0.3),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.7),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          // Subtle cyan glow for face-down cards
          if (!card.faceUp)
            BoxShadow(
              color: PokerTheme.cyan.withValues(alpha: 0.15),
              blurRadius: 8,
            ),
        ],
      ),
      child: card.faceUp
          ? Column(
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
            )
          : Center(
              child: Container(
                width: 32,
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  border: Border.all(color: PokerTheme.cyan.withValues(alpha: 0.25), width: 2),
                  color: PokerTheme.cyan.withValues(alpha: 0.06),
                ),
                child: Center(
                  child: Text(
                    'S',
                    style: TextStyle(
                      color: PokerTheme.cyan.withValues(alpha: 0.3),
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
