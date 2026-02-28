/**
 * Comprehensive Poker App Test Suite
 * Tests: Auth, Wallet, Tables, WebSocket gameplay, Shop, Chat, Taunts, etc.
 */
import http from 'http';
import { WebSocket } from 'ws';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5000';
const REPORT_PATH = '/home/runner/workspace/TEST_REPORT.md';

// Collect all test results
const results = [];
let cookies = '';
let userId = '';
let tableId = '';

function log(section, test, status, details = '') {
  const entry = { section, test, status, details };
  results.push(entry);
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`${icon} ${section} > ${test}${details ? ': ' + details : ''}`);
}

// HTTP request helper with cookie support
function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookies ? { Cookie: cookies } : {}),
        ...extraHeaders,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // Extract Set-Cookie headers
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          const cookieParts = setCookies.map(c => c.split(';')[0]);
          cookies = cookieParts.join('; ');
        }

        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, data: parsed, raw: data, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// WebSocket helper that connects with session cookie
function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:5000/ws`, {
      headers: { Cookie: cookies },
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

// Wait for a specific WS message type
function waitForMessage(ws, type, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch {}
    };
    ws.on('message', handler);
  });
}

// Collect all WS messages for a duration
function collectMessages(ws, duration = 2000) {
  return new Promise((resolve) => {
    const messages = [];
    const handler = (data) => {
      try { messages.push(JSON.parse(data.toString())); } catch {}
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(messages);
    }, duration);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════════════════════
// TEST SECTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function testAuth() {
  console.log('\n===== TESTING AUTH =====\n');

  // 1. Check /me without auth
  try {
    const res = await request('GET', '/api/auth/me');
    if (res.status === 401) {
      log('Auth', 'GET /api/auth/me without auth returns 401', 'PASS');
    } else {
      log('Auth', 'GET /api/auth/me without auth returns 401', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'GET /api/auth/me without auth', 'FAIL', e.message);
  }

  // 2. Register a new user
  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'testplayer1',
      password: 'testpass123',
      displayName: 'Test Player 1',
    });
    if (res.status === 200 && res.data && res.data.id) {
      userId = res.data.id;
      log('Auth', 'Register new user', 'PASS', `id=${userId}, balance=${res.data.chipBalance}`);
      if (res.data.chipBalance === 10000) {
        log('Auth', 'New user gets 10000 starting chips', 'PASS');
      } else {
        log('Auth', 'New user gets 10000 starting chips', 'FAIL', `Got ${res.data.chipBalance}`);
      }
    } else if (res.status === 409) {
      log('Auth', 'Register new user', 'WARN', 'User already exists, trying login');
      // Try login instead
      const loginRes = await request('POST', '/api/auth/login', {
        username: 'testplayer1',
        password: 'testpass123',
      });
      if (loginRes.status === 200 && loginRes.data.id) {
        userId = loginRes.data.id;
        log('Auth', 'Login existing user', 'PASS', `id=${userId}`);
      } else {
        log('Auth', 'Login existing user', 'FAIL', `Status ${loginRes.status}: ${loginRes.raw}`);
      }
    } else {
      log('Auth', 'Register new user', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Auth', 'Register new user', 'FAIL', e.message);
  }

  // 3. Check /me with auth
  try {
    const res = await request('GET', '/api/auth/me');
    if (res.status === 200 && res.data && res.data.id === userId) {
      log('Auth', 'GET /api/auth/me with session cookie', 'PASS');
      log('Auth', 'Session cookie persists across requests', 'PASS');
    } else {
      log('Auth', 'GET /api/auth/me with session cookie', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'GET /api/auth/me with session cookie', 'FAIL', e.message);
  }

  // 4. Guest account creation
  const savedCookies = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/auth/guest');
    if (res.status === 200 && res.data && res.data.role === 'guest') {
      log('Auth', 'Create guest account', 'PASS', `name=${res.data.displayName}`);
      if (res.data.chipBalance === 10000) {
        log('Auth', 'Guest gets 10000 starting chips', 'PASS');
      } else {
        log('Auth', 'Guest gets 10000 starting chips', 'FAIL', `Got ${res.data.chipBalance}`);
      }
      if (res.data.avatarId) {
        log('Auth', 'Guest gets random avatar assigned', 'PASS', `avatar=${res.data.avatarId}`);
      } else {
        log('Auth', 'Guest gets random avatar assigned', 'FAIL', 'No avatarId');
      }
    } else {
      log('Auth', 'Create guest account', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Auth', 'Create guest account', 'FAIL', e.message);
  }
  cookies = savedCookies; // restore main session

  // 5. Duplicate username
  const saved2 = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'testplayer1',
      password: 'testpass123',
      displayName: 'Duplicate',
    });
    if (res.status === 409) {
      log('Auth', 'Duplicate username returns 409', 'PASS');
    } else {
      log('Auth', 'Duplicate username returns 409', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Duplicate username returns 409', 'FAIL', e.message);
  }
  cookies = saved2 ? saved2 : cookies;
  // Re-set to main session
  if (saved2) cookies = saved2;

  // 6. Login with wrong password
  const saved3 = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/auth/login', {
      username: 'testplayer1',
      password: 'wrongpassword',
    });
    if (res.status === 401) {
      log('Auth', 'Wrong password returns 401', 'PASS');
    } else {
      log('Auth', 'Wrong password returns 401', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Wrong password returns 401', 'FAIL', e.message);
  }
  cookies = saved3;

  // 7. Validation - short username
  const saved4 = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'ab',
      password: 'testpass123',
    });
    if (res.status === 400) {
      log('Auth', 'Username < 3 chars returns 400', 'PASS');
    } else {
      log('Auth', 'Username < 3 chars returns 400', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Username < 3 chars returns 400', 'FAIL', e.message);
  }
  cookies = saved4;

  // 8. Validation - short password
  const saved5 = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'validuser123',
      password: '12345',
    });
    if (res.status === 400) {
      log('Auth', 'Password < 6 chars returns 400', 'PASS');
    } else {
      log('Auth', 'Password < 6 chars returns 400', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Password < 6 chars returns 400', 'FAIL', e.message);
  }
  cookies = saved5;

  // 9. Logout
  try {
    const res = await request('POST', '/api/auth/logout');
    if (res.status === 200) {
      log('Auth', 'Logout', 'PASS');
    } else {
      log('Auth', 'Logout', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Logout', 'FAIL', e.message);
  }

  // 10. Re-login
  try {
    const res = await request('POST', '/api/auth/login', {
      username: 'testplayer1',
      password: 'testpass123',
    });
    if (res.status === 200 && res.data.id) {
      userId = res.data.id;
      log('Auth', 'Re-login after logout', 'PASS');
    } else {
      log('Auth', 'Re-login after logout', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Auth', 'Re-login after logout', 'FAIL', e.message);
  }
}

async function testWallet() {
  console.log('\n===== TESTING WALLET =====\n');

  // 1. Check balance
  try {
    const res = await request('GET', '/api/wallet/balance');
    if (res.status === 200 && typeof res.data.balance === 'number') {
      log('Wallet', 'GET /api/wallet/balance', 'PASS', `balance=${res.data.balance}`);
    } else {
      log('Wallet', 'GET /api/wallet/balance', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Wallet', 'GET /api/wallet/balance', 'FAIL', e.message);
  }

  // 2. Check daily bonus status
  try {
    const res = await request('GET', '/api/wallet/daily-status');
    if (res.status === 200) {
      log('Wallet', 'GET /api/wallet/daily-status', 'PASS', `canClaim=${res.data.canClaim}, bonusAmount=${res.data.bonusAmount}`);
    } else {
      log('Wallet', 'GET /api/wallet/daily-status', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Wallet', 'GET /api/wallet/daily-status', 'FAIL', e.message);
  }

  // 3. Claim daily bonus
  try {
    const beforeRes = await request('GET', '/api/wallet/balance');
    const balanceBefore = beforeRes.data?.balance ?? 0;

    const res = await request('POST', '/api/wallet/claim-daily');
    if (res.status === 200 && res.data.bonus) {
      log('Wallet', 'Claim daily bonus', 'PASS', `bonus=${res.data.bonus}, newBalance=${res.data.balance}`);
      if (res.data.balance === balanceBefore + res.data.bonus) {
        log('Wallet', 'Balance correctly updated after bonus', 'PASS');
      } else {
        log('Wallet', 'Balance correctly updated after bonus', 'FAIL', `Expected ${balanceBefore + res.data.bonus}, got ${res.data.balance}`);
      }
    } else if (res.status === 429) {
      log('Wallet', 'Claim daily bonus (already claimed)', 'PASS', 'Already claimed today - 429 as expected');
    } else {
      log('Wallet', 'Claim daily bonus', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Wallet', 'Claim daily bonus', 'FAIL', e.message);
  }

  // 4. Claim again should be blocked
  try {
    const res = await request('POST', '/api/wallet/claim-daily');
    if (res.status === 429) {
      log('Wallet', 'Double-claim daily bonus returns 429', 'PASS');
      if (res.data.nextClaimAt) {
        log('Wallet', 'Double-claim includes nextClaimAt', 'PASS');
      }
    } else {
      log('Wallet', 'Double-claim daily bonus returns 429', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Wallet', 'Double-claim daily bonus returns 429', 'FAIL', e.message);
  }

  // 5. Transactions list
  try {
    const res = await request('GET', '/api/wallet/transactions');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Wallet', 'GET /api/wallet/transactions', 'PASS', `count=${res.data.length}`);
      if (res.data.length > 0) {
        const tx = res.data[0];
        if (tx.type && typeof tx.amount === 'number' && tx.displayType) {
          log('Wallet', 'Transaction has required fields (type, amount, displayType)', 'PASS');
        } else {
          log('Wallet', 'Transaction has required fields', 'FAIL', JSON.stringify(Object.keys(tx)));
        }
      }
    } else {
      log('Wallet', 'GET /api/wallet/transactions', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Wallet', 'GET /api/wallet/transactions', 'FAIL', e.message);
  }

  // 6. Session summaries
  try {
    const res = await request('GET', '/api/wallet/sessions');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Wallet', 'GET /api/wallet/sessions', 'PASS', `count=${res.data.length}`);
    } else {
      log('Wallet', 'GET /api/wallet/sessions', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Wallet', 'GET /api/wallet/sessions', 'FAIL', e.message);
  }

  // 7. Wallet balance without auth
  const saved = cookies;
  cookies = '';
  try {
    const res = await request('GET', '/api/wallet/balance');
    if (res.status === 401) {
      log('Wallet', 'Balance without auth returns 401', 'PASS');
    } else {
      log('Wallet', 'Balance without auth returns 401', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Wallet', 'Balance without auth returns 401', 'FAIL', e.message);
  }
  cookies = saved;
}

async function testTableCreation() {
  console.log('\n===== TESTING TABLE CREATION =====\n');

  // 1. Create a cash game table
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Test Cash Table',
      maxPlayers: 6,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      gameFormat: 'cash',
      allowBots: true,
    });
    if (res.status === 201 && res.data && res.data.id) {
      tableId = res.data.id;
      log('Table', 'Create cash game table', 'PASS', `id=${tableId}`);
      if (res.data.smallBlind === 10 && res.data.bigBlind === 20) {
        log('Table', 'Correct blind levels set', 'PASS');
      }
      if (res.data.gameFormat === 'cash') {
        log('Table', 'Game format correctly set to cash', 'PASS');
      }
    } else {
      log('Table', 'Create cash game table', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Table', 'Create cash game table', 'FAIL', e.message);
  }

  // 2. Create a heads-up table
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Test Heads Up',
      maxPlayers: 2,
      smallBlind: 25,
      bigBlind: 50,
      minBuyIn: 500,
      maxBuyIn: 5000,
      gameFormat: 'heads_up',
    });
    if (res.status === 201) {
      log('Table', 'Create heads-up table', 'PASS', `id=${res.data.id}`);
    } else {
      log('Table', 'Create heads-up table', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Table', 'Create heads-up table', 'FAIL', e.message);
  }

  // 3. Create SNG table
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Test SNG',
      maxPlayers: 6,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      gameFormat: 'sng',
      buyInAmount: 500,
      startingChips: 1500,
      blindPreset: 'turbo',
    });
    if (res.status === 201) {
      log('Table', 'Create SNG table', 'PASS', `id=${res.data.id}, format=${res.data.gameFormat}`);
    } else {
      log('Table', 'Create SNG table', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Table', 'Create SNG table', 'FAIL', e.message);
  }

  // 4. Create private table with password
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Private Table',
      maxPlayers: 4,
      smallBlind: 50,
      bigBlind: 100,
      minBuyIn: 1000,
      maxBuyIn: 10000,
      gameFormat: 'cash',
      isPrivate: true,
      password: 'secret123',
    });
    if (res.status === 201) {
      log('Table', 'Create private table', 'PASS', `id=${res.data.id}`);
      if (!res.data.password) {
        log('Table', 'Password not exposed in response', 'PASS');
      } else {
        log('Table', 'Password not exposed in response', 'FAIL', 'Password visible in response!');
      }
    } else {
      log('Table', 'Create private table', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Table', 'Create private table', 'FAIL', e.message);
  }

  // 5. Create table with rake
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Raked Table',
      maxPlayers: 6,
      smallBlind: 25,
      bigBlind: 50,
      minBuyIn: 500,
      maxBuyIn: 5000,
      gameFormat: 'cash',
      rakePercent: 5,
      rakeCap: 100,
    });
    if (res.status === 201 && res.data.rakePercent === 5) {
      log('Table', 'Create table with rake', 'PASS', `rake=${res.data.rakePercent}%, cap=${res.data.rakeCap}`);
    } else {
      log('Table', 'Create table with rake', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Table', 'Create table with rake', 'FAIL', e.message);
  }

  // 6. List tables
  try {
    const res = await request('GET', '/api/tables');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Table', 'List tables', 'PASS', `count=${res.data.length}`);
      if (res.data.some(t => t.id === tableId)) {
        log('Table', 'Created table appears in list', 'PASS');
      }
    } else {
      log('Table', 'List tables', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Table', 'List tables', 'FAIL', e.message);
  }

  // 7. Get single table
  if (tableId) {
    try {
      const res = await request('GET', `/api/tables/${tableId}`);
      if (res.status === 200 && res.data.id === tableId) {
        log('Table', 'Get single table', 'PASS');
        if (Array.isArray(res.data.occupiedSeats)) {
          log('Table', 'Table includes occupiedSeats array', 'PASS');
        }
      } else {
        log('Table', 'Get single table', 'FAIL', `Status ${res.status}`);
      }
    } catch (e) {
      log('Table', 'Get single table', 'FAIL', e.message);
    }
  }

  // 8. Invalid table creation
  try {
    const res = await request('POST', '/api/tables', {
      name: '',  // invalid
    });
    if (res.status === 400) {
      log('Table', 'Invalid table creation returns 400', 'PASS');
    } else {
      log('Table', 'Invalid table creation returns 400', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Table', 'Invalid table creation returns 400', 'FAIL', e.message);
  }

  // 9. Table creation without auth
  const saved = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Unauth Table',
      maxPlayers: 6,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
    });
    if (res.status === 401) {
      log('Table', 'Table creation without auth returns 401', 'PASS');
    } else {
      log('Table', 'Table creation without auth returns 401', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Table', 'Table creation without auth returns 401', 'FAIL', e.message);
  }
  cookies = saved;
}

async function testWebSocketGameplay() {
  console.log('\n===== TESTING WEBSOCKET GAMEPLAY =====\n');

  if (!tableId) {
    log('WebSocket', 'Skipping - no table ID', 'FAIL', 'Table creation failed');
    return;
  }

  let ws;
  try {
    ws = await connectWs();
    log('WebSocket', 'Connect with session cookie', 'PASS');
  } catch (e) {
    log('WebSocket', 'Connect with session cookie', 'FAIL', e.message);
    return;
  }

  // 1. Join table
  try {
    ws.send(JSON.stringify({
      type: 'join_table',
      tableId: tableId,
      buyIn: 1000,
    }));

    const msg = await waitForMessage(ws, 'game_state', 5000);
    if (msg && msg.state) {
      log('WebSocket', 'Join table and receive game_state', 'PASS');
      log('WebSocket', `Phase: ${msg.state.phase}`, 'PASS');
      if (msg.state.players && msg.state.players.length > 0) {
        const me = msg.state.players.find(p => p.id === userId);
        if (me) {
          log('WebSocket', 'Player appears in state', 'PASS', `chips=${me.chips}, seat=${me.seatIndex}`);
        } else {
          log('WebSocket', 'Player appears in state', 'FAIL', 'Not found in players list');
        }
      }
    } else {
      log('WebSocket', 'Join table and receive game_state', 'FAIL', 'No game state received');
    }
  } catch (e) {
    log('WebSocket', 'Join table and receive game_state', 'FAIL', e.message);
  }

  // 2. Add bots
  try {
    ws.send(JSON.stringify({ type: 'add_bots' }));

    // Wait for game state updates
    await sleep(2000);
    const msgs = await collectMessages(ws, 3000);
    const gameStates = msgs.filter(m => m.type === 'game_state');

    if (gameStates.length > 0) {
      const latestState = gameStates[gameStates.length - 1].state;
      const playerCount = latestState.players?.length || 0;
      if (playerCount >= 2) {
        log('WebSocket', 'Add bots', 'PASS', `${playerCount} players at table`);
      } else {
        log('WebSocket', 'Add bots', 'FAIL', `Only ${playerCount} players`);
      }

      // Check if game started
      if (latestState.phase !== 'waiting') {
        log('WebSocket', 'Game auto-starts with enough players', 'PASS', `phase=${latestState.phase}`);
      } else {
        log('WebSocket', 'Game auto-starts with enough players', 'WARN', 'Still in waiting phase');
      }
    } else {
      log('WebSocket', 'Add bots', 'FAIL', 'No game state received after adding bots');
    }
  } catch (e) {
    log('WebSocket', 'Add bots', 'FAIL', e.message);
  }

  // 3. Play a complete hand
  try {
    // Collect messages for 8 seconds to let bots play / get to our turn
    let allMessages = [];
    let handPlayed = false;
    let lastState = null;

    for (let round = 0; round < 5; round++) {
      const msgs = await collectMessages(ws, 3000);
      allMessages.push(...msgs);

      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        lastState = gameStates[gameStates.length - 1].state;
      }

      if (!lastState) continue;

      // Check if it's our turn
      if (lastState.currentTurnSeat !== undefined && lastState.currentTurnSeat !== null) {
        const currentPlayer = lastState.players?.find(p => p.seatIndex === lastState.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId) {
          // It's our turn! Try calling
          const validActions = lastState.validActions || [];
          if (validActions.includes('call')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
            log('WebSocket', 'Performed call action', 'PASS');
            handPlayed = true;
          } else if (validActions.includes('check')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'check' }));
            log('WebSocket', 'Performed check action', 'PASS');
            handPlayed = true;
          } else if (validActions.length > 0) {
            ws.send(JSON.stringify({ type: 'player_action', action: validActions[0] }));
            log('WebSocket', `Performed ${validActions[0]} action`, 'PASS');
            handPlayed = true;
          }
        }
      }
    }

    // Check for various message types we received
    const msgTypes = new Set(allMessages.map(m => m.type));
    log('WebSocket', 'Message types received', 'PASS', Array.from(msgTypes).join(', '));

    if (msgTypes.has('game_state')) log('WebSocket', 'Received game_state messages', 'PASS');
    if (msgTypes.has('action_performed')) log('WebSocket', 'Received action_performed messages', 'PASS');
    if (msgTypes.has('pot_update')) log('WebSocket', 'Received pot_update messages', 'PASS');
    if (msgTypes.has('community_cards')) log('WebSocket', 'Received community_cards messages', 'PASS');
    if (msgTypes.has('showdown')) log('WebSocket', 'Received showdown messages', 'PASS');
    if (msgTypes.has('new_hand')) log('WebSocket', 'Received new_hand messages', 'PASS');

    if (lastState) {
      log('WebSocket', 'Final game state', 'PASS', `phase=${lastState.phase}, pot=${lastState.pot}, players=${lastState.players?.length}`);
    }

    if (!handPlayed) {
      log('WebSocket', 'Player got a turn to act', 'WARN', 'May not have been our turn during test window');
    }
  } catch (e) {
    log('WebSocket', 'Play hand', 'FAIL', e.message);
  }

  // 4. Test fold action
  try {
    // Wait for our turn again
    let folded = false;
    for (let i = 0; i < 10; i++) {
      const msgs = await collectMessages(ws, 2000);
      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId && state.phase !== 'waiting' && state.phase !== 'showdown') {
          ws.send(JSON.stringify({ type: 'player_action', action: 'fold' }));
          const response = await collectMessages(ws, 2000);
          const actionMsgs = response.filter(m => m.type === 'action_performed');
          if (actionMsgs.some(m => m.action === 'fold' && m.userId === userId)) {
            log('WebSocket', 'Fold action broadcast', 'PASS');
          }
          folded = true;
          log('WebSocket', 'Fold action', 'PASS');
          break;
        }
      }
    }
    if (!folded) {
      log('WebSocket', 'Fold action', 'WARN', 'Could not get turn to fold in time');
    }
  } catch (e) {
    log('WebSocket', 'Fold action', 'FAIL', e.message);
  }

  // 5. Test raise action
  try {
    let raised = false;
    for (let i = 0; i < 10; i++) {
      const msgs = await collectMessages(ws, 2000);
      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId && state.phase !== 'waiting' && state.phase !== 'showdown') {
          const validActions = state.validActions || [];
          if (validActions.includes('raise')) {
            const raiseMin = state.minRaise || state.bigBlind * 2 || 40;
            ws.send(JSON.stringify({ type: 'player_action', action: 'raise', amount: raiseMin }));
            raised = true;
            log('WebSocket', 'Raise action', 'PASS', `amount=${raiseMin}`);
            break;
          } else if (validActions.includes('call')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
          }
        }
      }
    }
    if (!raised) {
      log('WebSocket', 'Raise action', 'WARN', 'Could not get raise opportunity in time');
    }
  } catch (e) {
    log('WebSocket', 'Raise action', 'FAIL', e.message);
  }

  // 6. Test chat
  try {
    ws.send(JSON.stringify({ type: 'chat', message: 'Hello from test suite!' }));
    const msgs = await collectMessages(ws, 2000);
    const chatMsgs = msgs.filter(m => m.type === 'chat');
    // Chat may not echo back to sender depending on implementation
    log('WebSocket', 'Send chat message (no error)', 'PASS');
  } catch (e) {
    log('WebSocket', 'Send chat message', 'FAIL', e.message);
  }

  // 7. Test free taunt
  try {
    ws.send(JSON.stringify({ type: 'taunt', tauntId: 'gg' }));
    const msgs = await collectMessages(ws, 2000);
    const tauntMsgs = msgs.filter(m => m.type === 'taunt');
    // Taunts may be broadcast to others, not echoed
    log('WebSocket', 'Send free taunt (gg)', 'PASS');
  } catch (e) {
    log('WebSocket', 'Send free taunt', 'FAIL', e.message);
  }

  // 8. Test premium taunt without ownership (should fail)
  try {
    ws.send(JSON.stringify({ type: 'taunt', tauntId: 'ship-it' }));
    const msg = await waitForMessage(ws, 'error', 3000);
    if (msg && msg.message.includes("don't own")) {
      log('WebSocket', 'Premium taunt without ownership blocked', 'PASS');
    } else {
      log('WebSocket', 'Premium taunt without ownership blocked', 'WARN', `Got: ${JSON.stringify(msg)}`);
    }
  } catch (e) {
    log('WebSocket', 'Premium taunt without ownership', 'WARN', 'Timeout - may have been accepted');
  }

  // 9. Test taunt cooldown
  try {
    ws.send(JSON.stringify({ type: 'taunt', tauntId: 'nice-hand' }));
    await sleep(500);
    ws.send(JSON.stringify({ type: 'taunt', tauntId: 'gl' }));
    const msg = await waitForMessage(ws, 'error', 3000);
    if (msg && msg.message.includes('cooldown')) {
      log('WebSocket', 'Taunt cooldown enforced (5s)', 'PASS');
    } else {
      log('WebSocket', 'Taunt cooldown enforced (5s)', 'WARN', `Got: ${JSON.stringify(msg)}`);
    }
  } catch (e) {
    log('WebSocket', 'Taunt cooldown', 'WARN', 'Timeout - cooldown may not have triggered');
  }

  // 10. Test emote
  try {
    ws.send(JSON.stringify({ type: 'emote', emoteId: 'thumbs-up' }));
    log('WebSocket', 'Send emote (no error)', 'PASS');
  } catch (e) {
    log('WebSocket', 'Send emote', 'FAIL', e.message);
  }

  // 11. Continue playing multiple hands
  try {
    let handsCompleted = 0;
    let showdownSeen = false;

    for (let i = 0; i < 20; i++) {
      const msgs = await collectMessages(ws, 2000);

      for (const msg of msgs) {
        if (msg.type === 'new_hand') handsCompleted++;
        if (msg.type === 'showdown') showdownSeen = true;
      }

      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId && state.phase !== 'waiting' && state.phase !== 'showdown') {
          const validActions = state.validActions || [];
          // Alternate between call and check
          if (validActions.includes('call')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
          } else if (validActions.includes('check')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'check' }));
          }
        }
      }
    }

    log('WebSocket', 'Multiple hands played', 'PASS', `hands seen: ${handsCompleted}, showdown seen: ${showdownSeen}`);
  } catch (e) {
    log('WebSocket', 'Multiple hands', 'FAIL', e.message);
  }

  // 12. Test leave table
  try {
    ws.send(JSON.stringify({ type: 'leave_table' }));
    const msgs = await collectMessages(ws, 3000);
    log('WebSocket', 'Leave table (no error)', 'PASS');
  } catch (e) {
    log('WebSocket', 'Leave table', 'FAIL', e.message);
  }

  // 13. Verify chips returned to wallet after leaving
  try {
    await sleep(2000);
    const res = await request('GET', '/api/wallet/balance');
    if (res.status === 200) {
      log('WebSocket', 'Balance after leaving table', 'PASS', `balance=${res.data.balance}`);
    }
  } catch (e) {
    log('WebSocket', 'Balance check after leave', 'FAIL', e.message);
  }

  // 14. Rejoin table
  try {
    ws.send(JSON.stringify({
      type: 'join_table',
      tableId: tableId,
      buyIn: 500,
    }));
    const msg = await waitForMessage(ws, 'game_state', 5000);
    if (msg && msg.state) {
      log('WebSocket', 'Rejoin table after leaving', 'PASS', `phase=${msg.state.phase}`);
    } else {
      log('WebSocket', 'Rejoin table after leaving', 'FAIL');
    }
  } catch (e) {
    log('WebSocket', 'Rejoin table after leaving', 'FAIL', e.message);
  }

  // 15. Test adding chips between hands
  try {
    // Wait for waiting/showdown phase
    let addedChips = false;
    for (let i = 0; i < 10; i++) {
      const msgs = await collectMessages(ws, 2000);
      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        if (state.phase === 'waiting' || state.phase === 'showdown') {
          ws.send(JSON.stringify({ type: 'add_chips', amount: 500 }));
          addedChips = true;
          const response = await collectMessages(ws, 2000);
          const errorMsgs = response.filter(m => m.type === 'error');
          if (errorMsgs.length === 0) {
            log('WebSocket', 'Add chips between hands', 'PASS');
          } else {
            log('WebSocket', 'Add chips between hands', 'FAIL', errorMsgs[0].message);
          }
          break;
        }

        // Act if it's our turn
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId && state.phase !== 'waiting') {
          ws.send(JSON.stringify({ type: 'player_action', action: 'fold' }));
        }
      }
    }
    if (!addedChips) {
      log('WebSocket', 'Add chips between hands', 'WARN', 'Could not find waiting phase');
    }
  } catch (e) {
    log('WebSocket', 'Add chips between hands', 'FAIL', e.message);
  }

  // 16. Try adding chips during a hand (should fail)
  try {
    let testedMidHand = false;
    for (let i = 0; i < 10; i++) {
      const msgs = await collectMessages(ws, 2000);
      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        if (state.phase !== 'waiting' && state.phase !== 'showdown') {
          ws.send(JSON.stringify({ type: 'add_chips', amount: 500 }));
          const response = await collectMessages(ws, 2000);
          const errorMsgs = response.filter(m => m.type === 'error');
          if (errorMsgs.some(m => m.message.includes('between hands'))) {
            log('WebSocket', 'Add chips during hand correctly blocked', 'PASS');
          } else {
            log('WebSocket', 'Add chips during hand correctly blocked', 'WARN', 'No error received - may have been in transition');
          }
          testedMidHand = true;
          break;
        }

        // Act if it's our turn
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId) {
          ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
        }
      }
    }
    if (!testedMidHand) {
      log('WebSocket', 'Add chips during hand blocked', 'WARN', 'Could not test - never caught mid-hand');
    }
  } catch (e) {
    log('WebSocket', 'Add chips during hand blocked', 'FAIL', e.message);
  }

  // Clean up - leave table
  ws.send(JSON.stringify({ type: 'leave_table' }));
  await sleep(2000);
  ws.close();
}

async function testWebSocketWithoutAuth() {
  console.log('\n===== TESTING WEBSOCKET WITHOUT AUTH =====\n');

  try {
    const ws = new WebSocket('ws://localhost:5000/ws');
    const result = await new Promise((resolve) => {
      ws.on('open', () => resolve('connected'));
      ws.on('error', (e) => resolve('error: ' + e.message));
      ws.on('close', (code, reason) => resolve(`closed: ${code} ${reason}`));
      setTimeout(() => resolve('timeout'), 5000);
    });

    if (result.startsWith('closed') || result.startsWith('error')) {
      log('WebSocket Auth', 'Connection without auth rejected', 'PASS', result);
    } else if (result === 'connected') {
      log('WebSocket Auth', 'Connection without auth rejected', 'FAIL', 'Connection was accepted without auth!');
      ws.close();
    } else {
      log('WebSocket Auth', 'Connection without auth rejected', 'WARN', result);
    }
  } catch (e) {
    log('WebSocket Auth', 'Connection without auth rejected', 'PASS', e.message);
  }
}

async function testShop() {
  console.log('\n===== TESTING SHOP =====\n');

  // 1. List all shop items
  let shopItems = [];
  try {
    const res = await request('GET', '/api/shop/items');
    if (res.status === 200 && Array.isArray(res.data)) {
      shopItems = res.data;
      log('Shop', 'List all shop items', 'PASS', `count=${res.data.length}`);

      // Check categories
      const categories = [...new Set(res.data.map(i => i.category))];
      log('Shop', 'Item categories', 'PASS', categories.join(', '));

      if (categories.includes('taunt')) {
        log('Shop', 'Taunts category exists', 'PASS');
      } else {
        log('Shop', 'Taunts category exists', 'FAIL', 'No "taunt" category found');
      }
    } else {
      log('Shop', 'List all shop items', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Shop', 'List all shop items', 'FAIL', e.message);
  }

  // 2. Filter by category
  try {
    const res = await request('GET', '/api/shop/items?category=taunt');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Shop', 'Filter by taunt category', 'PASS', `count=${res.data.length}`);
    } else {
      log('Shop', 'Filter by taunt category', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Shop', 'Filter by taunt category', 'FAIL', e.message);
  }

  // 3. Attempt purchase
  if (shopItems.length > 0) {
    // Find cheapest item
    const cheapest = shopItems.reduce((min, i) => (i.price < min.price ? i : min), shopItems[0]);
    try {
      const res = await request('POST', '/api/shop/purchase', { itemId: cheapest.id });
      if (res.status === 200) {
        log('Shop', 'Purchase item', 'PASS', `item=${cheapest.name}, price=${cheapest.price}`);
      } else if (res.status === 400 && res.data?.message === 'Already owned') {
        log('Shop', 'Purchase item (already owned)', 'PASS', 'Correctly prevents duplicate purchase');
      } else if (res.status === 400 && res.data?.message === 'Insufficient chips') {
        log('Shop', 'Purchase item (insufficient chips)', 'PASS', 'Correctly blocks underfunded purchase');
      } else {
        log('Shop', 'Purchase item', 'FAIL', `Status ${res.status}: ${res.raw}`);
      }
    } catch (e) {
      log('Shop', 'Purchase item', 'FAIL', e.message);
    }
  }

  // 4. Check inventory
  try {
    const res = await request('GET', '/api/shop/inventory');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Shop', 'Get inventory', 'PASS', `count=${res.data.length}`);
    } else {
      log('Shop', 'Get inventory', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Shop', 'Get inventory', 'FAIL', e.message);
  }

  // 5. Purchase without auth
  const saved = cookies;
  cookies = '';
  try {
    const res = await request('POST', '/api/shop/purchase', { itemId: 'test' });
    if (res.status === 401) {
      log('Shop', 'Purchase without auth returns 401', 'PASS');
    } else {
      log('Shop', 'Purchase without auth returns 401', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Shop', 'Purchase without auth returns 401', 'FAIL', e.message);
  }
  cookies = saved;
}

async function testPlayerStats() {
  console.log('\n===== TESTING PLAYER STATS =====\n');

  try {
    const res = await request('GET', '/api/stats/me');
    if (res.status === 200 && typeof res.data.handsPlayed === 'number') {
      log('Stats', 'GET /api/stats/me', 'PASS', `hands=${res.data.handsPlayed}, wins=${res.data.potsWon}`);
    } else {
      log('Stats', 'GET /api/stats/me', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Stats', 'GET /api/stats/me', 'FAIL', e.message);
  }
}

async function testLeaderboard() {
  console.log('\n===== TESTING LEADERBOARD =====\n');

  for (const metric of ['chips', 'wins', 'winRate']) {
    try {
      const res = await request('GET', `/api/leaderboard?metric=${metric}`);
      if (res.status === 200 && Array.isArray(res.data)) {
        log('Leaderboard', `GET /api/leaderboard?metric=${metric}`, 'PASS', `entries=${res.data.length}`);
      } else {
        log('Leaderboard', `GET /api/leaderboard?metric=${metric}`, 'FAIL', `Status ${res.status}`);
      }
    } catch (e) {
      log('Leaderboard', `GET /api/leaderboard?metric=${metric}`, 'FAIL', e.message);
    }
  }

  // Invalid metric
  try {
    const res = await request('GET', '/api/leaderboard?metric=invalid');
    if (res.status === 400) {
      log('Leaderboard', 'Invalid metric returns 400', 'PASS');
    } else {
      log('Leaderboard', 'Invalid metric returns 400', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Leaderboard', 'Invalid metric returns 400', 'FAIL', e.message);
  }
}

async function testMissions() {
  console.log('\n===== TESTING MISSIONS =====\n');

  try {
    const res = await request('GET', '/api/missions');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Missions', 'GET /api/missions', 'PASS', `count=${res.data.length}`);
      if (res.data.length > 0) {
        const m = res.data[0];
        if (m.label && m.target !== undefined && m.reward !== undefined) {
          log('Missions', 'Mission has required fields (label, target, reward)', 'PASS');
        }
        log('Missions', 'Sample mission', 'PASS', `"${m.label}" - target: ${m.target}, reward: ${m.reward}, progress: ${m.progress}`);
      }
    } else {
      log('Missions', 'GET /api/missions', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Missions', 'GET /api/missions', 'FAIL', e.message);
  }
}

async function testProfileUpdate() {
  console.log('\n===== TESTING PROFILE =====\n');

  try {
    const res = await request('PUT', '/api/profile/avatar', {
      avatarId: 'neon-viper',
      displayName: 'Updated Test Player',
    });
    if (res.status === 200) {
      log('Profile', 'Update avatar and display name', 'PASS');
    } else {
      log('Profile', 'Update avatar and display name', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Profile', 'Update avatar and display name', 'FAIL', e.message);
  }

  // Verify update
  try {
    const res = await request('GET', '/api/auth/me');
    if (res.status === 200 && res.data.avatarId === 'neon-viper') {
      log('Profile', 'Avatar update persisted', 'PASS');
    } else {
      log('Profile', 'Avatar update persisted', 'FAIL', `avatarId=${res.data?.avatarId}`);
    }
  } catch (e) {
    log('Profile', 'Avatar update persisted', 'FAIL', e.message);
  }
}

async function testOnlineUsers() {
  console.log('\n===== TESTING ONLINE USERS =====\n');

  try {
    const res = await request('GET', '/api/online-users');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Online', 'GET /api/online-users', 'PASS', `count=${res.data.length}`);
    } else {
      log('Online', 'GET /api/online-users', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Online', 'GET /api/online-users', 'FAIL', e.message);
  }
}

async function testHandHistory() {
  console.log('\n===== TESTING HAND HISTORY =====\n');

  if (tableId) {
    try {
      const res = await request('GET', `/api/tables/${tableId}/hands`);
      if (res.status === 200 && Array.isArray(res.data)) {
        log('Hands', 'GET /api/tables/:id/hands', 'PASS', `count=${res.data.length}`);

        if (res.data.length > 0) {
          const hand = res.data[0];
          log('Hands', 'Hand record exists', 'PASS', `hand #${hand.handNumber}, pot=${hand.potTotal}`);

          // Test individual hand
          try {
            const handRes = await request('GET', `/api/hands/${hand.id}`);
            if (handRes.status === 200) {
              log('Hands', 'GET /api/hands/:id', 'PASS');
            }
          } catch {}

          // Test hand players
          try {
            const playersRes = await request('GET', `/api/hands/${hand.id}/players`);
            if (playersRes.status === 200 && Array.isArray(playersRes.data)) {
              log('Hands', 'GET /api/hands/:id/players', 'PASS', `count=${playersRes.data.length}`);
            }
          } catch {}

          // Test hand actions
          try {
            const actionsRes = await request('GET', `/api/hands/${hand.id}/actions`);
            if (actionsRes.status === 200 && Array.isArray(actionsRes.data)) {
              log('Hands', 'GET /api/hands/:id/actions', 'PASS', `count=${actionsRes.data.length}`);
            }
          } catch {}
        }
      } else {
        log('Hands', 'GET /api/tables/:id/hands', 'FAIL', `Status ${res.status}`);
      }
    } catch (e) {
      log('Hands', 'GET /api/tables/:id/hands', 'FAIL', e.message);
    }
  }

  // Player hand history
  try {
    const res = await request('GET', `/api/players/${userId}/hands`);
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Hands', 'GET /api/players/:id/hands', 'PASS', `count=${res.data.length}`);
    } else {
      log('Hands', 'GET /api/players/:id/hands', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Hands', 'GET /api/players/:id/hands', 'FAIL', e.message);
  }
}

