import 'package:flutter/material.dart';
import 'widgets/poker_table.dart';

void main() {
  runApp(const PokerApp());
}

class PokerApp extends StatelessWidget {
  const PokerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'High Rollers Club - Poker',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: const PokerTable(),
    );
  }
}
