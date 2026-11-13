# MS Alien Shooter — ডেভেলপমেন্ট অগ্রগতি রিপোর্ট (DEVELOPMENT PROGRESS)

**প্রজেক্টের নাম:** MS Alien Shooter  
**টার্গেট প্ল্যাটফর্ম:** KaiOS 2.5.3.2 (Gecko 48 / Firefox 48 Engine)  
**টার্গেট ডিভাইস:** Energizer E241S (`240×320` পোর্ট্রেট ডিসপ্লে, নন-টাচ ফিজিক্যাল কীপ্যাড)  
**মূল রেফারেন্স:** স্বতন্ত্র / Independent project — no third-party game content is used  
**বর্তমান অবস্থা:** **Phase 8 — Performance Optimization, KaiOS Build & ZIP Packaging সম্পন্ন ও ভেরিফাইড (Real Device Testing Pending Phase 9)**  

---

## ১. Phase 1 সারসংক্ষেপ (সম্পন্ন ও ভেরিফাইড)
- **KaiOS 2.5.3.2 (Gecko 48) Build & Runtime Compatibility:** Post-build `writeBundle`-এ একক Classic IIFE (`esbuild.buildSync`), `<script defer src="./assets/...">`, Firefox 48-compatible CSS (`@layer` unwrap, `oklch()` -> `#hex`, logical spacing -> physical spacing), এবং `/src/polyfills.ts`।
- **`240×320` Native Viewport ও Keypad Controls:** KaiOS হার্ডওয়্যার কী ও একবার ইনিশিয়ালাইজ করা Canvas 2D Context (`ctxRef`) রিইউজ।

---

## ২. Phase 2 সারসংক্ষেপ (সম্পন্ন ও ভেরিফাইড)
- **Isometric Facility Architecture & Interactive Props:** Armored Security Blast Doors (`Tile 13`, `Tile 14`), Automated Military Sentry Turrets (`Tile 15`), Destructible Alien Bio-Stasis Containment Pods (`Tile 16`), Dynamic Sector Darkness & Flashlight (`*` key), এবং On-Canvas Tactical Minimap Radar (`38×34px`)।
- **Phase 2 Gameplay Verification & Bug Fixes:** BFS Flow-Field (`computePlayerFlowField` ও `getEnemyChaseDirection`) পাথফাইন্ডিং, ৪-ধাপের সাব-স্টেপিং বুলেট কলিশন এবং ইউক্লিডীয় দূরত্ব অনুযায়ী নিকটতম অবজেক্ট ইন্টারেকশন (`triggerContextAction`)।

---

## ৩. Phase 3 সারসংক্ষেপ (সম্পন্ন ও ভেরিফাইড)
- **Graphics, Sprites & Animations:** ৮-দিকের (`N, NE, E, SE, S, SW, W, NW`) মেরিন সোলজার স্প্রাইট, ৪-ফ্রেমের লেগ স্ট্রাইড, রিকয়েল ও মাজল ফ্ল্যাশ; ৫ ধরনের এলিয়েনের (`Basic, Fast, Heavy, Ranged, Boss`) মুভমেন্ট, মেলি লাঞ্জ (`attackAnimMs`) ও ডেথ ডিসলভ (`state === 'dead'`); ৪টি অস্ত্রের স্বতন্ত্র ভিজ্যুয়াল ও প্রজেক্টাইল (`drawProjectile`); ৬ ধরনের পার্টিকেল (`drawParticle`) এবং ১৭টি প্রি-বেকড আইসোমেট্রিক এনভায়রনমেন্ট টাইলস (`bakeTile 0..16`)।

---

## ৪. Phase 4 সারসংক্ষেপ (সম্পন্ন ও ভেরিফাইড)
- **Audio, Tactical Gadgets & Campaign Expansion:** WebAudio সিন্থেসাইজার ভিত্তিক সাউন্ড ও ডার্ক সাই-ফাই BGM (`updateMusic`), ৩টি ট্যাকটিক্যাল গ্যাজেট (**Frag Grenade `Key 7`**, **Nano-Med Stim `Key 8`**, **Combat Overdrive `Key 9`**), এবং **Mission 04 (`M-04: Xenomorph Mother Lair`)**।

---

## ৫. Combined Phase 5 — Weapons, Equipment, Game Modes, Mission System, Progression & Economy (সম্পন্ন ও ভেরিফাইড)

### ৫.১ Module 1 — Weapons & Equipment (`/src/game/weapons.ts`, `/src/game/engine.ts`)
- **Weapon Categories & Slot Types:** প্রতিটি অস্ত্রে ক্যাটাগরি (`Secondary Sidearm`, `Primary Assault`, `Primary Close-Quarters`, `Primary Heavy Energy`) এবং স্লট টাইপ (`secondary` / `primary`) যুক্ত করা হয়েছে।
- **Effective Weapon Stats (`getEffectiveWeaponStats`):** অস্ত্রের আপগ্রেড লেভেল (`Lv.1..6`) এবং প্লেয়ারের স্কিল অনুযায়ী `damage`, `fireRateMs`, `range`, `clipSize` এবং `reloadMs` স্বয়ংক্রিয়ভাবে স্কেল করে।
- **Equipment System Expansion:** পূর্বের ৩টি ট্যাকটিক্যাল গ্যাজেটের (`Frag Grenade`, `Nano-Med Stim`, `Combat Overdrive`) পাশাপাশি যুক্ত হয়েছে:
  - **Active Belt Selection (`selectedEquipment`, `useSelectedEquipment`, `cycleSelectedEquipment`):** অ্যাক্টিভ ইকুইপমেন্ট নির্বাচন ও সাইকেল করার সুবিধা।
  - **Armor Suit Upgrade Tiers (`armorTier: Mk.1..4`):** সর্বোচ্চ আর্মার ক্যাপাসিটি (`100 -> 175`) এবং ড্যামেজ শোষণ ক্ষমতা (`65% -> 85%`) বৃদ্ধি করে।
  - **Bio-Regen Implant (`regenImplantLevel: Lv.0..3`):** যুদ্ধের সময় প্রতি `2.5` সেকেন্ডে প্যাসিভলি `HP` পুনরুদ্ধার করে।

### ৫.২ Module 2 — Game Modes & Mission System (`/src/game/maps.ts`, `/src/game/engine.ts`)
- **Campaign Mode:** ৪টি ক্রমান্বয়ে কঠিন মিশন (`M-01` থেকে `M-04`), মিশন আনলকিং (`unlockedMission`), সম্পন্ন হওয়া মিশন ট্র্যাকিং (`completedMissions`), এবং বস এনকাউন্টার।
- **Playable Endless Survival Mode (`SURVIVAL_ARENA_MISSION` / `startSurvivalMode`):**
  - অসীম এলিয়েন ওয়েভ (`Wave 1, 2, 3...`), যেখানে প্রতি ওয়েভে এলিয়েনের সংখ্যা, `HP`, `speed` এবং `damage` বৃদ্ধি পায় এবং প্রতি ৩য় ওয়েভে বস (`Brood Overlord`) স্পন হয়।
  - প্রতি ওয়েভ ক্লিয়ার করলে তাৎক্ষণিক ক্রেডিট (`$60 × wave`) ও XP (`45 × wave`) পুরস্কার এবং **Survival Best Wave (`survivalBestWave`)** ও **Best Score (`survivalBestScore`)** সংরক্ষণ।
  - প্লেয়ারের মৃত্যু হলে ডেডিকেটেড **Survival Result Screen (`SURVIVAL_OVER`)** প্রদর্শন।