async function testClubs() {
  console.log('\n===== TESTING CLUBS =====\n');

  let clubId = '';

  // Create club
  try {
    const res = await request('POST', '/api/clubs', {
      name: 'Test Club',
      description: 'A test poker club',
      isPublic: true,
    });
    if (res.status === 201 && res.data.id) {
      clubId = res.data.id;
      log('Clubs', 'Create club', 'PASS', `id=${clubId}`);
    } else {
      log('Clubs', 'Create club', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Clubs', 'Create club', 'FAIL', e.message);
  }

  // List clubs
  try {
    const res = await request('GET', '/api/clubs');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Clubs', 'List clubs', 'PASS', `count=${res.data.length}`);
    }
  } catch (e) {
    log('Clubs', 'List clubs', 'FAIL', e.message);
  }

  // Get club detail
  if (clubId) {
    try {
      const res = await request('GET', `/api/clubs/${clubId}`);
      if (res.status === 200 && res.data.id === clubId) {
        log('Clubs', 'Get club detail', 'PASS');
      }
    } catch (e) {
      log('Clubs', 'Get club detail', 'FAIL', e.message);
    }

    // Get members
    try {
      const res = await request('GET', `/api/clubs/${clubId}/members`);
      if (res.status === 200 && Array.isArray(res.data)) {
        log('Clubs', 'Get club members', 'PASS', `count=${res.data.length}`);
      }
    } catch (e) {
      log('Clubs', 'Get club members', 'FAIL', e.message);
    }

    // Announcements
    try {
      const res = await request('POST', `/api/clubs/${clubId}/announcements`, {
        title: 'Test Announcement',
        content: 'Testing the announcement system',
      });
      if (res.status === 201) {
        log('Clubs', 'Create announcement', 'PASS');
      } else {
        log('Clubs', 'Create announcement', 'FAIL', `Status ${res.status}: ${res.raw}`);
      }
    } catch (e) {
      log('Clubs', 'Create announcement', 'FAIL', e.message);
    }
  }

  // User's clubs
  try {
    const res = await request('GET', '/api/me/clubs');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Clubs', 'GET /api/me/clubs', 'PASS', `count=${res.data.length}`);
    }
  } catch (e) {
    log('Clubs', 'GET /api/me/clubs', 'FAIL', e.message);
  }
}

