import { useState, useRef, useEffect, useCallback } from "react";
import { formatChips } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

const AVATARS = [
  "avatar-neon-fox.jpg", "avatar-neon-viper.jpg", "avatar-oracle-seer.jpg",
  "avatar-punk-duchess.jpg", "avatar-red-wolf.jpg", "avatar-shadow-king.jpg",
  "avatar-steel-ghost.jpg", "avatar-street-racer.jpg", "avatar-tech-monk.jpg",
  "avatar-void-witch.jpg",
];
const NAMES = ["AceHunter", "BluffMast", "ChipQueen", "DealerDan", "PocketRkt", "RiverRat", "Jaitey5", "Kumathr23", "Meorin34", "Movs503"];
const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const DECK = SUITS.flatMap(s => RANKS.map(r => ({ rank: r, suit: s })));
const HERO = 5, SB = 500, BB = 1000, FOLDS = [2, 5, 8];
const HAND_ORDER = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];

export type SimCard = { rank: string; suit: string };
export type SimPhase = "preflop" | "flop" | "turn" | "river" | "showdown" | "winner";
export interface SimPlayer {
  name: string; chips: number; avatar: string; status: "active" | "folded" | "allin";
  holeCards: SimCard[]; currentBet: number; isDealer: boolean; seatNum: number;
}

