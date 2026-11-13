export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'plasma';

export type WeaponCategory =
  | 'Secondary Sidearm'
  | 'Primary Assault'
  | 'Primary Close-Quarters'
  | 'Primary Heavy Energy';

export interface WeaponSpec {
  id: WeaponId;
  keySlot: '1' | '2' | '3' | '4';
  name: string;
  shortName: string;
  category: WeaponCategory;
  slotType: 'secondary' | 'primary';
  baseDamage: number;
  fireRateMs: number; // delay between shots
  range: number; // world units (tiles)
  bulletSpeed: number; // world units per second
  pellets: number;
  spreadRad: number;
  clipSize: number;
  reloadMs: number;
  infiniteAmmo: boolean;
  color: string;
  unlockCost: number;
  upgradeBaseCost: number;
}

export type EnemyType = 'basic' | 'fast' | 'heavy' | 'ranged' | 'boss';

export type EnemyState = 'idle' | 'chase' | 'attack' | 'retreat' | 'dead';

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  name: string;
  wx: number; // world tile X
  wy: number; // world tile Y
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldownMs: number;
  lastAttackTime: number;
  state: EnemyState;
  angle: number;
  animFrame: number;
  hitFlashTimer: number;
  xpValue: number;
  creditValue: number;
  bossPhase?: number;
  summonTimer?: number;
  deathTimerMs?: number;
  deathMaxMs?: number;
  attackAnimMs?: number;
  spawnAnimMs?: number;
}

export interface TurretEntity {
  key: string; // `${tx},${ty}`
  tx: number;
  ty: number;
  wx: number;
  wy: number;
  active: boolean;
  angle: number;
  fireCooldownMs: number;
  muzzleFlashMs: number;
  ammoRemaining: number;
  maxAmmo: number;
}

export interface BulletEntity {
  active: boolean;
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  damage: number;
  fromPlayer: boolean;
  color: string;
  radius: number;
  lifeMs: number;
  maxLifeMs: number;
  piercing?: boolean;
  weaponId?: WeaponId;
  isCrit?: boolean;
  turretShot?: boolean;
}

export interface ParticleEntity {
  active: boolean;
  wx: number;
  wy: number;
  wz: number; // height above ground
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  lifeMs: number;
  maxLifeMs: number;
  kind?: 'spark' | 'smoke' | 'blood' | 'plasma' | 'fire' | 'shell' | 'energy' | 'shockwave';
}

export interface DecalEntity {
  wx: number;
  wy: number;
  type:
    | 'blood_green'
    | 'blood_red'
    | 'scorch'
    | 'corpse_basic'
    | 'corpse_fast'
    | 'corpse_heavy'
    | 'debris_crate'
    | 'debris_pod';
  size: number;
  angle: number;
}

export type LootType =
  | 'medkit'
  | 'armor'
  | 'ammo_rifle'
  | 'ammo_shotgun'
  | 'ammo_plasma'
  | 'credits'
  | 'grenade_pack';

export interface GrenadeEntity {
  active: boolean;
  startWx: number;
  startWy: number;
  targetWx: number;
  targetWy: number;
  wx: number;
  wy: number;
  wz: number;
  elapsedMs: number;
  flightDurationMs: number;
  damage: number;
  radius: number;
}

export interface LootEntity {
  id: number;
  wx: number;
  wy: number;
  type: LootType;
  amount: number;
  bobPhase: number;
}

export type TileKind =
  | 0 // Dirt / Dark Grass perimeter
  | 1 // Concrete Military Floor
  | 2 // Hazard Stripe Floor
  | 3 // Lab Metal Grate Floor
  | 4 // Reinforced Steel Wall (Solid, Blocks LOS)
  | 5 // Lab Containment Wall (Solid, Blocks LOS)
  | 6 // Sandbag Barricade (Solid movement, DOES NOT block bullets/LOS)
  | 7 // Explosive Fuel Barrel (Solid until destroyed, explodes!)
  | 8 // Alien Spawn Vent (Floor + spawns aliens)
  | 9 // Objective Security Terminal (Interactive)
  | 10 // Supply Crate (Destructible / Interactive loot)
  | 11 // Toxic Acid Pool (Damages walking units, does not block LOS)
  | 12 // Extraction Pad
  | 13 // Locked Armored Blast Door (Solid & blocks LOS until unlocked via Terminal or OK)
  | 14 // Open Armored Blast Door Threshold (Walkable floor with door frame)
  | 15 // Automated Military Sentry Turret (Interactive: activate/reload with OK to auto-fire at aliens)
  | 16; // Alien Bio-Stasis Containment Pod (Destructible lab pod: drops plasma/credits or spawns specimen)

