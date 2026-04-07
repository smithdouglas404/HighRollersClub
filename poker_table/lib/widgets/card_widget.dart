// card_widget.dart — Gemini's EXACT 3D card flip code
import 'dart:math';
import 'package:flutter/material.dart';

class PokerCard extends StatefulWidget {
  final String rank;
  final String suit;
  const PokerCard({super.key, required this.rank, required this.suit});

  @override
  State<PokerCard> createState() => _PokerCardState();
}

class _PokerCardState extends State<PokerCard> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  bool isFront = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
  }

  void flip() {
    setState(() => isFront = !isFront);
    isFront ? _controller.forward() : _controller.reverse();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: flip,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final angle = _controller.value * pi;
          return Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001) // Perspective
              ..rotateY(angle),
            alignment: Alignment.center,
            child: angle < pi / 2
                ? _buildBack()
                : Transform.rotate(angle: pi, child: _buildFront()), // Keep text upright
          );
        },
      ),
    );
  }

  Widget _buildBack() => Container(
    width: 50, height: 70,
    decoration: BoxDecoration(
      color: Colors.blue,
      borderRadius: BorderRadius.circular(4),
      border: Border.all(color: Colors.white, width: 2),
    ),
    child: const Icon(Icons.star, color: Colors.white30),
  );

  Widget _buildFront() => Container(
    width: 50, height: 70,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(4),
    ),
    child: Center(
      child: Text(
        "${widget.rank}${widget.suit}",
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
    ),
  );
}
