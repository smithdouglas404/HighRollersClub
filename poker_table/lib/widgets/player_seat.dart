import 'package:flutter/material.dart';
import '../models/player_model.dart';
import '../theme/poker_theme.dart';

/// Stitch-poker-style player seat with full-body avatar portrait,
/// face-down cards overlapping the bottom, and cinematic glow effects.
class PlayerSeatWidget extends StatefulWidget {
  final PlayerModel player;
  final bool isActive;
  final bool isWinner;
  final bool isHero;
  final Color seatColor;

  const PlayerSeatWidget({
    super.key,
    required this.player,
    this.isActive = false,
    this.isWinner = false,
    this.isHero = false,
    required this.seatColor,
  });

  @override
  State<PlayerSeatWidget> createState() => _PlayerSeatWidgetState();
}

class _PlayerSeatWidgetState extends State<PlayerSeatWidget>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _winController;
  late Animation<double> _pulseAnim;
  late Animation<double> _winGlow;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _pulseAnim = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _winController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _winGlow = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _winController, curve: Curves.easeOut),
    );
  }

  @override
  void didUpdateWidget(PlayerSeatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _pulseController.repeat(reverse: true);
    } else if (!widget.isActive) {
      _pulseController.stop();
      _pulseController.reset();
    }

    if (widget.isWinner && !oldWidget.isWinner) {
      _winController.forward(from: 0);
    } else if (!widget.isWinner) {
      _winController.reset();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _winController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final player = widget.player;
    final isFolded = player.isFolded;
    final tierColor = PokerTheme.tierColor(player.tier);

    return AnimatedBuilder(
      animation: Listenable.merge([_pulseAnim, _winGlow]),
      builder: (context, child) {
        final pulseVal = widget.isActive ? _pulseAnim.value : 0.5;
        final winVal = widget.isWinner ? _winGlow.value : 0.0;

        // Determine border color based on state
        final borderColor = widget.isWinner
            ? Color.lerp(widget.seatColor, PokerTheme.goldBright, winVal)!
            : widget.isActive
                ? widget.seatColor.withValues(alpha: 0.6 + pulseVal * 0.4)
                : widget.seatColor.withValues(alpha: 0.5);

        return AnimatedOpacity(
          duration: const Duration(milliseconds: 400),
          opacity: isFolded ? 0.4 : 1.0,
          child: SizedBox(
            width: 150,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Dealer button
                if (player.isDealer)
                  _buildDealerButton(),

                // Action badge (FOLD, CALL, RAISE)
                if (player.status != PlayerStatus.active && player.status != PlayerStatus.thinking && player.status != PlayerStatus.waiting)
                  _buildActionBadge(player),

                const SizedBox(height: 4),

                // Main portrait card with winner ring
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: widget.isWinner
                        ? Border.all(color: PokerTheme.goldBright.withValues(alpha: 0.6 + winVal * 0.4), width: 2.5)
                        : null,
                    boxShadow: widget.isWinner
                        ? [
                            BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.5 * winVal), blurRadius: 25, spreadRadius: 5),
                            BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.2 * winVal), blurRadius: 50, spreadRadius: 10),
                          ]
                        : widget.isActive
                            ? [
                                BoxShadow(color: widget.seatColor.withValues(alpha: 0.5 * pulseVal), blurRadius: 20, spreadRadius: 3),
                                BoxShadow(color: widget.seatColor.withValues(alpha: 0.2 * pulseVal), blurRadius: 40, spreadRadius: 6),
                              ]
                            : [
                                BoxShadow(color: widget.seatColor.withValues(alpha: 0.3), blurRadius: 12),
                                BoxShadow(color: Colors.black.withValues(alpha: 0.6), blurRadius: 20, offset: const Offset(0, 6)),
                              ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Avatar portrait area
                      _buildAvatarPortrait(player, borderColor, tierColor),

                      // Name + chips bar
                      _buildNameBar(player, borderColor),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAvatarPortrait(PlayerModel player, Color borderColor, Color tierColor) {
    return Container(
      width: 150,
      height: 140,
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
        border: Border(
          top: BorderSide(color: borderColor, width: 3),
          left: BorderSide(color: borderColor, width: 3),
          right: BorderSide(color: borderColor, width: 3),
        ),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Avatar image
            ColorFiltered(
              colorFilter: player.isFolded
                  ? const ColorFilter.matrix(<double>[
                      0.2126, 0.7152, 0.0722, 0, 0,
                      0.2126, 0.7152, 0.0722, 0, 0,
                      0.2126, 0.7152, 0.0722, 0, 0,
                      0, 0, 0, 1, 0,
                    ])
                  : const ColorFilter.mode(Colors.transparent, BlendMode.multiply),
              child: Image.asset(
                player.avatarUrl,
                fit: BoxFit.cover,
                alignment: const Alignment(0, -0.7),
                errorBuilder: (context, error, stackTrace) => _avatarFallback(player),
              ),
            ),

            // Cinematic gradient overlay
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 100,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Color(0x40000000),
                      Color(0xD9080810),
                      Color(0xF50A0A0C),
                    ],
                    stops: [0.0, 0.35, 0.7, 1.0],
                  ),
                ),
              ),
            ),

            // Top glow edge
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      widget.seatColor,
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(color: widget.seatColor.withValues(alpha: 0.7), blurRadius: 10),
                  ],
                ),
              ),
            ),

            // Tier badge (top-right)
            if (player.tier != 'common')
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: PokerTheme.tierColor(player.tier).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: PokerTheme.tierColor(player.tier).withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    player.tier.toUpperCase(),
                    style: TextStyle(
                      color: PokerTheme.tierColor(player.tier),
                      fontSize: 7,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),

            // Face-down hole cards — overlapping bottom of portrait (stitch-poker style)
            if (!player.isFolded && player.holeCards.isNotEmpty && !(widget.isHero || player.holeCards.first.faceUp))
              Positioned(
                bottom: -4,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Transform.rotate(
                      angle: -0.17,
                      child: _buildFaceDownCard(),
                    ),
                    Transform.rotate(
                      angle: 0.17,
                      child: _buildFaceDownCard(),
                    ),
                  ],
                ),
              ),

            // Face-up hole cards (hero or showdown)
            if (!player.isFolded && player.holeCards.isNotEmpty && (widget.isHero || player.holeCards.first.faceUp))
              Positioned(
                bottom: -4,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < player.holeCards.length; i++)
                      TweenAnimationBuilder<double>(
                        key: ValueKey('card_${player.id}_$i'),
                        tween: Tween(begin: 0.0, end: 1.0),
                        duration: Duration(milliseconds: 400 + i * 200),
                        curve: Curves.easeOutBack,
                        builder: (context, value, child) {
                          return Transform(
                            transform: Matrix4.identity()
                              ..rotateZ(i == 0 ? -0.17 : 0.17)
                              // ignore: deprecated_member_use
                            ..scale(value),
                            alignment: Alignment.center,
                            child: child,
                          );
                        },
                        child: _buildFaceUpCard(player.holeCards[i]),
                      ),
                  ],
                ),
              ),

            // Winner hand label
            if (widget.isWinner && player.handLabel != null)
              Positioned(
                bottom: 8,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: PokerTheme.gold.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: PokerTheme.gold.withValues(alpha: 0.5)),
                    ),
                    child: Text(
                      player.handLabel!,
                      style: const TextStyle(
                        color: PokerTheme.goldBright,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNameBar(PlayerModel player, Color borderColor) {
    return Container(
      width: 150,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xEB0F0F14),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
        border: Border(
          bottom: BorderSide(color: borderColor.withValues(alpha: 0.35), width: 3),
          left: BorderSide(color: borderColor.withValues(alpha: 0.35), width: 3),
          right: BorderSide(color: borderColor.withValues(alpha: 0.35), width: 3),
        ),
      ),
      child: Stack(
        children: [
          Column(
            children: [
              Row(
                children: [
                  Text(
                    'P${player.seatIndex + 1}: ',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 10, fontFamily: 'monospace'),
                  ),
                  Expanded(
                    child: Text(
                      player.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Text(
                    PokerTheme.formatChips(player.chips),
                    style: const TextStyle(
                      color: PokerTheme.goldBright,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                  if (widget.isWinner && player.amountDelta > 0) ...[
                    const SizedBox(width: 6),
                    Text(
                      '+${PokerTheme.formatChips(player.amountDelta)}',
                      style: TextStyle(
                        color: PokerTheme.callGreen.withValues(alpha: 0.9),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
          // Bottom gold accent line
          Positioned(
            bottom: -5,
            left: -10,
            right: -10,
            height: 3,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.transparent, PokerTheme.gold, PokerTheme.goldBright, PokerTheme.gold, Colors.transparent],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDealerButton() {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: PokerTheme.gold, width: 2),
        boxShadow: [
          BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.5), blurRadius: 8),
        ],
      ),
      child: const Center(
        child: Text('D', style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.w900)),
      ),
    );
  }

  Widget _buildActionBadge(PlayerModel player) {
    final (label, bgColor, textColor) = switch (player.status) {
      PlayerStatus.folded => ('FOLD', PokerTheme.foldRed.withValues(alpha: 0.3), PokerTheme.foldRed),
      PlayerStatus.allIn => ('ALL-IN', PokerTheme.allInRose.withValues(alpha: 0.3), PokerTheme.allInRose),
      _ => ('', Colors.transparent, Colors.transparent),
    };

    if (label.isEmpty) return const SizedBox.shrink();

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutBack,
      builder: (context, value, child) {
        return Transform.scale(
          scale: value,
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: textColor.withValues(alpha: 0.5)),
          boxShadow: [BoxShadow(color: textColor.withValues(alpha: 0.2), blurRadius: 14)],
        ),
        child: Text(
          label,
          style: TextStyle(color: textColor, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1),
        ),
      ),
    );
  }

  Widget _buildFaceDownCard() {
    return Container(
      width: 36,
      height: 50,
      margin: const EdgeInsets.symmetric(horizontal: -3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E3A5F), Color(0xFF0D1B2A)],
        ),
        border: Border.all(color: PokerTheme.cyan.withValues(alpha: 0.3), width: 2),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.8), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Center(
        child: Container(
          width: 20,
          height: 28,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(2),
            border: Border.all(color: PokerTheme.cyan.withValues(alpha: 0.25), width: 2),
            color: PokerTheme.cyan.withValues(alpha: 0.06),
          ),
          child: Center(
            child: Text(
              'S',
              style: TextStyle(color: PokerTheme.cyan.withValues(alpha: 0.35), fontSize: 14, fontWeight: FontWeight.w900),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFaceUpCard(dynamic card) {
    final isRed = card.isRed;
    final color = isRed ? Colors.red.shade700 : Colors.grey.shade900;

    return Container(
      width: 36,
      height: 50,
      margin: const EdgeInsets.symmetric(horizontal: -3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.grey.shade300.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.8), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 3, top: 2),
            child: Align(
              alignment: Alignment.topLeft,
              child: Text(card.rankLabel, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w900)),
            ),
          ),
          Text(card.suitSymbol, style: TextStyle(color: color, fontSize: 18)),
          const SizedBox(height: 2),
        ],
      ),
    );
  }

  Widget _avatarFallback(PlayerModel player) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: widget.isHero
              ? [const Color(0xFF0E7490), const Color(0xFF164E63)]
              : [const Color(0xFF78716C), const Color(0xFF44403C)],
        ),
      ),
      child: Center(
        child: Text(
          player.name.isNotEmpty ? player.name[0].toUpperCase() : '?',
          style: const TextStyle(color: Colors.white70, fontSize: 36, fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}
