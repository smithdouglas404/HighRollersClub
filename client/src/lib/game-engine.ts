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

    // Only deal in players with chips > 0
    const updatedPlayers: Player[] = players.map(p => {
      if (p.chips <= 0) {
        return { ...p, isActive: false, status: 'folded' as const, cards: undefined, currentBet: 0 };
      }
      return {
        ...p,
        cards: [newDeck.pop()!, newDeck.pop()!] as [CardType, CardType],
        isActive: true,
        status: 'waiting' as const,
        currentBet: 0,
        timeLeft: 100,
      };
    });

    const activePlayers = updatedPlayers.filter(p => p.isActive);
    if (activePlayers.length < 2) return; // Not enough players to play

    const dealerIndex = updatedPlayers.findIndex(p => p.id === gameState.dealerId);
    // Find next active player for each position
    const findNextActive = (startIdx: number) => {
      let idx = (startIdx + 1) % updatedPlayers.length;
      let safety = 0;
      while (!updatedPlayers[idx].isActive && safety < updatedPlayers.length) {
        idx = (idx + 1) % updatedPlayers.length;
        safety++;
      }
      return idx;
    };

    const sbIndex = findNextActive(dealerIndex);
    const bbIndex = findNextActive(sbIndex);
    const utgIndex = findNextActive(bbIndex);

    // Cap blinds at player's available chips (all-in posting)
    const sbAmount = Math.min(sb, updatedPlayers[sbIndex].chips);
    updatedPlayers[sbIndex].currentBet = sbAmount;
    updatedPlayers[sbIndex].chips -= sbAmount;

    const bbAmount = Math.min(bb, updatedPlayers[bbIndex].chips);
    updatedPlayers[bbIndex].currentBet = bbAmount;
    updatedPlayers[bbIndex].chips -= bbAmount;

    // Find first player to act (skip all-in players with 0 chips)
    let firstToAct = utgIndex;
    let safety = 0;
    while (updatedPlayers[firstToAct].chips === 0 && safety < updatedPlayers.length) {
      firstToAct = findNextActive(firstToAct);
      if (firstToAct === utgIndex) break; // Everyone is all-in
      safety++;
    }
    updatedPlayers[firstToAct].status = 'thinking';

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
      pot: sbAmount + bbAmount,
      communityCards: [],
      currentTurnPlayerId: finalPlayers[firstToAct].id,
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

        // Rotate dealer to next player who will have chips
        const currentDealerIdx = players.findIndex(p => p.id === gameState.dealerId);
        let nextDealerIdx = (currentDealerIdx + 1) % players.length;
        let dlrSafety = 0;
        while (dlrSafety < players.length) {
          const p = players[nextDealerIdx];
          // Will this player have chips next hand? (winners get potShare)
          const willHaveChips = winnerIds.includes(p.id) ? p.chips + potShare > 0 : p.chips > 0;
          if (willHaveChips) break;
          nextDealerIdx = (nextDealerIdx + 1) % players.length;
          dlrSafety++;
        }
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

    // Find next player who can act (not folded, not all-in, has chips)
    let nextIndex = (dealerIndex + 1) % players.length;
    let safety = 0;
    while (safety < players.length) {
      const p = players[nextIndex];
      if (p.status !== 'folded' && p.isActive && p.chips > 0) break;
      nextIndex = (nextIndex + 1) % players.length;
      safety++;
    }

    // Check if everyone is all-in or only one can act — skip straight to showdown
    const canAct = players.filter(p => p.status !== 'folded' && p.isActive && p.chips > 0);
    if (canAct.length <= 1) {
      // Run out all community cards and go to showdown
      const currentDeck2 = [...deck];
      const allCommunity = [...gameState.communityCards];
      while (allCommunity.length < 5 && currentDeck2.length > 0) {
        allCommunity.push(currentDeck2.pop()!);
      }
      setDeck(currentDeck2);
      setGameState(prev => ({ ...prev, communityCards: allCommunity, phase: nextPhaseName }));
      setPlayers(prev => prev.map(p => ({ ...p, currentBet: 0 })));
      // Continue advancing phases until showdown
      setTimeout(nextPhase, 800);
      return;
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
      status: idx === nextIndex ? 'thinking' : (p.status === 'folded' ? 'folded' : (p.chips === 0 ? 'waiting' : 'waiting')),
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
      const callAmount = Math.min(gameState.minBet - player.currentBet, player.chips);
      const newChips = player.chips - callAmount;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: newChips,
        currentBet: player.currentBet + callAmount,
        status: newChips === 0 ? 'called' : 'called',
      };
      newPot += callAmount;
    } else if (action === 'raise' && amount) {
      const added = Math.min(amount - player.currentBet, player.chips);
      const newChips = player.chips - added;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: newChips,
        currentBet: player.currentBet + added,
        status: 'raised',
      };
      newPot += added;
      newMinBet = player.currentBet + added;
    }

    // Check if only one player remains (everyone else folded)
    const activePlayers = newPlayers.filter(p => p.status !== 'folded' && p.isActive);
    if (activePlayers.length === 1) {
      // Last player standing wins
      const winner = activePlayers[0];
      const winnerIdx = newPlayers.findIndex(p => p.id === winner.id);
      newPlayers[winnerIdx] = { ...winner, chips: winner.chips + newPot };
      setPlayers(newPlayers);

      // Rotate dealer for next hand (skip eliminated players)
      const currentDealerIdx = newPlayers.findIndex(p => p.id === gameState.dealerId);
      let nextDealerIdx = (currentDealerIdx + 1) % newPlayers.length;
      let dlrSafety = 0;
      while (newPlayers[nextDealerIdx].chips <= 0 && !newPlayers[nextDealerIdx].isActive && dlrSafety < newPlayers.length) {
        nextDealerIdx = (nextDealerIdx + 1) % newPlayers.length;
        dlrSafety++;
      }

      setGameState(prev => ({
        ...prev,
        pot: 0,
        phase: 'showdown',
        dealerId: newPlayers[nextDealerIdx].id,
        lastAction: { playerId: player.id, action, amount },
        actionNumber: actionNumberRef.current,
      }));

      setTimeout(() => startGame(), 3000);
      return;
    }

    // Find next active player who can still act (skip folded and all-in with 0 chips)
    let nextIndex = (currentPlayerIndex + 1) % newPlayers.length;
    let loopCount = 0;
    while (loopCount < newPlayers.length) {
      const np = newPlayers[nextIndex];
      if (np.status !== 'folded' && np.chips > 0 && np.isActive) break;
      nextIndex = (nextIndex + 1) % newPlayers.length;
      loopCount++;
    }

    // Check if all remaining active players are all-in or only one can act
    const playersWhoCanAct = newPlayers.filter(p => p.status !== 'folded' && p.isActive && p.chips > 0);
    const nextPlayer = newPlayers[nextIndex];

    const isRoundOver =
      playersWhoCanAct.length <= 1 ||
      (nextPlayer.currentBet === newMinBet && nextPlayer.status !== 'thinking' && nextPlayer.status !== 'waiting') ||
      newPlayers.filter(p => p.status !== 'folded' && p.isActive).every(p => p.status === 'checked' || p.chips === 0);

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

  // Bot AI with slightly smarter logic and realistic delay
  useEffect(() => {
    const currentPlayer = players.find(p => p.id === gameState.currentTurnPlayerId);

    if (currentPlayer && currentPlayer.id !== heroId && currentPlayer.status === 'thinking') {
      // Skip bots with no chips (all-in)
      if (currentPlayer.chips <= 0) {
        handlePlayerAction('check');
        return;
      }

      const timer = setTimeout(() => {
        const roll = Math.random();
        if (gameState.minBet > 0 && currentPlayer.currentBet < gameState.minBet) {
          if (roll > 0.85) handlePlayerAction('fold');
          else if (roll > 0.15) handlePlayerAction('call');
          else handlePlayerAction('raise', Math.min(gameState.minBet * 2, currentPlayer.chips + currentPlayer.currentBet));
        } else {
          if (roll > 0.65) handlePlayerAction('check');
          else handlePlayerAction('raise', Math.min(gameState.minBet + bb * 2, currentPlayer.chips + currentPlayer.currentBet));
        }
      }, 2000 + Math.random() * 2500); // 2-4.5s realistic delay

      return () => clearTimeout(timer);
    }
  }, [gameState.currentTurnPlayerId, players, handlePlayerAction, gameState.minBet, heroId, bb]);

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
