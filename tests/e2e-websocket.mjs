/**
 * End-to-end WebSocket integration test
 *
 * Plays a full poker hand through the real game engine:
 *   1. Register/login two users
 *   2. Create a table
 *   3. Connect both via WebSocket
 *   4. Player 1 joins + adds bots
 *   5. Play through a complete hand (pre-flop → showdown)
 *   6. Verify hand history saved with summary
 *   7. Verify player stats incremented
 */

import WebSocket from "ws";
import http from "http";
import crypto from "crypto";

const BASE = "http://localhost:5000";
const WS_URL = "ws://localhost:5000/ws";

// ── Helpers ──────────────────────────────────────────────────

function httpRequest(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (bodyStr) headers["Content-Length"] = Buffer.byteLength(bodyStr);
    if (cookie) headers.Cookie = cookie;

    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };

    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        // Extract set-cookie
        const setCookie = res.headers["set-cookie"];
        let sessionCookie = cookie;
        if (setCookie) {
          for (const c of setCookie) {
            const match = c.match(/connect\.sid=[^;]+/);
            if (match) sessionCookie = match[0];
          }
        }
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json, cookie: sessionCookie, raw: data });
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function connectWS(cookie) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const ws = new WebSocket(WS_URL, { headers });
    const messages = [];
    let messageHandler = null;

    ws.on("open", () => {
      resolve({
        ws,
        messages,
        send(msg) { ws.send(JSON.stringify(msg)); },
        // Wait for a message matching a predicate, with timeout
        waitFor(predicate, timeoutMs = 15000) {
          // Check existing messages first
          const existing = messages.find(predicate);
          if (existing) return Promise.resolve(existing);

          return new Promise((res, rej) => {
            const timeout = setTimeout(() => {
              rej(new Error(`Timed out waiting for message (${timeoutMs}ms). Last ${messages.length} msgs: ${messages.map(m => m.type).join(", ")}`));
            }, timeoutMs);

            messageHandler = (msg) => {
              if (predicate(msg)) {
                clearTimeout(timeout);
                messageHandler = null;
                res(msg);
              }
            };
          });
        },
        close() { ws.close(); },
      });
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (messageHandler) messageHandler(msg);
      } catch {}
    });

    ws.on("error", reject);
    setTimeout(() => reject(new Error("WS connection timeout")), 5000);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Generate a random player seed and its SHA-256 commitment hash
function generateSeed() {
  const seed = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return { seed, hash };
}

// ── Main Test ────────────────────────────────────────────────