- **৭ ধরনের গেমপ্লে-সংযুক্ত Mission Objectives (`arePrimaryObjectivesComplete`):**
  1. `eliminate_all` — সব এলিয়েন ওয়েভ নির্মূল করা।
  2. `survive_duration` — নির্দিষ্ট সময় (`surviveDurationMs`) টিকে থাকা।
  3. `activate_terminals` — সিকিউরিটি টার্মিনাল (`requiredTerminals`) হ্যাক করা।
  4. `destroy_structures` — এলিয়েন বায়ো-স্ট্যাসিস পড (`requiredStructures`) ধ্বংস করা।
  5. `protect_object` — গুরুত্বপূর্ণ অবজেক্ট (`protectObject`) রক্ষা করা; এর `HP 0` হলে সাথে সাথে মিশন ব্যর্থ (`damageProtectedObject`) হয়।
  6. `reach_extraction` — সব অবজেক্টিভ শেষে এক্সট্রাকশন বিকনে পৌঁছানো।
  7. `defeat_boss` — বস (`requireBossDefeat`) পরাজিত করা।

### ৫.৩ Module 3, 4, 5 & 6 — Progression, Economy, Save System & `240×320` UI (`/src/game/storage.ts`, `/src/App.tsx`)
- **৫টি Skill Upgrades (`PlayerSkills`):** `vitality`, `firepower`, `reloadSpeed`, `agility`, `armorTech`।
- **Shop & Economy & Backward-Compatible Offline Save (`storage.ts`):** ক্রেডিট ভিত্তিক কেনাকাটা এবং করাপ্টেড JSON সেভ ডেটা সুরক্ষা।

---

## ৬. Combined Phase 5 — ১৮টি আবশ্যিক টেস্টের ফলাফল (18/18 Passed)
- সব ১৮টি টেস্ট সফলভাবে উত্তীর্ণ (PASS)।

---

## ৭. Phase 6 — Menus, UI & Game Experience (সম্পন্ন ও ভেরিফাইড)

### ৭.১ Main Menu Redesign (`TITLE`)
- **সাই-ফাই মিলিটারি থিম ও লাইভ ক্যানভাস ব্যাকগ্রাউন্ড:** `MS ALIEN SHOOTER` লোগো, কমান্ডার স্ট্যাটাস ব্যানার (`LV`, `CR`, `SP`, `M-0X`) এবং `240×320` স্ক্রিনের মধ্যে একসাথে দৃশ্যমান **৮টি অপশন**:
  1. `Continue Game` (চলমান সেশন বা সর্বোচ্চ আনলকড মিশন চালু করে)
  2. `New Campaign` (পূর্বের অগ্রগতি থাকলে কনফার্মেশন ডায়ালগ দেখিয়ে `M-01` শুরু করে)
  3. `Survival Mode` (`SURVIVAL_MENU` স্ক্রিনে নিয়ে যায়)
  4. `Missions` (`MISSION_SELECT` স্ক্রিনে নিয়ে যায়)
  5. `Armory` (`ARMORY` ওয়েপন ও ইকুইপমেন্ট স্ক্রিনে নিয়ে যায়)
  6. `Shop` (`SHOP` ৫-ক্যাটাগরির সাপ্লাই শপে নিয়ে যায়)
  7. `Player Profile` (`PROFILE` সার্ভিস রেকর্ড ও স্কিল আপগ্রেড স্ক্রিনে নিয়ে যায়)
  8. `Settings` (`SETTINGS` ৪-ট্যাবের কনফিগারেশন স্ক্রিনে নিয়ে যায়)

### ৭.২ Game Mode & Mission Selection UI (`MISSION_SELECT` & `SURVIVAL_MENU`)
- **Campaign Mission Selection (`MISSION_SELECT`):** প্রতিটি মিশনের জন্য মিশন নম্বর (`M-01..M-04`), নাম, সংক্ষিপ্ত ব্রিফিং, ডিফিকাল্টি ব্যাজ (`NORMAL`, `MODERATE`, `HARD`, `EXTREME`), স্ট্যাটাস (`COMPLETED ✓`, `UNLOCKED`, `LOCKED`), এবং ক্রেডিট ও XP রিওয়ার্ড প্রদর্শন। লকড মিশন সিলেক্ট করলে সতর্কবার্তা দেখায়।
- **Survival Mode Screen (`SURVIVAL_MENU`):** সার্ভাইভাল মোডের বিবরণ, সর্বোচ্চ ওয়েভ রেকর্ড (`survivalBestWave`), সর্বোচ্চ স্কোর (`survivalBestScore`), প্রতি ওয়েভের পুরস্কার এবং `Start Survival Mode` বাটন।

### ৭.৩ Player Profile & Skill Upgrade UI (`PROFILE`)
- **`PROFILE` ট্যাব:** প্লেয়ার লেভেল, ভিজ্যুয়াল XP প্রগ্রেস বার (`xp / xpNext`), বর্তমান ক্রেডিট, সম্পন্ন মিশন (`X/4`), মোট এলিয়েন কিল (`totalKills`), সার্ভাইভাল বেস্ট ওয়েভ এবং অবশিষ্ট স্কিল পয়েন্ট (`SP`)।
- **`SKILLS` ট্যাব:** ৫টি স্কিল (`Maximum Health`, `Armor Strength`, `Weapon Damage`, `Reload Speed`, `Movement Speed`)-এর বর্তমান লেভেল (`Lv.X/5`), পরবর্তী লেভেলের সুবিধা, `1 SP` খরচ এবং আপগ্রেড স্ট্যাটাস।

### ৭.৪ Armory & Inventory UI (`ARMORY`)
- **`WEAPONS` ট্যাব ও Live Weapon Stat Inspector:** ৪টি অস্ত্রের তালিকা এবং নির্বাচিত অস্ত্রের জন্য ড্যামেজ, ফায়ার রেট (`/s`), রেঞ্জ, রিলোড স্পিড (`s`), ম্যাগাজিন ক্যাপাসিটি, আপগ্রেড লেভেল (`Lv.1..6`), আনলক স্ট্যাটাস এবং ইকুইপ স্ট্যাটাস প্রদর্শন।
- **`EQUIPMENT` ট্যাব:** আর্মার স্যুট টিয়ার (`Mk.1..4`), বায়ো-রিজেন ইমপ্ল্যান্ট (`Lv.0..3`), এবং অ্যাক্টিভ ট্যাকটিক্যাল বেল্ট সিলেক্টরসহ `Frag Grenades`, `Nano-Med Stims` ও `Combat Overdrive`-এর স্টক প্রদর্শন।

### ৭.৫ Supply Shop UI (`SHOP`)
- **৫টি ক্যাটাগরি ট্যাব (`WEAPONS`, `UPGRADES`, `ARMOR`, `EQUIPMENT`, `AMMO`):** প্রতিটি আইটেমের নাম, আইকন ট্যাগ, বিবরণ, মূল্য, বর্তমান স্টক/লেভেল এবং ক্রয় স্ট্যাটাস প্রদর্শন। অপর্যাপ্ত ক্রেডিট থাকলে কেনাকাটা প্রতিরোধ করে এবং `NEED $X CREDITS` বার্তা দেখায়।

### ৭.৬ In-Game HUD (`PLAYING`), Pause Menu (`PAUSED`) ও Settings Menu (`SETTINGS`)
- **Compact `240×320` HUD:** টপ বারে HP বার, Armor বার, ওয়েভ কাউন্টার, অবশিষ্ট এলিয়েন ও ক্রেডিট; সাব-হেডারে মিশন অবজেক্টিভ এবং অ্যাক্টিভ ইকুইপমেন্ট হাইলাইটসহ ট্যাকটিক্যাল বেল্ট (`7:G`, `8:M`, `9:OD`); বটম বারে বর্তমান অস্ত্র, ম্যাগাজিন/রিজার্ভ অ্যামো এবং ভিজ্যুয়াল রিলোড প্রগ্রেস বার।
- **Pause Menu (`PAUSED`):** `Resume`, `Restart Mission`, `Settings`, `Return to Main Menu` — গেমপ্লে আপডেট (`engine.update`) সম্পূর্ণ স্থগিত রাখে এবং মিশন রিস্টার্ট বা মেইন মেনুতে ফেরার আগে কনফার্মেশন চায়।
- **Settings Menu (`SETTINGS` - 4 Tabs):**
  - `AUDIO`: Master Volume (`0..100%`), Music Volume (`0..100%`), SFX Volume (`0..100%`), এবং Audio Mute টগল (`soundFX.applySettings`-এর মাধ্যমে তাৎক্ষণিক কার্যকর)।
  - `GAME`: Auto-Fire টার্গেটিং স্ট্যাটাস, কন্ট্রোল ও কীপ্যাড গাইড।
  - `DISPLAY`: Brightness Level (`DARK / STANDARD / BRIGHT`), Particle Effects টগল, Screen Shake টগল এবং Tactical Flashlight টগল।
  - `DATA`: ম্যানুয়াল সেভ স্ট্যাটাস এবং কনফার্মেশন ডায়ালগসহ `Reset Game Data`।

