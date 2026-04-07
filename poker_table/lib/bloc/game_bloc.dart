import 'dart:async';
import 'dart:math';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/card_model.dart';
import '../models/game_state.dart';
import '../models/player_model.dart';
import 'game_event.dart';

class GameBloc extends Bloc<GameEvent, GameState> {
  Timer? _simTimer;
  final _rng = Random();

  static const _avatarNames = [
    'AceHunter', 'BluffMast', 'ChipQueen', 'DealerDan', 'PocketRkt',
    'RiverRat', 'NeonViper', 'ShadowKng', 'IceQueen', 'RedWolf',
  ];

  static const _tiers = ['legendary', 'epic', 'rare', 'common', 'epic', 'rare', 'legendary', 'common', 'rare', 'epic'];

  static const _avatarUrls = [
    'assets/avatars/avatar_neon_viper.webp',
    'assets/avatars/avatar_chrome_siren.webp',
    'assets/avatars/avatar_gold_phantom.webp',
    'assets/avatars/avatar_shadow_king.webp',
    'assets/avatars/avatar_red_wolf.webp',
    'assets/avatars/avatar_ice_queen.webp',
    'assets/avatars/avatar_tech_monk.webp',
    'assets/avatars/avatar_cyber_punk.webp',
    'assets/avatars/avatar_steel_ghost.webp',
    'assets/avatars/avatar_neon_fox.webp',
  ];

  GameBloc() : super(const GameState()) {
    on<StartSimulationEvent>(_onStartSimulation);
    on<NewHandEvent>(_onNewHand);
    on<DealCardsEvent>(_onDealCards);
    on<PlayerActionEvent>(_onPlayerAction);
    on<NewTurnEvent>(_onNewTurn);
    on<PotUpdatedEvent>(_onPotUpdated);
    on<RevealCommunityEvent>(_onRevealCommunity);
    on<ShowdownEvent>(_onShowdown);
    on<WinnerDeclaredEvent>(_onWinnerDeclared);
    on<PlayerJoinedEvent>(_onPlayerJoined);
    on<PlayerLeftEvent>(_onPlayerLeft);
  }

  void _onStartSimulation(StartSimulationEvent event, Emitter<GameState> emit) {
    // Seat 10 players
    final players = List.generate(10, (i) => PlayerModel(
      id: 'p$i',
      name: _avatarNames[i],
      avatarUrl: _avatarUrls[i],
      tier: _tiers[i],
      seatIndex: i,
      chips: 15000 + _rng.nextInt(20000),
    ));

    emit(state.copyWith(
      players: players,
      phase: GamePhase.waiting,
      handNumber: 0,
    ));

    // Start first hand after a brief delay
    _scheduleSimStep(() => add(NewHandEvent(handNumber: 1, dealerSeat: 0)), 500);
  }

  void _onNewHand(NewHandEvent event, Emitter<GameState> emit) {
    // Shuffle deck, deal, post blinds
    final deck = PlayingCard.fullDeck()..shuffle(_rng);
    var ci = 0;
    final sb = (event.dealerSeat + 1) % 10;
    final bb = (event.dealerSeat + 2) % 10;

    final players = state.players.map((p) {
      final cards = [deck[ci++], deck[ci++]];
      var chips = p.chips;
      var bet = 0;
      var isDealer = p.seatIndex == event.dealerSeat;

      if (p.seatIndex == sb) {
        chips -= state.smallBlind;
        bet = state.smallBlind;
      } else if (p.seatIndex == bb) {
        chips -= state.bigBlind;
        bet = state.bigBlind;
      }

      return p.copyWith(
        holeCards: cards,
        chips: chips,
        currentBet: bet,
        status: PlayerStatus.active,
        result: PlayerResult.neutral,
        isDealer: isDealer,
        handLabel: null,
        amountDelta: 0,
      );
    }).toList();

    final remaining = deck.sublist(ci);

    emit(state.copyWith(
      handId: 'hand_${event.handNumber}',
      handNumber: event.handNumber,
      phase: GamePhase.preflop,
      players: players,
      communityCards: [],
      pot: state.smallBlind + state.bigBlind,
      dealerSeat: event.dealerSeat,
      winnerSeat: null,
      winnerHand: '',
      actionLog: ['Hand #${event.handNumber} — Dealer: ${players[event.dealerSeat].name}'],
    ));

    // Simulate preflop actions
    _simulateBettingRound(event.dealerSeat, remaining, 0);
  }

