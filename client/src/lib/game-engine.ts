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
  const sbRef = useRef(config?.smallBlind ?? 10);
  const bbRef = useRef(config?.bigBlind ?? 20);
  const sb = sbRef.current;
  const bb = bbRef.current;
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [showdown, setShowdown] = useState<ShowdownData | null>(null);
  const handNumberRef = useRef(0);
  const actionNumberRef = useRef(0);
  const actedThisRoundRef = useRef<Set<string>>(new Set());

  // Refs to always have latest state (avoids stale closures in setTimeout callbacks)
  const playersRef = useRef<Player[]>(initialPlayers);
  const gameStateRef = useRef<GameState>(null!);

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

  // Keep refs in sync with state
  playersRef.current = players;
  gameStateRef.current = gameState;

  const showdownTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize Game — reads from refs so it always has latest state
  const startGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    const currentPlayers = playersRef.current;
    const currentDealerId = gameStateRef.current.dealerId;

    // Activate players who clicked "I'm Ready" during the previous hand
    const readiedPlayers = currentPlayers.map(p => {
      if ((p as any).sitInNextHand) {
        return { ...p, isSittingOut: false, awaitingReady: false, sitInNextHand: undefined, status: 'waiting' as const };
      }
      return p;
    });
    playersRef.current = readiedPlayers;

    // Only deal in players with chips > 0 who aren't sitting out or awaiting ready
    const updatedPlayers: Player[] = readiedPlayers.map(p => {
      if (p.chips <= 0 || p.isSittingOut || p.awaitingReady) {
        return { ...p, isActive: false, status: (p.isSittingOut || p.awaitingReady) ? 'sitting-out' as const : 'folded' as const, cards: undefined, currentBet: 0 };
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

    let dealerIndex = updatedPlayers.findIndex(p => p.id === currentDealerId);
    // If dealer was eliminated, find next active player as dealer
    if (dealerIndex === -1 || !updatedPlayers[dealerIndex].isActive) {
      dealerIndex = updatedPlayers.findIndex(p => p.isActive);
    }
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

    // Sync positional flags (dealer, SB, BB) and hide opponent cards
    const finalPlayers = updatedPlayers.map((p, idx) => ({
      ...p,
      isDealer: idx === dealerIndex,
      isSmallBlind: idx === sbIndex,
      isBigBlind: idx === bbIndex,
      cards: p.cards ? [
        { ...p.cards[0], hidden: p.id !== heroId },
        { ...p.cards[1], hidden: p.id !== heroId },
      ] as [CardType, CardType] : undefined,
    }));

    handNumberRef.current++;
    actedThisRoundRef.current = new Set();
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
  }, [heroId, sb, bb]);

  // Advance Phase — reads from refs to avoid stale closures
  const nextPhase = useCallback(() => {
    const gs = gameStateRef.current;
    const currentPlayers = playersRef.current;
    let cardsToDeal = 0;
    let nextPhaseName: GamePhase = gs.phase;

    if (gs.phase === 'pre-flop') {
      cardsToDeal = 3; nextPhaseName = 'flop';
    } else if (gs.phase === 'flop') {
      cardsToDeal = 1; nextPhaseName = 'turn';
    } else if (gs.phase === 'turn') {
      cardsToDeal = 1; nextPhaseName = 'river';
    } else if (gs.phase === 'river') {
      nextPhaseName = 'showdown';
    }

    if (nextPhaseName === 'showdown') {
      // Real hand evaluation!
      const activePlayers = currentPlayers.filter(p => p.status !== 'folded' && p.cards);
      const playerHands = activePlayers.map(p => ({
        id: p.id,
        cards: p.cards!.map(c => ({ ...c, hidden: false })),
      }));

      // Deal remaining community cards if needed
      const currentDeck = [...deck];
      const finalCommunity = [...gs.communityCards];
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

      // Capture pot value now (before any state resets)
      const currentPot = gs.pot;

      // Show showdown overlay
      setShowdown({ results, winnerIds, pot: currentPot });

      // Award chips and restart after delay
      showdownTimerRef.current = setTimeout(() => {
        const potShare = Math.floor(currentPot / winnerIds.length);

        // Award winnings — use functional updater so we always get latest state
        setPlayers(prev => {
          const awarded = prev.map(p =>
            winnerIds.includes(p.id) ? { ...p, chips: p.chips + potShare } : p
          );
          // Update ref immediately so startGame sees the awarded chips
          playersRef.current = awarded;
          return awarded;
        });

        // Rotate dealer to next player who will have chips (read from ref for latest)
        const latestPlayers = playersRef.current;
        const currentDealerId = gameStateRef.current.dealerId;
        const currentDealerIdx = latestPlayers.findIndex(p => p.id === currentDealerId);
        let nextDealerIdx = (currentDealerIdx + 1) % latestPlayers.length;
        let dlrSafety = 0;
        while (dlrSafety < latestPlayers.length) {
          const p = latestPlayers[nextDealerIdx];
          const willHaveChips = winnerIds.includes(p.id) ? p.chips + potShare > 0 : p.chips > 0;
          if (willHaveChips) break;
          nextDealerIdx = (nextDealerIdx + 1) % latestPlayers.length;
          dlrSafety++;
        }
        setGameState(prev => ({
          ...prev,
          dealerId: latestPlayers[nextDealerIdx].id,
        }));

        // Brief delay then start new hand
        setTimeout(() => {
          setShowdown(null);
          startGame();
        }, 500);
      }, 8000);

      return;
    }

    const newCommunityCards = [...gs.communityCards];
    const currentDeck = [...deck];

    for (let i = 0; i < cardsToDeal; i++) {
      if (currentDeck.length > 0) newCommunityCards.push(currentDeck.pop()!);
    }

    const dealerIndex = currentPlayers.findIndex(p => p.id === gs.dealerId);

    // Find next player who can act (not folded, not all-in, has chips)
    let nextIndex = (dealerIndex + 1) % currentPlayers.length;
    let safety = 0;
    while (safety < currentPlayers.length) {
      const p = currentPlayers[nextIndex];
      if (p.status !== 'folded' && p.isActive && p.chips > 0) break;
      nextIndex = (nextIndex + 1) % currentPlayers.length;
      safety++;
    }

    // Check if everyone is all-in or only one can act — deal streets one at a time with delay
    const canAct = currentPlayers.filter(p => p.status !== 'folded' && p.isActive && p.chips > 0);
    if (canAct.length <= 1) {
      setDeck(currentDeck);
      setGameState(prev => ({ ...prev, communityCards: newCommunityCards, phase: nextPhaseName, minBet: 0 }));
      setPlayers(prev => prev.map(p => ({ ...p, currentBet: 0 })));
      setTimeout(nextPhase, 2000);
      return;
    }

    actedThisRoundRef.current = new Set();
    setDeck(currentDeck);
    setGameState(prev => ({
      ...prev,
      communityCards: newCommunityCards,
      phase: nextPhaseName,
      minBet: 0,
      currentTurnPlayerId: currentPlayers[nextIndex].id,
      lastAggressorId: undefined,
    }));

    setPlayers(prev => prev.map((p, idx) => ({
      ...p,
      currentBet: 0,
      status: idx === nextIndex ? 'thinking' : (p.status === 'folded' ? 'folded' : 'waiting'),
    })));

  }, [deck, startGame]);

  // Handle Player Actions — reads from refs to avoid stale closures
  const handlePlayerAction = useCallback((action: string, amount?: number) => {
    const gs = gameStateRef.current;
    const currentPlayers = playersRef.current;
    const currentPlayerIndex = currentPlayers.findIndex(p => p.id === gs.currentTurnPlayerId);
    if (currentPlayerIndex === -1) return;

    actionNumberRef.current++;

    const player = currentPlayers[currentPlayerIndex];
    const newPlayers = [...currentPlayers];
    let newPot = gs.pot;
    let newMinBet = gs.minBet;

    if (action === 'fold') {
      newPlayers[currentPlayerIndex] = { ...newPlayers[currentPlayerIndex], status: 'folded' };
      actedThisRoundRef.current.add(player.id);
    } else if (action === 'check') {
      newPlayers[currentPlayerIndex] = { ...newPlayers[currentPlayerIndex], status: 'checked' };
      actedThisRoundRef.current.add(player.id);
    } else if (action === 'call') {
      const callAmount = Math.min(gs.minBet - player.currentBet, player.chips);
      const newChips = player.chips - callAmount;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: newChips,
        currentBet: player.currentBet + callAmount,
        status: newChips === 0 ? 'all-in' as const : 'called',
      };
      newPot += callAmount;
      actedThisRoundRef.current.add(player.id);
    } else if (action === 'raise' && amount) {
      const added = Math.min(amount - player.currentBet, player.chips);
      const newChips = player.chips - added;
      newPlayers[currentPlayerIndex] = {
        ...newPlayers[currentPlayerIndex],
        chips: newChips,
        currentBet: player.currentBet + added,
        status: newChips === 0 ? 'all-in' as const : 'raised',
      };
      newPot += added;
      newMinBet = player.currentBet + added;
      actedThisRoundRef.current.clear();
      actedThisRoundRef.current.add(player.id);
    }

    const activePlayers = newPlayers.filter(p => p.status !== 'folded' && p.isActive);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      const winnerIdx = newPlayers.findIndex(p => p.id === winner.id);
      newPlayers[winnerIdx] = { ...winner, chips: winner.chips + newPot };

      playersRef.current = newPlayers;
      setPlayers(newPlayers);

      const currentDealerIdx = newPlayers.findIndex(p => p.id === gs.dealerId);
      let nextDealerIdx = (currentDealerIdx + 1) % newPlayers.length;
      let dlrSafety = 0;
      while (newPlayers[nextDealerIdx].chips <= 0 && dlrSafety < newPlayers.length) {
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

    const eligible = newPlayers.filter(
      p => p.status !== 'folded' && p.isActive && p.status !== 'all-in' && p.chips > 0
    );

    const isRoundComplete = (() => {
      if (eligible.length === 0) return true;
      for (const p of eligible) {
        if (!actedThisRoundRef.current.has(p.id)) return false;
        if (p.currentBet !== newMinBet) return false;
      }
      return true;
    })();

    if (isRoundComplete) {
      playersRef.current = newPlayers;
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

    let nextIndex = (currentPlayerIndex + 1) % newPlayers.length;
    let loopCount = 0;
    while (loopCount < newPlayers.length) {
      const np = newPlayers[nextIndex];
      if (np.status !== 'folded' && np.chips > 0 && np.isActive) break;
      nextIndex = (nextIndex + 1) % newPlayers.length;
      loopCount++;
    }

    newPlayers[nextIndex] = { ...newPlayers[nextIndex], status: 'thinking', timeLeft: 100 };

    playersRef.current = newPlayers;
    setPlayers(newPlayers);
    setGameState(prev => ({
      ...prev,
      pot: newPot,
      minBet: newMinBet,
      currentTurnPlayerId: newPlayers[nextIndex].id,
      lastAction: { playerId: player.id, action, amount },
      actionNumber: actionNumberRef.current,
    }));

  }, [nextPhase, startGame]);

  // Bot AI — position-aware with realistic fold rates and timing
  useEffect(() => {
    const currentPlayer = players.find(p => p.id === gameState.currentTurnPlayerId);

    if (currentPlayer && currentPlayer.id !== heroId && currentPlayer.status === 'thinking') {
      // Skip bots with no chips (all-in)
      if (currentPlayer.chips <= 0) {
        handlePlayerAction('check');
        return;
      }

      const minBet = gameState.minBet;
      const phase = gameStateRef.current.phase;
      const pot = gameStateRef.current.pot;
      const callCost = Math.max(0, minBet - currentPlayer.currentBet);
      const potOdds = pot > 0 ? callCost / (pot + callCost) : 0;

      const timer = setTimeout(() => {
        const roll = Math.random();

        if (callCost > 0) {
          // Facing a bet — fold more in later streets and with bad pot odds
          const isExpensive = callCost > currentPlayer.chips * 0.3;
          const isPostFlop = phase !== 'pre-flop';
          let foldChance = 0.25; // Base 25% fold rate

          if (isPostFlop) foldChance += 0.10; // More folds post-flop
          if (isExpensive) foldChance += 0.15; // More folds facing big bets
          if (potOdds > 0.4) foldChance += 0.10; // Bad pot odds
          foldChance = Math.min(foldChance, 0.60); // Cap at 60%

          if (roll < foldChance) {
            handlePlayerAction('fold');
          } else if (roll < foldChance + 0.55 * (1 - foldChance)) {
            // Call — majority of remaining range
            handlePlayerAction('call');
          } else {
            // Raise — aggressive play
            const raiseSize = Math.min(minBet * (1.5 + Math.random() * 1.5), currentPlayer.chips + currentPlayer.currentBet);
            handlePlayerAction('raise', Math.round(raiseSize));
          }
        } else {
          // Not facing a bet — can check or bet
          if (roll < 0.60) {
            handlePlayerAction('check');
          } else if (roll < 0.85) {
            // Small bet (30-60% pot)
            const betSize = Math.max(bb, Math.round(pot * (0.3 + Math.random() * 0.3)));
            handlePlayerAction('raise', Math.min(betSize + currentPlayer.currentBet, currentPlayer.chips + currentPlayer.currentBet));
          } else {
            // Big bet (60-100% pot)
            const betSize = Math.max(bb * 2, Math.round(pot * (0.6 + Math.random() * 0.4)));
            handlePlayerAction('raise', Math.min(betSize + currentPlayer.currentBet, currentPlayer.chips + currentPlayer.currentBet));
          }
        }
      }, 2500 + Math.random() * 3500); // 2.5-6s realistic delay

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

  // Rebuy hero back into the game with fresh chips
  const rebuyHero = useCallback((chipAmount: number) => {
    setPlayers(prev => prev.map(p =>
      p.id === heroId
        ? { ...p, chips: chipAmount, isActive: true, status: 'waiting' as const, currentBet: 0 }
        : p
    ));
    // If game is stalled (not enough players), restart
    setTimeout(() => startGame(), 500);
  }, [heroId, startGame]);

  const sitOut = useCallback(() => {
    setPlayers(prev => {
      const updated = prev.map(p => {
        if (p.id !== heroId) return p;
        return { ...p, isSittingOut: true, status: 'sitting-out' as const };
      });
      playersRef.current = updated;
      return updated;
    });
  }, [heroId]);

  const sitIn = useCallback(() => {
    const currentPhase = gameStateRef.current.phase;
    const handInProgress = currentPhase !== 'waiting' && currentPhase !== 'pre-flop';

    setPlayers(prev => {
      const updated = prev.map(p => {
        if (p.id !== heroId) return p;
        if (handInProgress) {
          // Hand is in progress — mark ready but keep sitting out until next hand
          return { ...p, awaitingReady: false, isSittingOut: true, status: 'sitting-out' as const, sitInNextHand: true };
        }
        // No hand in progress — sit in immediately
        return { ...p, isSittingOut: false, awaitingReady: false, status: 'waiting' as const };
      });
      playersRef.current = updated;
      return updated;
    });

    // Only start a new hand if no hand is currently in progress
    if (!handInProgress) {
      setTimeout(() => startGame(), 600);
    }
  }, [heroId, startGame]);

  const updateConfig = useCallback((newConfig: Partial<GameEngineConfig>) => {
    if (newConfig.smallBlind !== undefined) sbRef.current = newConfig.smallBlind;
    if (newConfig.bigBlind !== undefined) bbRef.current = newConfig.bigBlind;
  }, []);

  return {
    players,
    gameState,
    handlePlayerAction,
    showdown,
    dismissShowdown: () => setShowdown(null),
    rebuyHero,
    sitOut,
    sitIn,
    updateConfig,
  };
}
