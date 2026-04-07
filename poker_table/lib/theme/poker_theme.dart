import 'package:flutter/material.dart';

class PokerTheme {
  // Core palette — dark cinematic
  static const Color background = Color(0xFF0A0A0C);
  static const Color feltGreen = Color(0xFF156B42);
  static const Color feltDark = Color(0xFF0A1F15);
  static const Color cyan = Color(0xFF00F3FF);
  static const Color gold = Color(0xFFD4AF37);
  static const Color goldBright = Color(0xFFFFD700);
  static const Color gunmetal = Color(0xFF1A1D24);
  static const Color panelBg = Color(0xE6101016);
  static const Color textPrimary = Color(0xFFE8EAED);
  static const Color textMuted = Color(0x99FFFFFF);

  // Status colors
  static const Color foldRed = Color(0xFFEF4444);
  static const Color callGreen = Color(0xFF22C55E);
  static const Color raisePurple = Color(0xFFA855F7);
  static const Color allInRose = Color(0xFFFF003C);
  static const Color checkGray = Color(0xFF9CA3AF);

  // Tier colors
  static Color tierColor(String tier) {
    switch (tier) {
      case 'legendary': return gold;
      case 'epic': return const Color(0xFFB44DFF);
      case 'rare': return const Color(0xFF3B82F6);
      default: return const Color(0xFF6B7280);
    }
  }

  static Color tierGlow(String tier) {
    switch (tier) {
      case 'legendary': return gold.withValues(alpha: 0.5);
      case 'epic': return const Color(0xFFB44DFF).withValues(alpha: 0.4);
      case 'rare': return const Color(0xFF3B82F6).withValues(alpha: 0.3);
      default: return Colors.white.withValues(alpha: 0.1);
    }
  }

  // Ring colors per seat (GGPoker style)
  static const List<Color> seatColors = [
    gold,                    // 0: hero
    Color(0xFF5EEAD4),       // 1: teal
    Color(0xFF94A3B8),       // 2: slate
    Color(0xFF25A065),       // 3: emerald
    Color(0xFFE0C97F),       // 4: warm gold
    Color(0xFFA1A1AA),       // 5: gray
    Color(0xFF6BB8C9),       // 6: muted cyan
    Color(0xFF34D399),       // 7: green
    Color(0xFF8FAAB8),       // 8: steel blue
    Color(0xFF5EEAD4),       // 9: teal
  ];

  // Glass panel decoration
  static BoxDecoration glassPanel({Color? borderColor}) => BoxDecoration(
    color: panelBg,
    borderRadius: BorderRadius.circular(12),
    border: Border.all(color: borderColor ?? Colors.white.withValues(alpha: 0.1)),
    boxShadow: [
      BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 20, offset: const Offset(0, 8)),
    ],
  );

  static String formatChips(int amount) {
    if (amount >= 1000000) return '\$${(amount / 1000000).toStringAsFixed(1)}M';
    if (amount >= 1000) return '\$${(amount / 1000).toStringAsFixed(1)}K';
    return '\$${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}
