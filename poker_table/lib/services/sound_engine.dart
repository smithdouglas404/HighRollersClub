import 'package:audioplayers/audioplayers.dart';

/// Sound engine — Gemini recommendation:
/// "The 'clink' of a chip should be triggered exactly at the end
///  of the AnimatedPositioned curve for the best feel."
///
/// Uses audioplayers package. On web, requires user click before playing.
class SoundEngine {
  final AudioPlayer _chipPlayer = AudioPlayer();
  final AudioPlayer _cardPlayer = AudioPlayer();
  final AudioPlayer _winPlayer = AudioPlayer();
  bool _enabled = true;
  bool _initialized = false;

  bool get enabled => _enabled;
  set enabled(bool value) => _enabled = value;

  /// Initialize audio context (required on web — browsers need user gesture)
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    // Pre-set volumes
    await _chipPlayer.setVolume(0.6);
    await _cardPlayer.setVolume(0.4);
    await _winPlayer.setVolume(0.8);
  }

  /// Play chip clink — call at the END of AnimatedPositioned curve
  Future<void> playChipClink() async {
    if (!_enabled) return;
    await _chipPlayer.play(AssetSource('sounds/chip_clink.mp3'));
  }

  /// Play card deal sound — call when card lands at seat
  Future<void> playCardDeal() async {
    if (!_enabled) return;
    await _cardPlayer.play(AssetSource('sounds/card_deal.mp3'));
  }

  /// Play card flip sound — call when AnimatedSwitcher triggers
  Future<void> playCardFlip() async {
    if (!_enabled) return;
    await _cardPlayer.play(AssetSource('sounds/card_flip.mp3'));
  }

  /// Play winner fanfare — call when WinnerDeclaredEvent fires
  Future<void> playWinFanfare() async {
    if (!_enabled) return;
    await _winPlayer.play(AssetSource('sounds/win_fanfare.mp3'));
  }

  /// Play timer tick — urgency controls pitch/speed
  Future<void> playTimerTick(double urgency) async {
    if (!_enabled) return;
    await _chipPlayer.setPlaybackRate(0.8 + urgency * 0.4);
    await _chipPlayer.play(AssetSource('sounds/timer_tick.mp3'));
  }

  void dispose() {
    _chipPlayer.dispose();
    _cardPlayer.dispose();
    _winPlayer.dispose();
  }
}
