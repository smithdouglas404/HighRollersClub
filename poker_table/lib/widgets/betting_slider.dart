// betting_slider.dart — Gemini's EXACT code
import 'package:flutter/material.dart';

class BettingSlider extends StatefulWidget {
  final double minBet;
  final double maxStack;
  final Function(double) onBetConfirmed;

  const BettingSlider({super.key, required this.minBet, required this.maxStack, required this.onBetConfirmed});

  @override
  State<BettingSlider> createState() => _BettingSliderState();
}

class _BettingSliderState extends State<BettingSlider> {
  double _currentValue = 0;

  @override
  void initState() {
    _currentValue = widget.minBet;
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(20)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("\$${_currentValue.toInt()}", style: const TextStyle(color: Colors.yellow, fontSize: 24, fontWeight: FontWeight.bold)),
          Slider(
            value: _currentValue,
            min: widget.minBet,
            max: widget.maxStack,
            divisions: (widget.maxStack - widget.minBet).toInt().clamp(1, 100),
            onChanged: (val) => setState(() => _currentValue = val),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton(onPressed: () => widget.onBetConfirmed(0), child: const Text("FOLD")),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                onPressed: () => widget.onBetConfirmed(_currentValue),
                child: const Text("RAISE"),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