function shuffle(): SimCard[] {
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

function evalHand(cards: SimCard[]): string {
  const r = cards.map(c => "23456789TJQKA".indexOf(c.rank === "10" ? "T" : c.rank));
  const rc: Record<number, number> = {};
  r.forEach(v => rc[v] = (rc[v] || 0) + 1);
  const cnt = Object.values(rc).sort((a, b) => b - a);
  const uniq = [...new Set(r)].sort((a, b) => a - b);
  const flush = new Set(cards.map(c => c.suit)).size <= 2 || cards.filter(c => c.suit === cards[0].suit).length >= 5;
  const straight = uniq.length >= 5 && uniq.some((_, i) => i + 4 < uniq.length && uniq[i + 4] - uniq[i] === 4);
  if (cnt[0] === 4) return "Four of a Kind";
  if (cnt[0] === 3 && cnt[1] >= 2) return "Full House";
  if (flush && straight) return "Straight Flush";
  if (flush) return "Flush";
  if (straight) return "Straight";
  if (cnt[0] === 3) return "Three of a Kind";
  if (cnt[0] === 2 && cnt[1] === 2) return "Two Pair";
  if (cnt[0] === 2) return "Pair";
  return "High Card";
}

export function useGameSim() {
  const [phase, setPhase] = useState<SimPhase>("preflop");
  const [players, setPlayers] = useState<SimPlayer[]>([]);
  const [community, setCommunity] = useState<SimCard[]>([]);
  const [pot, setPot] = useState(0);
  const [dealer, setDealer] = useState(0);
  const [hero, setHero] = useState<SimCard[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [winHand, setWinHand] = useState("");
  const [handNum, setHandNum] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const dealt = useRef(0);
  const di = useRef(0);
  const hn = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const run = useCallback(() => {
    clear();
    const deck = shuffle();
    let ci = 0;
    const d = di.current;
    const h = hn.current;
    const ps: SimPlayer[] = Array.from({ length: 10 }, (_, i) => ({
      name: NAMES[i], chips: 15000 + Math.floor(Math.random() * 20000),
      avatar: `${BASE}images/${AVATARS[i]}`, status: "active" as const,
      holeCards: [deck[ci++]!, deck[ci++]!], currentBet: 0, isDealer: i === d, seatNum: i + 1,
    }));
    const sb = (d + 1) % 10, bb = (d + 2) % 10;
    ps[sb].chips -= SB; ps[sb].currentBet = SB;
    ps[bb].chips -= BB; ps[bb].currentBet = BB;
    const rem = deck.slice(ci);
    let dp = 0, cp = SB + BB, cp2 = [...ps];

    const sync = () => { setPlayers([...cp2]); setPot(cp); };
    const bet = (amt: number) => {
      const active = cp2.filter(p => p.status !== "folded");
      let tot = 0;
      cp2 = cp2.map(p => { if (p.status === "folded") return p; tot += amt; return { ...p, chips: p.chips - amt, currentBet: amt }; });
      cp += tot; sync();
      setLog(l => [...l, ...active.map(p => `${p.name} bets $${formatChips(amt)}`)]);
    };
    const clearBets = () => { cp2 = cp2.map(p => ({ ...p, currentBet: 0 })); };
    const deal = (n: number) => { const c = rem.slice(dp, dp + n); dp += n; return c; };
    const fmt = (c: SimCard) => `${c.rank}${c.suit[0]}`;

    setPlayers([...ps]); setHero(ps[HERO].holeCards); setCommunity([]); setPot(cp);
    setPhase("preflop"); setWinner(null); setWinHand(""); setHandNum(h); setDealer(d);
    setLog([`Hand #${h} — Dealer: ${ps[d].name}`, `${ps[sb].name} posts SB $${formatChips(SB)}`, `${ps[bb].name} posts BB $${formatChips(BB)}`]);
    dealt.current = 0;

    let t = 1500;
    for (let s = 0; s < 10; s++) {
      const pi = (d + 3 + s) % 10;
      at(() => {
        cp2 = cp2.map((p, i) => {
          if (i !== pi) return p;
          if (FOLDS.includes(i)) return { ...p, status: "folded" as const };
          const ca = BB - p.currentBet; cp += ca;
          return { ...p, chips: p.chips - ca, currentBet: BB };
        });
        sync();
        setLog(l => [...l, FOLDS.includes(pi) ? `${cp2[pi].name} folds` : `${cp2[pi].name} calls $${formatChips(BB)}`]);
      }, t);
      t += 800;
    }

    t += 500;
    at(() => { clearBets(); const f = deal(3); sync(); setCommunity(f); setPhase("flop"); setLog(l => [...l, `--- FLOP: ${f.map(fmt).join(" ")} ---`]); }, t);
    t += 2000;
    at(() => bet(1000), t);
    t += 2000;
    at(() => { clearBets(); const c = deal(1); sync(); setCommunity(p => [...p, ...c]); setPhase("turn"); setLog(l => [...l, `--- TURN: ${fmt(c[0])} ---`]); }, t);
    t += 2000;
    at(() => bet(2000), t);
    t += 2000;
    at(() => { clearBets(); const c = deal(1); sync(); setCommunity(p => [...p, ...c]); setPhase("river"); setLog(l => [...l, `--- RIVER: ${fmt(c[0])} ---`]); }, t);
    t += 2000;
    at(() => bet(3000), t);
    t += 2500;
    at(() => { clearBets(); sync(); setPhase("showdown"); }, t);

    t += 1500;
    at(() => {
      const comm = rem.slice(0, dp);
      const active = cp2.filter(p => p.status !== "folded");
      let bi = -1, br = -1;
      active.forEach(p => {
        const h = evalHand([...p.holeCards, ...comm]);
        const r = HAND_ORDER.indexOf(h);
        const idx = cp2.findIndex(x => x.name === p.name);
        if (r > br || (r === br && bi === -1)) { br = r; bi = idx; }
      });
      if (bi >= 0) {
        const w = cp2[bi], hand = evalHand([...w.holeCards, ...comm]);
        cp2[bi] = { ...w, chips: w.chips + cp };
        setPlayers([...cp2]); setWinner(bi); setWinHand(hand);
        setLog(l => [...l, `🏆 ${w.name} wins $${formatChips(cp)} with ${hand}!`]);
      }
      setPhase("winner");
    }, t);

    t += 6000;
    at(() => { di.current = (di.current + 1) % 10; hn.current++; dealt.current = 0; run(); }, t);
  }, []);

  useEffect(() => { run(); return clear; }, []);

  return { phase, players, community, pot, dealer, hero, winner, winHand, handNum, log, dealt };
}
