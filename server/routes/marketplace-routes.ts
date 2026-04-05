import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";

export interface MarketplaceHelpers {
  requireTier: (minTier: string) => RequestHandler;
  tierRank: (tier: string) => number;
  requireAdmin: RequestHandler;
}

export async function registerMarketplaceRoutes(
  app: Express,
  requireAuth: RequestHandler,
  helpers: MarketplaceHelpers,
) {
  const { requireTier, tierRank, requireAdmin } = helpers;

  // ─── Shop Routes ─────────────────────────────────────────────────────
  app.get("/api/shop/items", async (req, res, next) => {
    try {
      const category = req.query.category as string;
      const items = await storage.getShopItems(category || undefined);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/purchase", requireAuth, async (req, res, next) => {
    try {
      const { itemId } = req.body;
      const item = await storage.getShopItem(itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if already owned
      const inventory = await storage.getUserInventory(user.id);
      if (inventory.some(i => i.itemId === itemId)) {
        return res.status(400).json({ message: "Already owned" });
      }

      // Deduct from main wallet for shop purchases
      await storage.ensureWallets(user.id);
      const { success, newBalance: balanceAfterPurchase } = await storage.atomicDeductFromWallet(user.id, "main", item.price);
      if (!success) {
        return res.status(400).json({ message: "Insufficient chips in main wallet" });
      }

      await storage.createTransaction({
        userId: user.id,
        type: "purchase",
        amount: -item.price,
        balanceBefore: balanceAfterPurchase + item.price,
        balanceAfter: balanceAfterPurchase,
        tableId: null,
        description: `Purchased: ${item.name}`,
        walletType: "main",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const inv = await storage.addToInventory(user.id, itemId);

      // Grant bonus chips if item description mentions chips (e.g., VIP Chip Bundle)
      const chipMatch = item.description?.match(/(\d[\d,]*)\s*chips/i);
      if (chipMatch) {
        const bonusChips = parseInt(chipMatch[1].replace(/,/g, ""), 10);
        if (bonusChips > 0) {
          const { success: addOk, newBalance: balAfterBonus } = await storage.atomicAddChips(user.id, bonusChips);
          if (addOk) {
            await storage.createTransaction({
              userId: user.id,
              type: "deposit",
              amount: bonusChips,
              balanceBefore: balAfterBonus - bonusChips,
              balanceAfter: balAfterBonus,
              tableId: null,
              description: `Bonus chips from: ${item.name}`,
              walletType: "bonus",
              relatedTransactionId: null,
              paymentId: null,
              metadata: null,
            });
          }
        }
      }

      res.json({ message: "Purchased", item: inv });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/shop/inventory", requireAuth, async (req, res, next) => {
    try {
      const inventory = await storage.getUserInventory(req.user!.id);
      // Enrich with item data
      const enriched = await Promise.all(
        inventory.map(async (inv) => {
          const item = await storage.getShopItem(inv.itemId);
          return { ...inv, item };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/equip", requireAuth, async (req, res, next) => {
    try {
      const { inventoryId } = req.body;
      await storage.equipItem(inventoryId);
      res.json({ message: "Equipped" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Wishlist Routes (database-persisted) ────────────────────────────
  app.get("/api/shop/wishlist", requireAuth, async (req, res, next) => {
    try {
      const items = await storage.getWishlist(req.user!.id);
      res.json(items);
    } catch (err) { next(err); }
  });

  app.post("/api/shop/wishlist/:itemId", requireAuth, async (req, res, next) => {
    try {
      await storage.addToWishlist(req.user!.id, req.params.itemId);
      res.json({ message: "Added" });
    } catch (err) { next(err); }
  });

  app.delete("/api/shop/wishlist/:itemId", requireAuth, async (req, res, next) => {
    try {
      await storage.removeFromWishlist(req.user!.id, req.params.itemId);
      res.json({ message: "Removed" });
    } catch (err) { next(err); }
  });

  // ─── Avatar Marketplace ────────────────────────────────────────────────
  app.get("/api/marketplace", requireAuth, async (req, res, next) => {
    try {
      const listings = await storage.getListings("active");
      res.json(listings);
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/list", requireAuth, requireTier("silver"), async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // KYC required to sell on marketplace
      if (user.kycStatus !== "verified") {
        return res.status(403).json({
          message: "KYC verification required to sell on the marketplace",
          requiresKyc: true,
        });
      }

      const { itemId, price } = req.body;
      if (!itemId || !price || price < 1) return res.status(400).json({ message: "itemId and price required" });

      // Verify ownership
      const inventory = await storage.getUserInventory(user.id);
      const owns = inventory.find(i => i.itemId === itemId);
      if (!owns) return res.status(400).json({ message: "You don't own this item" });

      // Platinum clubs get reduced marketplace fee: 2.0% vs 2.9%
      const feePercent = tierRank(user.tier) >= tierRank("platinum") ? 0.02 : 0.029;
      const platformFee = Math.max(1, Math.floor(price * feePercent));

      const listing = await storage.createListing({
        sellerId: user.id,
        itemId,
        price,
        status: "active",
        buyerId: null,
        platformFee,
        soldAt: null,
      });
      res.json(listing);
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/:id/buy", requireAuth, requireTier("silver"), async (req, res, next) => {
    try {
      const user = req.user as any;
      const listings = await storage.getListings("active");
      const listing = listings.find(l => l.id === req.params.id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId === user.id) return res.status(400).json({ message: "Cannot buy your own listing" });

      // Use the fee already calculated at listing time
      const fee = listing.platformFee || Math.max(1, Math.floor(listing.price * 0.029));
      const sellerPayout = listing.price - fee;

      // Deduct from buyer
      const deduct = await storage.atomicDeductChips(user.id, listing.price);
      if (!deduct.success) return res.status(400).json({ message: "Insufficient chips" });

      // Pay seller
      await storage.atomicAddChips(listing.sellerId, sellerPayout);

      // Transfer item — remove from seller, give to buyer
      await storage.removeFromInventory(listing.sellerId, listing.itemId);
      await storage.addToInventory(user.id, listing.itemId);

      // Mark sold
      const updated = await storage.buyListing(req.params.id, user.id);
      res.json({ listing: updated, fee, sellerPayout });
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/:id/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const listings = await storage.getListings();
      const listing = listings.find(l => l.id === req.params.id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId !== user.id) return res.status(403).json({ message: "Not your listing" });

      const updated = await storage.cancelListing(req.params.id);
      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── NFT Marketplace Routes ──────────────────────────────────────────────
  // Mint avatar as NFT (platform admin or authorized minter)
  app.post("/api/nft/mint", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { toAddress, metadataURI } = req.body;
      if (!toAddress || !metadataURI) {
        return res.status(400).json({ message: "toAddress and metadataURI required" });
      }

      const { getNFTService } = await import("../nft/nft-service");
      const nftService = getNFTService();
      if (!nftService.isAvailable()) {
        return res.status(503).json({ message: "NFT service not configured" });
      }

      const result = await nftService.mintAvatar(toAddress, metadataURI);
      if (!result) {
        return res.status(500).json({ message: "Minting failed" });
      }

      res.json({
        tokenId: result.tokenId,
        txHash: result.txHash,
        metadataURI,
      });
    } catch (err) { next(err); }
  });

  // Get NFT listing info
  app.get("/api/nft/listing/:tokenId", async (req, res, next) => {
    try {
      const { getNFTService } = await import("../nft/nft-service");
      const nftService = getNFTService();
      if (!nftService.isAvailable()) {
        return res.status(503).json({ message: "NFT service not configured" });
      }

      const listing = await nftService.getListing(req.params.tokenId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      res.json(listing);
    } catch (err) { next(err); }
  });

  // Check NFT marketplace status
  app.get("/api/nft/status", (_req, res) => {
    const configured = !!(process.env.NFT_MARKETPLACE_ADDRESS && process.env.POLYGON_RPC_URL && process.env.POLYGON_WALLET_KEY);
    res.json({
      available: configured,
      contractAddress: process.env.NFT_MARKETPLACE_ADDRESS || null,
      network: process.env.POLYGON_CHAIN_ID === "137" ? "Polygon Mainnet" : "Polygon Testnet",
      defaultFeeBps: 290, // 2.9%
      platinumFeeBps: 200, // 2.0%
    });
  });

  // ─── Staking System ────────────────────────────────────────────────────
  app.get("/api/stakes/my", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const myStakes = await storage.getStakesForPlayer(user.id);
      // Enrich with display names and tournament info
      const enriched = await Promise.all(myStakes.map(async (s) => {
        const [backer, player, tournament] = await Promise.all([
          storage.getUser(s.backerId),
          storage.getUser(s.playerId),
          storage.getTournament(s.tournamentId),
        ]);
        return {
          ...s,
          backerName: backer?.displayName ?? backer?.username ?? s.backerId.slice(0, 8),
          playerName: player?.displayName ?? player?.username ?? s.playerId.slice(0, 8),
          tournamentName: tournament?.name ?? s.tournamentId.slice(0, 8),
          tournamentStatus: tournament?.status ?? "unknown",
        };
      }));
      res.json(enriched);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/offer", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const { playerId, tournamentId, stakePercent, buyInShare } = req.body;
      if (!playerId || !tournamentId || !stakePercent || !buyInShare) {
        return res.status(400).json({ message: "playerId, tournamentId, stakePercent, buyInShare required" });
      }

      // Deduct buy-in share from backer
      const deduct = await storage.atomicDeductChips(user.id, buyInShare);
      if (!deduct.success) return res.status(400).json({ message: "Insufficient chips" });

      const stake = await storage.createStake({
        backerId: user.id,
        playerId,
        tournamentId,
        stakePercent,
        buyInShare,
        status: "pending",
        payout: null,
      });
      res.json(stake);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/accept", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.playerId !== user.id) return res.status(403).json({ message: "Not your stake to accept" });
      if (stake.status !== "pending") return res.status(400).json({ message: "Stake not pending" });

      const updated = await storage.updateStake(req.params.id, { status: "accepted" });
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/settle", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.backerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (stake.status !== "accepted" && stake.status !== "active") {
        return res.status(400).json({ message: "Stake not in settleable state" });
      }

      const { payout } = req.body;
      if (typeof payout !== "number" || payout < 0) return res.status(400).json({ message: "payout required" });

      // Calculate backer's share
      const backerShare = Math.floor(payout * (stake.stakePercent / 100));
      if (backerShare > 0) {
        await storage.atomicAddChips(stake.backerId, backerShare);
      }
      // Player gets the rest
      const playerShare = payout - backerShare;
      if (playerShare > 0) {
        await storage.atomicAddChips(stake.playerId, playerShare);
      }

      const updated = await storage.updateStake(req.params.id, { status: "settled", payout });

      // Notify both backer and player about settlement
      try {
        const backerUser = await storage.getUser(stake.backerId);
        const playerUser = await storage.getUser(stake.playerId);
        const backerName = backerUser?.displayName ?? "Backer";
        const playerName = playerUser?.displayName ?? "Player";
        if (backerShare > 0) {
          await storage.createNotification(
            stake.backerId,
            "leaderboard_change",
            "Stake Settled",
            `Your stake on ${playerName} paid out ${backerShare.toLocaleString()} chips (${stake.stakePercent}% of ${payout.toLocaleString()}).`,
            { stakeId: req.params.id },
          );
        }
        if (playerShare > 0) {
          await storage.createNotification(
            stake.playerId,
            "leaderboard_change",
            "Stake Settled",
            `Stake from ${backerName} settled. You received ${playerShare.toLocaleString()} chips.`,
            { stakeId: req.params.id },
          );
        }
      } catch (_) { /* non-critical */ }

      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.backerId !== user.id && stake.playerId !== user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (stake.status !== "pending" && stake.status !== "accepted") {
        return res.status(400).json({ message: "Cannot cancel at this stage" });
      }

      // Refund backer
      await storage.atomicAddChips(stake.backerId, stake.buyInShare);

      const updated = await storage.updateStake(req.params.id, { status: "cancelled" });
      res.json(updated);
    } catch (err) { next(err); }
  });
}