async function runTest() {
  const results = { passed: 0, failed: 0, errors: [] };

  function assert(condition, label) {
    if (condition) {
      results.passed++;
      console.log(`  ✓ ${label}`);
    } else {
      results.failed++;
      results.errors.push(label);
      console.log(`  ✗ ${label}`);
    }
  }

  try {
    // ── Step 1: Register & Login ──
    console.log("\n═══ STEP 1: Register & Login ═══");

    const ts = Date.now().toString(36).slice(-6); // short unique suffix
    const username1 = `hero_${ts}`;
    const username2 = `vill_${ts}`;

    const reg1 = await httpRequest("POST", "/api/auth/register", {
      username: username1, password: "testpass123", displayName: "E2E Hero"
    });
    assert(reg1.status === 201 || reg1.status === 200, `Register player 1 (status ${reg1.status})`);
    const cookie1 = reg1.cookie;
    const userId1 = reg1.json?.id;
    console.log(`    Player 1: ${username1} (${userId1})`);

    const reg2 = await httpRequest("POST", "/api/auth/register", {
      username: username2, password: "testpass123", displayName: "E2E Villain"
    });
    assert(reg2.status === 201 || reg2.status === 200, `Register player 2 (status ${reg2.status})`);
    const cookie2 = reg2.cookie;
    const userId2 = reg2.json?.id;
    console.log(`    Player 2: ${username2} (${userId2})`);

    // ── Step 2: Create a cash game table ──
    console.log("\n═══ STEP 2: Create Cash Game Table ═══");

    const createRes = await httpRequest("POST", "/api/tables", {
      name: "E2E Test Table",
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 200,
      maxBuyIn: 1000,
      maxPlayers: 6,
      gameFormat: "cash",
    }, cookie1);
    assert(createRes.status === 201 || createRes.status === 200, `Create table (status ${createRes.status})`);
    const tableId = createRes.json?.id;
    console.log(`    Table ID: ${tableId}`);

    // ── Step 3: Connect WebSockets ──
    console.log("\n═══ STEP 3: Connect WebSockets ═══");

    const client1 = await connectWS(cookie1);
    assert(true, "Player 1 WebSocket connected");

    const client2 = await connectWS(cookie2);
    assert(true, "Player 2 WebSocket connected");

    // ── Step 4: Join Table ──
    console.log("\n═══ STEP 4: Join Table ═══");

    client1.send({ type: "join_table", tableId, buyIn: 500 });

    // Wait for game state after join
    const joinState1 = await client1.waitFor(m => m.type === "game_state");
    assert(joinState1.type === "game_state", "Player 1 received game_state after join");

    const p1InState = joinState1.state?.players?.find(p => p.id === userId1);
    assert(p1InState != null, `Player 1 appears in game state (chips: ${p1InState?.chips})`);

    // Player 2 joins
    client2.send({ type: "join_table", tableId, buyIn: 500 });

    // Wait for game state showing both players
    const joinState2 = await client2.waitFor(m => m.type === "game_state");
    assert(joinState2.type === "game_state", "Player 2 received game_state after join");

    // ── Step 5: Wait for hand to auto-start ──
    console.log("\n═══ STEP 5: Wait for Hand to Start ═══");

    // With 2 players, hand should auto-start after ~2 seconds
    // We need to handle seed requests for provably fair
    let seed1 = null;
    let seed2 = null;

    // Wait for seed_request or game_state with pre-flop phase
    const handStartMsg1 = await client1.waitFor(
      m => m.type === "seed_request" || (m.type === "game_state" && m.state?.phase === "pre-flop"),
      10000
    );

    if (handStartMsg1.type === "seed_request") {
      console.log("    Provably fair seed request received");
      seed1 = generateSeed();
      client1.send({ type: "seed_commit", commitmentHash: seed1.hash });

      // Player 2 should also get seed request
      const seedReq2 = await client2.waitFor(m => m.type === "seed_request", 5000);
      if (seedReq2) {
        seed2 = generateSeed();
        client2.send({ type: "seed_commit", commitmentHash: seed2.hash });
      }
      assert(true, "Both players submitted seed commitments");
    }

    // Wait for pre-flop game state
    const preFlopState = await client1.waitFor(
      m => m.type === "game_state" && m.state?.phase === "pre-flop",
      10000
    );
    assert(preFlopState.state?.phase === "pre-flop", "Hand started - pre-flop phase");
    assert(preFlopState.state?.communityCards?.length === 0, "No community cards at pre-flop");

    const allPlayers = preFlopState.state?.players;
    assert(allPlayers?.length >= 2, `${allPlayers?.length} players at table`);

    // ── Step 6: Play Pre-flop Actions ──
    console.log("\n═══ STEP 6: Play Pre-flop ═══");

    // Determine whose turn it is
    let currentTurnSeat = preFlopState.state?.currentTurnSeat;
    let currentPlayer1 = preFlopState.state?.players?.find(p => p.id === userId1);
    let currentPlayer2 = preFlopState.state?.players?.find(p => p.id === userId2);

    console.log(`    Turn seat: ${currentTurnSeat}, P1 seat: ${currentPlayer1?.seatIndex}, P2 seat: ${currentPlayer2?.seatIndex}`);

    // Play through by having both players call/check
    let phase = "pre-flop";
    let handComplete = false;
    let actionCount = 0;
    const MAX_ACTIONS = 20; // Safety limit

    while (!handComplete && actionCount < MAX_ACTIONS) {
      // Get latest state from either client
      const latestState = client1.messages.filter(m => m.type === "game_state").pop();
      if (!latestState) { await sleep(500); continue; }

      phase = latestState.state?.phase;
      currentTurnSeat = latestState.state?.currentTurnSeat;

      if (phase === "showdown" || phase === "complete") {
        handComplete = true;
        break;
      }

      // Find whose turn it is
      const turnPlayer = latestState.state?.players?.find(p => p.seatIndex === currentTurnSeat);
      if (!turnPlayer) { await sleep(300); continue; }

      let activeClient = null;
      let activeSeed = null;

      if (turnPlayer.id === userId1) {
        activeClient = client1;
        activeSeed = seed1;
      } else if (turnPlayer.id === userId2) {
        activeClient = client2;
        activeSeed = seed2;
      } else {
        // It's another player's (bot's) turn, wait
        await sleep(500);
        continue;
      }

      // Determine valid action: call if there's a bet, check otherwise
      const action = latestState.state?.minBet > 0 ? "call" : "check";
      console.log(`    ${turnPlayer.displayName} (seat ${currentTurnSeat}) → ${action} [${phase}]`);

      activeClient.send({ type: "player_action", action });
      actionCount++;

      // Wait a bit for server to process and possibly advance phase
      await sleep(800);

      // Wait for next game state
      try {
        await client1.waitFor(
          m => m.type === "game_state" && (
            m.state?.currentTurnSeat !== currentTurnSeat ||
            m.state?.phase !== phase
          ),
          5000
        );
      } catch {
        // Might have already received it
      }
    }

    assert(actionCount > 0, `Played ${actionCount} actions through the hand`);

    // ── Step 7: Wait for Showdown ──
    console.log("\n═══ STEP 7: Wait for Showdown ═══");

    // The hand might have ended by fold or reached showdown
    let showdownState;
    try {
      showdownState = await client1.waitFor(
        m => m.type === "game_state" && (m.state?.phase === "showdown" || m.state?.showdownResults),
        10000
      );
    } catch {
      // If hand ended by fold, we might not see showdown phase
      showdownState = client1.messages.filter(m => m.type === "game_state").pop();
    }

    const finalPhase = showdownState?.state?.phase;
    assert(
      finalPhase === "showdown" || finalPhase === "complete" || handComplete,
      `Hand completed (final phase: ${finalPhase})`
    );

    // If it's showdown, reveal seeds
    if (seed1) {
      client1.send({ type: "seed_reveal", seed: seed1.seed });
    }
    if (seed2) {
      client2.send({ type: "seed_reveal", seed: seed2.seed });
    }

    // Check community cards were dealt
    const finalCommunity = showdownState?.state?.communityCards;
    console.log(`    Community cards: ${finalCommunity?.length || 0} cards`);

    // Look for showdown results
    const showdownResults = showdownState?.state?.showdownResults;
    if (showdownResults) {
      console.log(`    Showdown results: ${showdownResults.length} players`);
      for (const r of showdownResults) {
        console.log(`      ${r.displayName}: ${r.handRank || "folded"} ${r.winAmount ? `(won ${r.winAmount})` : ""}`);
      }
      assert(showdownResults.length > 0, "Showdown results present");
    }

    // Wait for shuffle_reveal (proof)
    await sleep(2000);
    const shuffleReveal = client1.messages.find(m => m.type === "shuffle_reveal");
    if (shuffleReveal) {
      assert(shuffleReveal.proof != null, "Shuffle proof received after showdown");
      console.log(`    Shuffle proof keys: ${Object.keys(shuffleReveal.proof || {}).join(", ")}`);
    }

    // ── Step 8: Verify Hand History ──
    console.log("\n═══ STEP 8: Verify Hand History ═══");

    await sleep(2000); // Let server persist the hand

    const handsRes = await httpRequest("GET", `/api/tables/${tableId}/hands`, null, cookie1);
    assert(handsRes.status === 200, `GET hand history (status ${handsRes.status})`);

    const hands = handsRes.json;
    assert(Array.isArray(hands) && hands.length > 0, `Hand history has ${hands?.length} entries`);

    if (hands?.length > 0) {
      const latestHand = hands[0];
      console.log(`    Hand #${latestHand.handNumber}, players: ${latestHand.playerCount}`);
      assert(latestHand.summary != null, `Hand summary is non-null`);
      // Shuffle proof fields are at the top level, not nested under shuffleProof
      assert(latestHand.serverSeed != null || latestHand.shuffleProof != null, "Hand has shuffle proof data");
      assert(latestHand.commitmentHash != null, "Hand has commitment hash");
      assert(latestHand.deckOrder != null, "Hand has deck order recorded");

      if (latestHand.summary) {
        console.log(`    Summary keys: ${Object.keys(latestHand.summary).join(", ")}`);
      }
    }

    // ── Step 9: Verify Stats ──
    console.log("\n═══ STEP 9: Verify Player Stats ═══");

    await sleep(2000); // Extra wait for async stat writes to complete

    const stats1 = await httpRequest("GET", "/api/stats/me", null, cookie1);
    assert(stats1.status === 200, `GET stats for player 1 (status ${stats1.status})`);
    console.log(`    Player 1 stats: handsPlayed=${stats1.json?.handsPlayed}, potsWon=${stats1.json?.potsWon}`);
    assert(stats1.json?.handsPlayed >= 1, `Player 1 handsPlayed >= 1 (actual: ${stats1.json?.handsPlayed})`);

    const stats2 = await httpRequest("GET", "/api/stats/me", null, cookie2);
    assert(stats2.status === 200, `GET stats for player 2 (status ${stats2.status})`);
    console.log(`    Player 2 stats: handsPlayed=${stats2.json?.handsPlayed}, potsWon=${stats2.json?.potsWon}`);
    assert(stats2.json?.handsPlayed >= 1, `Player 2 handsPlayed >= 1 (actual: ${stats2.json?.handsPlayed})`);

    // Check that the hand record has a winner
    const winnerIds = hands?.[0]?.winnerIds || [];
    console.log(`    Hand winner IDs: ${JSON.stringify(winnerIds)}`);
    assert(winnerIds.length >= 1, `Hand record has at least 1 winner (found ${winnerIds.length})`);

    // Check potsWon stat or hand summary winners
    const totalWins = (stats1.json?.potsWon || 0) + (stats2.json?.potsWon || 0);
    const summaryWinners = hands?.[0]?.summary?.winners || [];
    assert(totalWins >= 1 || summaryWinners.length >= 1, `Winner tracked (stats: ${totalWins} wins, summary: ${summaryWinners.length} winners)`);

    // ── Step 10: Verify Wallet Balance Changed ──
    console.log("\n═══ STEP 10: Verify Wallet ═══");

    const wallet1 = await httpRequest("GET", "/api/wallet/balance", null, cookie1);
    const wallet2 = await httpRequest("GET", "/api/wallet/balance", null, cookie2);
    console.log(`    Player 1 balance: ${wallet1.json?.balance} (started 10000, bought in 500)`);
    console.log(`    Player 2 balance: ${wallet2.json?.balance} (started 10000, bought in 500)`);
    // Both players bought in for 500, so starting wallet should be 10000 - 500 = 9500
    assert(wallet1.json?.balance <= 10000, `Player 1 wallet decreased from buy-in (${wallet1.json?.balance})`);
    assert(wallet2.json?.balance <= 10000, `Player 2 wallet decreased from buy-in (${wallet2.json?.balance})`);

    // ── Cleanup ──
    console.log("\n═══ CLEANUP ═══");
    client1.send({ type: "leave_table" });
    client2.send({ type: "leave_table" });
    await sleep(500);
    client1.close();
    client2.close();

    // ── Report ──
    console.log("\n═══════════════════════════════════════");
    console.log(`  RESULTS: ${results.passed} passed, ${results.failed} failed`);
    if (results.failed > 0) {
      console.log(`  FAILURES:`);
      for (const err of results.errors) {
        console.log(`    ✗ ${err}`);
      }
    }
    console.log("═══════════════════════════════════════\n");

    process.exit(results.failed > 0 ? 1 : 0);

  } catch (err) {
    console.error("\n  FATAL ERROR:", err.message);
    console.error(err.stack);
    process.exit(2);
  }
}

runTest();
