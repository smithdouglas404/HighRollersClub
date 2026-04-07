import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_table/main.dart';

void main() {
  testWidgets('Poker app loads', (WidgetTester tester) async {
    await tester.pumpWidget(const PokerApp());
    expect(find.byType(Scaffold), findsOneWidget);
  });
}