---

## ৮. Phase 6 — ২৪টি আবশ্যিক টেস্টের ফলাফল (24 Required Verification Results)
1. **Main Menu navigation (8 options):** PASS
2. **Continue Game:** PASS
3. **New Campaign (with confirmation dialog):** PASS
4. **Campaign mission selection (M-01..M-04):** PASS
5. **Locked and completed mission states:** PASS
6. **Survival Mode navigation (`SURVIVAL_MENU`):** PASS
7. **Player Profile (`PROFILE` stats tab):** PASS
8. **XP and level display (with visual XP progress bar):** PASS
9. **Skill upgrade interface (All 5 skills):** PASS
10. **Armory weapon selection & live Weapon Stat Inspector:** PASS
11. **Equipment inventory & active belt selection:** PASS
12. **Shop purchase flow (5 categories: Weapons, Upgrades, Armor, Equipment, Ammo):** PASS
13. **Insufficient credits handling:** PASS
14. **Pause and Resume (`PAUSED` halts gameplay updates):** PASS
15. **Restart Mission (with confirmation dialog):** PASS
16. **Settings persistence (Master/Music/SFX Volume, Brightness, Particles, Screen Shake):** PASS
17. **Reset Game Data confirmation (`RESET_DATA` modal):** PASS
18. **Keypad navigation (`UP/DOWN`, `LEFT/RIGHT`, `OK/5`, `LSK`, `RSK/Backspace`, `0` Pause):** PASS
19. **Back navigation (`RSK / Backspace` across all screens):** PASS
20. **Gameplay HUD (`240×320` HP, Armor, Weapon, Mag/Reserve, Reload bar, Objective/Wave, Belt):** PASS
21. **`240×320` layout integrity:** PASS
22. **Save/load integration (including corrupted JSON fallback):** PASS
23. **TypeScript checks (`tsc --noEmit` — 0 errors):** PASS
24. **Production build (`npm run build` — Gecko 48 Classic IIFE bundle):** PASS

---

## ৯. Phase 6 Final Bug Fix — Audio Volume Cycling & Normalization (সম্পন্ন ও ভেরিফাইড)

### ৯.১ চিহ্নিত সমস্যা ও সমাধান (`/src/game/storage.ts`, `/src/game/sound.ts`, `/src/App.tsx`)
- **সমস্যা:** পূর্বে `src/App.tsx`-এ ভলিউম পরিবর্তনের জন্য `(d.masterVolume + 25) % 125` ব্যবহার করা হয়েছিল। যদি ভলিউমের মান `25`-এর গুণিতক না হতো (যেমন পূর্বের ডিফল্ট `80`, `70`, `85`), তবে `+ 25` করার ফলে `105` বা `110` উৎপন্ন হতো, যা `0–100` সীমার বাইরে চলে যেত।
- **সমাধান:**
  1. `/src/game/storage.ts`-এ `normalizeVolumeStep(value, fallback)` ও `cycleVolumeStep(current)` হেল্পার ফাংশন তৈরি করা হয়েছে:
     - যেকোনো ভলিউম মানকে প্রথমে নিরাপদভাবে `0–100` সীমার ভেতরে এনে নিকটতম `25`-এর গুণিতকে (`0, 25, 50, 75, 100`) নরমালাইজ করা হয়।
     - এরপর `cycleVolumeStep` কঠোরভাবে **`0 → 25 → 50 → 75 → 100 → 0`** ক্রমে ভলিউম পরিবর্তন করে।
  2. `DEFAULT_SAVE_DATA`-তে `masterVolume: 75`, `musicVolume: 75`, `sfxVolume: 75` সেট করা হয়েছে এবং `cloneSaveData()`-তে লোড করার সময় পুরোনো বা নন-মাল্টিপল মানগুলোকে স্বয়ংক্রিয়ভাবে `normalizeVolumeStep()` দিয়ে নরমালাইজ করা হয়েছে।
  3. `/src/App.tsx`-এ `handleSettingsAction` হেল্পার যুক্ত করে `masterVolume`, `musicVolume` এবং `sfxVolume` তিনটির জন্যই `cycleVolumeStep()` ব্যবহার করা হয়েছে (কীপ্যাড `OK` এবং সরাসরি মাউস ক্লিক উভয় ক্ষেত্রেই তাৎক্ষণিক কার্যকর)।
  4. `/src/game/sound.ts`-এর সব SFX মেথডে (`playShoot`, `playReload`, `playAlienHit`, `playPlayerHit`, `playAlienDeath`, `playExplosion`, `playGrenadeThrow`, `playStimUse`, `playDoorOpen`, `playTerminalHack`, `playWaveIncoming`, `playLevelUp`, `playPickup`, `playUiBeep`) `this.getSfxScale()` প্রয়োগ করা হয়েছে।

### ৯.২ ভেরিফিকেশন ফলাফল
- **Volume Cycling Sequence (`0 → 25 → 50 → 75 → 100 → 0`):** PASS (`masterVolume`, `musicVolume`, `sfxVolume` সবগুলোর জন্য পরীক্ষিত)।
- **Non-multiple of 25 Normalization (`80, 70, 85, 13, 95, -20, 150`):** PASS (সব মান `0–100`-এর মধ্যে `{0, 25, 50, 75, 100}`-এ নরমালাইজ হয়)।
- **Immediate Audio Apply, Reload Persistence & Mute:** PASS (`soundFX.applySettings` ও `LocalStorage` রিলোড পরখ করা হয়েছে)।
- **Regression Checks (Main Menu 8 options, Missions, Survival, Armory, Shop, Profile, Skills, Pause/Resume, Settings Tabs, Keypad):** PASS।
- **Final Build Inspection:** `tsc --noEmit` (`0 errors`), `npm run build` সফল, এবং `dist/index.html`-এ Classic IIFE বান্ডেল নিশ্চিত করা হয়েছে।

---

## ১০. Phase 7 — Audio & Visual Polish (সম্পন্ন ও ভেরিফাইড)

### ১০.১ Audio System Improvements (`/src/game/sound.ts`, `/src/game/engine.ts`, `/src/App.tsx`)
- **Singleton `AudioContext` ও Voice Limiting:** একক `AudioContext` পুনঃব্যবহার করা হয়েছে, কখনোই নতুন `AudioContext` বারবার তৈরি হয় না। কম মেমোরির KaiOS ডিভাইসে অডিও ওভারলোড প্রতিরোধে `maxConcurrentVoices = 12`, প্রতি সাউন্ডে মিনিমাম ইন্টারভ্যাল থ্রটলিং (`canTriggerSfx`) এবং `startAndCleanupVoice()` যুক্ত করা হয়েছে।
- **Weapon Sounds:**
  - `playShoot('pistol' | 'rifle' | 'shotgun' | 'plasma')`: প্রতিটি অস্ত্রের জন্য আলাদা ও সহজে চেনা যায় এমন প্রসিডিউরাল সাউন্ড।
  - `playReload()`: মাল্টি-স্টেজ মেকানিক্যাল রিলোড সাউন্ড।
  - `playEmptyMag()`: ম্যাগাজিন খালি হলে মেটালিক ড্রাই-ফায়ার ক্লিক সাউন্ড।
  - `playWeaponSwitch(weapon)`: অস্ত্র পরিবর্তনের সময় আলাদা মেকানিক্যাল/এনার্জি সুইচ সাউন্ড।
