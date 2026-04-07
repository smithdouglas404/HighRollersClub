import 'package:flutter/material.dart';
// Rive import — uncomment when .riv files are created in Rive editor
// import 'package:rive/rive.dart' as rive;
import '../models/player_model.dart';
import '../theme/poker_theme.dart';

/// Gemini: "Rive is the industry standard for Flutter games in 2026."
///
/// "Unlike Lottie, Rive allows for State Machines. You can create one
/// animation file where the dealer has a 'Happy' state and a 'Dealing' state,
/// and trigger them via code based on the game logic."
///
/// To use: create .riv files with a StateMachine named "GameReactions"
/// containing boolean inputs: isBetting, isFolding, isWinning, isDealing, isIdle.
///
/// Since .riv asset files require creation in the Rive editor, this widget
/// currently uses the FallbackRiveAvatar for static image display with
/// AnimatedContainer state transitions. Swap to RiveAnimation.asset() when
/// .riv files are ready.

class RiveAvatarWidget extends StatelessWidget {
  final String riveAsset;
  final PlayerStatus playerStatus;
  final bool isWinner;
  final bool isDealer;
  final double size;
  final String tier;

  const RiveAvatarWidget({
    super.key,
    required this.riveAsset,
    required this.playerStatus,
    this.isWinner = false,
    this.isDealer = false,
    this.size = 140,
    this.tier = 'common',
  });

  @override
  Widget build(BuildContext context) {
    final tierColor = PokerTheme.tierColor(tier);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tierColor.withValues(alpha: 0.5), width: 2),
        boxShadow: [
          BoxShadow(color: tierColor.withValues(alpha: 0.3), blurRadius: 12),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        // Gemini: "Trigger state machine states via code based on game logic"
        // When .riv files are created in Rive editor, replace with:
        // rive.RiveAnimation.asset(riveAsset, fit: BoxFit.cover,
        //   stateMachines: const ['GameReactions'],
        //   onInit: (artboard) { /* set state machine inputs */ },
        // )
        child: Container(
          color: const Color(0xFF1A1D24),
          child: const Center(
            child: Icon(Icons.person, color: Colors.white38, size: 40),
          ),
        ),
      ),
    );
  }
}

/// Fallback when .riv files are not yet created.
/// Shows the static avatar image with AnimatedContainer state transitions.
/// Gemini: "AnimatedContainer — handles status transitions automatically"
class FallbackRiveAvatar extends StatelessWidget {
  final String imageUrl;
  final PlayerStatus playerStatus;
  final bool isWinner;
  final String tier;
  final double size;

  const FallbackRiveAvatar({
    super.key,
    required this.imageUrl,
    required this.playerStatus,
    this.isWinner = false,
    this.tier = 'common',
    this.size = 140,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOut,
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isWinner
              ? PokerTheme.goldBright
              : PokerTheme.tierColor(tier).withValues(alpha: 0.5),
          width: isWinner ? 3 : 2,
        ),
        boxShadow: [
          if (isWinner)
            BoxShadow(color: PokerTheme.gold.withValues(alpha: 0.5), blurRadius: 20, spreadRadius: 5),
          BoxShadow(
            color: PokerTheme.tierColor(tier).withValues(alpha: 0.3),
            blurRadius: 12,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 400),
          opacity: playerStatus == PlayerStatus.folded ? 0.3 : 1.0,
          child: ColorFiltered(
            colorFilter: playerStatus == PlayerStatus.folded
                ? const ColorFilter.matrix(<double>[
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0.2126, 0.7152, 0.0722, 0, 0,
                    0, 0, 0, 1, 0,
                  ])
                : const ColorFilter.mode(Colors.transparent, BlendMode.multiply),
            child: Image.asset(
              imageUrl,
              fit: BoxFit.cover,
              alignment: const Alignment(0, -0.7),
              errorBuilder: (context, error, stackTrace) => Container(
                color: const Color(0xFF1A1D24),
                child: const Center(
                  child: Icon(Icons.person, color: Colors.white38, size: 40),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
