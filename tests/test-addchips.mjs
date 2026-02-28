import WebSocket from "ws";
import http from "http";

const BASE = "http://localhost:5000";

async function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; }
    if (cookie) opts.headers["Cookie"] = cookie;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ");
        resolve({ status: res.statusCode, body: JSON.parse(data || "{}"), cookie: setCookie || cookie });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Register
  const reg = await request("POST", "/api/auth/register", { username: "addchips_" + Date.now(), password: "test123" });
  console.log("Register:", reg.status, "balance:", reg.body.chipBalance);
  const cookie = reg.cookie;

  // Create table
  const tbl = await request("POST", "/api/tables", { name: "AddChips Test", smallBlind: 10, bigBlind: 20, minBuyIn: 200, maxBuyIn: 2000 }, cookie);
  console.log("Table:", tbl.status, tbl.body.id?.slice(0,8));
  const tableId = tbl.body.id;

  // Connect WebSocket
  const ws = new WebSocket(`ws://localhost:5000/ws`, { headers: { Cookie: cookie } });
  
  const messages = [];
  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
    if (msg.type === "chips_added") {
      console.log("CHIPS_ADDED received:", JSON.stringify(msg));
    }
  });

  await new Promise((resolve) => ws.on("open", resolve));
  console.log("WS connected");

  // Join table
  ws.send(JSON.stringify({ type: "join_table", tableId, buyIn: 500 }));
  await new Promise(r => setTimeout(r, 500));

  // Check game state
  const gameState = messages.find(m => m.type === "game_state");
  const hero = gameState?.state?.players?.find(p => !p.isBot);
  console.log("Hero chips after join:", hero?.chips);

  // Add chips
  ws.send(JSON.stringify({ type: "add_chips", amount: 300 }));
  await new Promise(r => setTimeout(r, 500));

  // Check for chips_added message
  const chipsMsg = messages.find(m => m.type === "chips_added");
  if (chipsMsg) {
    console.log("PASS: chips_added message received");
    console.log("  amount:", chipsMsg.amount);
    console.log("  newTableStack:", chipsMsg.newTableStack);
    console.log("  newWalletBalance:", chipsMsg.newWalletBalance);
  } else {
    console.log("FAIL: No chips_added message received");
    console.log("Messages:", messages.map(m => m.type));
  }

  // Check balance
  const bal = await request("GET", "/api/wallet/balance", null, cookie);
  console.log("Wallet balance after add:", bal.body.balance);

  ws.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
