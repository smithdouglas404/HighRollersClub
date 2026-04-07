import 'package:equatable/equatable.dart';
import '../models/card_model.dart';
import '../models/game_state.dart';

abstract class GameEvent extends Equatable {
  const GameEvent();
  @override
  List<Object?> get props => [];
}

/// Server sends new hand data
class NewHandEvent extends GameEvent {
  final int handNumber;
  final int dealerSeat;
  const NewHandEvent({required this.handNumber, required this.dealerSeat});
  @override
  List<Object?> get props => [handNumber, dealerSeat];
}

/// Cards dealt to players
class DealCardsEvent extends GameEvent {
  final Map<int, List<PlayingCard>> playerCards; // seatIndex -> cards
  const DealCardsEvent({required this.playerCards});
  @override
  List<Object?> get props => [playerCards];
}

/// Community cards revealed
class RevealCommunityEvent extends GameEvent {
  final List<PlayingCard> cards;
  final GamePhase phase;
  const RevealCommunityEvent({required this.cards, required this.phase});
  @override
  List<Object?> get props => [cards, phase];
}

/// Player action received
class PlayerActionEvent extends GameEvent {
  final int seatIndex;
  final String action; // fold, call, raise, check, allIn
  final int amount;
  const PlayerActionEvent({required this.seatIndex, required this.action, this.amount = 0});
  @override
  List<Object?> get props => [seatIndex, action, amount];
}

/// Turn changes to a new player
class NewTurnEvent extends GameEvent {
  final int seatIndex;
  const NewTurnEvent({required this.seatIndex});
  @override
  List<Object?> get props => [seatIndex];
}

/// Pot updated
class PotUpdatedEvent extends GameEvent {
  final int newPot;
  const PotUpdatedEvent({required this.newPot});
  @override
  List<Object?> get props => [newPot];
}

/// Showdown — reveal hole cards
class ShowdownEvent extends GameEvent {
  final Map<int, List<PlayingCard>> revealedCards;
  const ShowdownEvent({required this.revealedCards});
  @override
  List<Object?> get props => [revealedCards];
}

/// Winner declared
class WinnerDeclaredEvent extends GameEvent {
  final int seatIndex;
  final String handName;
  final int potWon;
  const WinnerDeclaredEvent({required this.seatIndex, required this.handName, required this.potWon});
  @override
  List<Object?> get props => [seatIndex, handName, potWon];
}

/// Player joined the table
class PlayerJoinedEvent extends GameEvent {
  final int seatIndex;
  final String name;
  final String avatarUrl;
  final String tier;
  final int chips;
  const PlayerJoinedEvent({required this.seatIndex, required this.name, required this.avatarUrl, this.tier = 'common', required this.chips});
  @override
  List<Object?> get props => [seatIndex, name, avatarUrl, chips];
}

/// Player left the table
class PlayerLeftEvent extends GameEvent {
  final int seatIndex;
  const PlayerLeftEvent({required this.seatIndex});
  @override
  List<Object?> get props => [seatIndex];
}

/// Start game simulation (demo mode)
class StartSimulationEvent extends GameEvent {
  const StartSimulationEvent();
}