export interface PropDamageState {
  key: string; // `${tx},${ty}`
  hp: number;
  maxHp: number;
  activated?: boolean;
}

export type MissionObjectiveType =
  | 'eliminate_all'
  | 'survive_duration'
  | 'activate_terminals'
  | 'destroy_structures'
  | 'protect_object'
  | 'reach_extraction'
  | 'defeat_boss';

export interface MissionObjectivesConfig {
  requiredTerminals?: number;
  requiredStructures?: number;
  surviveDurationMs?: number;
  protectObject?: {
    name: string;
    wx: number;
    wy: number;
    maxHp: number;
  };
  requireBossDefeat?: boolean;
}

export type GameMode = 'CAMPAIGN' | 'SURVIVAL';

export interface MissionDef {
  id: number;
  code: string;
  title: string;
  location: string;
  briefing: string;
  objectiveText: string;
  ambientDarkness: number; // 0 = bright outpost, 0.35..0.55 = dark bio-lab / hive core
  width: number;
  height: number;
  tiles: TileKind[][];
  playerStart: { wx: number; wy: number };
  extractionPoint: { wx: number; wy: number };
  totalWaves: number;
  levelCount?: number; // STEP 2: levels inside this mission (4 or 5); default 1
  waveConfig: {
    basic: number;
    fast: number;
    heavy: number;
    ranged: number;
    boss: number;
  }[];
  rewardCredits: number;
  rewardXp: number;
  objectives?: MissionObjectivesConfig;
}

export interface PlayerSkills {
  vitality: number; // +25 Max HP per level
  firepower: number; // +10% Weapon damage per level
  agility: number; // +8% Move speed per level
  armorTech: number; // +20 Starting armor & +3% absorption per level
  reloadSpeed: number; // +9% Reload speed per level
}

export type EquipmentId = 'grenade' | 'medkit' | 'overdrive';

export interface TacticalInventory {
  grenades: number; // Key 7: Frag Grenade
  medkits: number; // Key 8: Field Med-Stim (+60 HP)
  overdrives: number; // Key 9: Combat Overdrive Booster (6s)
}

export interface SaveData {
  xp: number;
  level: number;
  skillPoints: number;
  credits: number;
  unlockedMission: number;
  completedMissions: number[];
  survivalBestWave: number;
  survivalBestScore: number;
  highScore: number;
  totalKills: number;
  unlockedWeapons: Record<WeaponId, boolean>;
  weaponLevels: Record<WeaponId, number>;
  ammoInventory: Record<WeaponId, number>;
  tacticalInventory: TacticalInventory;
  armorTier: number; // 1..4 (Kevlar -> Exo-Suit -> Titan Armor)
  regenImplantLevel: number; // 0..3 (Passive nano-health regeneration)
  selectedEquipment: EquipmentId;
  skills: PlayerSkills;
  soundEnabled: boolean;
  flashlightOn: boolean;
  masterVolume: number; // 0..100
  musicVolume: number; // 0..100
  sfxVolume: number; // 0..100
  particlesEnabled: boolean;
  screenShakeEnabled: boolean;
  brightnessLevel: number; // 0 = Dark, 1 = Standard, 2 = High Visibility
  showPerfOverlay?: boolean; // Lightweight debug-only FPS & frame timing overlay (off by default)
  missionLevelProgress?: Record<number, number>; // STEP 2: highest level cleared per mission id; absent in old saves = derived from completedMissions
}

export type ScreenMode =
  | 'TITLE'
  | 'MISSION_SELECT'
  | 'SURVIVAL_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'ARMORY'
  | 'SHOP'
  | 'PROFILE'
  | 'SETTINGS'
  | 'VICTORY'
  | 'GAME_OVER'
  | 'SURVIVAL_OVER'
  | 'CONTROLS_HELP';
