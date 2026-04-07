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

/// Gemini's 6-Layer Cyberpunk Poker Table Architecture
///
/// Layer 1: Background room (static image + shader code lines)
/// Layer 2: Table + 10 seats (Matrix4 perspective ellipse)
/// Layer 3: Full-body 3D avatars sitting in chairs
/// Layer 4: Player name badges with avatar thumbnails + stacks
/// Layer 5: Community cards, pot, current bet
/// Layer 6: Action buttons, admin menu, hand strength

const _avatarFullBody = [
  'assets/images/avatar-full-1.png',
  'assets/images/avatar-full-2.png',
  'assets/images/avatar-full-3.png',
  'assets/images/avatar-full-4.png',
  'assets/images/avatar-full-5.png',
  'assets/images/avatar-full-6.png',
  'assets/images/avatar-full-7.png',
  'assets/images/avatar-full-8.png',
  'assets/images/avatar-full-1.png', // wrap for seats 9-10
  'assets/images/avatar-full-2.png',
];

const _avatarThumbs = [
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
  'CyberDeck', 'Vortek', 'CyberDeck', 'Mystic', 'SilverHand',
  'Pond', 'MISTIC1', 'Mystic75', 'PosRire', 'Mystic',
];

const _playerStacks = [
  1250000, 2500000, 1290000, 1800000, 1920000,
  3400000, 1500000, 1500000, 1400000, 1800000,
];

class PokerTable extends StatefulWidget {
  const PokerTable({super.key});

  @override
  State<PokerTable> createState() => _PokerTableState();
}

