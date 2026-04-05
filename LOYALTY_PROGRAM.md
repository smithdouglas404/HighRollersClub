# HighRollersClub — Loyalty Program & Shop Expansion

**Date:** 2026-04-05

---

## The Insight

Right now, the only way to get cool stuff is to **buy it with chips**. That means losing players stop engaging — they have no chips, they can't buy anything, they leave. A loyalty program flips this: the more you **play**, the more you **earn**, regardless of whether you're winning or losing. It keeps everyone at the table.

---

## Loyalty Points System: "High Roller Points" (HRP)

### How You Earn HRP

| Activity | HRP Earned | Notes |
|----------|-----------|-------|
| **Play a hand (any result)** | 1 HRP | The core loop — just keep playing |
| **Win a pot** | +2 HRP bonus | Small reward for winning |
| **Play a tournament hand** | 2 HRP | Tournaments are harder to fill — incentivize them |
| **Finish a tournament (any place)** | 10-100 HRP | Scaled by placement |
| **Complete a daily mission** | 25 HRP | Stacks with chip reward |
| **Complete a weekly mission** | 100 HRP | Stacks with chip reward |
| **Play 100 hands in a day** | 50 HRP bonus | "Grinder" bonus |
| **Play 7 consecutive days** | 200 HRP bonus | Streak bonus |
| **Refer a friend who plays 100 hands** | 500 HRP | Referral program |
| **First deposit** | 250 HRP one-time | Onboarding incentive |

**Key principle:** HRP is earned by PLAYING, not by WINNING. A losing player who grinds 500 hands earns more HRP than a winning player who plays 50.

---

## Loyalty Levels (Earned, Not Purchased)

These are **separate from subscription tiers**. A Free-tier player can reach Diamond loyalty. A Platinum subscriber starts at the same loyalty level as everyone else — they just earn faster.

| Level | Name | HRP Required | Badge | Perks |
|-------|------|-------------|-------|-------|
| 1 | **Rookie** | 0 | Bronze chip | Base emotes, 5 starter avatars |
| 2 | **Regular** | 500 | Silver chip | +1 free taunt unlock, custom card back color |
| 3 | **Grinder** | 2,000 | Gold chip | +1 free avatar (rare), "Grinder" profile title |
| 4 | **Shark** | 5,000 | Platinum chip | +1 free table theme, priority seating at bot tables |
| 5 | **High Roller** | 15,000 | Diamond chip | +1 free legendary avatar, exclusive emote pack |
| 6 | **VIP** | 35,000 | Ruby chip | +1 free mythic avatar, animated card back |
| 7 | **Elite** | 75,000 | Sapphire chip | Exclusive profile frame, name glow effect at tables |
| 8 | **Legend** | 150,000 | Emerald chip | Custom seat color at tables, "Legend" title |
| 9 | **Icon** | 300,000 | Obsidian chip | Animated profile background, entrance animation |
| 10 | **Immortal** | 500,000 | Holographic chip | All of the above + exclusive Immortal-only avatar + permanent 1.5x HRP multiplier |

### HRP Multipliers by Subscription Tier

| Subscription | HRP Multiplier | Effect |
|-------------|---------------|--------|
| Free | 1.0x | Base rate |
| Bronze | 1.2x | 20% faster |
| Silver | 1.5x | 50% faster |
| Gold | 2.0x | Double speed |
| Platinum | 3.0x | Triple speed |

This creates a **virtuous cycle**: subscribers earn loyalty rewards faster, which makes the subscription feel more valuable, which drives retention.

---

## Shop Expansion: What's Missing

### Current State
- 8 avatars, 5 themes, 5 emotes, 16 taunts, 3 premium items = **37 items total**
- All priced in chips only
- All have `imageUrl: null`

### What Players Actually Want to Buy

#### Category 1: CARD BACKS (New Category)
Players see their cards every single hand. This is the highest-visibility cosmetic.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Classic Red | Common | Free (default) | — |
| Midnight Black | Common | 300 chips | Loyalty Level 2 |
| Royal Blue | Uncommon | 800 chips | — |
| Gold Foil | Rare | 2,500 chips | — |
| Carbon Fiber | Rare | 3,000 chips | Loyalty Level 4 |
| Holographic | Epic | 5,000 chips | Loyalty Level 6 |
| Animated Fire | Epic | 7,500 chips | — |
| Animated Lightning | Legendary | 12,000 chips | — |
| Animated Galaxy | Mythic | 25,000 chips | Loyalty Level 9 |

#### Category 2: PROFILE FRAMES (New Category)
The border around your avatar at the table and on your profile.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Simple Silver | Common | 200 chips | Free at Level 1 |
| Bronze Laurel | Uncommon | 600 chips | — |
| Gold Crown | Rare | 2,000 chips | — |
| Diamond Ring | Epic | 4,000 chips | Loyalty Level 5 |
| Animated Flame Ring | Legendary | 8,000 chips | — |
| Animated Neon Pulse | Legendary | 10,000 chips | Loyalty Level 7 |
| Holographic Prism | Mythic | 20,000 chips | Loyalty Level 10 |

