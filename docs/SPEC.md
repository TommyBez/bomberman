# Target specification — "Bomberman" for PlayStation

This remake targets **Bomberman** for the original PlayStation — released in Japan in
December 1998 and in Europe in July 1999 (Virgin Interactive) as simply *Bomberman*, and in
North America in 2000 as *Bomberman Party Edition* (Vatical). It is the "back to basics"
PlayStation entry: a remake of the 1985 Famicom/NES game plus a five-player battle game.
(*Bomberman World*, 1998, is a different game with an angled view and is **not** the target.)

Everything below was compiled from the US and Japanese instruction manuals, the Japanese
Wikipedia article, the Bomberman Wiki and NES mechanics references. All graphics, music and
sound in this project are original; only the game rules are reproduced.

## Presentation

- Straight overhead view, 16×16 tiles, **256×224** display.
- The top wall row is drawn two tiles tall and carries the HUD.
- Title → **PRESS START BUTTON** → *Normal Game* / *Battle Game* / *Option*.

## Normal Game (1 player)

| Rule | Value |
|---|---|
| Stages | 50, then an ending |
| Field | 31×13 tiles incl. border (29×11 playable), pillars on even/even tiles, horizontal scrolling |
| Objective | Kill every monster, then walk into the exit (a pair of doors hidden under a soft block) |
| Timer | 3:00 per stage; at 0:00 a swarm of extra monsters (Pontans) appears |
| Penalty | Bombing the revealed exit or item releases a pack of tougher monsters |
| Lives | ×02 at the start (3 tries), **+1 for every stage cleared** |
| Caps | Bombs 10, Fire 5 |
| Bonus stage | After stages 5, 10, …, 45: invincible, endless monsters of one kind, 30 s of score attack |
| Game over | Continue (same stage) / Save (3 files) / Quit + 8-character password |
| Versions | **Modern** (5 themes, changing every 10 stages, "Bomberman Show Time" intermission every 10 stages) or **Retro** (NES look and sound) |

Soft blocks per attempt: 50 + 2 × stage number (the exit and the item hide under two of
them). Layouts are random every attempt; the enemy roster and the item are fixed per stage.

**Movement / timing (NES logic):** fuse 159 frames; player 0.75 px/frame, 1.0 px/frame with
Speed Up; Ballom 0.5 px/frame. Enemy speed classes: slowest 0.25, slow 0.5, normal 0.75,
fast 1.0 px/frame.

### Monsters

| Monster (JP / US manual) | Points | Speed | Notes |
|---|---|---|---|
| Ballom | 100 | slow | erratic |
| Onil | 200 | normal | ambushes the player |
| Dahl / Blockhead | 400 | normal | wanders |
| Minvo / Minbow | 800 | fast | |
| Kondoria / Ameban | 1000 | slowest | passes through soft blocks, smart |
| Ovapi / Floatsam | 2000 | slow | passes through soft blocks |
| Pass / Tiglon | 4000 | fast | smart, avoids bombs |
| Pontan / Foton | 8000 | fast | passes through walls, charges in straight lines |

Several monsters caught in one blast double in value one after another.

### Items

| Item | Effect | Lost on a miss |
|---|---|---|
| Fire | +1 blast range (max 5) | no |
| Bomb | +1 bomb (max 10) | no |
| Speed Up | faster walking (only on stage 4) | yes |
| Remote Control | bombs wait for the detonate button | yes |
| Bomb Pass-Thru | walk through bombs | yes |
| Wall Pass-Thru | walk through soft blocks | yes |
| Fireman | immune to blasts | yes |
| Flak Jacket | temporary invincibility | yes |

### Hidden score panels

| Panel | Points | Stages | Condition |
|---|---|---|---|
| B | 10,000 | 6, 8, 14, 16, 22, 24, 30, 32, 38, 40, 46, 48 | uncover the exit without killing anything, then walk over it |
| Louie | 20,000 | 1, 7, 9, 15, 17, 23, 25, 31, 33, 39, 41, 47, 49 | kill every monster, then walk the whole outer ring |
| Yo-yo | 30,000 | 4, 12, 20, 28, 36, 44 | walk the whole outer ring without killing anything |
| Golden Bomberman | 500,000 | 2, 10, 18, 26, 34, 42, 50 | explode 248 bombs in the stage |
| Nakamoto-san | 10,000,000 | 3, 11, 19, 27, 35, 43 | kill every monster, then break 16 more soft blocks |
| Tekuteku Angel | 20,000,000 | 5, 13, 21, 29, 37, 45 | break every soft block without killing anything |

The stage table (enemies and item for all 50 stages) lives in `src/game/campaign/stages.ts`.

## Battle Game (1–5 players)

- Modes: **Battle Royal** or **Custom Battle** (item counts, hit points).
- Levels: **Beginner / Normal / Advanced**, eight stages each.
- **Single** or **Tag** (two teams).
- Rules: Computer (Weak/Normal/Strong), Games per match 1–5 (3), Time 1–5 min or ∞ (3:00),
  Sudden Death Off/On/Random (Off; Random = one of several fall patterns), Random Position
  Off/On/Random (Off), Skull Bomb (Off), Hyper Bomber (On),
  Bomber Cart Off/On/Super (Off). Beginner locks Sudden Death, Random Position and Skull.
- Arena 15×13 (13×11 playable), whole arena on screen. Starts: P1 white top-left,
  P2 black bottom-right, P3 red top-right, P4 blue bottom-left, P5 green centre.
- Controls: A = bomb / Power Glove, B = remote / specials, stop kicked bomb, punch / push /
  multi bomb.
- "Hurry!" at 1:00 left: pressure blocks spiral in from the top-left (fill everything
  with Sudden Death on). "Time's UP!" at 0:00 → draw.
- Two kicked bombs colliding make a **Super Bomb**; Super/Power bombs colliding make an
  **Ultra Bomb**.
- Items: Bomb, Fire, Speed, Steel Shoes (−speed), Kick, Power Glove, Punch, Push,
  Multi Bomb, Power Bomb, Rubber Bomb, Metabomb (pierce), Full Fire, Land Mine, Heart, Egg,
  Skull, Remote Control.
- Skull diseases: Superspeed, Superslow, Diarrhea, Impotent, Feeble, Streaking, Confusion,
  Short-tempered, Slow Motion, Warp. Cured by another item or passed on by touch.
- Bomber Cart: knocked-out players ride carts around the edge and lob bombs (Super: a hit
  swaps you back in).
- Hyper Bomber: the round winner throws a yo-yo at moving item panels to start the next
  game with that item (and turns gold).
- Results screen (trophies), Battle Report (who beat whom), VICTORY / DRAW.

### Stages

| # | Beginner | Normal | Advanced |
|---|---|---|---|
| 1 | Normal | All Together Now | Super Power |
| 2 | SeeSaw Park | SeeSaw Land | Robo Bomber |
| 3 | Life in the Slow Lane | Head in the Clouds | Round and Round |
| 4 | Take the Train | Switcheroo | Destination Unknown |
| 5 | One-Way Street | Block World | King of the Jungle |
| 6 | Pipe City | Every Which Way | Incoming! |
| 7 | Factory | Coming and Going | The Fast Lane |
| 8 | Warp Desert | Winter Wonderland | The Seven Seas |
