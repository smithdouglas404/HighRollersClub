import 'package:equatable/equatable.dart';

enum Suit { hearts, diamonds, clubs, spades }

enum Rank { two, three, four, five, six, seven, eight, nine, ten, jack, queen, king, ace }

class PlayingCard extends Equatable {
  final Rank rank;
  final Suit suit;
  final bool faceUp;

  const PlayingCard({required this.rank, required this.suit, this.faceUp = false});

  bool get isRed => suit == Suit.hearts || suit == Suit.diamonds;

  String get rankLabel {
    switch (rank) {
      case Rank.two: return '2';
      case Rank.three: return '3';
      case Rank.four: return '4';
      case Rank.five: return '5';
      case Rank.six: return '6';
      case Rank.seven: return '7';
      case Rank.eight: return '8';
      case Rank.nine: return '9';
      case Rank.ten: return '10';
      case Rank.jack: return 'J';
      case Rank.queen: return 'Q';
      case Rank.king: return 'K';
      case Rank.ace: return 'A';
    }
  }

  String get suitSymbol {
    switch (suit) {
      case Suit.hearts: return '\u2665';
      case Suit.diamonds: return '\u2666';
      case Suit.clubs: return '\u2663';
      case Suit.spades: return '\u2660';
    }
  }

  PlayingCard copyWith({bool? faceUp}) =>
      PlayingCard(rank: rank, suit: suit, faceUp: faceUp ?? this.faceUp);

  @override
  List<Object?> get props => [rank, suit, faceUp];

  static List<PlayingCard> fullDeck() {
    return [
      for (final suit in Suit.values)
        for (final rank in Rank.values) PlayingCard(rank: rank, suit: suit),
    ];
  }
}