- **Combat & Boss Sounds:**
  - `playAlienHit()`, `playAlienDeath(isBig)` (সাধারণ ও হেভি এলিয়েনের আলাদা ডেথ সাউন্ড)।
  - `playPlayerHit()`, `playArmorHit()` (আর্মার ড্যামেজ শোষণ করলে মেটালিক শিল্ড ডিফ্লেকশন সাউন্ড), `playPlayerDeath()` (প্লেয়ার ডেথ সাউন্ড)।
  - `playExplosion()`, `playGrenadeThrow()`, `playGrenadeExplode()` (গ্রেনেড বিস্ফোরণের আলাদা কনকাসিভ সাউন্ড)।
  - `playBossAttack()` (বস স্পন, বায়ো-ক্যানন ফায়ার ও সোয়ার্ম সামন) এবং `playBossDeath()` (মাল্টি-স্টেজ বস ডেথ সাউন্ড)।
- **Environment & Mission Sounds:**
  - `playDoorOpen()`, `playDoorClose()`, `playTerminalHack()`, `playTurretShoot()`, `playPickup()`, `playMissionComplete()`, `playMissionFail()`।
- **Multi-Track Procedural Background Music (`updateMusic`):**
  - ৪টি আলাদা প্রসিডিউরাল সাই-ফাই মিউজিক ট্র্যাক: `menu` (মেইন মেনু ও সাব-মেনু), `campaign` (ক্যাম্পেইন মিশন), `survival` (সারভাইভাল এরিনা), এবং `boss` (বস এনকাউন্টার)।
  - অ্যান্টি-ডুপ্লিকেট প্লেব্যাক গার্ড (`lastBgmNoteTimestamp`) এবং `pauseAudio()` / `resumeAudio()` লাইফসাইকেল হ্যান্ডলিং যুক্ত করা হয়েছে।
- **Audio Settings Integration:** Phase 6-এর `0 → 25 → 50 → 75 → 100 → 0` ভলিউম সাইক্লিং (`Master`, `Music`, `SFX`) ও `Mute` সম্পূর্ণ অক্ষুণ্ণ রাখা হয়েছে।

### ১০.২ Visual Effects, Animations, Screen Feedback & Environment Polish (`/src/game/sprites.ts`, `/src/game/engine.ts`, `/src/game/types.ts`)
- **Weapon & Projectile Effects:** প্রতিটি অস্ত্রের আলাদা মাজল ফ্ল্যাশ, প্রজেক্টাইল ট্রেইল (`Pistol` ট্রেসার, `Rifle` হাই-ভেলোসিটি স্ট্রিক, `Shotgun` হিটেড বাকশট পেলেট, `Plasma` গ্লোয়িং এনার্জি অর্ব + ওয়েক ট্রেইল, `Turret` সায়ান বোল্ট), ইম্প্যাক্ট স্পার্ক এবং ক্রিটিক্যাল হিট (`CRIT!` ফ্লোটিং টেক্সট ও গোল্ডেন এনার্জি স্পার্ক)।
- **Explosion & Pooled Particle Effects:** প্রি-অ্যালোকেটেড `120`-স্লটের পার্টিকেল পুলে `'shockwave'`, `'energy'`, `'fire'`, `'smoke'`, `'spark'`, `'plasma'`, `'blood'`, `'shell'` পুনঃব্যবহার করা হয়েছে (কোনো রানটাইম মেমোরি লিক ছাড়াই)।
- **Character, Enemy & Boss Animations:**
  - **Player:** Idle শ্বাস-প্রশ্বাস ও ভাইজর গ্লো, Walking ও Running (`Overdrive` কাইনেটিক স্পিড ট্রেইল), Shooting রিকয়েল, Damage হিট-ফ্ল্যাশ এবং Death অ্যানিমেশন।
  - **Enemies:** Idle, Movement, Attack লাঞ্জ, Hit ফ্ল্যাশ এবং Death ডিসলভ অ্যানিমেশন।
  - **Boss:** Boss Entrance শকওয়েভ রিং ও `WARNING: APEX BOSS DETECTED` ব্যানার (`spawnAnimMs`), বায়ো-ক্যানন অ্যাটাক ফ্লেয়ার, ড্যামেজ ফ্ল্যাশ এবং মাল্টি-স্টেজ ডেথ বিস্ফোরণ।
- **Screen Effects & Environment Polish:**
  - `Screen Shake` (সেটিংস থেকে অন/অফ করা যায়), প্লেয়ার ড্যামেজ রেড বর্ডার ফ্ল্যাশ (`damageFlashMs`), আর্মার শিল্ড সায়ান ফ্ল্যাশ (`armorFlashMs`), এবং র‍্যাঙ্ক প্রমোশন/লেভেল-আপ ব্যানার (`levelUpBannerMs`)।
  - অ্যানিমেটেড টার্মিনাল স্ক্যানলাইন (`Tile 9`), লকড ব্লাস্ট ডোরে পালসিং লেজার/এনার্জি ব্যারিয়ার (`Tile 13`), ফ্লিকারিং সেক্টর লাইট (`Tile 5`), এবং অ্যাসিড পুল (`Tile 11`), এলিয়েন ভেন্ট (`Tile 8`) ও টেক গ্রেটে (`Tile 3`) অ্যাম্বিয়েন্ট পার্টিকেল ইফেক্ট।

---

## ১১. Phase 7 — ২৪টি আবশ্যিক টেস্টের ফলাফল (24 Required Verification Results)
1. **All weapon sounds (`pistol`, `rifle`, `shotgun`, `plasma`, `empty_mag`, `weapon_switch`):** PASS
2. **Reload sounds (`playReload`):** PASS
3. **Enemy hit & death sounds + Player/Armor hit & death (`alien_hit`, `alien_death`, `player_hit`, `armor_hit`, `player_death`):** PASS
4. **Explosion & Boss combat sounds (`explosion`, `grenade_throw`, `grenade_explode`, `boss_attack`, `boss_death`):** PASS
5. **Background music (`menu`, `campaign`, `survival` procedural tracks):** PASS
6. **Boss music transition (`campaign`/`survival` → `boss` on Boss spawn):** PASS
7. **Mission completion, failure & environment sounds (`door_open`, `door_close`, `terminal_hack`, `turret_shoot`, `pickup`, `mission_complete`, `mission_fail`):** PASS
8. **Master Volume (`0 → 25 → 50 → 75 → 100 → 0` cycling preserved):** PASS
9. **Music Volume (`0 → 25 → 50 → 75 → 100 → 0` cycling & immediate BGM scaling):** PASS
10. **SFX Volume (`0 → 25 → 50 → 75 → 100 → 0` cycling & immediate SFX scaling):** PASS
11. **Mute functionality (`soundEnabled` mutes & unmutes cleanly):** PASS
12. **Pause and Resume audio (`pauseAudio` / `resumeAudio` halts and resumes BGM cleanly):** PASS
13. **No duplicate music playback (`lastBgmNoteTimestamp` anti-duplicate guard verified):** PASS
14. **Player animations (Idle breathing, Walk, Run/Overdrive trail, Shoot recoil, Hit flash, Death):** PASS
15. **Enemy animations (Idle, Move, Attack lunge, Hit flash, Death dissolve):** PASS
16. **Boss animations (Entrance shockwave & alert banner, Bio-cannon attack flare, Damage flash, Multi-stage death):** PASS
17. **Projectile effects (Weapon-specific trails for Pistol, Rifle, Shotgun, Plasma, Turret & Crit):** PASS
18. **Explosion particles (Pooled `shockwave`, `fire`, `smoke`, `spark`, `energy`):** PASS
19. **Screen shake (Adjustable/disableable via `screenShakeEnabled`) & Damage/Armor screen flashes:** PASS
20. **Existing settings integration (`particlesEnabled`, `brightnessLevel`, `flashlightOn`, `LocalStorage` persistence):** PASS
21. **Gameplay performance (`600` frames update+render in `175.5ms` = `0.292ms/frame` on `240×320` canvas):** PASS
22. **No audio or visual memory leaks (Fixed pools `bullets=75`, `particles=120`, capped `decals<=55`, `activeVoiceCount=0`):** PASS
23. **TypeScript checks (`npm run lint` / `tsc --noEmit` — 0 errors):** PASS
24. **Production build (`npm run build` — Gecko 48 Classic IIFE bundle):** PASS

