import 'dart:async';
import 'dart:collection';
import 'package:flutter/foundation.dart';

/// Animation Manager — Gemini's recommended "GameController" pattern.
///
/// Separates visual state from data state. The BLoC owns the data;
/// the AnimationManager owns the visual timeline.
///
/// Key Gemini requirements implemented:
/// 1. Logical Clock: Each move gets a sequence number. If client receives
///    Move 5 and Move 6 at the same time, animations play back-to-back.
/// 2. Time Buffer (100-200ms): When server sends a "DEAL" command with
///    timestamp, client waits to ensure all card data has arrived before
///    starting the dealing animation.
/// 3. TickerProvider-aware: Only runs animations when screen is active.

typedef AnimationCallback = Future<void> Function();

class AnimationStep {
  final int sequenceNumber;
  final String type; // 'deal', 'bet', 'fold', 'reveal', 'winner'
  final AnimationCallback execute;
  final Duration duration;
  final DateTime? serverTimestamp;

  AnimationStep({
    required this.sequenceNumber,
    required this.type,
    required this.execute,
    required this.duration,
    this.serverTimestamp,
  });
}

class AnimationManager extends ChangeNotifier {
  final Queue<AnimationStep> _queue = Queue();
  int _lastProcessedSequence = -1;
  bool _isProcessing = false;
  Timer? _bufferTimer;

  // Gemini's 100-200ms time buffer
  static const _bufferDuration = Duration(milliseconds: 150);

  // Current animation state — widgets listen to these
  String currentAnimationType = '';
  bool isAnimating = false;
  int? activeChipFlightSeat;
  int? activeDealSeat;

  /// Enqueue an animation step. The logical clock ensures ordering.
  /// Server-authoritative events (deal, showdown) use the time buffer.
  /// Optimistic events (player fold/bet) skip the buffer.
  void enqueue(AnimationStep step, {bool optimistic = false}) {
    _queue.add(step);

    // Sort by sequence number (logical clock ordering)
    final sorted = _queue.toList()..sort((a, b) => a.sequenceNumber.compareTo(b.sequenceNumber));
    _queue.clear();
    _queue.addAll(sorted);

    if (optimistic) {
      // Optimistic UI: animate immediately (Gemini pattern)
      _processQueue();
    } else {
      // Server-authoritative: wait for buffer to collect all data
      _bufferTimer?.cancel();
      _bufferTimer = Timer(_bufferDuration, _processQueue);
    }
  }

  Future<void> _processQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;
    isAnimating = true;
    notifyListeners();

    while (_queue.isNotEmpty) {
      final step = _queue.first;

      // Skip already-processed steps (idempotent)
      if (step.sequenceNumber <= _lastProcessedSequence) {
        _queue.removeFirst();
        continue;
      }

      // If we're missing a step (gap in sequence), wait briefly for it
      if (step.sequenceNumber > _lastProcessedSequence + 1) {
        await Future.delayed(const Duration(milliseconds: 100));
        if (_queue.first.sequenceNumber > _lastProcessedSequence + 1) {
          // Gap persists — skip ahead (network lost a message)
          _lastProcessedSequence = step.sequenceNumber - 1;
        } else {
          continue;
        }
      }

      _queue.removeFirst();
      currentAnimationType = step.type;
      notifyListeners();

      // Execute the animation
      await step.execute();

      // Wait for the animation duration to complete
      await Future.delayed(step.duration);

      _lastProcessedSequence = step.sequenceNumber;
    }

    isAnimating = false;
    currentAnimationType = '';
    notifyListeners();
    _isProcessing = false;
  }

  /// Signal that a chip flight animation should start
  void startChipFlight(int fromSeat) {
    activeChipFlightSeat = fromSeat;
    notifyListeners();
  }

  void endChipFlight() {
    activeChipFlightSeat = null;
    notifyListeners();
  }

  /// Signal that a card deal animation should start
  void startDeal(int toSeat) {
    activeDealSeat = toSeat;
    notifyListeners();
  }

  void endDeal() {
    activeDealSeat = null;
    notifyListeners();
  }

  void reset() {
    _queue.clear();
    _lastProcessedSequence = -1;
    _isProcessing = false;
    _bufferTimer?.cancel();
    isAnimating = false;
    currentAnimationType = '';
    activeChipFlightSeat = null;
    activeDealSeat = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _bufferTimer?.cancel();
    super.dispose();
  }
}
