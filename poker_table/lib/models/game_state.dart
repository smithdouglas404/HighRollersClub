import 'package:equatable/equatable.dart';
import 'card_model.dart';
import 'player_model.dart';

enum GamePhase { waiting, preflop, flop, turn, river, showdown, winner }

class GameState extends Equatable {
  final String handId;
  final int handNumber;
  final GamePhase phase;
  final List<PlayerModel> players;
  final List<PlayingCard> communityCards;
  final int pot;
  final int dealerSeat;
  final int currentTurnSeat;
  final int? winnerSeat;
  final String winnerHand;
  final int smallBlind;
  final int bigBlind;
  final List<String> actionLog;

  const GameState({
    this.handId = '',
    this.handNumber = 0,
    this.phase = GamePhase.waiting,
    this.players = const [],
    this.communityCards = const [],
    this.pot = 0,
    this.dealerSeat = 0,
    this.currentTurnSeat = -1,
    this.winnerSeat,
    this.winnerHand = '',
    this.smallBlind = 500,
    this.bigBlind = 1000,
    this.actionLog = const [],
  });

  GameState copyWith({
    String? handId,
    int? handNumber,
    GamePhase? phase,
    List<PlayerModel>? players,
    List<PlayingCard>? communityCards,
    int? pot,
    int? dealerSeat,
    int? currentTurnSeat,
    int? winnerSeat,
    String? winnerHand,
    int? smallBlind,
    int? bigBlind,
    List<String>? actionLog,
  }) {
    return GameState(
      handId: handId ?? this.handId,
      handNumber: handNumber ?? this.handNumber,
      phase: phase ?? this.phase,
      players: players ?? this.players,
      communityCards: communityCards ?? this.communityCards,
      pot: pot ?? this.pot,
      dealerSeat: dealerSeat ?? this.dealerSeat,
      currentTurnSeat: currentTurnSeat ?? this.currentTurnSeat,
      winnerSeat: winnerSeat ?? this.winnerSeat,
      winnerHand: winnerHand ?? this.winnerHand,
      smallBlind: smallBlind ?? this.smallBlind,
      bigBlind: bigBlind ?? this.bigBlind,
      actionLog: actionLog ?? this.actionLog,
    );
  }

  @override
  List<Object?> get props => [handId, handNumber, phase, players, communityCards, pot, dealerSeat, currentTurnSeat, winnerSeat, winnerHand, actionLog];
}