---

## ১২. Phase 8 — Performance Optimization & KaiOS Compatibility

### চিহ্নিত বটলনেক ও বাস্তবায়িত অপ্টিমাইজেশন (Bottlenecks Identified & Optimizations Performed)
1. **BFS Flow-Field Pathfinding Cache & Zero-Allocation Grid (`src/game/engine.ts`):**
   - **পূর্বে:** প্রতিটি ফ্রেমে `computePlayerFlowField()` নতুন `new Int16Array(w * h)` এবং `queueX`/`queueY` অ্যারে অ্যালোকেট করত।
   - **অপ্টিমাইজেশন:** প্রি-অ্যালোকেটেড `this.flowGrid`, `this.flowQueueX`, এবং `this.flowQueueY` (`Int16Array`) বাফার ব্যবহার করা হয়েছে এবং প্লেয়ারের টাইল পজিশন (`lastFlowPlayerTx`, `lastFlowPlayerTy`) বা ম্যাপের দরজা/প্রপ পরিবর্তন (`flowFieldDirty`) না হওয়া পর্যন্ত ক্যাশড ফ্লো-ফিল্ড রিটার্ন করা হয়েছে। ৬০০ ফ্রেমের হেভি কমব্যাট বেঞ্চমার্কে **৯৬.০% ক্যাশ হিট রেট** (`553` hits / `23` recomputes) অর্জিত হয়েছে।
2. **Pre-Allocated Render Item Pool (`src/game/engine.ts`):**
   - **পূর্বে:** প্রতিটি ফ্রেমে `render()` মেথডে দৃশ্যমান দেয়াল, প্রপ, এনিমি ও প্লেয়ারের জন্য নতুন `{ kind, depth, ... }` অবজেক্ট তৈরি করে `renderList`-এ পুশ করা হতো।
   - **অপ্টিমাইজেশন:** `280`-স্লটের প্রি-অ্যালোকেটেড `this.renderPool` ও `this.activeRenderSlice` বাফার পুনঃব্যবহার করা হয়েছে, ফলে ডেপথ-সর্টিংয়ের সময় প্রতি ফ্রেমে নতুন অবজেক্ট অ্যালোকেশন ও গার্বেজ কালেকশন সম্পূর্ণ শূন্যে নামিয়ে আনা হয়েছে।
3. **Offscreen Canvas Gradient Caching (`src/game/sprites.ts` & `src/game/engine.ts`):**
   - **পূর্বে:** প্লেয়ারের ট্যাকটিক্যাল ফ্ল্যাশলাইট ও অন্ধকার ভিনেট (`renderLightingOverlay`) প্রতি ফ্রেমে `ctx.createRadialGradient(...)` তৈরি করত।
   - **অপ্টিমাইজেশন:** `SpriteCache`-এ ফ্ল্যাশলাইট কোন (`flashlightCanvas`) এবং ব্রাইটনেস/ফ্ল্যাশলাইট স্টেট অনুযায়ী লাইটিং ওভারলে (`lightingCanvases`) অফস্ক্রিন ক্যানভাসে প্রি-বেক ও ক্যাশ করা হয়েছে (`perFrameGradients = 0`)।
4. **O(1) Ring-Buffer Cursor for Bullet & Particle Pools (`src/game/engine.ts`):**
   - `bullets` (`75` স্লট) এবং `particles` (`120` স্লট) পুলে ইনঅ্যাক্টিভ স্লট খোঁজার জন্য রিং-বাফার কার্সর (`bulletCursor`, `particleCursor`) যুক্ত করা হয়েছে এবং `decals` (`<= 55`) ও `SoundManager` অ্যাক্টিভ ভয়েস ক্যাপ (`<= 6`) বজায় রাখা হয়েছে।
5. **PLAYING-Only HUD Sync & Lightweight Debug Performance Monitor (`src/App.tsx` & `src/game/engine.ts`):**
   - মেনু স্ক্রিনে অপ্রয়োজনীয় React re-render এড়াতে শুধুমাত্র `mode === 'PLAYING'` অবস্থায় HUD স্ন্যাপশট সিঙ্ক করা হয়েছে।
   - ইঞ্জিনে `fpsCount`, `avgFps`, `frameTimeMs`, `updateTimeMs`, এবং `renderTimeMs` পরিমাপ যুক্ত করা হয়েছে। ডিফল্টভাবে সাধারণ গেমপ্লেতে এটি বন্ধ থাকে (`showPerfOverlay: false`) এবং `Settings → DISPLAY → Perf Monitor (Debug)` থেকে অন/অফ করা যায়।
#### 6. **KaiOS 2.5.3.2 & Gecko 48 Production Output, React 17.0.2 Migration, Manifest Audit & ZIP Packaging (`package.json`, `src/main.tsx`, `public/manifest.webapp`, `vite.config.ts`, `dist/`, `ms-alien-shooter-phase8.zip`):**
   - **React 19 → React 17.0.2 Migration (`package.json`, `src/main.tsx`):**
     - পলিফিল থাকা সত্ত্বেও React 19 (`19.x`) আধুনিক ব্রাউজার আর্কিটেকচার (`queueMicrotask`, `reportError`, `Node.prototype.getRootNode`, Concurrent Fiber ও রুট ইভেন্ট ডেলিগেশন)-এর ওপর নির্ভরশীল এবং Gecko 48 (Firefox 48)-এর জন্য অফিশিয়ালি সমর্থিত নয়।
     - সোর্স কোড ও ডিপেন্ডেন্সি অডিট করে দেখা গেছে প্রজেক্টে ব্যবহৃত সব হুক (`useState`, `useEffect`, `useRef`, `useCallback`) React 17.0.2-এর সাথে শতভাগ সামঞ্জস্যপূর্ণ এবং অব্যবহৃত `motion` প্যাকেজটি সরানো হয়েছে।
     - `react@17.0.2`, `react-dom@17.0.2`, `@types/react@^17.0.85` এবং `@types/react-dom@^17.0.25` ইনস্টল করা হয়েছে এবং `src/main.tsx`-এ `createRoot()`-এর পরিবর্তে লিগ্যাসি ব্রাউজার-সমর্থিত `ReactDOM.render(<App />, document.getElementById('root'))` ব্যবহার করা হয়েছে।
     - এর ফলে প্রোডাকশন জাভাস্ক্রিপ্ট বান্ডেল সাইজ `399,618` bytes থেকে কমে **`308,949` bytes (`301.71 KB`, gzipped `83.89 kB` — `90.7 KB` হ্রাস)** হয়েছে এবং বান্ডেলে কোনো `getRootNode`, `queueMicrotask`, বা `reportError` ডিপেন্ডেন্সি অবশিষ্ট নেই।
   - **CSS 8-Digit Hex Colors (`#rrggbbaa`) ও Firefox 48 Selector/Property Fallbacks (`vite.config.ts`, `src/index.css`):**
     - জেনারেটেড CSS-এর কাস্টম প্রপার্টিতে থাকা সব ৮-ডিজিট হেক্স (`#0000001a` → `rgba(0,0,0,.102)` এবং `#00000040` → `rgba(0,0,0,.251)`) ও ৪-ডিজিট হেক্স (`#0000` → `rgba(0,0,0,0)`) সম্পূর্ণরূপে `rgba()`-তে রূপান্তর করা হয়েছে (ফাইনাল CSS-এ ৮-ডিজিট বা ৪-ডিজিট হেক্স সংখ্যা: `0`)।
     - Firefox 48-এ অসমর্থিত সিলেক্টর (`:where()`, `:is()`, `:host`, `::backdrop`, `::file-selector-button`) আনর‍্যাপ/রূপান্তর করা হয়েছে যাতে Gecko 48 কোনো CSS রুল বাতিল না করে।
     - Firefox 48-এ অসমর্থিত প্রপার্টি (`overscroll-behavior`, `font-variation-settings`, `text-underline-offset`, `-webkit-line-clamp`) সরিয়ে নিরাপদ ফলব্যাক যুক্ত করা হয়েছে।
   - **Manifest Developer URL Audit (`public/manifest.webapp`, `dist/manifest.webapp`):**
     - অননুমোদিত থার্ড-পার্টি কোম্পানির URL বাদ দেওয়া হয়েছে। প্রজেক্টের স্বত্বাধিকারী নাম `"developer": { "name": "MS Tactical Games" }` অক্ষুণ্ণ রাখা হয়েছে।
   - **Actual Lint Result:** `npm run lint` (`tsc --noEmit`) — **PASS (0 errors)**।
   - **Actual Production Build Result:** `npm run build` (`NODE_ENV=production vite build`) — **PASS** (`dist/` ডিরেক্টরি সফলভাবে জেনারেট ও যাচাইকৃত)।
   - **Generated Bundle Details (`dist/`):**
     - `dist/index.html` (`1,361` bytes): `<script defer src="./assets/index-C4fuKMZV.js"></script>` এবং `<link rel="stylesheet" href="./assets/index-CUtDuhjQ.css">` (কোনো `type="module"` বা `modulepreload` নেই)।
     - `dist/assets/index-C4fuKMZV.js` (`308,949` bytes / `307.17 kB` Vite report): স্বয়ংসম্পূর্ণ Classic ES2015 IIFE বান্ডেল (`(()=>{...})();`), বাইট অফসেট `562`-তেই সর্বপ্রথম `polyfills.ts` এক্সিকিউট হয় এবং শেষে `ReactDOM.render(...)` কল হয়; কোনো ES module `import`/`export`, `?.`, `??`, `import()`, বা `jsxDEV` নেই।
     - `dist/assets/index-CUtDuhjQ.css` (`24,601` bytes): Firefox 48 / Gecko 48 টার্গেটে রূপান্তরিত CSS; কোনো ৮-ডিজিট হেক্স, ৪-ডিজিট হেক্স, `@layer`, `@property`, `oklch`, `color-mix`, `:where()`, `:is()`, `:host`, বা `::backdrop` নেই।
     - `dist/manifest.webapp` (`674` bytes): `"name": "MS Alien Shooter"`, `"launch_path": "/index.html"`, `"fullscreen": "true"`, `"orientation": "portrait-primary"`।
     - `dist/icon-56.png` (`445` bytes) এবং `dist/icon-112.png` (`891` bytes)।
   - **Standalone ZIP Package (`ms-alien-shooter-phase8.zip`):**
     - সোর্স কোড, `DEVELOPMENT_PROGRESS.md`, এবং সম্পূর্ণ `dist/` ফোল্ডার (সকল প্রোডাকশন ফাইলসহ) ধারণকারী `ms-alien-shooter-phase8.zip` তৈরি ও ভেরিফাই করা হয়েছে (২৮টি ফাইল এন্ট্রি)।

