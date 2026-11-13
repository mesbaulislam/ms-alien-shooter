import { MissionDef, TileKind } from './types';

// Legend:
// 0: Dirt/Grass perimeter
// 1: Concrete Floor
// 2: Hazard Floor
// 3: Lab Grate Floor
// 4: Steel Bunker Wall (Solid, Blocks LOS)
// 5: Lab Containment Wall (Solid, Blocks LOS)
// 6: Sandbag Barricade (Solid movement, shoot-over)
// 7: Explosive Fuel Barrel
// 8: Alien Spawn Vent
// 9: Security Terminal (Objective / Unlocks Blast Doors & Supplies)
// 10: Supply Crate (Destructible Loot)
// 11: Toxic Acid Pool
// 12: Extraction Beacon
// 13: Locked Armored Blast Door (Opens via Terminal or OK interaction)
// 14: Open Armored Blast Door Threshold
// 15: Automated Military Sentry Turret (Activate with OK)
// 16: Alien Bio-Stasis Containment Pod (Destructible Lab Specimen Pod)

const MISSION_01_TILES: TileKind[][] = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 0, 0, 1, 1, 1, 4, 8, 1, 1, 8, 4, 1, 1, 10, 0, 0, 4],
  [4, 0, 1, 1, 2, 1, 4, 1, 1, 7, 1, 4, 1, 9, 1, 1, 0, 4],
  [4, 1, 1, 10, 1, 1, 13, 1, 1, 1, 1, 13, 1, 1, 7, 1, 1, 4],
  [4, 1, 2, 1, 1, 6, 1, 1, 1, 15, 1, 1, 6, 1, 1, 2, 1, 4],
  [4, 1, 1, 7, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 10, 1, 8, 4],
  [4, 4, 4, 2, 1, 1, 4, 4, 13, 13, 4, 4, 1, 1, 2, 4, 4, 4],
  [4, 8, 1, 1, 1, 1, 4, 3, 3, 3, 3, 4, 1, 1, 1, 1, 8, 4],
  [4, 1, 1, 9, 1, 1, 2, 3, 9, 10, 3, 2, 1, 1, 7, 1, 1, 4],
  [4, 1, 10, 1, 1, 1, 4, 3, 16, 16, 3, 4, 1, 10, 1, 1, 1, 4],
  [4, 4, 4, 2, 1, 1, 4, 4, 2, 2, 4, 4, 1, 1, 2, 4, 4, 4],
  [4, 0, 1, 1, 1, 6, 1, 1, 1, 15, 1, 1, 6, 1, 1, 1, 0, 4],
  [4, 0, 1, 7, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 7, 1, 0, 4],
  [4, 8, 1, 1, 1, 10, 1, 1, 1, 1, 1, 1, 10, 1, 1, 1, 8, 4],
  [4, 0, 0, 1, 1, 2, 1, 1, 12, 1, 1, 2, 1, 1, 0, 0, 0, 4],
  [4, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 4],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];

const MISSION_02_TILES: TileKind[][] = [
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 8, 3, 3, 10, 3, 5, 8, 3, 3, 8, 5, 3, 10, 3, 3, 8, 5],
  [5, 16, 3, 3, 3, 3, 13, 3, 11, 11, 3, 13, 3, 3, 3, 3, 16, 5],
  [5, 9, 3, 3, 3, 3, 5, 3, 11, 11, 3, 5, 3, 3, 3, 9, 3, 5],
  [5, 5, 2, 3, 5, 3, 5, 3, 3, 15, 3, 5, 3, 5, 3, 2, 5, 5],
  [5, 3, 3, 3, 3, 3, 2, 3, 7, 7, 3, 2, 3, 3, 3, 3, 3, 5],
  [5, 8, 3, 11, 3, 6, 3, 3, 9, 3, 3, 6, 3, 11, 3, 3, 8, 5],
  [5, 3, 16, 11, 3, 3, 3, 3, 15, 3, 3, 3, 3, 11, 16, 10, 3, 5],
  [5, 3, 7, 3, 3, 5, 5, 2, 3, 3, 2, 5, 5, 3, 3, 7, 3, 5],
  [5, 3, 10, 3, 3, 13, 3, 3, 12, 3, 3, 13, 3, 3, 10, 3, 3, 5],
  [5, 8, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 8, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];

