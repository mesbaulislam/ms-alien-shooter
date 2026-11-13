# MS Alien Shooter

A 2D isometric alien action shooter built for KaiOS 2.5.3.2 keypad phones (240×320, e.g. Energizer E241S). Clear infested military outposts and research labs with intelligent auto-fire combat, tactical equipment, and a full progression system — all offline.

> **Platform:** KaiOS 2.5.3.2 (240×320 keypad phones, e.g. Energizer E241S)
> **Developer:** MS Tactical Games (Mesbaul Islam — [@mesbaulislam](https://github.com/mesbaulislam))
> **Version:** 1.0.0 (Step 4 build, 2026-11-04)

> **Status — please read:** this is the Step 4 build (bug audit + fixes + UI redesign). `tsc --noEmit` passes and the Vite production build passes. **Sound and Main Menu navigation have NOT been verified on a physical device.** The player reported complete silence on the E241S (menu beeps, music, weapon sounds — nothing audible); Step 4 raised music gain and fixed likely causes, but the fix is unverified until tested on the phone. Main Menu scrolling was deliberately NOT added — the audit found all 8 menu rows fit 240×320 at the corrected row heights, so no scrolling was needed.

## Gameplay

- **Isometric 2D combat** — diamond-tile maps rendered on canvas, with line-of-sight blocking walls, sandbag barricades you can shoot over, explosive fuel barrels, toxic acid pools, and spawn vents
- **Intelligent auto-fire** — move with the D-pad; the weapon auto-targets and fires at the nearest enemy. No separate fire button needed on the keypad
- **4 weapons** (switch with keys 1–4, upgradeable in the Armory):

  | Key | Weapon | Damage | Clip | Notes |
  |---|---|---|---|---|
  | 1 | M9A Dual Tactical Pistols | 24 | 16 | Secondary sidearm, **infinite ammo** |
  | 2 | KR-47 Pulse Assault Rifle | 22 | 36 | Primary assault |
  | 3 | SG-12 Combat Breacher | 19 × 6 pellets | 8 | Primary close-quarters, wide spread |
  | 4 | X-90 Heavy Plasma Gun | 68 | 20 | Primary heavy energy, unlocks for 450 credits |

  Upgrades add +18% damage per level; fire rate, range, clip size, and reload time improve with level and skills.
- **5 enemy types** — Basic, Fast, Heavy, Ranged, and Boss (Brood Overlord). Bosses have phases and can summon.
- **Tactical equipment** — Frag Grenade (`7`), Field Med-Stim +60 HP (`8`), Combat Overdrive Booster 6s (`9`)
- **Sentry turrets** — activate/reload with OK; once online they auto-fire at aliens
- **Objectives** — eliminate all enemies, survive a duration, activate security terminals, destroy structures, protect an object, reach the extraction beacon, defeat the boss
- **Interactive map objects** — security terminals (unlock blast doors & supplies), locked armored blast doors, supply crates (destructible loot), alien bio-stasis pods (drop plasma/credits or spawn a specimen), extraction pads
- **Loot drops** — medkits, armor, rifle/shotgun/plasma ammo, credits, grenade packs
- **Flashlight** (`*`) — essential in the dark bio-lab and hive-core missions
- **Particles, decals, screen shake** — sparks, smoke, blood, plasma, fire, shell casings, shockwaves; corpses and scorch marks persist on the map

## Campaign — 18 levels

4 missions, each split into levels (4 + 4 + 5 + 5 = 18 levels). Progress is saved per mission.

| Mission | Location | Levels | Objective |
|---|---|---|---|
| **M-01: Military Outpost** | Sector 7 Perimeter Base | 4 | Clear the outpost & reach the beacon |
| **M-02: Bio-Research Lab** | Sub-Level 4 Genetics Wing | 4 | Purge the bio-lab containment |
| **M-03: Omega Hive Core** | Deep Reactor Chamber | 5 | Slay the Brood Overlord |
| **M-04: Xenomorph Mother Lair** | Subterranean Hive Vault | 5 | Purge the Mother Lair & extract (twin Brood Overlords) |

Mission briefings, rewards (credits + XP), wave compositions, and ambient darkness (0.18 bright outpost → 0.56 pitch-dark hive vault) are defined in `src/game/maps.ts`.

## Survival mode

**Survival Arena: Outpost Siege (S-01)** — endless waves (up to 999) storming the defense perimeter. Earn credits and XP after every wave and chase the best-wave / best-score records.

## Progression

- **XP & levels** — earn XP per kill and per mission; spend skill points on 5 skills:
  - Vitality +25 Max HP / level
  - Firepower +10% weapon damage / level
  - Agility +8% move speed / level
  - Armor Tech +20 starting armor & +3% absorption / level
  - Reload Speed +9% reload speed / level
- **Credits & Shop** — buy weapons, ammo, grenades, medkits, overdrives, and armor
- **Armory** — upgrade each weapon's damage, fire rate, range, clip, and reload
- **Armor tiers 1–4** — Kevlar → Exo-Suit → Titan Armor
- **Regen implant 0–3** — passive nano-health regeneration
- **Save data** — XP, level, credits, unlocked/completed missions, per-mission level progress, survival records, high score, total kills, weapons, ammo, inventory, and settings are persisted in `localStorage` (`ms_alien_shooter_kaios_save_v1`)

## Controls (KaiOS keypad)

| Key | Action |
|---|---|
| D-pad / Arrows | Move (in game) / navigate menus |
| OK / Enter | Interact / confirm (activate turret, terminal, blast door, deploy) |
| `1`–`4` | Switch weapon (Pistol / Rifle / Shotgun / Plasma) |
| `7` | Throw Frag Grenade |
| `8` | Use Field Med-Stim (+60 HP) |
| `9` | Combat Overdrive Booster (6s) |
| `*` | Toggle flashlight |
| `0` / RSK | Back / pause menu |
| LSK | Primary action |
| Back (KaiOS) | Back |

Menus use an arrow-repeat guard so holding Up/Down does not skip rows, and the cursor stays in sync with the focused item.

## Screens

Title, Mission Select, Survival Menu, Playing, Paused, Armory, Shop, Profile, Settings, Victory, Game Over, Survival Over, Controls Help.

Settings include master/music/SFX volume, sound on/off, flashlight, particles, screen shake, brightness (Dark / Standard / High Visibility), and a debug FPS overlay (off by default).

## Technologies used

- **React 17 + TypeScript** — UI screens, menus, and the single global key handler (`src/App.tsx`)
- **Vite 8** — dev server and production build
- **Canvas 2D** — the game engine (`src/game/engine.ts`, ~3,000 lines) and procedural sprites (`src/game/sprites.ts`)
- **Tailwind CSS 4** — UI styling, transformed for Gecko 48 by a custom Vite plugin (see below)
- **Web Audio API** — synthesized music and sound effects, no audio files (`src/game/sound.ts`)
- **localStorage** — save data and settings (`src/game/storage.ts`)
- **lucide-react** — menu icons

### KaiOS 2.5.3.2 compatibility

The game targets Gecko 48 (Firefox 48 / KaiOS 2.5.3.2), so the build pipeline downgrades modern output:

- `vite.config.ts` contains a custom plugin that unwraps CSS `@layer` / `@supports` blocks, drops `@property` (Houdini), converts `oklch()` colors to hex, converts 8-digit/4-digit hex colors to `rgba()`, rewrites standalone `translate:` to `transform:`, and converts logical spacing properties to physical ones
- `src/polyfills.ts` shims missing runtime APIs
- `public/manifest.webapp` — type `web`, fullscreen, `portrait-primary`, `cursor: false`, icons 56/112
- ES5-friendly runtime behaviour; no touchscreen-first UI; keypad-only navigation

## Project structure

```text
ms-alien-shooter/
├── index.html                 # App shell (240x320 viewport, manifest link)
├── package.json               # React 17 + Vite 8 + TypeScript + Tailwind 4
├── package-lock.json
├── tsconfig.json
├── vite.config.ts             # Build config + Gecko 48 CSS transform plugin
├── metadata.json              # AI Studio project metadata
├── public/
│   ├── manifest.webapp        # KaiOS manifest (v1.0.0, type "web")
│   ├── icon-56.png
│   └── icon-112.png
├── src/
│   ├── App.tsx                # Screens, menus, key handling (~3,800 lines)
│   ├── main.tsx               # Entry point
│   ├── index.css              # Tailwind + game styles
│   ├── polyfills.ts           # KaiOS runtime shims
│   └── game/
│       ├── engine.ts          # Game engine: loop, combat, AI, rendering
│       ├── maps.ts            # 4 missions + Survival Arena tile maps
│       ├── types.ts           # Entities, weapons, missions, save data
│       ├── weapons.ts         # Weapon specs + effective-stat math
│       ├── sprites.ts         # Procedural canvas sprites
│       ├── sound.ts           # Web Audio music + SFX
│       └── storage.ts         # Save/load + XP curve
├── BUG_AUDIT_REPORT.md        # Step 4 Phase 1 audit (Bengali)
├── BUG_FIX_REPORT_STEP1.md    # Step 1 bug-fix report
├── DEVELOPMENT_PROGRESS.md    # Development progress notes
├── STEP2_REPORT.md            # Step 2 report (Bengali)
├── STEP3_REPORT.md            # Step 3 report (Bengali)
└── STEP4_REPORT.md            # Step 4 audit + fix + redesign report (Bengali)
```

## Build and installation

```bash
npm install
npm run build        # NODE_ENV=production vite build -> dist/
npm run dev          # dev server on http://localhost:3000
npm run lint         # tsc --noEmit
npm run preview      # preview the production build
```

### KaiOS install

1. Run `npm run build`.
2. ZIP the contents of `dist/` (not the `dist` folder itself), so `manifest.webapp` is at the ZIP root.
3. Install the ZIP on a KaiOS 2.5 device via KaiStore Personal Testing as a **web** app, or sideload it with WebIDE.

## Tests

- `npm run lint` (`tsc --noEmit`) passes.
- The Vite production build passes.
- **No device testing was performed in the build environment.** Sound, Main Menu navigation, and full gameplay must be verified on the real E241S — see the Step 4 audit (`BUG_AUDIT_REPORT.md`) for the full findings list (1 critical, 7 high, 9 medium, 4 low).

## Screenshots

No screenshots are bundled in this repository.

## Known limitations

- **Sound is unverified on device** — the player reported complete silence on the E241S. Step 4 raised music gain, fixed suspended-context handling, and removed a mute-on-`0` bug, but none of it has been confirmed on hardware.
- Main Menu navigation fixes are likewise unconfirmed on the device.
- The `package.json` name is still the AI Studio template default (`react-example`, version `0.0.0`) — it was not renamed.
- `@google/genai`, `express`, and `dotenv` are declared in `package.json` but are **not used by the game** — AI Studio template leftovers. The game has no network calls and no API key.
- The manifest type is `web` (not `privileged`); the manifest has no `permissions` field.
- The original `README.md` was the AI Studio boilerplate (Gemini API key instructions); it has been replaced by this README.

## Developer

**Mesbaul Islam** — [@mesbaulislam](https://github.com/mesbaulislam)

© 2026 MS Alien Shooter