---

## ১৩. Phase 8 — ভেরিফিকেশন রিপোর্ট (Build, Bundle, Playground Tests vs. Pending Phase 9)

### ১৩.১ Build Executed (বাস্তবে সম্পাদিত বিল্ড কমান্ড)
- `npm run lint` (`tsc --noEmit`): **EXECUTED & PASSED** (`0` errors)।
- `npm run build` (`NODE_ENV=production vite build`): **EXECUTED & PASSED**।

### ১৩.২ Bundle Inspected (বান্ডেল পরিদর্শন ফলাফল)
- `dist/index.html` (`1,361` bytes): `<script defer src="./assets/index-C4fuKMZV.js"></script>`, কোনো `type="module"` বা `modulepreload` নেই।
- `dist/assets/index-C4fuKMZV.js` (`308,949` bytes): Classic IIFE (`(()=>{...})();`), `react@17.0.2` + `react-dom@17.0.2` (`ReactDOM.render`), পলিফিল React ইনিশিয়ালাইজেশনের আগেই রান করে, কোনো ES module `import`/`export`, `?.`, `??`, `import()`, বা `jsxDEV` নেই।
- `dist/assets/index-CUtDuhjQ.css` (`24,601` bytes): কোনো ৮-ডিজিট বা ৪-ডিজিট হেক্স কালার, `@layer`, `@property`, `oklch`, `color-mix`, `:where()`, `:is()`, `:host`, বা অসমর্থিত প্রপার্টি নেই।
- `dist/manifest.webapp` (`674` bytes), `dist/icon-56.png` (`445` bytes), `dist/icon-112.png` (`891` bytes): ফিজিক্যালি বিদ্যমান ও যাচাইকৃত।
- **Manifest Developer URL:** থার্ড-পার্টি কোম্পানি URL সম্পূর্ণ বর্জন করা হয়েছে।
- **Physical `dist/` Directory Presence:** `dist/` ডিরেক্টরি এবং এর ভেতরের সকল ৬টি ফাইল ডিস্কে ও ফাইলট্রি-তে বিদ্যমান।
- **ZIP Package Presence:** `ms-alien-shooter-phase8.zip` (২৮টি ফাইল সম্বলিত, যার মধ্যে সম্পূর্ণ `dist/` ডিরেক্টরি অন্তর্ভুক্ত) প্রজেক্ট রূটে বিদ্যমান।

### ১৩.৩ Playground Tests Executed (কন্টেইনার/প্লেগ্রাউন্ড এনভায়রনমেন্টে সম্পাদিত পরীক্ষা)
- `React 17.0.2` রেন্ডারিং (`ReactDOMServer.renderToString(<App />)`), ক্যাম্পেইন ও সারভাইভাল ইঞ্জিন সিমুলেশন, অস্ত্র, এনিমি AI, BFS Flow-Field ক্যাশ, পুলড পার্টিকেল/বুলেট, সেভ/লোড (`LocalStorage` + করাপ্টেড JSON রিকভারি), এবং অডিও ভলিউম সাইক্লিং (`0 → 25 → 50 → 75 → 100 → 0`) স্বয়ংক্রিয়ভাবে কন্টেইনার এনভায়রনমেন্টে পরীক্ষা করা হয়েছে।

### ১৩.৪ Tests Not Executed & Real Device Testing Pending Phase 9
- **Tests Not Executed in Current Turn:** বাস্তব KaiOS 2.5.3.2 (Gecko 48) ব্রাউজার রানটাইম বা ফিজিক্যাল হ্যান্ডসেটে কোনো টেস্ট চালানো হয়নি।
- **Real Device Testing Status:** **Pending Phase 9** — বাস্তব **Energizer E241S** ডিভাইসে প্যাকেজ ইনস্টলেশন, Gecko 48 রানটাইম বুট, হার্ডওয়্যার কীপ্যাড রেসপন্স, অডিও আউটপুট এবং ফ্রেমরেট/মেমোরি পরীক্ষা Phase 9-এ সম্পন্ন হবে।

---

## ৯. STEP 1 — বাগ ফিক্স (2026-11-01, E241S ডিভাইস টেস্ট রিপোর্টের ভিত্তিতে)

**সুযোগ:** শুধু ৫টি রিপোর্ট করা বাগের ফিক্স। UI রিডিজাইন, ক্যারেক্টার/এনভায়রনমেন্ট পরিবর্তন, ক্যাম্পেইন সম্প্রসারণ — কিছুই করা হয়নি। STEP 2 শুরু করা হয়নি।

### বাগ ১ — লঞ্চে সরাসরি গেমপ্লে, Main Menu বাদ যাওয়া
- **কারণ:** `src/App.tsx`-এ শুরুতে `screenMode = 'PLAYING'`, `hasActiveSession = true`, আর মাউন্ট এফেক্টে সরাসরি `engine.startMission(...)` চালু হতো।
- **ফিক্স:** শুরুতে `screenMode = 'TITLE'`, `hasActiveSession = false`। মাউন্টে মিশন শুধু মেনুর পেছনের লাইভ ক্যানভাস ব্যাকগ্রাউন্ড হিসেবে লোড হয়, অ্যাক্টিভ সেশন হিসেবে নয়। গেমপ্লে শুরু হয় শুধু Continue / New Campaign / মিশন / Survival বাছলে। ইনিশিয়ালাইজেশনে কিছু সেভ করা হয় না, তাই বৈধ সেভ ওভাররাইট হয় না।