#### Category 3: TABLE FELT COLORS (Expand Existing)
Add more variety — players spend hours staring at the felt.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Casino Red | Common | 400 chips | — |
| Stealth Black | Uncommon | 1,000 chips | Loyalty Level 3 |
| Purple Velvet | Rare | 2,500 chips | — |
| Animated Starfield | Epic | 6,000 chips | — |
| Animated Lava | Legendary | 12,000 chips | — |

#### Category 4: SEAT EFFECTS (New Category)
Visual effects around your seat at the table.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Subtle Glow | Common | 500 chips | Loyalty Level 2 |
| Smoke Trail | Uncommon | 1,500 chips | — |
| Electric Sparks | Rare | 3,000 chips | — |
| Flame Aura | Epic | 6,000 chips | — |
| Ice Crystal | Epic | 6,000 chips | Loyalty Level 6 |
| Golden Crown Glow | Legendary | 15,000 chips | Loyalty Level 8 |

#### Category 5: WIN CELEBRATIONS (New Category)
What plays when you win a big pot or a tournament.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Chip Cascade (default) | Common | Free | — |
| Confetti Burst | Uncommon | 1,000 chips | Loyalty Level 3 |
| Gold Rain | Rare | 3,000 chips | — |
| Fireworks | Epic | 5,000 chips | — |
| Lightning Strike | Legendary | 10,000 chips | Loyalty Level 7 |
| Nuclear Explosion | Mythic | 20,000 chips | — |

#### Category 6: CHAT EFFECTS (New Category)
Visual flair on your chat messages.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| Standard (default) | Common | Free | — |
| Gold Text | Uncommon | 800 chips | Loyalty Level 4 |
| Animated Border | Rare | 2,000 chips | — |
| Rainbow Text | Epic | 4,000 chips | Loyalty Level 6 |
| Custom Chat Color | Legendary | 8,000 chips | Loyalty Level 8 |

#### Category 7: ENTRANCE ANIMATIONS (New Category)
What plays when you sit down at a table.

| Item | Rarity | Price | Also Earnable? |
|------|--------|-------|---------------|
| None (default) | Common | Free | — |
| Slide In | Common | 300 chips | — |
| Smoke Appear | Uncommon | 1,200 chips | Loyalty Level 3 |
| Portal Open | Rare | 3,500 chips | — |
| Lightning Strike | Epic | 7,000 chips | Loyalty Level 7 |
| Holographic Materialize | Mythic | 15,000 chips | Loyalty Level 9 |

---

## Expanded Emotes & Taunts

### New Emotes (Add to Existing 8)

| Emote | Rarity | Price | Earnable? |
|-------|--------|-------|-----------|
| Ship It | Uncommon | 400 chips | — |
| Slow Roll | Rare | 1,500 chips | Loyalty Level 4 |
| Scared | Common | 200 chips | — |
| Thinking... | Common | 200 chips | Free at Level 1 |
| On Tilt | Rare | 1,500 chips | — |
| Respect | Uncommon | 600 chips | — |
| Crying | Uncommon | 500 chips | — |
| Dancing | Epic | 3,000 chips | Loyalty Level 5 |
| Mic Drop | Legendary | 8,000 chips | Loyalty Level 8 |

### New Premium Taunts (Voice Lines)

| Taunt | Rarity | Price | Earnable? |
|-------|--------|-------|-----------|
| "That's poker, baby" | Rare | 2,000 chips | Loyalty Level 4 |
| "Call the clock!" | Uncommon | 800 chips | — |
| "Running like God" | Epic | 4,000 chips | — |
| "Thanks for the donation" | Legendary | 8,000 chips | — |
| "I always have it" | Rare | 1,500 chips | Loyalty Level 5 |

---

## Battle Pass (Seasonal, 30-day Rotation)

A monthly progression track with free and premium paths. Resets every 30 days.

### Free Track (Available to Everyone)
| Level | HRP Needed | Reward |
|-------|-----------|--------|
| 5 | 250 | 500 chips |
| 10 | 500 | Random common card back |
| 15 | 750 | 1,000 chips |
| 20 | 1,000 | Random uncommon emote |
| 25 | 1,250 | 2,000 chips |
| 30 | 1,500 | Random rare avatar |
| 40 | 2,000 | 5,000 chips |
| 50 | 2,500 | Exclusive seasonal avatar (changes monthly) |

### Premium Track ($9.99 or 10,000 chips — unlocks bonus rewards at each level)
| Level | Additional Reward |
|-------|-------------------|
| 5 | +1,000 chips |
| 10 | Exclusive card back (seasonal) |
| 15 | +2,000 chips |
| 20 | Exclusive emote (seasonal) |
| 25 | +3,000 chips |
| 30 | Exclusive table theme (seasonal) |
| 40 | +5,000 chips + exclusive frame |
| 50 | Exclusive MYTHIC avatar (only available this season) |

**Why this works:** The free track gives casual players a reason to log in daily. The premium track gives whales exclusive seasonal items that can never be obtained again — creating FOMO and collectibility.

---

## Achievement System (Permanent Unlocks)

