import 'package:equatable/equatable.dart';
import 'card_model.dart';

enum PlayerStatus { active, folded, allIn, thinking, sittingOut, waiting }

enum PlayerResult { win, loss, neutral }

class PlayerModel extends Equatable {
  final String id;
  final String name;
  final String avatarUrl;
  final String? fullBodyAvatarUrl;
  final String tier; // legendary, epic, rare, common
  final int seatIndex;
  final int chips;
  final int currentBet;
  final PlayerStatus status;
  final PlayerResult result;
  final List<PlayingCard> holeCards;
  final bool isDealer;
  final String? handLabel;
  final int amountDelta;

  const PlayerModel({
    required this.id,
    required this.name,
    required this.avatarUrl,
    this.fullBodyAvatarUrl,
    this.tier = 'common',
    required this.seatIndex,
    required this.chips,
    this.currentBet = 0,
    this.status = PlayerStatus.active,
    this.result = PlayerResult.neutral,
    this.holeCards = const [],
    this.isDealer = false,
    this.handLabel,
    this.amountDelta = 0,
  });

  bool get isFolded => status == PlayerStatus.folded;
  bool get isAllIn => status == PlayerStatus.allIn;
  bool get isThinking => status == PlayerStatus.thinking;

  PlayerModel copyWith({
    String? id,
    String? name,
    String? avatarUrl,
    String? fullBodyAvatarUrl,
    String? tier,
    int? seatIndex,
    int? chips,
    int? currentBet,
    PlayerStatus? status,
    PlayerResult? result,
    List<PlayingCard>? holeCards,
    bool? isDealer,
    String? handLabel,
    int? amountDelta,
  }) {
    return PlayerModel(
      id: id ?? this.id,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      fullBodyAvatarUrl: fullBodyAvatarUrl ?? this.fullBodyAvatarUrl,
      tier: tier ?? this.tier,
      seatIndex: seatIndex ?? this.seatIndex,
      chips: chips ?? this.chips,
      currentBet: currentBet ?? this.currentBet,
      status: status ?? this.status,
      result: result ?? this.result,
      holeCards: holeCards ?? this.holeCards,
      isDealer: isDealer ?? this.isDealer,
      handLabel: handLabel ?? this.handLabel,
      amountDelta: amountDelta ?? this.amountDelta,
    );
  }

  @override
  List<Object?> get props => [id, name, avatarUrl, seatIndex, chips, currentBet, status, result, holeCards, isDealer, handLabel, amountDelta, tier];
}