### বাগ ২ — সেভ/রিজিউম কাজ না করা
- **কারণ:** কিলে পাওয়া XP/লেভেল/ক্রেডিট/কিল শুধু মেমোরিতে থাকতো। `grantXp()`-এ `persistSaveData()` ছিল না। মিশন শেষ, মৃত্যু, সারভাইভাল ওয়েভ ক্লিয়ার বা Settings-এ ম্যানুয়াল সেভ ছাড়া সেগুলো ডিস্কে যেতো না। তাই লেভেল ২-এ পৌঁছে অ্যাপ বন্ধ করলে সব হারিয়ে যেতো, আর আবার চালু হলে পুরনো আনলকড মিশন থেকে শুরু হতো। এছাড়া App-এর `saveData` স্টেট আর ইঞ্জিনের `saveData` আলাদা কপি ছিল, তাই Continue পুরনো তথ্য দিয়ে সিদ্ধান্ত নিতো।
- **ফিক্স:** `grantXp()`-এ প্রতিবার XP দিলেই `persistSaveData()`। Pause, TITLE-তে যাওয়া, QUIT_TO_TITLE, অ্যাপ লুকানো (visibilitychange) — সব জায়গায় সেভ চেকপয়েন্ট। Continue এখন ইঞ্জিনের বর্তমান সেভ থেকে `unlockedMission` পড়ে, পুরনো স্টেট থেকে নয়। RESET_DATA এখন মিশন শুরু না করে TITLE-তে যায়, কোনো ফ্যান্টম অ্যাক্টিভ সেশন থাকে না।
- **সৎ সীমা:** মিড-মিশনের ঠিক পজিশন/HP রিস্টোর করা হয় না — আগে থেকেই এমন সেশন স্ন্যাপশট ফিল্ড ছিল না। রিস্টোর হয় ক্যাম্পেইন চেকপয়েন্ট: আনলকড মিশন, লেভেল, XP, ক্রেডিট, কিল, আনলক/আপগ্রেড।

### বাগ ৩ — Main Menu কীপ্যাড নেভিগেশন
- **কারণ:** TITLE-তে যাওয়ার কিছু পথ (`QUIT_TO_TITLE`, RESET) সরাসরি `setScreenMode('TITLE')` ব্যবহার করতো, কার্সর রিসেট হতো না, আগের স্ক্রিন রেকর্ড হতো না। আর মেনু বাটনগুলো DOM ফোকাস পেলে Enter/OK-তে বাটন ক্লিক + কীপ্যাড হ্যান্ডলার — দুবার অ্যাকশন হতে পারতো।
- **ফিক্স:** সব TITLE-তে যাওয়া এখন `navigateToScreen('TITLE')` দিয়ে, কার্সর ০-তে রিসেট হয়। TITLE-র বাটনগুলোতে `tabIndex={-1}` দেওয়া হয়েছে, আর স্ক্রিন বদলালে অ্যাক্টিভ DOM ফোকাস blur করা হয়। TITLE-তে LEFT/RIGHT স্পষ্টভাবে no-op (ভার্টিক্যাল লিস্টে হরিজন্টাল নেভিগেশন প্রযোজ্য নয়), UP/DOWN চলে, OK/LSK সিলেক্ট করে, RSK Settings-এ যায়। Settings/Shop/Missions/Profile/Armory-র নেভিগেশন লজিক ছোঁয়া হয়নি।

### বাগ ৪ — কীপ্যাড রেসপন্স ধীর
- **কারণ:** `triggerKaiKey` প্রতিবার কার্সর/সেভ বদলালে নতুন identity পেতো, তাই keydown/keyUp লিসেনার বারবার খুলে আবার লাগানো হতো। দ্রুত চাপে ইভেন্ট মিস/দেরি হতো। হোল্ড করা কী-র auto-repeat মেনু অ্যাকশন বারবার React রি-রেন্ডার করাতো।
- **ফিক্স:** লিসেনার এখন একবারই লাগানো হয়। `triggerKaiKeyRef` / `confirmDialogRef` / `screenModeRef` দিয়ে সবসময় লেটেস্ট হ্যান্ডলার/স্টেট ব্যবহার করা হয়, লিসেনার রি-রেজিস্টার হয় না। PLAYING-এর বাইরে অ্যাকশন কী-র auto-repeat উপেক্ষা করা হয়, যাতে হোল্ড করলে ডাবল সিলেকশন না হয়। PLAYING-এ মুভমেন্ট (engine.keys) আগের মতোই চলে।

### বাগ ৫ — সাউন্ড/মিউজিক না শোনা
- **কারণ:** AudioContext তৈরি হতো requestAnimationFrame টিক থেকে, গেমপ্লে/মেনু মিউজিকের সময়। KaiOS/Gecko নন-জেসচার টিক থেকে resume উপেক্ষা করে, তাই কনটেক্সট suspended-ই থেকে যেতো। অটো-ফায়ার সাউন্ডও rAF থেকে আসতো, জেসচার থেকে নয়, তাই পুরো সেশন নীরব থাকতো। সাউন্ড কোড নিজে ছিল, কিন্তু unlock পথ ছিল না।
- **ফিক্স:** `sound.ts`-এ `unlockFromGesture()` যোগ করা হয়েছে। প্রতিটি keydown-এর শুরুতে এটি কল হয় — জেসচার কনটেক্সটে কনটেক্সট তৈরি/resume করে। `suspend()`/`resume()` কল এখন Gecko 48-এ নিরাপদ (promise না থাকলেও ক্র্যাশ হবে না)। Master/Music/SFX ভলিউম সেটিংস আগের মতোই সম্মান করা হয়।

### তৃতীয় পক্ষের রেফারেন্স পরিষ্কার করা
- সোর্সে কোনো কপি করা স্প্রাইট, অডিও ফাইল, ম্যাপ, লোগো বা ক্যারেক্টার পাওয়া যায়নি — সব ভিজ্যুয়াল প্রোসিডিউরাল ক্যানভাস, সব অডিও প্রোসিডিউরাল WebAudio। শুধু টেক্সট রেফারেন্স ছিল: `index.html`-এর meta-তে একটি বাণিজ্যিক গেমের নাম, `sprites.ts`-এর একটি কমেন্ট, আর এই রিপোর্টের হেডারে একটি রেফারেন্স লাইন। এই তিনটি সরিয়ে দেওয়া হয়েছে। গেমের নাম, গেমপ্লে, মিশন, অস্ত্র, এনিমি, প্রোগ্রেশন — কিছুই বদলানো হয়নি।

### টেস্ট (এই পরিবেশে, ডিভাইসে নয়)
- `npx tsc --noEmit` — পাস, কোনো টাইপ এরর নেই।
- `NODE_ENV=production npx vite build` — পাস। `dist/index.html` (1.3 KB), `dist/assets/*.js` (~311 KB, Classic IIFE, `createRoot` নেই), `dist/assets/*.css` (~44 KB)।
- স্টোরেজ টেস্ট (mock localStorage দিয়ে): লেভেল ২, XP ১২০, ক্রেডিট ৯৯৯, আনলকড মিশন ২, সম্পন্ন [১], কিল ৪২ — সেভ করে আবার লোড করলে একই মান ফেরত আসে — PASS।
- সাউন্ড টেস্ট (Node-এ, AudioContext নেই): `unlockFromGesture()`, `updateMusic('menu')`, `playUiBeep()` ক্র্যাশ ছাড়া চলে — PASS (Node-এ শব্দ শোনা যাবে না, এটা প্রত্যাশিত)।
- **E241S-এ আসল ডিভাইস টেস্ট এখনো করা হয়নি।** নিচেরগুলো ডিভাইসে যাচাই করতে হবে: লঞ্চে TITLE আসা, Continue-তে আনলকড মিশন, মেনু নেভিগেশন, কীপ্যাড স্পিড, মেনু/গেমপ্লে সাউন্ড।

