import { useState, useEffect, useCallback } from 'react';
import { Player, GameState, CardType, Suit, Rank, GamePhase } from './poker-types';

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
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// --- Hook Implementation ---
export function useGameEngine(initialPlayers: Player[]) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [deck, setDeck] = useState<CardType[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    pot: 0,
    communityCards: [],
    currentTurnPlayerId: initialPlayers[0].id, // Will be set correctly on start
    dealerId: initialPlayers[1].id,
    phase: 'pre-flop',
    minBet: 20, // Big Blind
  });

  // Initialize Game
  const startGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    const updatedPlayers: Player[] = players.map(p => ({
      ...p,
      cards: [newDeck.pop()!, newDeck.pop()!] as [CardType, CardType],
      isActive: true,
      status: 'waiting',
      currentBet: 0,
      timeLeft: 100,
    }));

    // Mock Blinds
    // Assuming Seat 0 is SB, Seat 1 is BB, Seat 2 is Dealer (6-max logic simplified)
    // Let's just say Dealer is current, next is SB, next is BB.
    
    // Simple rotation for mockup:
    // Dealer -> SB -> BB -> UTG (Action starts here)
    
    const dealerIndex = updatedPlayers.findIndex(p => p.id === gameState.dealerId);
    const sbIndex = (dealerIndex + 1) % updatedPlayers.length;
    const bbIndex = (dealerIndex + 2) % updatedPlayers.length;
    const utgIndex = (dealerIndex + 3) % updatedPlayers.length;

    updatedPlayers[sbIndex].currentBet = 10;
    updatedPlayers[sbIndex].chips -= 10;
    
    updatedPlayers[bbIndex].currentBet = 20;
    updatedPlayers[bbIndex].chips -= 20;

    updatedPlayers[utgIndex].status = 'thinking';

    setPlayers(updatedPlayers);
    setDeck(newDeck);
    setGameState(prev => ({
      ...prev,
      pot: 30,
      communityCards: [],
      currentTurnPlayerId: updatedPlayers[utgIndex].id,
      phase: 'pre-flop',
      minBet: 20,
      lastAggressorId: undefined
    }));
  }, [players, gameState.dealerId]);


  // Advance Phase
  const nextPhase = useCallback(() => {
    let cardsToDeal = 0;
    let nextPhaseName: GamePhase = gameState.phase;

    if (gameState.phase === 'pre-flop') {
      cardsToDeal = 3;
      nextPhaseName = 'flop';
    } else if (gameState.phase === 'flop') {
      cardsToDeal = 1;
      nextPhaseName = 'turn';
    } else if (gameState.phase === 'turn') {
      cardsToDeal = 1;
      nextPhaseName = 'river';
    } else if (gameState.phase === 'river') {
      nextPhaseName = 'showdown';
    }

    if (nextPhaseName === 'showdown') {
        // Award pot to random active player for mockup
        const activePlayers = players.filter(p => p.status !== 'folded');
        const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
        
        // Reset for next hand after delay
        setGameState(prev => ({ ...prev, phase: 'showdown' }));
        
        setTimeout(() => {
            // Reset chips/pot logic could go here
             setPlayers(prev => prev.map(p => p.id === winner.id ? { ...p, chips: p.chips + gameState.pot } : p));
             startGame(); // Auto restart
        }, 4000);
        return;
    }

    const newCommunityCards = [...gameState.communityCards];
    const currentDeck = [...deck];
    
    for(let i=0; i<cardsToDeal; i++) {
        if(currentDeck.length > 0) newCommunityCards.push(currentDeck.pop()!);
    }

    // Rotate to SB or first active player after Dealer
    const dealerIndex = players.findIndex(p => p.id === gameState.dealerId);
    let nextIndex = (dealerIndex + 1) % players.length;
    
    // Find next active player
    while(players[nextIndex].status === 'folded') {
        nextIndex = (nextIndex + 1) % players.length;
    }

    setDeck(currentDeck);
    setGameState(prev => ({
      ...prev,
      communityCards: newCommunityCards,
      phase: nextPhaseName,
      currentTurnPlayerId: players[nextIndex].id,
      lastAggressorId: undefined // Reset aggression for new street
    }));

     setPlayers(prev => prev.map((p, idx) => ({
        ...p,
        currentBet: 0, // Reset bets for new street
        status: idx === nextIndex ? 'thinking' : (p.status === 'folded' ? 'folded' : 'waiting')
    })));

  }, [gameState, deck, players, startGame]);


  // Handle Player Actions
  const handlePlayerAction = useCallback((action: string, amount?: number) => {
    const currentPlayerIndex = players.findIndex(p => p.id === gameState.currentTurnPlayerId);
    if (currentPlayerIndex === -1) return;

    const player = players[currentPlayerIndex];
    let newPlayers = [...players];
    let newPot = gameState.pot;
    let newMinBet = gameState.minBet;
    let nextTurnId = '';

    // 1. Execute Action Logic
    if (action === 'fold') {
        newPlayers[currentPlayerIndex].status = 'folded';
    } else if (action === 'check') {
        newPlayers[currentPlayerIndex].status = 'checked';
    } else if (action === 'call') {
        const callAmount = gameState.minBet - player.currentBet;
        newPlayers[currentPlayerIndex].chips -= callAmount;
        newPlayers[currentPlayerIndex].currentBet = gameState.minBet;
        newPlayers[currentPlayerIndex].status = 'called';
        newPot += callAmount;
    } else if (action === 'raise' && amount) {
        const raiseAmount = amount; // Total bet amount
        const added = raiseAmount - player.currentBet;
        newPlayers[currentPlayerIndex].chips -= added;
        newPlayers[currentPlayerIndex].currentBet = raiseAmount;
        newPlayers[currentPlayerIndex].status = 'raised';
        newPot += added;
        newMinBet = raiseAmount;
    }

    // 2. Determine Next Player
    // Simple Rotation: Find next non-folded player
    let nextIndex = (currentPlayerIndex + 1) % newPlayers.length;
    let activeCount = 0;
    let loopCount = 0;
    
    // Check if round is complete
    // Round is complete if all active players have matched the bet or checked
    // AND everyone has acted at least once (unless they are BB preflop and checked)
    
    // For Mockup: Just rotate until we hit the original aggressor or start of round
    // If we cycle back to the last aggressor (or the first person to check if no bets), go to next phase
    
    // Simplified: Just rotate 1 for now, if everyone acted, next phase
    // Real poker logic is complex, simulating basics here
    
    while(newPlayers[nextIndex].status === 'folded' && loopCount < newPlayers.length) {
        nextIndex = (nextIndex + 1) % newPlayers.length;
        loopCount++;
    }

    const nextPlayer = newPlayers[nextIndex];
    
    // Check if we should advance phase
    // Condition: Next player is the one who started the aggression/betting round OR everyone checked
    // Simplification: If next player has already acted (checked/called/raised) AND matches current bet, phase over.
    const isRoundOver = (nextPlayer.currentBet === newMinBet && (nextPlayer.status !== 'thinking' && nextPlayer.status !== 'waiting')) || 
                        (newPlayers.filter(p => p.status !== 'folded').every(p => p.status === 'checked'));

    if (isRoundOver) {
        // Go to next phase
        setPlayers(newPlayers);
        setGameState(prev => ({ ...prev, pot: newPot, minBet: newMinBet }));
        setTimeout(nextPhase, 1000); // Small delay before deal
        return;
    }

    // Pass Turn
    newPlayers[nextIndex].status = 'thinking';
    // Reset timer for new player
    newPlayers[nextIndex].timeLeft = 100;

    setPlayers(newPlayers);
    setGameState(prev => ({
        ...prev,
        pot: newPot,
        minBet: newMinBet,
        currentTurnPlayerId: newPlayers[nextIndex].id
    }));

  }, [players, gameState, nextPhase]);

  // Bot Simulation Effect
  useEffect(() => {
    const currentPlayer = players.find(p => p.id === gameState.currentTurnPlayerId);
    
    if (currentPlayer && currentPlayer.id !== 'player-1' && currentPlayer.status === 'thinking') {
        // It's a bot's turn
        const timer = setTimeout(() => {
            // Bot Logic
            const roll = Math.random();
            if (gameState.minBet > 0 && currentPlayer.currentBet < gameState.minBet) {
                 // Facing a bet
                 if (roll > 0.8) handlePlayerAction('fold');
                 else if (roll > 0.2) handlePlayerAction('call');
                 else handlePlayerAction('raise', gameState.minBet * 2);
            } else {
                // Can check
                if (roll > 0.7) handlePlayerAction('check');
                else handlePlayerAction('raise', 50); // Min bet bump
            }
        }, 1500 + Math.random() * 2000); // Random thinking time

        return () => clearTimeout(timer);
    }
  }, [gameState.currentTurnPlayerId, players, handlePlayerAction, gameState.minBet]);

  // Start game on mount if not started
  useEffect(() => {
      if (gameState.phase === 'pre-flop' && gameState.pot === 0) {
          startGame();
      }
  }, []);

  return {
      players,
      gameState,
      handlePlayerAction
  };
}