  void _simulateBettingRound(int dealer, List<PlayingCard> deck, int deckPos) {
    var delay = 800;
    final foldSeats = {2, 5, 8}; // Some players fold each hand

    for (var s = 0; s < 10; s++) {
      final pi = (dealer + 3 + s) % 10;
      final shouldFold = foldSeats.contains(pi);
      _scheduleSimStep(() {
        add(PlayerActionEvent(
          seatIndex: pi,
          action: shouldFold ? 'fold' : 'call',
          amount: shouldFold ? 0 : state.bigBlind,
        ));
      }, delay);
      delay += 600;
    }

    // Flop
    _scheduleSimStep(() {
      final flop = deck.sublist(deckPos, deckPos + 3).map((c) => c.copyWith(faceUp: true)).toList();
      add(RevealCommunityEvent(cards: flop, phase: GamePhase.flop));
    }, delay);
    delay += 1500;

    // Flop bet round
    _scheduleSimStep(() {
      for (final p in state.players) {
        if (!p.isFolded) {
          add(PlayerActionEvent(seatIndex: p.seatIndex, action: 'call', amount: 1000));
        }
      }
    }, delay);
    delay += 1200;

    // Turn
    _scheduleSimStep(() {
      final turn = [deck[deckPos + 3].copyWith(faceUp: true)];
      add(RevealCommunityEvent(cards: [...state.communityCards, ...turn], phase: GamePhase.turn));
    }, delay);
    delay += 1500;

    // Turn bet
    _scheduleSimStep(() {
      for (final p in state.players) {
        if (!p.isFolded) {
          add(PlayerActionEvent(seatIndex: p.seatIndex, action: 'call', amount: 2000));
        }
      }
    }, delay);
    delay += 1200;

    // River
    _scheduleSimStep(() {
      final river = [deck[deckPos + 4].copyWith(faceUp: true)];
      add(RevealCommunityEvent(cards: [...state.communityCards, ...river], phase: GamePhase.river));
    }, delay);
    delay += 1500;

    // River bet
    _scheduleSimStep(() {
      for (final p in state.players) {
        if (!p.isFolded) {
          add(PlayerActionEvent(seatIndex: p.seatIndex, action: 'call', amount: 3000));
        }
      }
    }, delay);
    delay += 1500;

    // Showdown
    _scheduleSimStep(() {
      add(RevealCommunityEvent(cards: state.communityCards, phase: GamePhase.showdown));
    }, delay);
    delay += 1200;

    // Winner
    _scheduleSimStep(() {
      final active = state.players.where((p) => !p.isFolded).toList();
      if (active.isNotEmpty) {
        final winner = active[_rng.nextInt(active.length)];
        add(WinnerDeclaredEvent(
          seatIndex: winner.seatIndex,
          handName: _randomHandName(),
          potWon: state.pot,
        ));
      }
    }, delay);
    delay += 4000;

    // Next hand
    _scheduleSimStep(() {
      add(NewHandEvent(
        handNumber: state.handNumber + 1,
        dealerSeat: (state.dealerSeat + 1) % 10,
      ));
    }, delay);
  }

  String _randomHandName() {
    const hands = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind'];
    return hands[_rng.nextInt(hands.length)];
  }

  void _onDealCards(DealCardsEvent event, Emitter<GameState> emit) {
    final players = state.players.map((p) {
      final cards = event.playerCards[p.seatIndex];
      return cards != null ? p.copyWith(holeCards: cards) : p;
    }).toList();
    emit(state.copyWith(players: players));
  }