const MISSION_03_TILES: TileKind[][] = [
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 8, 2, 3, 7, 16, 11, 11, 11, 16, 7, 3, 2, 8, 5, 5],
  [5, 2, 3, 3, 3, 3, 3, 9, 3, 3, 3, 3, 3, 2, 5, 5],
  [5, 3, 7, 6, 3, 15, 3, 3, 3, 15, 3, 6, 7, 3, 5, 5],
  [5, 8, 3, 3, 10, 3, 2, 13, 2, 3, 10, 3, 3, 8, 5, 5],
  [5, 3, 16, 3, 3, 2, 3, 3, 3, 2, 3, 3, 16, 3, 5, 5],
  [5, 11, 3, 7, 2, 3, 3, 3, 3, 3, 2, 7, 3, 11, 5, 5],
  [5, 11, 9, 3, 3, 3, 3, 3, 3, 3, 3, 3, 9, 11, 5, 5],
  [5, 8, 3, 3, 10, 3, 2, 2, 2, 3, 10, 3, 3, 8, 5, 5],
  [5, 3, 7, 6, 3, 3, 3, 12, 3, 3, 3, 6, 7, 3, 5, 5],
  [5, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 5, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];

const MISSION_04_TILES: TileKind[][] = [
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  [5, 8, 3, 3, 16, 3, 3, 8, 3, 3, 8, 3, 3, 16, 3, 3, 8, 5],
  [5, 3, 3, 7, 3, 3, 2, 3, 9, 3, 3, 2, 3, 3, 7, 3, 3, 5],
  [5, 3, 10, 3, 3, 15, 3, 3, 3, 3, 3, 3, 15, 3, 3, 10, 3, 5],
  [5, 8, 3, 3, 5, 13, 3, 3, 2, 2, 3, 3, 13, 5, 3, 3, 8, 5],
  [5, 3, 16, 3, 3, 3, 3, 11, 3, 3, 11, 3, 3, 3, 3, 16, 3, 5],
  [5, 3, 7, 3, 3, 6, 3, 3, 3, 3, 3, 3, 6, 3, 3, 7, 3, 5],
  [5, 3, 9, 3, 3, 3, 3, 11, 3, 3, 11, 3, 3, 3, 3, 9, 3, 5],
  [5, 8, 3, 3, 10, 3, 3, 3, 3, 3, 3, 3, 3, 10, 3, 3, 8, 5],
  [5, 3, 7, 3, 3, 15, 3, 2, 12, 2, 3, 15, 3, 3, 7, 3, 3, 5],
  [5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];

const SURVIVAL_ARENA_TILES: TileKind[][] = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 8, 2, 1, 10, 1, 1, 8, 8, 1, 1, 10, 1, 2, 8, 4],
  [4, 2, 1, 7, 1, 1, 2, 1, 1, 2, 1, 1, 7, 1, 2, 4],
  [4, 1, 1, 1, 15, 1, 1, 9, 9, 1, 1, 15, 1, 1, 1, 4],
  [4, 8, 1, 6, 1, 3, 3, 3, 3, 3, 3, 1, 6, 1, 8, 4],
  [4, 1, 16, 1, 3, 3, 2, 2, 2, 2, 3, 3, 1, 16, 1, 4],
  [4, 1, 7, 1, 3, 2, 3, 3, 3, 3, 2, 3, 1, 7, 1, 4],
  [4, 8, 1, 6, 1, 3, 3, 12, 3, 3, 3, 1, 6, 1, 8, 4],
  [4, 1, 10, 1, 15, 1, 1, 1, 1, 1, 1, 15, 1, 10, 1, 4],
  [4, 2, 1, 7, 1, 1, 2, 8, 8, 2, 1, 1, 7, 1, 2, 4],
  [4, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 8, 4],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];

export const SURVIVAL_ARENA_MISSION: MissionDef = {
  id: 99,
  code: 'S-01',
  title: 'Survival Arena: Outpost Siege',
  location: 'Defense Perimeter Alpha',
  briefing:
    'Endless xenomorph waves are storming the perimeter. Hold the line as long as possible, earn credits and XP after every wave, and set a new survival record.',
  objectiveText: 'Survive Endless Alien Waves',
  ambientDarkness: 0.28,
  width: SURVIVAL_ARENA_TILES[0].length,
  height: SURVIVAL_ARENA_TILES.length,
  tiles: SURVIVAL_ARENA_TILES,
  playerStart: { wx: 7.5, wy: 6.5 },
  extractionPoint: { wx: 7.5, wy: 7.5 },
  totalWaves: 999,
  levelCount: 1,
  waveConfig: [{ basic: 6, fast: 3, heavy: 1, ranged: 1, boss: 0 }],
  rewardCredits: 150,
  rewardXp: 120,
};

