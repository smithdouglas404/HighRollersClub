import 'package:flutter/material.dart';
import '../theme/poker_theme.dart';

/// Animated pot display with chip stack visual and smooth count-up.
class PotDisplay extends StatelessWidget {
  final int pot;

  const PotDisplay({super.key, required this.pot});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TweenAnimationBuilder<int>(
        tween: IntTween(begin: 0, end: pot),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOut,
        builder: (context, value, child) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xD90F0F14),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: PokerTheme.gold.withValues(alpha: 0.3)),
              boxShadow: [
                BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.15), blurRadius: 15),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Chip stack icon
                SizedBox(
                  width: 20,
                  height: 24,
                  child: Stack(
                    children: [
                      for (var i = 0; i < 3; i++)
                        Positioned(
                          bottom: i * 4.0,
                          child: Container(
                            width: 20,
                            height: 12,
                            decoration: BoxDecoration(
                              color: i == 0 ? PokerTheme.goldBright : i == 1 ? const Color(0xFF111827) : const Color(0xFFDC2626),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: i == 0 ? const Color(0xFFB8860B) : i == 1 ? const Color(0xFF374151) : const Color(0xFF991B1B),
                                width: 1,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Total Pot: ${PokerTheme.formatChips(value)}',
                  style: const TextStyle(
                    color: PokerTheme.goldBright,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