class _PokerTableState extends State<PokerTable> with TickerProviderStateMixin {
  static const int totalSeats = 10;
  int _activeSeat = 4;
  int? _winnerSeat;
  bool _showAdminMenu = false;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GameBloc(),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: LayoutBuilder(
          builder: (context, constraints) {
            final size = constraints.biggest;
            final centerX = size.width / 2;
            final centerY = size.height / 2;

            // Gemini Layer 2: "Define an oval radius that accounts for
            // perspective distortion — shorter Y creates perspective tilt"
            final radiusX = size.width * 0.45;
            final radiusY = size.height * 0.35;

            // Seat dimensions
            const seatWidth = 80.0;
            const seatHeight = 80.0;

            return Stack(
              fit: StackFit.expand,
              children: [
                // ═══════════════════════════════════════════════
                // LAYER 1: Background Room
                // Gemini: "Static Layer (DecoratedBox) — high-res background"
                // ═══════════════════════════════════════════════
                Positioned.fill(
                  child: Image.asset(
                    'assets/images/table_background.png',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      decoration: const BoxDecoration(
                        gradient: RadialGradient(
                          center: Alignment(0, -0.3),
                          radius: 1.2,
                          colors: [
                            Color(0xFF1A2E1A), // dark green room
                            Color(0xFF0D1A0D),
                            Color(0xFF050A05),
                            Color(0xFF020402),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                // Gemini: "Shader Layer — green vertical code lines on walls"
                // CustomPainter for scrolling matrix-style code
                Positioned.fill(
                  child: CustomPaint(
                    painter: _MatrixCodePainter(),
                  ),
                ),

                // ═══════════════════════════════════════════════
                // LAYER 2: The Table Felt (Perspective Ellipse)
                // Gemini: "Matrix4 projection for 3D perspective"
                // ═══════════════════════════════════════════════
                Center(
                  child: Transform(
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001) // perspective
                      ..rotateX(0.15), // slight tilt for 3D feel
                    alignment: Alignment.center,
                    child: Container(
                      width: radiusX * 1.8,
                      height: radiusY * 1.6,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.all(
                          Radius.elliptical(radiusX * 1.5, radiusY * 1.5),
                        ),
                        gradient: const RadialGradient(
                          center: Alignment(0, -0.2),
                          radius: 0.9,
                          colors: [
                            Color(0xFF1A3A2A),
                            Color(0xFF0F2A1C),
                            Color(0xFF0A1F15),
                            Color(0xFF071A10),
                          ],
                        ),
                        border: Border.all(color: const Color(0xFF2A1A0A), width: 12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.8),
                            blurRadius: 40,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Stack(
                        children: [
                          // Inner gold ring
                          Center(
                            child: Container(
                              width: radiusX * 1.6,
                              height: radiusY * 1.4,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.all(
                                  Radius.elliptical(radiusX * 1.5, radiusY * 1.5),
                                ),
                                border: Border.all(
                                  color: PokerTheme.gold.withValues(alpha: 0.2),
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                          // HIGH ROLLERS CLUB logo
                          const Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'HIGH ROLLERS',
                                  style: TextStyle(
                                    color: Color(0x18D4AF37),
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 8,
                                  ),
                                ),
                                Text(
                                  'CLUB',
                                  style: TextStyle(
                                    color: Color(0x10D4AF37),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // ═══════════════════════════════════════════════
                // LAYER 3: Full-Body 3D Avatars Sitting at Table
                // Gemini: "Full 3D high-fidelity avatars (cyborgs, robots)"
                // ═══════════════════════════════════════════════
                ...List.generate(totalSeats, (index) {
                  // Gemini: "Polar Coordinate system"
                  double angle = (index * (2 * math.pi / totalSeats)) - (math.pi / 2);
                  // Push avatars outside the table edge
                  double avatarRx = radiusX * 1.05;
                  double avatarRy = radiusY * 1.15;
                  double x = avatarRx * math.cos(angle) + centerX;
                  double y = avatarRy * math.sin(angle) + centerY;

                  // Perspective scale — farther seats are smaller
                  final normalY = (y - (centerY - radiusY)) / (radiusY * 2);
                  final perspScale = 0.6 + (normalY.clamp(0, 1) * 0.5);
                  final avatarH = 180.0 * perspScale;
                  final avatarW = 140.0 * perspScale;

                  return AnimatedPositioned(
                    duration: const Duration(milliseconds: 300),
                    left: x - avatarW / 2,
                    top: y - avatarH * 0.8,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 400),
                      opacity: 1.0,
                      child: SizedBox(
                        width: avatarW,
                        height: avatarH,
                        child: Image.asset(
                          _avatarFullBody[index % _avatarFullBody.length],
                          fit: BoxFit.contain,
                          alignment: Alignment.bottomCenter,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  );
                }),

                // ═══════════════════════════════════════════════
                // LAYER 4: Player Name Badges + Avatar Thumbnails
                // Gemini: "Text widgets for readability + dark metal
                // BoxDecoration with green border gradient"
                // ═══════════════════════════════════════════════
                ...List.generate(totalSeats, (index) {
                  double angle = (index * (2 * math.pi / totalSeats)) - (math.pi / 2);
                  double badgeRx = radiusX * 1.05;
                  double badgeRy = radiusY * 1.15;
                  double x = badgeRx * math.cos(angle) + centerX;
                  double y = badgeRy * math.sin(angle) + centerY;

                  final normalY = (y - (centerY - radiusY)) / (radiusY * 2);
                  final perspScale = 0.7 + (normalY.clamp(0, 1) * 0.4);
                  final isActive = _activeSeat == index;
                  final isWinner = _winnerSeat == index;

                  return AnimatedPositioned(
                    duration: const Duration(milliseconds: 300),
                    left: x - 70 * perspScale,
                    top: y + 10,
                    child: Transform.scale(
                      scale: perspScale,
                      child: _buildPlayerBadge(index, isActive, isWinner),
                    ),
                  );
                }),

                // ═══════════════════════════════════════════════
                // LAYER 5: Community Cards + Pot + Current Bet
                // ═══════════════════════════════════════════════
                // Community cards on the table
                Positioned(
                  left: centerX - 140,
                  top: centerY - 20,
                  child: Row(
                    children: [
                      // 5 card slots
                      for (var i = 0; i < 5; i++)
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: 46,
                          height: 66,
                          decoration: BoxDecoration(
                            color: i < 3 ? Colors.white : Colors.black26,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: i < 3 ? Colors.grey.shade300 : Colors.white10,
                              width: 1,
                            ),
                            boxShadow: i < 3 ? [
                              BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 6, offset: const Offset(0, 3)),
                            ] : null,
                          ),
                          child: i < 3
                              ? Center(
                                  child: Text(
                                    ['A\u2660', 'K\u2665', '10\u2663'][i],
                                    style: TextStyle(
                                      color: i == 1 ? Colors.red.shade700 : Colors.grey.shade900,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                )
                              : null,
                        ),
                    ],
                  ),
                ),

                // Chip stacks on table (visual prop)
                Positioned(
                  left: centerX - 30,
                  top: centerY - 60,
                  child: _buildChipStacks(),
                ),

                // Current bet badge
                Positioned(
                  left: centerX + 80,
                  top: centerY - 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xDD0A0A0C),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: PokerTheme.gold.withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('CURRENT BET  ', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold)),
                        Text('\$5,000', style: TextStyle(color: PokerTheme.goldBright, fontSize: 13, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                ),

                // ═══════════════════════════════════════════════
                // LAYER 6: UI — Action Buttons, Admin, Hand Strength
                // Gemini: "Standard Material buttons with custom BoxDecoration
                // dark metal texture and green border gradient"
                // ═══════════════════════════════════════════════

                // HIGH ROLLERS CLUB logo top center
                Positioned(
                  top: 20,
                  left: 0, right: 0,
                  child: Center(
                    child: Text(
                      'HIGH ROLLERS\nCLUB',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: PokerTheme.gold.withValues(alpha: 0.8),
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 3,
                        height: 1.2,
                        shadows: [Shadow(color: PokerTheme.gold.withValues(alpha: 0.3), blurRadius: 10)],
                      ),
                    ),
                  ),
                ),

                // Action buttons — FOLD / CALL / RAISE
                Positioned(
                  bottom: 20,
                  left: centerX - 200,
                  child: Row(
                    children: [
                      _buildActionButton('FOLD', const Color(0xFF1A1A1A), Colors.white70),
                      const SizedBox(width: 12),
                      _buildActionButton('CALL 60', const Color(0xFF1A1A1A), Colors.white70),
                      const SizedBox(width: 12),
                      _buildActionButton('RAISE', const Color(0xFF1A1A1A), Colors.white70),
                    ],
                  ),
                ),

                // Current Hand Strength (bottom right)
                Positioned(
                  bottom: 20,
                  right: 20,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xDD0A0A0C),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: PokerTheme.gold.withValues(alpha: 0.3)),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Current Hand Strength', style: TextStyle(color: Colors.white54, fontSize: 10)),
                            Text('FLUSH DRAW', style: TextStyle(color: PokerTheme.goldBright, fontSize: 14, fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Sit Out / Away toggle
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xDD0A0A0C),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Sit Out / Away', style: TextStyle(color: Colors.white54, fontSize: 11)),
                            SizedBox(width: 8),
                            Icon(Icons.toggle_off, color: Colors.white30, size: 20),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Admin Control menu (top right)
                Positioned(
                  top: 16,
                  right: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      GestureDetector(
                        onTap: () => setState(() => _showAdminMenu = !_showAdminMenu),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xDD0A0A0C),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Admin Control', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                              SizedBox(width: 8),
                              Icon(Icons.settings, color: Colors.white54, size: 16),
                            ],
                          ),
                        ),
                      ),
                      if (_showAdminMenu) ...[
                        const SizedBox(height: 4),
                        _buildAdminMenuItem('Pause Game', Icons.pause),
                        _buildAdminMenuItem('Manage Table', Icons.table_bar),
                        _buildAdminMenuItem('Approve New Players', Icons.person_add),
                      ],
                    ],
                  ),
                ),

                // Connection indicator
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

  /// Gemini Layer 4: Player name badge with avatar thumbnail
  /// "Dark metal texture asset and green border gradient"
  Widget _buildPlayerBadge(int index, bool isActive, bool isWinner) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xE60A0A0C),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isActive
              ? PokerTheme.cyan
              : isWinner
                  ? PokerTheme.goldBright
                  : Colors.white.withValues(alpha: 0.15),
          width: isActive || isWinner ? 2 : 1,
        ),
        boxShadow: isActive
            ? [BoxShadow(color: PokerTheme.cyan.withValues(alpha: 0.4), blurRadius: 12)]
            : isWinner
                ? [BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.5), blurRadius: 15)]
                : [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 8)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Avatar thumbnail
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
            ),
            child: ClipOval(
              child: Image.asset(
                _avatarThumbs[index % _avatarThumbs.length],
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: Colors.grey.shade800,
                  child: const Icon(Icons.person, color: Colors.white38, size: 18),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Name + stack
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _playerNames[index % _playerNames.length],
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
              Text(
                '\$${_formatStack(_playerStacks[index % _playerStacks.length])}',
                style: const TextStyle(color: PokerTheme.goldBright, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatStack(int amount) {
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(1)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(0)},000';
    return amount.toString();
  }

  /// Gemini Layer 6: Action buttons
  /// "Standard Material buttons with custom BoxDecoration —
  /// dark metal texture and green border gradient"
  Widget _buildActionButton(String label, Color bg, Color textColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 8, offset: const Offset(0, 3)),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 13,
          fontWeight: FontWeight.w900,
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _buildAdminMenuItem(String label, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Container(
        width: 180,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xE60A0A0C),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
            const Spacer(),
            Icon(icon, color: Colors.white38, size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildChipStacks() {
    return SizedBox(
      width: 60,
      height: 40,
      child: Stack(
        children: [
          for (var i = 0; i < 5; i++)
            Positioned(
              bottom: i * 4.0,
              left: i * 2.0,
              child: Container(
                width: 28,
                height: 16,
                decoration: BoxDecoration(
                  color: i % 2 == 0 ? PokerTheme.goldBright : const Color(0xFF111827),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: i % 2 == 0 ? const Color(0xFFB8860B) : const Color(0xFF374151),
                    width: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Gemini Layer 1: "Shader Layer — green vertical code lines on walls"
/// "Custom GLSL/SPIR-V shader makes scrolling code lines animate with zero CPU cost"
/// Using CustomPainter as the shader fallback for web compatibility
class _MatrixCodePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF00FF41).withValues(alpha: 0.03)
      ..strokeWidth = 1;

    // Vertical lines simulating the matrix code effect on walls
    final rng = math.Random(42); // Fixed seed for consistency
    for (var x = 0.0; x < size.width; x += 20 + rng.nextDouble() * 30) {
      if (x > size.width * 0.2 && x < size.width * 0.8) continue; // Skip table area
      for (var y = 0.0; y < size.height; y += 8 + rng.nextDouble() * 12) {
        final alpha = 0.02 + rng.nextDouble() * 0.04;
        paint.color = Color(0xFF00FF41).withValues(alpha: alpha);
        canvas.drawRect(
          Rect.fromLTWH(x, y, 2, 4 + rng.nextDouble() * 6),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