export const MISSIONS: MissionDef[] = [
  {
    id: 1,
    code: 'M-01',
    title: 'Mission 01: Military Outpost',
    location: 'Sector 7 Perimeter Base',
    briefing:
      'Xenomorph swarm has breached Outpost Delta. Breach blast doors, activate automated sentry turrets, hack security terminals, and reach the extraction beacon.',
    objectiveText: 'Clear Outpost & Reach Beacon',
    ambientDarkness: 0.18,
    width: MISSION_01_TILES[0].length,
    height: MISSION_01_TILES.length,
    tiles: MISSION_01_TILES,
    playerStart: { wx: 8.5, wy: 14.2 },
    extractionPoint: { wx: 8.5, wy: 14.0 },
    totalWaves: 3,
    levelCount: 4,
    waveConfig: [
      { basic: 6, fast: 2, heavy: 0, ranged: 1, boss: 0 },
      { basic: 7, fast: 4, heavy: 1, ranged: 2, boss: 0 },
      { basic: 8, fast: 4, heavy: 2, ranged: 3, boss: 0 },
    ],
    rewardCredits: 350,
    rewardXp: 250,
    objectives: {},
  },
  {
    id: 2,
    code: 'M-02',
    title: 'Mission 02: Bio-Research Lab',
    location: 'Sub-Level 4 Genetics Wing',
    briefing:
      'Bio-stasis pods have ruptured inside the darkened genetics wing. Use your tactical flashlight (*), bring lab sentry turrets online, and purge the containment sectors.',
    objectiveText: 'Purge Bio-Lab Containment',
    ambientDarkness: 0.42,
    width: MISSION_02_TILES[0].length,
    height: MISSION_02_TILES.length,
    tiles: MISSION_02_TILES,
    playerStart: { wx: 8.5, wy: 9.2 },
    extractionPoint: { wx: 8.5, wy: 9.0 },
    totalWaves: 3,
    levelCount: 4,
    waveConfig: [
      { basic: 6, fast: 4, heavy: 2, ranged: 3, boss: 0 },
      { basic: 8, fast: 5, heavy: 3, ranged: 4, boss: 0 },
      { basic: 9, fast: 6, heavy: 4, ranged: 4, boss: 0 },
    ],
    rewardCredits: 550,
    rewardXp: 420,
    objectives: {},
  },
  {
    id: 3,
    code: 'M-03',
    title: 'Mission 03: Omega Hive Core',
    location: 'Deep Reactor Chamber',
    briefing:
      'A colossal Brood Overlord is nesting in the pitch-dark reactor core. Activate dual defense turrets, protect the core, shatter stasis pods, and terminate the apex xenomorph.',
    objectiveText: 'Slay the Brood Overlord',
    ambientDarkness: 0.52,
    width: MISSION_03_TILES[0].length,
    height: MISSION_03_TILES.length,
    tiles: MISSION_03_TILES,
    playerStart: { wx: 7.5, wy: 9.2 },
    extractionPoint: { wx: 7.5, wy: 9.0 },
    totalWaves: 2,
    levelCount: 5,
    waveConfig: [
      { basic: 7, fast: 5, heavy: 2, ranged: 3, boss: 0 },
      { basic: 5, fast: 4, heavy: 2, ranged: 2, boss: 1 },
    ],
    rewardCredits: 1000,
    rewardXp: 850,
    objectives: {
      requireBossDefeat: true,
    },
  },
  {
    id: 4,
    code: 'M-04',
    title: 'Mission 04: Xenomorph Mother Lair',
    location: 'Subterranean Hive Vault',
    briefing:
      'Final operation inside the subterranean hive vault. Deploy Frag Grenades (7), Med-Stims (8), and Combat Overdrive (9) alongside quad sentry turrets to annihilate the twin Brood Overlords.',
    objectiveText: 'Purge Mother Lair & Extract',
    ambientDarkness: 0.56,
    width: MISSION_04_TILES[0].length,
    height: MISSION_04_TILES.length,
    tiles: MISSION_04_TILES,
    playerStart: { wx: 8.5, wy: 9.2 },
    extractionPoint: { wx: 8.5, wy: 9.0 },
    totalWaves: 4,
    levelCount: 5,
    waveConfig: [
      { basic: 8, fast: 6, heavy: 2, ranged: 3, boss: 0 },
      { basic: 9, fast: 6, heavy: 3, ranged: 4, boss: 0 },
      { basic: 7, fast: 5, heavy: 3, ranged: 3, boss: 1 },
      { basic: 8, fast: 6, heavy: 4, ranged: 4, boss: 1 },
    ],
    rewardCredits: 1600,
    rewardXp: 1400,
    objectives: {
      requireBossDefeat: true,
    },
  },
];