Badges that show on your profile permanently once earned.

### Poker Achievements
| Achievement | Requirement | Reward |
|------------|-------------|--------|
| First Blood | Win your first hand | 100 HRP + "First Blood" badge |
| Century | Play 100 hands | 200 HRP + 500 chips |
| Millennium | Play 1,000 hands | 500 HRP + 2,000 chips |
| Iron Player | Play 10,000 hands | 2,000 HRP + exclusive avatar |
| The Grind | Play 100,000 hands | 10,000 HRP + "The Grind" animated badge |
| Royal Flush | Hit a royal flush | 1,000 HRP + "Royal" badge |
| Straight Flush | Hit a straight flush | 500 HRP |
| Quad Aces | Hit four aces | 300 HRP |
| Full House 50 | Win 50 pots with a full house | 500 HRP |
| Bluff Master | Win 10 showdowns with bottom pair or worse | 750 HRP + "Bluffer" title |
| Comeback Kid | Win a pot after being <10% equity on the flop | 500 HRP |

### Tournament Achievements
| Achievement | Requirement | Reward |
|------------|-------------|--------|
| Tournament Virgin | Play first tournament | 100 HRP |
| Final Table | Reach a final table | 300 HRP + badge |
| Champion | Win a tournament | 1,000 HRP + crown badge |
| Triple Crown | Win 3 different tournament formats | 2,000 HRP + exclusive frame |
| Road to Glory | Win 10 tournaments | 5,000 HRP + animated badge |

### Social Achievements
| Achievement | Requirement | Reward |
|------------|-------------|--------|
| Social Butterfly | Join 3 clubs | 200 HRP |
| Club Owner | Create a club with 10+ members | 500 HRP + badge |
| Backer | Successfully back a winning player | 300 HRP |
| Philanthropist | Gift items to 5 different players | 500 HRP |
| Streamer | Use video chat for 10 hours total | 300 HRP |

### Collection Achievements
| Achievement | Requirement | Reward |
|------------|-------------|--------|
| Collector | Own 10 shop items | 200 HRP |
| Curator | Own 25 shop items | 500 HRP + exclusive frame |
| Hoarder | Own 50 shop items | 1,000 HRP + exclusive avatar |
| Completionist | Own every item in a category | 2,000 HRP + animated badge |

---

## Daily Login Rewards (7-Day Cycle)

| Day | Reward | HRP |
|-----|--------|-----|
| 1 | 500 chips | 25 HRP |
| 2 | 750 chips | 25 HRP |
| 3 | 1,000 chips | 50 HRP |
| 4 | Random common cosmetic | 50 HRP |
| 5 | 1,500 chips | 75 HRP |
| 6 | Random uncommon cosmetic | 75 HRP |
| 7 | 3,000 chips + random rare cosmetic | 150 HRP |

Missing a day resets to Day 1. Consecutive weeks multiply: Week 2 = 1.5x, Week 3 = 2x, Week 4+ = 2.5x.

---

## Referral Program

| Milestone | Referrer Gets | New Player Gets |
|-----------|--------------|-----------------|
| Friend signs up | 100 HRP | 100 HRP + welcome pack |
| Friend plays 100 hands | 500 HRP + 2,000 chips | 1,000 chips |
| Friend makes first deposit | 1,000 HRP + 5,000 chips | 2,500 chips |
| Friend reaches Loyalty Level 3 | 2,000 HRP + exclusive referral avatar | — |

---

## Shop Item Count: Before vs After

| Category | Current | Proposed | Earnable via Loyalty |
|----------|---------|----------|---------------------|
| Avatars | 8 | 30+ | 5 |
| Table Themes | 5 | 15+ | 3 |
| Emotes | 5 | 17+ | 4 |
| Taunts | 16 | 21+ | 3 |
| Card Backs | 0 | 9 | 4 |
| Profile Frames | 0 | 7 | 4 |
| Seat Effects | 0 | 6 | 3 |
| Win Celebrations | 0 | 6 | 2 |
| Chat Effects | 0 | 5 | 3 |
| Entrance Animations | 0 | 6 | 3 |
| Premium/Battle Pass | 3 | Seasonal | Seasonal |
| **Total** | **37** | **120+** | **34** |

---

## Why This Model Prints Money

1. **Losing players stay engaged** — they still earn HRP, still progress, still unlock cosmetics. They don't feel like they're just burning cash.

2. **Winning players have something to spend on** — chip-rich players who can't withdraw (or don't want to) now have 120+ items to buy. That's chip velocity.

3. **Battle Pass creates monthly FOMO** — seasonal mythic avatars that expire forever. Collectors will pay $9.99/month just for the exclusive.

4. **Loyalty + subscription stack** — A Gold subscriber with 3x HRP multiplier reaches Immortal in ~170k hands instead of 500k. They feel the subscription is worth it.

5. **Referrals compound growth** — 500 HRP + 2,000 chips for getting a friend to play 100 hands. Players recruit for you.

6. **Achievements are permanent bragging rights** — "Royal Flush" badge on your profile. "The Grind" animated badge for 100k hands. These can't be bought — only earned.