  void _onPlayerAction(PlayerActionEvent event, Emitter<GameState> emit) {
    final players = state.players.map((p) {
      if (p.seatIndex != event.seatIndex) return p;

      switch (event.action) {
        case 'fold':
          return p.copyWith(status: PlayerStatus.folded, currentBet: 0);
        case 'call':
          return p.copyWith(
            chips: p.chips - event.amount,
            currentBet: event.amount,
          );
        case 'raise':
          return p.copyWith(
            chips: p.chips - event.amount,
            currentBet: event.amount,
          );
        case 'allIn':
          return p.copyWith(
            status: PlayerStatus.allIn,
            currentBet: p.chips,
            chips: 0,
          );
        default:
          return p;
      }
    }).toList();

    var potAdd = 0;
    if (event.action != 'fold') {
      potAdd = event.amount;
    }

    final log = [...state.actionLog];
    final pName = state.players.firstWhere((p) => p.seatIndex == event.seatIndex).name;
    if (event.action == 'fold') {
      log.add('$pName folds');
    } else {
      log.add('$pName ${event.action}s \$${event.amount}');
    }

    emit(state.copyWith(
      players: players,
      pot: state.pot + potAdd,
      actionLog: log,
    ));
  }

  void _onNewTurn(NewTurnEvent event, Emitter<GameState> emit) {
    emit(state.copyWith(currentTurnSeat: event.seatIndex));
  }

  void _onPotUpdated(PotUpdatedEvent event, Emitter<GameState> emit) {
    emit(state.copyWith(pot: event.newPot));
  }

  void _onRevealCommunity(RevealCommunityEvent event, Emitter<GameState> emit) {
    // Clear bets when new street
    final players = state.players.map((p) => p.copyWith(currentBet: 0)).toList();
    final log = [...state.actionLog];
    final phaseLabel = event.phase == GamePhase.flop ? 'FLOP' : event.phase == GamePhase.turn ? 'TURN' : event.phase == GamePhase.river ? 'RIVER' : 'SHOWDOWN';
    log.add('--- $phaseLabel ---');

    emit(state.copyWith(
      communityCards: event.cards,
      phase: event.phase,
      players: players,
      actionLog: log,
    ));
  }

  void _onShowdown(ShowdownEvent event, Emitter<GameState> emit) {
    final players = state.players.map((p) {
      final revealed = event.revealedCards[p.seatIndex];
      if (revealed != null) {
        return p.copyWith(holeCards: revealed.map((c) => c.copyWith(faceUp: true)).toList());
      }
      return p;
    }).toList();
    emit(state.copyWith(phase: GamePhase.showdown, players: players));
  }

  void _onWinnerDeclared(WinnerDeclaredEvent event, Emitter<GameState> emit) {
    final players = state.players.map((p) {
      if (p.seatIndex == event.seatIndex) {
        return p.copyWith(
          result: PlayerResult.win,
          chips: p.chips + event.potWon,
          handLabel: event.handName,
          amountDelta: event.potWon,
        );
      }
      return p.copyWith(result: p.isFolded ? PlayerResult.neutral : PlayerResult.loss);
    }).toList();

    final log = [...state.actionLog, '${players[event.seatIndex].name} wins \$${event.potWon} with ${event.handName}!'];

    emit(state.copyWith(
      phase: GamePhase.winner,
      winnerSeat: event.seatIndex,
      winnerHand: event.handName,
      players: players,
      actionLog: log,
    ));
  }

  void _onPlayerJoined(PlayerJoinedEvent event, Emitter<GameState> emit) {
    final players = [...state.players, PlayerModel(
      id: 'p${event.seatIndex}',
      name: event.name,
      avatarUrl: event.avatarUrl,
      tier: event.tier,
      seatIndex: event.seatIndex,
      chips: event.chips,
    )];
    emit(state.copyWith(players: players));
  }

  void _onPlayerLeft(PlayerLeftEvent event, Emitter<GameState> emit) {
    final players = state.players.where((p) => p.seatIndex != event.seatIndex).toList();
    emit(state.copyWith(players: players));
  }

  void _scheduleSimStep(void Function() fn, int delayMs) {
    _simTimer?.cancel();
    Future.delayed(Duration(milliseconds: delayMs), () {
      if (!isClosed) fn();
    });
  }

  @override
  Future<void> close() {
    _simTimer?.cancel();
    return super.close();
  }
}