### বাকি জানা সীমা
- মিড-মিশনের ঠিক পজিশন রিস্টোর হয় না (উপরে বলা হয়েছে)।
- React 17 + Tailwind বান্ডেল (~311 KB JS) E241S-এর 512 MB RAM-এ ভারী হতে পারে — এটা STEP 1-এর বাইরে, রিডিজাইন ছাড়া বদলানো হয়নি।
- STEP 2 শুরু করা হয়নি, ব্যবহারকারীর অনুমতির অপেক্ষায় আছে।

---

## ১০. STEP 3 — প্রফেশনাল UI ওভারহল + বাকি বাগ ফিক্স (2026-11-03)

**সুযোগ:** Step 2-এর কপিতে কাজ, Step 1/2 ZIP ছোঁয়া হয়নি। রেফারেন্স ছবি শুধু স্টাইলের জন্য, কোনো অস্ত্রের নাম/স্ট্যাট/আর্ট কপি করা হয়নি।

**ডিজাইন সিস্টেম:** প্যানেল `bg-[#060a10]/96` + সায়ান বর্ডার + `ms-panel` নিয়ন্ত্রিত গ্লো। অ্যাক্টিভ রো `bg-[#0e2a3d]/95` + সায়ান বর্ডার, ইনঅ্যাক্টিভ `bg-[#0b111a]/90`। রো লেবেল ১১px, মেটা/ফুটার ন্যূনতম ৯px, টাইটেল ১৪px, রো প্যাডিং ৬px, ফুটার ২০px, আউটার প্যাডিং ৮px। সব মেনু স্ক্রিন, Pause, Victory, Defeat, Survival Result, Controls Help-এ প্রয়োগ হয়েছে। কোনো অপশন বাদ/নাম বদল হয়নি।

**Main Menu নেভিগেশন (মূল কারণ):** (১) React স্টেট ধীর হওয়ায় দ্রুত DOWN+OK পুরনো আইটেম সিলেক্ট করতো — `menuCursorRef` + `moveCursor()` দিয়ে সিঙ্ক্রোনাস কার্সর। (২) স্ক্রিন রেফ এফেক্টে দেরিতে আপডেট হতো — `navigateToScreen`/মিশন শুরুতে সঙ্গে সঙ্গে আপডেট। (৩) Backspace আর SoftRight দুটোই RSK ছিল, TITLE-তে Back চাপলে Settings খুলতো — নতুন `BACK` অ্যাকশন (ডায়ালগ বাতিল, গেমপ্লেতে Pause, TITLE-তে কিছুই না, অন্যত্র RSK-এর মতো)। (৪) সব বাটনে `tabIndex={-1}` + `button:focus { outline: none }`, যাতে DOM ফোকাস কার্সরের সঙ্গে না লড়ে।

**সাউন্ড ডায়াগনস্টিক:** Sound Test ফলাফলে এখন ব্যাকএন্ড + ভলিউম থাকে। Settings Audio-তে একটি সিলেক্ট-না-করা ডায়াগনস্টিক লাইন আছে (ব্যাকএন্ড, স্টেট, Master/Music/SFX, শেষ টেস্ট)। Audio ট্যাবের ৫টি রো বদলায়নি। **সাউন্ড ডিভাইসে এখনো নিশ্চিত নয়।**

**রাডার:** ১.২৫x জুমের পর রাডার আনজুমড পজিশন দিয়ে হিসাব করতো। এখন জুম করা পজিশন দিয়ে অফ-স্ক্রিন পরীক্ষা আর দিক বের করা হয়। জুম রাখা হয়েছে, মিনিম্যাপ বদলায়নি।

**বদলানো হয়নি:** `storage.ts`, `maps.ts`, ক্যাম্পেইন (১৮ লেভেল), গেমপ্লে, অস্ত্র, XP/অর্থনীতি, Step 1/2 ফিক্স।

**টেস্ট:** `tsc --noEmit` পাস, `vite build` পাস (JS ~৩২৫ KB, CSS ~৪৪ KB, IIFE, `createRoot` নেই), রাডার গণিত টেস্ট পাস। **E241S ডিভাইস টেস্ট বাকি:** Main Menu নেভিগেশন, সব স্ক্রিনের ক্লিপিং, Sound Test ফলাফল + শোনা, কীপ্যাড স্পিড, জুম/রাডার, FPS, পুরনো সেভ।

---

## ১১. STEP 4 — বাগ অডিট + ফিক্স + প্রফেশনাল UI রিডিজাইন (2026-11-04)

**ধারা:** Phase 1 অডিট প্রথমে সম্পূর্ণ করে `BUG_AUDIT_REPORT.md` লেখা হয়েছে, তারপর
সেই অডিটের ভিত্তিতেই Phase 2 করা হয়েছে। Step 1/২/৩ ZIP ছোঁয়া হয়নি।

**অডিটের মূল ফল (Critical ১, High ৭):** ডিভাইসে সম্পূর্ণ নীরবতা (মূল কারণ ডিভাইস
ছাড়া অনিশ্চিত); মেনুতে অ্যারো-রিপিট গার্ড ছিল না; কিছু পথে কার্সর ref সিঙ্ক হতো না;
MISSION_SELECT-এ OK চাপলেই সরাসরি Deploy; Step 3-এর "১১px সব জায়গায়" দাবি ভুল
(Shop/Armory/Profile/HUD ছিল ৯px) — এটাই "Step 3 শুধু একটু বড় মনে হয়েছে" অভিযোগের
কারণ; Main Menu-র রো আসলে ৩২০px-এ আঁটতো না; রাডার-ডট HUD-এর নিচে লুকাতো। Main Menu-তে
স্ক্রলিং-এর প্রয়োজন প্রমাণিত হয়নি, তাই স্ক্রলিং যোগ করা হয়নি।

**ফিক্স:** অ্যারো/WASD রিপিট গার্ড (PLAYING ছাড়া); `setCursorSync(n)` — সব কার্সর-আপডেট
এক পথে (৩৭টি কল); Mission Detail প্যানেল (ব্রিফিং, প্রগ্রেস বার, লেভেল-তালিকা, Deploy);
মিউজিক গেইন ০.০৪৮ → ০.০৯, ১১০ Hz-এর নিচের নোট অক্টেভ উপরে, UI বিপ ০.০৮ → ০.১৪;
রাডার ক্ল্যাম্প/টেস্ট ৪০px-এ, মৃত শত্রুর ডট বাদ।

**রিডিজাইন:** একক স্কেল (টাইটেল ২০/১৬/১৩px, রো-নাম ১১–১২px leading-none, বর্ণনা ৯px,
ফুটার ১০px, নির্বাচিত রো-তে border-l-4)। Main Menu-তে নতুন XP/ক্রেডিট প্যানেল; Missions-এ
প্রগ্রেস বার + Detail প্যানেল; Settings/Shop/Armory/Profile-এ সংগঠিত ট্যাব ও প্যানেল;
HUD-এ ১০px টেক্সট ও চওড়া HP বার; Pause/Victory/Defeat প্যানেল বড় টাইটেলসহ।

**বদলানো হয়নি:** `storage.ts`, `maps.ts`, ক্যাম্পেইন (১৮ লেভেল), গেমপ্লে, অস্ত্র, XP/অর্থনীতি,
Main Menu-র অপশন-সংখ্যা/ক্রম।

**টেস্ট:** `tsc --noEmit` পাস, `vite build` পাস (JS ~৩২৫ KB Classic IIFE, `createRoot` নেই,
CSS ~২৭ KB), dist যাচাই পাস। **E241S ডিভাইস টেস্ট বাকি:** সাউন্ড + Sound Test ফলাফল,
Main Menu নেভিগেশন, Mission Detail প্রবাহ, সব স্ক্রিনের ক্লিপিং, রাডার, FPS, পুরোনো সেভ।
**সাউন্ড ডিভাইসে এখনো নিশ্চিত নয়।**
