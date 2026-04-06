import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, extractFirebaseUid } from "../lib/auth";
import { creditChips, getBalance } from "../lib/wallet";

const router: IRouter = Router();

router.post("/auth/firebase-sync", async (req, res) => {
  const firebaseUid = await extractFirebaseUid(req);

  if (!firebaseUid) {
    res.status(401).json({ error: "Not authenticated with Firebase" });
    return;
  }

  const { displayName, username: requestedUsername, avatarUrl, email } = req.body;
  const baseUsername = requestedUsername || email?.split("@")[0] || firebaseUid.slice(0, 16);

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));

    if (existing) {
      if (displayName || avatarUrl) {
        await db.update(usersTable).set({
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        }).where(eq(usersTable.id, existing.id));
      }

      const balance = await getBalance(existing.id);

      req.session.userId = existing.id;
      req.session.username = existing.username;
      await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

      res.json({
        id: existing.id,
        username: existing.username,
        displayName: displayName || existing.displayName,
        avatarUrl: avatarUrl || existing.avatarUrl,
        level: existing.level,
        gamesPlayed: existing.gamesPlayed,
        gamesWon: existing.gamesWon,
        balance,
      });
      return;
    }

    let finalUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20);
    const [existingByUsername] = await db.select().from(usersTable).where(eq(usersTable.username, finalUsername));
    if (existingByUsername) {
      finalUsername = `${finalUsername}_${Date.now().toString(36).slice(-4)}`;
    }

    const [newUser] = await db.insert(usersTable).values({
      username: finalUsername,
      displayName: displayName || finalUsername,
      avatarUrl: avatarUrl || null,
      firebaseUid,
      passwordHash: "",
    }).returning();

    await creditChips(newUser.id, 10000, "deposit", "Welcome bonus");

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl,
      level: 1,
      gamesPlayed: 0,
      gamesWon: 0,
      balance: 10000,
    });
  } catch (err: any) {
    console.error("Firebase sync error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

router.post("/auth/register", async (req, res) => {
  const { username, password, displayName } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: "Username must be 3-20 characters" });
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const STARTING_CHIPS = 10000;

  const [user] = await db.insert(usersTable).values({
    username: username.toLowerCase(),
    passwordHash,
    displayName: displayName || username,
    level: 1,
    gamesPlayed: 0,
    gamesWon: 0,
  }).returning();

  await creditChips(user.id, STARTING_CHIPS, "deposit", "Welcome bonus");

  req.session.userId = user.id;
  req.session.username = user.username;
  await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  });
});

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    const firebaseUid = await extractFirebaseUid(req);
    if (firebaseUid) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
      if (user) {
        req.session.userId = user.id;
        req.session.username = user.username;
        await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
        res.json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          level: user.level,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
        });
        return;
      }
    }
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    level: user.level,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
  });
});

export default router;
