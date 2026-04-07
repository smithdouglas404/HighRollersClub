import 'package:flutter/material.dart';
import '../theme/poker_theme.dart';

/// Gemini: "AnimatedPositioned — Perfect for moving chips from a player to the pot.
/// You just update the coordinates in setState, and Flutter handles the slide."
///
/// "Use Curves.easeOut — it will catch up smoothly to the new server coordinates
/// rather than snapping."
class ChipFlightWidget extends StatefulWidget {
  final double fromX;
  final double fromY;
  final double toX;
  final double toY;
  final VoidCallback? onComplete;

  const ChipFlightWidget({
    super.key,
    required this.fromX,
    required this.fromY,
    required this.toX,
    required this.toY,
    this.onComplete,
  });

  @override
  State<ChipFlightWidget> createState() => _ChipFlightWidgetState();
}

class _ChipFlightWidgetState extends State<ChipFlightWidget> {
  late double _left;
  late double _top;
  double _opacity = 1.0;

  @override
  void initState() {
    super.initState();
    _left = widget.fromX;
    _top = widget.fromY;

    // Gemini: "Update coordinates in setState, Flutter handles the slide"
    WidgetsBinding.instance.addPostFrameCallback((_) {
      setState(() {
        _left = widget.toX;
        _top = widget.toY;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOut, // Gemini: "Use Curves.easeOut"
      left: _left - 12,
      top: _top - 12,
      onEnd: () {
        // Gemini: "clink should be triggered exactly at end of curve"
        widget.onComplete?.call();
        setState(() => _opacity = 0.0);
      },
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: _opacity,
        child: _buildChipStack(),
      ),
    );
  }

  Widget _buildChipStack() {
    return SizedBox(
      width: 24,
      height: 32,
      child: Stack(
        children: [
          for (var i = 0; i < 3; i++)
            Positioned(
              bottom: i * 4.0,
              child: Container(
                width: 24,
                height: 14,
                decoration: BoxDecoration(
                  color: i == 0 ? PokerTheme.goldBright : i == 1 ? const Color(0xFF111827) : const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(7),
                  border: Border.all(
                    color: i == 0 ? const Color(0xFFB8860B) : i == 1 ? const Color(0xFF374151) : const Color(0xFF991B1B),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 4, offset: const Offset(0, 2)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
