import { useState, useEffect, useCallback, useRef } from 'react';
import { Player, GameState, CardType, Suit, Rank, GamePhase } from './poker-types';
import { determineWinners, PlayerResult } from './hand-evaluator';

// --- Constants & Helpers ---
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const createDeck = (): CardType[] => {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

const shuffleDeck = (deck: CardType[]): CardType[] => {
  const newDeck = [...deck];
  const randomValues = new Uint32Array(newDeck.length);
  crypto.getRandomValues(randomValues);
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export interface ShowdownData {
  results: PlayerResult[];
  winnerIds: string[];
  pot: number;
}

export interface GameEngineConfig {
  smallBlind?: number;  // default 10
  bigBlind?: number;    // default 20
  ante?: number;        // default 0
}

// --- Hook Implementation ---
export function useGameEngine(initialPlayers: Player[], heroId: string = 'player-1', config?: GameEngineConfig) {
  const sb = config?.smallBlind ?? 10;
  const bb = config?.bigBlind ?? 20;
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [showdown, setShowdown] = useState<ShowdownData | null>(null);
  const handNumberRef = useRef(0);
  const actionNumberRef = useRef(0);

  const [gameState, setGameState] = useState<GameState>({
    pot: 0,
    communityCards: [],
    currentTurnPlayerId: initialPlayers[0].id,
    dealerId: initialPlayers[1].id,
    phase: 'pre-flop',
    minBet: bb,
    dealingPhase: 'idle',
    handNumber: 0,
    actionNumber: 0,
  });

  const showdownTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize Game
  const startGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    const updatedPlayers: Player[] = players.map(p => ({
      ...p,
      cards: [newDeck.pop()!, newDeck.pop()!] as [CardType, CardType],
      isActive: true,
      status: 'waiting' as const,
      currentBet: 0,
      timeLeft: 100,
    }));

    const dealerIndex = updatedPlayers.findIndex(p => p.id === gameState.dealerId);
    const sbIndex = (dealerIndex + 1) % updatedPlayers.length;
    const bbIndex = (dealerIndex + 2) % updatedPlayers.length;
    const utgIndex = (dealerIndex + 3) % updatedPlayers.length;

    updatedPlayers[sbIndex].currentBet = sb;
    updatedPlayers[sbIndex].chips -= sb;

    updatedPlayers[bbIndex].currentBet = bb;
    updatedPlayers[bbIndex].chips -= bb;

    updatedPlayers[utgIndex].status = 'thinking';

    // Hide opponent cards (hero can see their own)
    const finalPlayers = updatedPlayers.map(p => ({
      ...p,
      cards: p.cards ? [
        { ...p.cards[0], hidden: p.id !== heroId },
        { ...p.cards[1], hidden: p.id !== heroId },
      ] as [CardType, CardType] : undefined,
    }));

    handNumberRef.current++;
    setPlayers(finalPlayers);
    setDeck(newDeck);
    setShowdown(null);
    setGameState(prev => ({
      ...prev,
      pot: sb + bb,
      communityCards: [],
      currentTurnPlayerId: finalPlayers[utgIndex].id,
      phase: 'pre-flop',
      minBet: bb,
      lastAggressorId: undefined,
      dealingPhase: 'dealing',
      handNumber: handNumberRef.current,
      lastAction: undefined,
    }));

    // Transition to 'dealt' after dealing animation completes
    setTimeout(() => {
      setGameState(prev => ({ ...prev, dealingPhase: 'dealt' }));
    }, 1500);
  }, [players, gameState.dealerId, heroId]);

  // Advance Phase
  const nextPhase = useCallback(() => {
    let cardsToDeal = 0;
    let nextPhaseName: GamePhase = gameState.phase;

    if (gameState.phase === 'pre-flop') {
      cardsToDeal = 3; nextPhaseName = 'flop';
    } else if (gameState.phase === 'flop') {
      cardsToDeal = 1; nextPhaseName = 'turn';
    } else if (gameState.phase === 'turn') {
      cardsToDeal = 1; nextPhaseName = 'river';
    } else if (gameState.phase === 'river') {
      nextPhaseName = 'showdown';
    }

    if (nextPhaseName === 'showdown') {
      // Real hand evaluation!
      const activePlayers = players.filter(p => p.status !== 'folded' && p.cards);
      const playerHands = activePlayers.map(p => ({
        id: p.id,
        cards: p.cards!.map(c => ({ ...c, hidden: false })),
      }));

      // Deal remaining community cards if needed
      const currentDeck = [...deck];
      const finalCommunity = [...gameState.communityCards];
      while (finalCommunity.length < 5 && currentDeck.length > 0) {
        finalCommunity.push(currentDeck.pop()!);
      }

      const results = determineWinners(playerHands, finalCommunity);
      const winnerIds = results.filter(r => r.isWinner).map(r => r.playerId);

      // Reveal all cards
      setPlayers(prev => prev.map(p => ({
        ...p,
        cards: p.cards && p.status !== 'folded'
          ? [{ ...p.cards[0], hidden: false }, { ...p.cards[1], hidden: false }] as [CardType, CardType]
          : p.cards,
      })));

      setGameState(prev => ({ ...prev, phase: 'showdown', communityCards: finalCommunity }));
      setDeck(currentDeck);

      // Show showdown overlay
      setShowdown({ results, winnerIds, pot: gameState.pot });

      // Award chips and restart after delay
      showdownTimerRef.current = setTimeout(() => {
        const potShare = Math.floor(gameState.pot / winnerIds.length);
        setPlayers(prev => prev.map(p =>
          winnerIds.includes(p.id) ? { ...p, chips: p.chips + potShare } : p
        ));

        // Rotate dealer for next hand
        const currentDealerIdx = players.findIndex(p => p.id === gameState.dealerId);
        const nextDealerIdx = (currentDealerIdx + 1) % players.length;
        setGameState(prev => ({
          ...prev,
          dealerId: players[nextDealerIdx].id,
        }));

        // Brief delay then start new hand
        setTimeout(() => {
          setShowdown(null);
          startGame();
        }, 500);
      }, 5000);

      return;
    }

    const newCommunityCards = [...gameState.communityCards];
    const currentDeck = [...deck];

    for (let i = 0; i < cardsToDeal; i++) {
      if (currentDeck.length > 0) newCommunityCards.push(currentDeck.pop()!);
    }

    const dealerIndex = players.findIndex(p => p.id === gameState.dealerId);
    let nextIndex = (dealerIndex + 1) % players.length;
    let safety = 0;
    while (players[nextIndex].status === 'folded' && safety < players.length) {
      nextIndex = (nextIndex + 1) % players.length;
      safety++;
    }

    setDeck(currentDeck);
    setGameState(prev => ({
      ...prev,
      communityCards: newCommunityCards,
      phase: nextPhaseName,
      currentTurnPlayerId: players[nextIndex].id,
      lastAggressorId: undefined,
    }));

    setPlayers(prev => prev.map((p, idx) => ({
      ...p,
      currentBet: 0,
      status: idx === nextIndex ? 'thinking' : (p.status === 'folded' ? 'folded' : 'waiting'),
    })));

  }, [gameState, deck, players, startGame]);

  // Handle Player Actions
  const handlePlayerAction = useCallback((action: string, amount?: number) => {
    const currentPlayerIndex = players.findIndex(p => p.id === gameState.currentTurnPlayerId);
    if (currentPlayerIndex === -1) return;

    actionNumberRef.current++;

    const player = players[currentPlayerIndex];
    const newPlayers = [...players];
    let newPot = gameState.pot;
    let newMinBet = gameState.minBet;

    if (action === 'fold') {
      newPlayers[currentPlayerIndex] = { ...newPlayers[currentPlayerIndex], status: 'folded' };
    } else if (action === 'check') {
      newPlayers[currentPlayerIndex] = { ...newPlayers[currentPlayerIndex], status: 'checked' };
    } else if (action === 'call') {
      const callAmount = gameState.minBet - player.currentBet;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: player.chips - callAmount,
        currentBet: gameState.minBet,
        status: 'called',
      };
      newPot += callAmount;
    } else if (action === 'raise' && amount) {
      const added = amount - player.currentBet;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: player.chips - added,
        currentBet: amount,
        status: 'raised',
      };
      newPot += added;
      newMinBet = amount;
    }

    // Check if only one player remains (everyone else folded)
    const activePlayers = newPlayers.filter(p => p.status !== 'folded');
    if (activePlayers.length === 1) {
      // Last player standing wins
      const winner = activePlayers[0];
      newPlayers[newPlayers.findIndex(p => p.id === winner.id)] = {
        ...winner,
        chips: winner.chips + newPot,
      };
      setPlayers(newPlayers);
      setGameState(prev => ({
        ...prev,
        pot: 0,
        phase: 'showdown',
        lastAction: { playerId: player.id, action, amount },
        actionNumber: actionNumberRef.current,
      }));

      setTimeout(() => startGame(), 3000);
      return;
    }

    // Find next active player
    let nextIndex = (currentPlayerIndex + 1) % newPlayers.length;
    let loopCount = 0;
    while (newPlayers[nextIndex].status === 'folded' && loopCount < newPlayers.length) {
      nextIndex = (nextIndex + 1) % newPlayers.length;
      loopCount++;
    }

    const nextPlayer = newPlayers[nextIndex];

    const isRoundOver =
      (nextPlayer.currentBet === newMinBet && nextPlayer.status !== 'thinking' && nextPlayer.status !== 'waiting') ||
      newPlayers.filter(p => p.status !== 'folded').every(p => p.status === 'checked');

    if (isRoundOver) {
      setPlayers(newPlayers);
      setGameState(prev => ({
        ...prev,
        pot: newPot,
        minBet: newMinBet,
        lastAction: { playerId: player.id, action, amount },
        actionNumber: actionNumberRef.current,
      }));
      setTimeout(nextPhase, 1000);
      return;
    }

    newPlayers[nextIndex] = { ...newPlayers[nextIndex], status: 'thinking', timeLeft: 100 };

    setPlayers(newPlayers);
    setGameState(prev => ({
      ...prev,
      pot: newPot,
      minBet: newMinBet,
      currentTurnPlayerId: newPlayers[nextIndex].id,
      lastAction: { playerId: player.id, action, amount },
      actionNumber: actionNumberRef.current,
    }));

  }, [players, gameState, nextPhase, startGame]);

  // Bot AI with slightly smarter logic
  useEffect(() => {
    const currentPlayer = players.find(p => p.id === gameState.currentTurnPlayerId);

    if (currentPlayer && currentPlayer.id !== heroId && currentPlayer.status === 'thinking') {
      const timer = setTimeout(() => {
        const roll = Math.random();
        if (gameState.minBet > 0 && currentPlayer.currentBet < gameState.minBet) {
          if (roll > 0.85) handlePlayerAction('fold');
          else if (roll > 0.15) handlePlayerAction('call');
          else handlePlayerAction('raise', Math.min(gameState.minBet * 2, currentPlayer.chips));
        } else {
          if (roll > 0.65) handlePlayerAction('check');
          else handlePlayerAction('raise', Math.min(50, currentPlayer.chips));
        }
      }, 1200 + Math.random() * 2000);

      return () => clearTimeout(timer);
    }
  }, [gameState.currentTurnPlayerId, players, handlePlayerAction, gameState.minBet, heroId]);

  // Start game on mount
  useEffect(() => {
    if (gameState.phase === 'pre-flop' && gameState.pot === 0) {
      startGame();
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (showdownTimerRef.current) clearTimeout(showdownTimerRef.current);
    };
  }, []);

  return {
    players,
    gameState,
    handlePlayerAction,
    showdown,
    dismissShowdown: () => setShowdown(null),
  };
}