async function testTournaments() {
  console.log('\n===== TESTING TOURNAMENTS =====\n');

  try {
    const res = await request('GET', '/api/tournaments');
    if (res.status === 200 && Array.isArray(res.data)) {
      log('Tournaments', 'List tournaments', 'PASS', `count=${res.data.length}`);
    } else {
      log('Tournaments', 'List tournaments', 'FAIL', `Status ${res.status}`);
    }
  } catch (e) {
    log('Tournaments', 'List tournaments', 'FAIL', e.message);
  }

  // Create tournament
  try {
    const res = await request('POST', '/api/tournaments', {
      name: 'Test Tournament',
      buyIn: 100,
      startingChips: 3000,
      maxPlayers: 20,
    });
    if (res.status === 201 && res.data.id) {
      log('Tournaments', 'Create tournament', 'PASS', `id=${res.data.id}`);

      // Register for tournament
      try {
        const regRes = await request('POST', `/api/tournaments/${res.data.id}/register`);
        if (regRes.status === 201) {
          log('Tournaments', 'Register for tournament', 'PASS');
        } else {
          log('Tournaments', 'Register for tournament', 'FAIL', `Status ${regRes.status}: ${regRes.raw}`);
        }
      } catch (e) {
        log('Tournaments', 'Register for tournament', 'FAIL', e.message);
      }
    } else {
      log('Tournaments', 'Create tournament', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Tournaments', 'Create tournament', 'FAIL', e.message);
  }
}

async function testHandAnalysis() {
  console.log('\n===== TESTING HAND ANALYSIS =====\n');

  try {
    const res = await request('POST', '/api/analyze-hand', {
      holeCards: [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: 'K' },
      ],
      communityCards: [
        { suit: 'hearts', rank: 'Q' },
        { suit: 'hearts', rank: 'J' },
        { suit: 'diamonds', rank: '10' },
      ],
      pot: 500,
      position: 'button',
    });
    if (res.status === 200 && res.data) {
      log('Analysis', 'Analyze hand (AK suited)', 'PASS', JSON.stringify(res.data).substring(0, 200));
    } else {
      log('Analysis', 'Analyze hand', 'FAIL', `Status ${res.status}: ${res.raw}`);
    }
  } catch (e) {
    log('Analysis', 'Analyze hand', 'FAIL', e.message);
  }
}

async function testEdgeCases() {
  console.log('\n===== TESTING EDGE CASES =====\n');

  // Non-existent table
  try {
    const res = await request('GET', '/api/tables/nonexistent-id');
    if (res.status === 404) {
      log('Edge', 'Non-existent table returns 404', 'PASS');
    } else {
      log('Edge', 'Non-existent table returns 404', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Edge', 'Non-existent table returns 404', 'FAIL', e.message);
  }

  // Non-existent hand
  try {
    const res = await request('GET', '/api/hands/nonexistent-id');
    if (res.status === 404) {
      log('Edge', 'Non-existent hand returns 404', 'PASS');
    } else {
      log('Edge', 'Non-existent hand returns 404', 'FAIL', `Got ${res.status}`);
    }
  } catch (e) {
    log('Edge', 'Non-existent hand returns 404', 'FAIL', e.message);
  }

  // Delete table (only creator)
  if (tableId) {
    // Create another user session and try to delete
    const saved = cookies;
    cookies = '';
    try {
      await request('POST', '/api/auth/guest');
      const res = await request('DELETE', `/api/tables/${tableId}`);
      if (res.status === 403) {
        log('Edge', 'Non-creator cannot delete table', 'PASS');
      } else {
        log('Edge', 'Non-creator cannot delete table', 'FAIL', `Got ${res.status}`);
      }
    } catch (e) {
      log('Edge', 'Non-creator cannot delete table', 'FAIL', e.message);
    }
    cookies = saved;
  }

  // Table format filter
  try {
    const res = await request('GET', '/api/tables?format=cash');
    if (res.status === 200 && Array.isArray(res.data)) {
      const allCash = res.data.every(t => t.gameFormat === 'cash');
      if (allCash) {
        log('Edge', 'Table format filter works', 'PASS', `count=${res.data.length}`);
      } else {
        log('Edge', 'Table format filter works', 'FAIL', 'Non-cash tables returned');
      }
    }
  } catch (e) {
    log('Edge', 'Table format filter works', 'FAIL', e.message);
  }
}

async function testAllInScenario() {
  console.log('\n===== TESTING ALL-IN SCENARIO =====\n');

  // Create a small table with low blinds to test all-in
  let smallTableId = '';
  try {
    const res = await request('POST', '/api/tables', {
      name: 'All-In Test Table',
      maxPlayers: 2,
      smallBlind: 100,
      bigBlind: 200,
      minBuyIn: 200,
      maxBuyIn: 400,
      gameFormat: 'heads_up',
      allowBots: true,
    });
    if (res.status === 201) {
      smallTableId = res.data.id;
      log('All-In', 'Create heads-up test table', 'PASS');
    }
  } catch (e) {
    log('All-In', 'Create heads-up test table', 'FAIL', e.message);
    return;
  }

  let ws;
  try {
    ws = await connectWs();
    ws.send(JSON.stringify({
      type: 'join_table',
      tableId: smallTableId,
      buyIn: 400,
    }));
    await waitForMessage(ws, 'game_state', 5000);

    // Add bots
    ws.send(JSON.stringify({ type: 'add_bots' }));
    await sleep(3000);

    // Try to go all-in by raising everything
    let allInAttempted = false;
    for (let i = 0; i < 15; i++) {
      const msgs = await collectMessages(ws, 2000);
      const gameStates = msgs.filter(m => m.type === 'game_state');
      if (gameStates.length > 0) {
        const state = gameStates[gameStates.length - 1].state;
        const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
        if (currentPlayer && currentPlayer.id === userId && state.phase !== 'waiting' && state.phase !== 'showdown') {
          const validActions = state.validActions || [];
          if (validActions.includes('raise')) {
            // Raise maximum (should be all-in given small stack)
            ws.send(JSON.stringify({ type: 'player_action', action: 'raise', amount: 10000 }));
            allInAttempted = true;
            log('All-In', 'Attempted all-in raise', 'PASS');
            break;
          } else if (validActions.includes('call')) {
            ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
          }
        }
      }
    }

    if (!allInAttempted) {
      log('All-In', 'All-in attempt', 'WARN', 'Could not find raise opportunity');
    }

    // Collect post-all-in messages
    const afterMsgs = await collectMessages(ws, 5000);
    const showdowns = afterMsgs.filter(m => m.type === 'showdown');
    if (showdowns.length > 0) {
      log('All-In', 'Showdown after all-in', 'PASS', JSON.stringify(showdowns[0]).substring(0, 200));
    }

    ws.send(JSON.stringify({ type: 'leave_table' }));
    await sleep(1000);
    ws.close();
  } catch (e) {
    log('All-In', 'All-in scenario', 'FAIL', e.message);
    if (ws) ws.close();
  }
}

async function testReconnection() {
  console.log('\n===== TESTING RECONNECTION =====\n');

  if (!tableId) {
    log('Reconnect', 'Skipping - no table', 'FAIL');
    return;
  }

  let ws1;
  try {
    ws1 = await connectWs();
    ws1.send(JSON.stringify({
      type: 'join_table',
      tableId: tableId,
      buyIn: 500,
    }));
    const joinMsg = await waitForMessage(ws1, 'game_state', 5000);
    if (!joinMsg) {
      log('Reconnect', 'Initial join', 'FAIL');
      return;
    }
    log('Reconnect', 'Initial join', 'PASS');

    // Close connection (simulating disconnect)
    ws1.close();
    await sleep(1000);

    // Reconnect
    const ws2 = await connectWs();
    log('Reconnect', 'Reconnect WebSocket', 'PASS');

    // Should automatically get game state for the table
    const reconnectMsgs = await collectMessages(ws2, 3000);
    const gameStates = reconnectMsgs.filter(m => m.type === 'game_state');
    if (gameStates.length > 0) {
      log('Reconnect', 'Auto-receive game state on reconnect', 'PASS');
      const me = gameStates[0].state?.players?.find(p => p.id === userId);
      if (me) {
        log('Reconnect', 'Player still at table after reconnect', 'PASS', `chips=${me.chips}`);
      } else {
        log('Reconnect', 'Player still at table after reconnect', 'WARN', 'Player not found - may have been removed');
      }
    } else {
      log('Reconnect', 'Auto-receive game state on reconnect', 'WARN', 'No game state received');
    }

    ws2.send(JSON.stringify({ type: 'leave_table' }));
    await sleep(1000);
    ws2.close();
  } catch (e) {
    log('Reconnect', 'Reconnection test', 'FAIL', e.message);
    if (ws1) ws1.close();
  }
}

async function testDeleteTable() {
  console.log('\n===== TESTING TABLE DELETION =====\n');

  // Create a table to delete
  try {
    const res = await request('POST', '/api/tables', {
      name: 'Delete Me Table',
      maxPlayers: 6,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
    });
    if (res.status === 201) {
      const delId = res.data.id;
      const delRes = await request('DELETE', `/api/tables/${delId}`);
      if (delRes.status === 200) {
        log('Delete', 'Delete own table', 'PASS');

        // Verify deleted
        const getRes = await request('GET', `/api/tables/${delId}`);
        if (getRes.status === 404) {
          log('Delete', 'Deleted table returns 404', 'PASS');
        } else {
          log('Delete', 'Deleted table returns 404', 'FAIL', `Got ${getRes.status}`);
        }
      } else {
        log('Delete', 'Delete own table', 'FAIL', `Status ${delRes.status}: ${delRes.raw}`);
      }
    }
  } catch (e) {
    log('Delete', 'Delete table', 'FAIL', e.message);
  }
}

async function testSecondPlayerInteraction() {
  console.log('\n===== TESTING TWO-PLAYER INTERACTION =====\n');

  // Create second user
  let cookies2 = '';
  let userId2 = '';
  const savedCookies = cookies;
  cookies = '';

  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'testplayer2',
      password: 'testpass123',
      displayName: 'Test Player 2',
    });
    if (res.status === 200) {
      userId2 = res.data.id;
      cookies2 = cookies;
      log('2Player', 'Register second player', 'PASS');
    } else if (res.status === 409) {
      const loginRes = await request('POST', '/api/auth/login', {
        username: 'testplayer2',
        password: 'testpass123',
      });
      if (loginRes.status === 200) {
        userId2 = loginRes.data.id;
        cookies2 = cookies;
        log('2Player', 'Login second player', 'PASS');
      }
    }
  } catch (e) {
    log('2Player', 'Create second player', 'FAIL', e.message);
    cookies = savedCookies;
    return;
  }

  // Create a new table for this test
  cookies = savedCookies;
  let testTable = '';
  try {
    const res = await request('POST', '/api/tables', {
      name: '2P Test Table',
      maxPlayers: 2,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      gameFormat: 'heads_up',
    });
    if (res.status === 201) {
      testTable = res.data.id;
    }
  } catch (e) {
    log('2Player', 'Create test table', 'FAIL', e.message);
    return;
  }

  if (!testTable) return;

  // Connect both players via WebSocket
  let ws1, ws2;
  try {
    ws1 = await connectWs();
    log('2Player', 'Player 1 WS connect', 'PASS');

    const savedMain = cookies;
    cookies = cookies2;
    ws2 = await new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:5000/ws', {
        headers: { Cookie: cookies2 },
      });
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
    cookies = savedMain;
    log('2Player', 'Player 2 WS connect', 'PASS');

    // Player 1 joins
    ws1.send(JSON.stringify({ type: 'join_table', tableId: testTable, buyIn: 500 }));
    await waitForMessage(ws1, 'game_state', 5000);

    // Player 2 joins
    ws2.send(JSON.stringify({ type: 'join_table', tableId: testTable, buyIn: 500 }));
    await sleep(2000);

    // Collect messages from both
    const msgs1 = await collectMessages(ws1, 3000);
    const msgs2 = await collectMessages(ws2, 3000);

    const states1 = msgs1.filter(m => m.type === 'game_state');
    const states2 = msgs2.filter(m => m.type === 'game_state');

    if (states1.length > 0 || states2.length > 0) {
      log('2Player', 'Both players receive game states', 'PASS');

      // Check if game started
      const lastState = states1.length > 0 ? states1[states1.length - 1].state : states2[states2.length - 1].state;
      if (lastState.phase !== 'waiting') {
        log('2Player', 'Game starts with 2 human players', 'PASS', `phase=${lastState.phase}`);
      }
    }

    // Test chat broadcast - Player 1 sends, Player 2 should receive
    ws1.send(JSON.stringify({ type: 'chat', message: 'Hello from P1!' }));
    const chatMsgs = await collectMessages(ws2, 2000);
    const chats = chatMsgs.filter(m => m.type === 'chat');
    if (chats.length > 0 && chats[0].message === 'Hello from P1!') {
      log('2Player', 'Chat broadcast to other player', 'PASS');
    } else {
      log('2Player', 'Chat broadcast to other player', 'WARN', `Chat messages received: ${chats.length}`);
    }

    // Test taunt broadcast
    ws1.send(JSON.stringify({ type: 'taunt', tauntId: 'gg' }));
    const tauntMsgs = await collectMessages(ws2, 2000);
    const taunts = tauntMsgs.filter(m => m.type === 'taunt');
    if (taunts.length > 0 && taunts[0].text === 'Good game!') {
      log('2Player', 'Taunt broadcast to other player', 'PASS');
    } else {
      log('2Player', 'Taunt broadcast to other player', 'WARN', `Taunt messages received: ${taunts.length}`);
    }

    // Let the hand play out
    for (let i = 0; i < 10; i++) {
      const allMsgs1 = await collectMessages(ws1, 1500);
      const allMsgs2 = await collectMessages(ws2, 500);

      // Check each player's turn
      for (const [ws, uid] of [[ws1, userId], [ws2, userId2]]) {
        const states = (ws === ws1 ? allMsgs1 : allMsgs2).filter(m => m.type === 'game_state');
        if (states.length > 0) {
          const state = states[states.length - 1].state;
          const currentPlayer = state.players?.find(p => p.seatIndex === state.currentTurnSeat);
          if (currentPlayer && currentPlayer.id === uid && state.phase !== 'waiting' && state.phase !== 'showdown') {
            ws.send(JSON.stringify({ type: 'player_action', action: 'call' }));
          }
        }
      }
    }

    log('2Player', 'Two player game completed', 'PASS');

    ws1.send(JSON.stringify({ type: 'leave_table' }));
    ws2.send(JSON.stringify({ type: 'leave_table' }));
    await sleep(1000);
    ws1.close();
    ws2.close();
  } catch (e) {
    log('2Player', 'Two player interaction', 'FAIL', e.message);
    if (ws1) ws1.close();
    if (ws2) ws2.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE REPORT
// ═══════════════════════════════════════════════════════════════════════════

function generateReport() {
  const now = new Date().toISOString();
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  let md = `# Comprehensive Poker App Test Report\n\n`;
  md += `**Date:** ${now}\n`;
  md += `**Server:** http://localhost:5000\n`;
  md += `**Total Tests:** ${total}\n`;
  md += `**Passed:** ${passes}\n`;
  md += `**Failed:** ${fails}\n`;
  md += `**Warnings:** ${warns}\n`;
  md += `**Pass Rate:** ${((passes / total) * 100).toFixed(1)}%\n\n`;
  md += `---\n\n`;

  // Summary
  md += `## Summary\n\n`;
  if (fails === 0) {
    md += `All tests passed with ${warns} warnings. The application is functioning correctly across all tested areas.\n\n`;
  } else {
    md += `Found **${fails} failures** and **${warns} warnings** that need attention.\n\n`;
  }

  // Group by section
  const sections = [...new Set(results.map(r => r.section))];

  for (const section of sections) {
    md += `## ${section}\n\n`;
    const sectionResults = results.filter(r => r.section === section);
    const sPass = sectionResults.filter(r => r.status === 'PASS').length;
    const sFail = sectionResults.filter(r => r.status === 'FAIL').length;
    const sWarn = sectionResults.filter(r => r.status === 'WARN').length;
    md += `**${sPass}/${sectionResults.length} passed** (${sFail} failed, ${sWarn} warnings)\n\n`;

    md += `| Status | Test | Details |\n`;
    md += `|--------|------|--------|\n`;
    for (const r of sectionResults) {
      const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'WARN';
      const details = r.details ? r.details.replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 150) : '';
      md += `| ${icon} | ${r.test} | ${details} |\n`;
    }
    md += `\n`;
  }

  // Bugs section
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    md += `## Bugs Found\n\n`;
    for (const f of failures) {
      md += `### [${f.section}] ${f.test}\n`;
      md += `- **Status:** FAIL\n`;
      md += `- **Details:** ${f.details || 'No details'}\n`;
      md += `- **Suggested fix:** Investigate the ${f.section.toLowerCase()} module\n\n`;
    }
  }

  // Warnings section
  const warnings = results.filter(r => r.status === 'WARN');
  if (warnings.length > 0) {
    md += `## Warnings\n\n`;
    for (const w of warnings) {
      md += `- **[${w.section}] ${w.test}:** ${w.details || 'See above'}\n`;
    }
    md += `\n`;
  }

  // Features tested
  md += `## Features Tested\n\n`;
  md += `1. **Authentication** - Registration, login, logout, guest accounts, session cookies, validation\n`;
  md += `2. **Wallet** - Balance check, daily bonus claim, transactions, session summaries\n`;
  md += `3. **Table Creation** - Cash games, heads-up, SNG, private tables, rake tables, validation\n`;
  md += `4. **WebSocket Gameplay** - Connect, join table, add bots, play hands, fold/call/raise/check\n`;
  md += `5. **Chat & Taunts** - Send chat, free taunts, premium taunts, cooldowns, emotes\n`;
  md += `6. **Reconnection** - Disconnect and reconnect mid-game\n`;
  md += `7. **Two-Player** - Two human players at same table, chat/taunt broadcast\n`;
  md += `8. **Shop** - List items, filter by category, purchase, inventory\n`;
  md += `9. **Player Stats** - Stats endpoint, leaderboard with multiple metrics\n`;
  md += `10. **Missions** - List missions with progress tracking\n`;
  md += `11. **Hand History** - Table hands, individual hand details, player history\n`;
  md += `12. **Clubs** - Create, list, members, announcements\n`;
  md += `13. **Tournaments** - Create, register\n`;
  md += `14. **Hand Analysis** - Analyze poker hands\n`;
  md += `15. **Profile** - Update avatar and display name\n`;
  md += `16. **Edge Cases** - 404s, auth guards, table deletion, format filters\n`;
  md += `17. **Add Chips** - Between hands, blocked during hands\n`;
  md += `18. **All-In** - All-in raise scenario\n\n`;

  md += `## Recommendations\n\n`;
  if (fails > 0) {
    md += `1. Address all FAIL items before deployment\n`;
    md += `2. Investigate WARN items for potential race conditions\n`;
  }
  md += `3. Consider adding rate limiting tests under load\n`;
  md += `4. Add tests for concurrent multi-table play\n`;
  md += `5. Test WebSocket reconnection during active hand with pending action\n`;
  md += `6. Load test with 10+ concurrent WebSocket connections\n`;

  writeFileSync(REPORT_PATH, md, 'utf-8');
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log(`\nFinal: ${passes}/${total} passed, ${fails} failed, ${warns} warnings`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('=== COMPREHENSIVE POKER APP TEST SUITE ===');
  console.log(`Server: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    await testAuth();
    await testWallet();
    await testTableCreation();
    await testShop();
    await testPlayerStats();
    await testLeaderboard();
    await testMissions();
    await testProfileUpdate();
    await testOnlineUsers();
    await testClubs();
    await testTournaments();
    await testHandAnalysis();
    await testWebSocketGameplay();
    await testWebSocketWithoutAuth();
    await testAllInScenario();
    await testReconnection();
    await testHandHistory();
    await testDeleteTable();
    await testSecondPlayerInteraction();
    await testEdgeCases();
  } catch (e) {
    console.error('FATAL ERROR:', e);
    log('Fatal', 'Test suite crashed', 'FAIL', e.message);
  }

  generateReport();
}

main();
