import { MISSIONS, SURVIVAL_ARENA_MISSION } from './maps';
import { soundFX } from './sound';
import { ISO_TILE_H, ISO_TILE_W, spriteCache } from './sprites';
import { getXpForNextLevel, persistSaveData } from './storage';
import {
  BulletEntity,
  DecalEntity,
  EnemyEntity,
  EnemyType,
  EquipmentId,
  GameMode,
  GrenadeEntity,
  LootEntity,
  LootType,
  MissionDef,
  ParticleEntity,
  SaveData,
  TileKind,
  TurretEntity,
  WeaponId,
} from './types';
import {
  getEffectiveWeaponDamage,
  getEffectiveWeaponStats,
  WEAPON_ORDER,
  WEAPONS,
} from './weapons';

export const NATIVE_W = 240;
export const NATIVE_H = 320;

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  weapon: WeaponId;
  clipAmmo: number;
  maxClip: number;
  reserveAmmo: number;
  infiniteAmmo: boolean;
  reloading: boolean;
  reloadProgress: number;
  wave: number;
  totalWaves: number;
  enemiesRemaining: number;
  score: number;
  credits: number;
  xp: number;
  level: number;
  objectiveText: string;
  contextPrompt: string | null;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  fps: number;
  avgFps: number;
  frameTimeMs: number;
  updateTimeMs: number;
  renderTimeMs: number;
  autoTargetLocked: boolean;
  activeTurrets: number;
  totalTurrets: number;
  grenades: number;
  medkits: number;
  overdrives: number;
  overdriveActive: boolean;
  gameMode: GameMode;
  survivalBestWave: number;
  missionElapsedMs: number;
  destroyedStructures: number;
  bossesDefeated: number;
  protectedObjectName: string | null;
  protectedObjectHp: number;
  protectedObjectMaxHp: number;
  selectedEquipment: EquipmentId;
  missionLevel: number;
  missionLevelCount: number;
}

interface PooledRenderItem {
  kind: 'prop' | 'enemy' | 'player';
  depth: number;
  tx: number;
  ty: number;
  tileKind: TileKind;
  enemy: EnemyEntity | null;
}

const FLOW_CARDINALS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const FLOW_DIAGS: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export class AlienShooterEngine {
  public gameMode: GameMode = 'CAMPAIGN';
  public mission: MissionDef = MISSIONS[0];
  public tiles: TileKind[][] = [];
  public propHp: Map<string, number> = new Map();
  public propMaxHp: Map<string, number> = new Map();
  public hackedTerminals: Set<string> = new Set();
  public turrets: Map<string, TurretEntity> = new Map();

  // Player state
  public player = {
    wx: 8.5,
    wy: 14.2,
    radius: 0.32,
    hp: 100,
    maxHp: 100,
    armor: 25,
    maxArmor: 100,
    aimAngle: -Math.PI / 2,
    moveAngle: -Math.PI / 2,
    walkCycle: 0,
    weapon: 'rifle' as WeaponId,
    clip: 36,
    reloading: false,
    reloadTimerMs: 0,
    lastShotMs: 0,
    muzzleFlashMs: 0,
    hitFlashMs: 0,
    acidTickMs: 0,
    isDead: false,
    deathAnimTimerMs: 0,
    overdriveTimerMs: 0,
  };

  // Camera in isometric screen space
  public camX = 0;
  public camY = 0;

  // Entities & pools
  public enemies: EnemyEntity[] = [];
  public bullets: BulletEntity[] = [];
  public grenades: GrenadeEntity[] = [];
  public particles: ParticleEntity[] = [];
  public decals: DecalEntity[] = [];
  public loots: LootEntity[] = [];
  public spawnPoints: { wx: number; wy: number }[] = [];

  // Wave & mission state
  public currentWave = 1;
  public currentLevel = 1;
  public pendingNextLevel = 0; // STEP 2: 0 = no next level in same mission; else next level number
  public spawnQueue: EnemyType[] = [];
  public spawnTimerMs = 0;
  public waveClearBannerMs = 0;
  public bossAlertBannerMs = 0;
  public levelUpBannerMs = 0;
  public damageFlashMs = 0;
  public armorFlashMs = 0;
  public envParticleTimerMs = 0;
  public isPlayerMoving = false;
  public score = 0;
  public missionKills = 0;
  public missionCreditsEarned = 0;
  public extractionReady = false;
  public missionElapsedMs = 0;
  public destroyedStructures = 0;
  public bossesDefeated = 0;
  public protectedObjectHp = 0;
  public protectedObjectMaxHp = 0;
  public regenTickMs = 0;
  public lockedEnemyId: number | null = null;
  public screenShakeMs = 0;
  public pulseTimerMs = 0;
  public floatingTexts: {
    wx: number;
    wy: number;
    wz: number;
    text: string;
    color: string;
    lifeMs: number;
  }[] = [];

  private nextEntityId = 1;
  public fpsCount = 30;
  public avgFps = 30;
  public frameTimeMs = 16.7;
  public updateTimeMs = 0.4;
  public renderTimeMs = 0.7;
  private frameAccum = 0;
  private frameTimerMs = 0;
  private totalFramesMeasured = 0;
  private totalTimeMeasuredMs = 0;

  // Pre-allocated pool cursors & zero-allocation caches (Phase 8)
  private bulletCursor = 0;
  private particleCursor = 0;
  private flowGrid: Int16Array = new Int16Array(400);
  private flowQueueX: Int16Array = new Int16Array(400);
  private flowQueueY: Int16Array = new Int16Array(400);
  private lastFlowPlayerTx = -1;
  private lastFlowPlayerTy = -1;
  public flowFieldDirty = true;
  public flowFieldRecomputes = 0;
  public flowFieldCacheHits = 0;
  private renderPool: PooledRenderItem[] = [];
  private activeRenderSlice: PooledRenderItem[] = [];

  // Active keypad input flags
  public keys = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  public saveData: SaveData;
  private onMissionEnd: (victory: boolean) => void;

  constructor(saveData: SaveData, onMissionEnd: (victory: boolean) => void) {
    this.saveData = saveData;
    this.onMissionEnd = onMissionEnd;
    spriteCache.init();
    this.initPools();
  }

  private initPools(): void {
    this.bullets = Array.from({ length: 75 }, () => ({
      active: false,
      wx: 0,
      wy: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      fromPlayer: true,
      color: '#facc15',
      radius: 0.12,
      lifeMs: 0,
      maxLifeMs: 1000,
    }));

    this.particles = Array.from({ length: 120 }, () => ({
      active: false,
      wx: 0,
      wy: 0,
      wz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      color: '#4ade80',
      size: 2,
      lifeMs: 0,
      maxLifeMs: 400,
    }));

    this.renderPool = Array.from({ length: 280 }, () => ({
      kind: 'prop' as const,
      depth: 0,
      tx: 0,
      ty: 0,
      tileKind: 1 as TileKind,
      enemy: null,
    }));
  }

  public getMissionLevelCount(): number {
    return this.gameMode === 'SURVIVAL' ? 1 : this.mission.levelCount || 1;
  }

  public startMission(missionId: number, level: number = 1): void {
    this.gameMode = 'CAMPAIGN';
    const found = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    const lc = found.levelCount || 1;
    this.currentLevel = Math.max(1, Math.min(lc, level));
    this.pendingNextLevel = 0;
    this.initializeMissionInstance(found);
  }

  public startMissionLevel(missionId: number, level: number): void {
    this.startMission(missionId, level);
  }

  public startSurvivalMode(): void {
    this.gameMode = 'SURVIVAL';
    this.initializeMissionInstance(SURVIVAL_ARENA_MISSION);
  }

  private initializeMissionInstance(found: MissionDef): void {
    this.mission = found;
    this.tiles = found.tiles.map((row) => [...row]);
    this.propHp.clear();
    this.propMaxHp.clear();
    this.hackedTerminals.clear();
    this.turrets.clear();
    this.spawnPoints = [];

    for (let ty = 0; ty < this.mission.height; ty++) {
      for (let tx = 0; tx < this.mission.width; tx++) {
        const t = this.tiles[ty][tx];
        const key = `${tx},${ty}`;
        if (t === 7) {
          this.propHp.set(key, 35); // Explosive barrel
          this.propMaxHp.set(key, 35);
        } else if (t === 10) {
          this.propHp.set(key, 30); // Supply crate
          this.propMaxHp.set(key, 30);
        } else if (t === 16) {
          this.propHp.set(key, 45); // Bio-Stasis Pod
          this.propMaxHp.set(key, 45);
        } else if (t === 8) {
          this.spawnPoints.push({ wx: tx + 0.5, wy: ty + 0.5 });
        } else if (t === 15) {
          this.turrets.set(key, {
            key,
            tx,
            ty,
            wx: tx + 0.5,
            wy: ty + 0.5,
            active: false,
            angle: -Math.PI / 2,
            fireCooldownMs: 0,
            muzzleFlashMs: 0,
            ammoRemaining: 90,
            maxAmmo: 90,
          });
        }
      }
    }

    const armorTier = Math.max(1, this.saveData.armorTier || 1);
    const maxHp = 100 + this.saveData.skills.vitality * 25;
    const maxArmor = 100 + (armorTier - 1) * 25;
    const startArmor = Math.min(
      maxArmor,
      25 + this.saveData.skills.armorTech * 20 + (armorTier - 1) * 20
    );

    // Choose best unlocked weapon with ammo
    let startWeapon: WeaponId = 'pistol';
    if (this.saveData.unlockedWeapons.rifle && this.saveData.ammoInventory.rifle > 0) {
      startWeapon = 'rifle';
    }
    const effStats = getEffectiveWeaponStats(
      startWeapon,
      this.saveData.weaponLevels[startWeapon],
      this.saveData.skills
    );

    this.player = {
      wx: found.playerStart.wx,
      wy: found.playerStart.wy,
      radius: 0.32,
      hp: maxHp,
      maxHp,
      armor: startArmor,
      maxArmor,
      aimAngle: -Math.PI / 2,
      moveAngle: -Math.PI / 2,
      walkCycle: 0,
      weapon: startWeapon,
      clip: effStats.clipSize,
      reloading: false,
      reloadTimerMs: 0,
      lastShotMs: 0,
      muzzleFlashMs: 0,
      hitFlashMs: 0,
      acidTickMs: 0,
      isDead: false,
      deathAnimTimerMs: 0,
      overdriveTimerMs: 0,
    };

    this.enemies = [];
    this.grenades = [];
    this.decals = [];
    this.loots = [];
    this.floatingTexts = [];
    this.bullets.forEach((b) => (b.active = false));
    this.particles.forEach((p) => (p.active = false));

    this.currentWave = 1;
    this.score = 0;
    this.missionKills = 0;
    this.missionCreditsEarned = 0;
    this.extractionReady = false;
    this.missionElapsedMs = 0;
    this.destroyedStructures = 0;
    this.bossesDefeated = 0;
    this.regenTickMs = 0;
    this.protectedObjectMaxHp = found.objectives?.protectObject
      ? found.objectives.protectObject.maxHp
      : 0;
    this.protectedObjectHp = this.protectedObjectMaxHp;
    this.lockedEnemyId = null;
    this.keys = { up: false, down: false, left: false, right: false };

    const gridCells = found.width * found.height;
    if (gridCells > this.flowGrid.length) {
      this.flowGrid = new Int16Array(gridCells);
      this.flowQueueX = new Int16Array(gridCells);
      this.flowQueueY = new Int16Array(gridCells);
    }
    this.lastFlowPlayerTx = -1;
    this.lastFlowPlayerTy = -1;
    this.flowFieldDirty = true;

    const iso = this.worldToIso(this.player.wx, this.player.wy);
    this.camX = iso.sx;
    this.camY = iso.sy;

    this.prepareWave(1);
  }

  private prepareWave(waveNum: number): void {
    this.currentWave = waveNum;
    const baseCfg =
      this.gameMode === 'SURVIVAL'
        ? {
            basic: 4 + waveNum * 2,
            fast: Math.max(1, Math.floor(waveNum * 1.5)),
            ranged: waveNum >= 2 ? 1 + Math.floor(waveNum * 0.8) : 0,
            heavy: waveNum >= 2 ? Math.floor(waveNum * 0.7) : 0,
            boss: waveNum % 3 === 0 ? Math.max(1, Math.floor(waveNum / 3)) : 0,
          }
        : this.mission.waveConfig[waveNum - 1];
    if (!baseCfg) return;
    // STEP 2: later levels inside the same mission add enemies, boss count unchanged.
    const cfg =
      this.gameMode === 'CAMPAIGN' && this.currentLevel > 1
        ? {
            basic: baseCfg.basic + (this.currentLevel - 1) * 2,
            fast: baseCfg.fast + (this.currentLevel - 1),
            ranged: baseCfg.ranged + (this.currentLevel >= 2 ? this.currentLevel - 1 : 0),
            heavy: baseCfg.heavy + (this.currentLevel >= 3 ? this.currentLevel - 2 : 0),
            boss: baseCfg.boss,
          }
        : baseCfg;

    const queue: EnemyType[] = [];
    for (let i = 0; i < cfg.basic; i++) queue.push('basic');
    for (let i = 0; i < cfg.fast; i++) queue.push('fast');
    for (let i = 0; i < cfg.ranged; i++) queue.push('ranged');
    for (let i = 0; i < cfg.heavy; i++) queue.push('heavy');

    // Shuffle standard enemies for dynamic pacing
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    // Boss spawns last in wave
    for (let i = 0; i < cfg.boss; i++) queue.push('boss');

    this.spawnQueue = queue;
    this.spawnTimerMs = 400;
    this.waveClearBannerMs = 1800;
    if (waveNum > 1) {
      soundFX.playWaveIncoming();
    }
  }

  /**
   * Converts world tile coordinates (wx, wy) to isometric screen space (sx, sy)
   */
  public worldToIso(wx: number, wy: number): { sx: number; sy: number } {
    return {
      sx: (wx - wy) * (ISO_TILE_W / 2),
      sy: (wx + wy) * (ISO_TILE_H / 2),
    };
  }

  /**
   * Inverse transformation: converts isometric space (sx, sy) back to world tile coordinates (wx, wy)
   */
  public isoToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const halfW = ISO_TILE_W / 2;
    const halfH = ISO_TILE_H / 2;
    return {
      wx: (sy / halfH + sx / halfW) * 0.5,
      wy: (sy / halfH - sx / halfW) * 0.5,
    };
  }

  /**
   * Converts 240x320 viewport pixel coordinates (screenX, screenY) to world tile coordinates (wx, wy)
   */
  public screenToWorld(screenX: number, screenY: number): { wx: number; wy: number } {
    const isoX = screenX - NATIVE_W / 2 + this.camX;
    const isoY = screenY - NATIVE_H / 2 + this.camY;
    return this.isoToWorld(isoX, isoY);
  }

  public switchWeapon(weaponId: WeaponId): void {
    if (!this.saveData.unlockedWeapons[weaponId]) return;
    if (this.player.weapon === weaponId) return;
    this.player.weapon = weaponId;
    const spec = WEAPONS[weaponId];
    const effStats = getEffectiveWeaponStats(
      weaponId,
      this.saveData.weaponLevels[weaponId],
      this.saveData.skills
    );
    const avail = spec.infiniteAmmo
      ? effStats.clipSize
      : Math.min(effStats.clipSize, this.saveData.ammoInventory[weaponId]);
    this.player.clip = avail;
    this.player.reloading = false;
    this.player.reloadTimerMs = 0;
    soundFX.playWeaponSwitch(weaponId);
  }

  public cycleWeapon(): void {
    const idx = WEAPON_ORDER.indexOf(this.player.weapon);
    for (let offset = 1; offset <= WEAPON_ORDER.length; offset++) {
      const next = WEAPON_ORDER[(idx + offset) % WEAPON_ORDER.length];
      if (this.saveData.unlockedWeapons[next]) {
        const spec = WEAPONS[next];
        if (spec.infiniteAmmo || this.saveData.ammoInventory[next] > 0) {
          this.switchWeapon(next);
          return;
        }
      }
    }
  }

  public triggerContextAction(): void {
    const ptx = Math.floor(this.player.wx);
    const pty = Math.floor(this.player.wy);

    let bestAction: {
      kind: 'terminal' | 'door' | 'turret_activate' | 'turret_reload';
      tx: number;
      ty: number;
      dist: number;
    } | null = null;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = ptx + dx;
        const ty = pty + dy;
        const dist = Math.hypot(tx + 0.5 - this.player.wx, ty + 0.5 - this.player.wy);
        if (dist > 1.65) continue;

        const tile = this.getTile(tx, ty);
        if (tile === 9 && !this.hackedTerminals.has(`${tx},${ty}`)) {
          if (!bestAction || dist < bestAction.dist) {
            bestAction = { kind: 'terminal', tx, ty, dist };
          }
        } else if (tile === 13) {
          if (!bestAction || dist < bestAction.dist) {
            bestAction = { kind: 'door', tx, ty, dist };
          }
        } else if (tile === 15) {
          const tur = this.turrets.get(`${tx},${ty}`);
          if (tur && !tur.active) {
            if (!bestAction || dist < bestAction.dist) {
              bestAction = { kind: 'turret_activate', tx, ty, dist };
            }
          } else if (tur && tur.ammoRemaining < tur.maxAmmo) {
            if (!bestAction || dist < bestAction.dist) {
              bestAction = { kind: 'turret_reload', tx, ty, dist };
            }
          }
        }
      }
    }

    if (bestAction) {
      const { kind, tx, ty } = bestAction;
      if (kind === 'terminal') {
        const key = `${tx},${ty}`;
        this.hackedTerminals.add(key);
        soundFX.playTerminalHack();
        const doorsOpened = this.unlockNearbyDoorsAndTurrets(tx, ty, 6);
        this.addFloatingText(
          tx + 0.5,
          ty + 0.5,
          doorsOpened > 0 ? 'TERMINAL HACKED · DOORS OPEN!' : 'TERMINAL HACKED +$100',
          '#38bdf8'
        );
        this.saveData.credits += 100;
        this.missionCreditsEarned += 100;
        this.score += 250;
        this.grantXp(75);
        this.spawnLoot(tx + 0.5, ty + 0.8, 'ammo_rifle', 45);
        return;
      }

      if (kind === 'door') {
        this.tiles[ty][tx] = 14;
        // Also unlock any directly adjacent double-door segment
        for (let ody = -1; ody <= 1; ody++) {
          for (let odx = -1; odx <= 1; odx++) {
            if (this.getTile(tx + odx, ty + ody) === 13) {
              this.tiles[ty + ody][tx + odx] = 14;
            }
          }
        }
        this.flowFieldDirty = true;
        soundFX.playDoorOpen();
        this.spawnHitSparks(tx + 0.5, ty + 0.5, '#22c55e', 6, 'energy');
        this.addFloatingText(tx + 0.5, ty + 0.5, 'BLAST DOOR OPENED', '#4ade80');
        return;
      }

      if (kind === 'turret_activate') {
        const turret = this.turrets.get(`${tx},${ty}`);
        if (turret) {
          turret.active = true;
          turret.ammoRemaining = turret.maxAmmo;
          soundFX.playPickup();
          this.spawnHitSparks(turret.wx, turret.wy, '#22c55e', 8);
          this.addFloatingText(turret.wx, turret.wy, 'SENTRY TURRET ONLINE!', '#4ade80');
          return;
        }
      }

      if (kind === 'turret_reload') {
        const turret = this.turrets.get(`${tx},${ty}`);
        if (turret) {
          turret.ammoRemaining = turret.maxAmmo;
          soundFX.playReload();
          this.addFloatingText(turret.wx, turret.wy, 'TURRET RELOADED', '#38bdf8');
          return;
        }
      }
    }

    // 4. Check Extraction Beacon if ready
    if (this.extractionReady && this.gameMode === 'CAMPAIGN') {
      const dist = Math.hypot(
        this.player.wx - this.mission.extractionPoint.wx,
        this.player.wy - this.mission.extractionPoint.wy
      );
      if (dist < 1.8) {
        this.completeMission();
        return;
      }
    }

    // 5. Otherwise manual reload if clip is not full
    const spec = WEAPONS[this.player.weapon];
    const effStats = getEffectiveWeaponStats(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills
    );
    if (!this.player.reloading && this.player.clip < effStats.clipSize) {
      if (spec.infiniteAmmo || this.saveData.ammoInventory[this.player.weapon] > 0) {
        this.startReload();
      }
    }
  }

  public useFragGrenade(): boolean {
    if (this.player.isDead || this.saveData.tacticalInventory.grenades <= 0) {
      soundFX.playUiBeep(false);
      return false;
    }

    this.saveData.tacticalInventory.grenades--;
    persistSaveData(this.saveData);
    soundFX.playGrenadeThrow();

    let targetWx = this.player.wx;
    let targetWy = this.player.wy;
    const locked = this.enemies.find((e) => e.id === this.lockedEnemyId && e.hp > 0 && e.state !== 'dead');

    if (locked) {
      targetWx = locked.wx;
      targetWy = locked.wy;
    } else {
      // Convert isometric aim angle into world direction
      const isoDx = Math.cos(this.player.aimAngle);
      const isoDy = Math.sin(this.player.aimAngle);
      let dwx = isoDx + isoDy;
      let dwy = isoDy - isoDx;
      const len = Math.hypot(dwx, dwy) || 1;
      dwx /= len;
      dwy /= len;
      targetWx = Math.max(1.5, Math.min(this.mission.width - 1.5, this.player.wx + dwx * 3.2));
      targetWy = Math.max(1.5, Math.min(this.mission.height - 1.5, this.player.wy + dwy * 3.2));
    }

    const dmg = Math.round((145 + this.saveData.level * 15) * (1 + this.saveData.skills.firepower * 0.1));
    this.grenades.push({
      active: true,
      startWx: this.player.wx,
      startWy: this.player.wy,
      targetWx,
      targetWy,
      wx: this.player.wx,
      wy: this.player.wy,
      wz: 8,
      elapsedMs: 0,
      flightDurationMs: 360,
      damage: dmg,
      radius: 2.6,
    });

    this.addFloatingText(this.player.wx, this.player.wy, 'FRAG GRENADE OUT!', '#f97316');
    return true;
  }

  public useMedkitStim(): boolean {
    if (
      this.player.isDead ||
      this.saveData.tacticalInventory.medkits <= 0 ||
      this.player.hp >= this.player.maxHp
    ) {
      soundFX.playUiBeep(false);
      return false;
    }

    this.saveData.tacticalInventory.medkits--;
    const heal = 60 + this.saveData.skills.vitality * 10;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.player.acidTickMs = 0;
    persistSaveData(this.saveData);
    soundFX.playStimUse();
    this.spawnHitSparks(this.player.wx, this.player.wy, '#4ade80', 8, 'plasma');
    this.addFloatingText(this.player.wx, this.player.wy, `MED-STIM +${heal} HP`, '#4ade80');
    return true;
  }

  public useCombatOverdrive(): boolean {
    if (this.player.isDead || this.saveData.tacticalInventory.overdrives <= 0) {
      soundFX.playUiBeep(false);
      return false;
    }

    this.saveData.tacticalInventory.overdrives--;
    this.player.overdriveTimerMs = 6000;
    persistSaveData(this.saveData);
    soundFX.playStimUse();
    this.spawnHitSparks(this.player.wx, this.player.wy, '#38bdf8', 10, 'plasma');
    this.addFloatingText(this.player.wx, this.player.wy, 'COMBAT OVERDRIVE (6s)!', '#38bdf8');
    return true;
  }

  public useSelectedEquipment(): boolean {
    const eq = this.saveData.selectedEquipment || 'grenade';
    if (eq === 'medkit') return this.useMedkitStim();
    if (eq === 'overdrive') return this.useCombatOverdrive();
    return this.useFragGrenade();
  }

  public cycleSelectedEquipment(): void {
    const order: EquipmentId[] = ['grenade', 'medkit', 'overdrive'];
    const idx = order.indexOf(this.saveData.selectedEquipment || 'grenade');
    this.saveData.selectedEquipment = order[(idx + 1) % order.length];
    persistSaveData(this.saveData);
    soundFX.playUiBeep(true);
  }

  private unlockNearbyDoorsAndTurrets(cx: number, cy: number, radius: number): number {
    let opened = 0;
    for (let ty = 0; ty < this.mission.height; ty++) {
      for (let tx = 0; tx < this.mission.width; tx++) {
        if (Math.hypot(tx - cx, ty - cy) <= radius) {
          if (this.tiles[ty][tx] === 13) {
            this.tiles[ty][tx] = 14;
            this.flowFieldDirty = true;
            this.spawnHitSparks(tx + 0.5, ty + 0.5, '#22c55e', 5);
            opened++;
          } else if (this.tiles[ty][tx] === 15) {
            const tur = this.turrets.get(`${tx},${ty}`);
            if (tur && !tur.active) {
              tur.active = true;
              tur.ammoRemaining = tur.maxAmmo;
            }
          }
        }
      }
    }
    return opened;
  }

  private startReload(): void {
    const spec = WEAPONS[this.player.weapon];
    if (this.player.reloading) return;
    if (!spec.infiniteAmmo && this.saveData.ammoInventory[this.player.weapon] <= 0) {
      soundFX.playEmptyMag();
      this.switchWeapon('pistol');
      return;
    }
    const effStats = getEffectiveWeaponStats(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills
    );
    this.player.reloading = true;
    this.player.reloadTimerMs = effStats.reloadMs;
    soundFX.playReload();
  }

  public getTile(tx: number, ty: number): TileKind {
    if (ty < 0 || ty >= this.mission.height || tx < 0 || tx >= this.mission.width) {
      return 4; // Solid wall outside boundaries
    }
    return this.tiles[ty][tx];
  }

  public isTileSolidForMovement(tx: number, ty: number): boolean {
    const t = this.getTile(tx, ty);
    return (
      t === 4 ||
      t === 5 ||
      t === 6 ||
      t === 7 ||
      t === 9 ||
      t === 10 ||
      t === 13 ||
      t === 15 ||
      t === 16
    );
  }

  public isTileBlockingVision(tx: number, ty: number): boolean {
    const t = this.getTile(tx, ty);
    return t === 4 || t === 5 || t === 13;
  }

  public hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 4);
    if (steps <= 1) return true;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      if (this.isTileBlockingVision(Math.floor(cx), Math.floor(cy))) {
        return false;
      }
    }
    return true;
  }

  public update(rawDtMs: number): void {
    const startUpd = nowMs();
    const dtMs = Math.max(0, Math.min(rawDtMs, 50));
    const dt = dtMs / 1000;
    this.pulseTimerMs += dtMs;
    this.frameTimeMs = Number((this.frameTimeMs * 0.85 + dtMs * 0.15).toFixed(2));

    // FPS & rolling average FPS tracking
    this.frameAccum++;
    this.frameTimerMs += dtMs;
    this.totalFramesMeasured++;
    this.totalTimeMeasuredMs += dtMs;
    if (this.frameTimerMs >= 500) {
      this.fpsCount = Math.round((this.frameAccum * 1000) / this.frameTimerMs);
      this.avgFps =
        this.totalTimeMeasuredMs > 0
          ? Math.round((this.totalFramesMeasured * 1000) / this.totalTimeMeasuredMs)
          : this.fpsCount;
      this.frameAccum = 0;
      this.frameTimerMs = 0;
    }

    if (this.waveClearBannerMs > 0) this.waveClearBannerMs -= dtMs;
    if (this.bossAlertBannerMs > 0) this.bossAlertBannerMs -= dtMs;
    if (this.levelUpBannerMs > 0) this.levelUpBannerMs -= dtMs;
    if (this.damageFlashMs > 0) this.damageFlashMs -= dtMs;
    if (this.armorFlashMs > 0) this.armorFlashMs -= dtMs;
    if (this.screenShakeMs > 0) this.screenShakeMs -= dtMs;
    if (this.player.muzzleFlashMs > 0) this.player.muzzleFlashMs -= dtMs;
    if (this.player.hitFlashMs > 0) this.player.hitFlashMs -= dtMs;
    if (this.player.overdriveTimerMs > 0)
      this.player.overdriveTimerMs = Math.max(0, this.player.overdriveTimerMs - dtMs);
    if (this.player.isDead) {
      this.player.deathAnimTimerMs += dtMs;
    } else {
      this.missionElapsedMs += dtMs;
      if (this.saveData.regenImplantLevel > 0 && this.player.hp < this.player.maxHp) {
        this.regenTickMs += dtMs;
        if (this.regenTickMs >= 2500) {
          this.regenTickMs = 0;
          const regenAmt = this.saveData.regenImplantLevel * 2;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + regenAmt);
        }
      }
    }

    const hasBoss = this.enemies.some((e) => e.type === 'boss' && e.hp > 0);
    const musicMode = hasBoss
      ? 'boss'
      : this.gameMode === 'SURVIVAL'
      ? 'survival'
      : 'campaign';
    soundFX.updateMusic(dtMs, musicMode);

    this.updatePlayerMovement(dt, dtMs);
    this.updateAutoFireAndReload(dtMs);
    this.updateTurrets(dt, dtMs);
    this.updateBullets(dt, dtMs);
    this.updateGrenades(dtMs);
    this.updateEnemies(dt, dtMs);
    this.updateWaveSpawner(dtMs);
    this.updateLoots(dt);
    this.updateEnvironmentParticles(dtMs);
    this.updateParticles(dt, dtMs);
    this.updateFloatingTexts(dtMs);

    // Smooth camera tracking in isometric space
    const targetIso = this.worldToIso(this.player.wx, this.player.wy);
    const lerp = Math.min(1, dt * 9);
    this.camX += (targetIso.sx - this.camX) * lerp;
    this.camY += (targetIso.sy - this.camY) * lerp;

    const elapsedUpd = nowMs() - startUpd;
    this.updateTimeMs = Number((this.updateTimeMs * 0.8 + elapsedUpd * 0.2).toFixed(2));
  }

  private updateGrenades(dtMs: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      if (!g.active) {
        this.grenades.splice(i, 1);
        continue;
      }
      g.elapsedMs += dtMs;
      const t = Math.min(1, g.elapsedMs / g.flightDurationMs);
      g.wx = g.startWx + (g.targetWx - g.startWx) * t;
      g.wy = g.startWy + (g.targetWy - g.startWy) * t;
      // Parabolic arc height
      g.wz = Math.sin(t * Math.PI) * 28;

      if (t >= 1) {
        g.active = false;
        this.triggerExplosion(g.targetWx, g.targetWy, g.radius, g.damage, true);
        this.grenades.splice(i, 1);
      }
    }
  }

  private updateTurrets(_dt: number, dtMs: number): void {
    this.turrets.forEach((turret) => {
      if (turret.muzzleFlashMs > 0) {
        turret.muzzleFlashMs -= dtMs;
      }
      if (!turret.active || turret.ammoRemaining <= 0) return;

      turret.fireCooldownMs -= dtMs;

      // Find nearest visible enemy within 5.8 tiles
      let target: EnemyEntity | null = null;
      let bestDist = 5.8;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.hp <= 0 || e.state === 'dead') continue;
        const d = Math.hypot(e.wx - turret.wx, e.wy - turret.wy);
        if (d <= bestDist && this.hasLineOfSight(turret.wx, turret.wy, e.wx, e.wy)) {
          bestDist = d;
          target = e;
        }
      }

      if (target) {
        const tIso = this.worldToIso(turret.wx, turret.wy);
        const eIso = this.worldToIso(target.wx, target.wy);
        turret.angle = Math.atan2(eIso.sy - tIso.sy, eIso.sx - tIso.sx);

        if (turret.fireCooldownMs <= 0) {
          turret.fireCooldownMs = 240;
          turret.muzzleFlashMs = 45;
          turret.ammoRemaining--;

          const worldAng = Math.atan2(target.wy - turret.wy, target.wx - turret.wx);
          this.spawnBullet(
            turret.wx + Math.cos(worldAng) * 0.35,
            turret.wy + Math.sin(worldAng) * 0.35,
            Math.cos(worldAng) * 11.5,
            Math.sin(worldAng) * 11.5,
            14,
            true,
            '#38bdf8',
            0.11,
            600,
            false,
            'rifle',
            false,
            true
          );
          soundFX.playTurretShoot();

          if (turret.ammoRemaining <= 0) {
            turret.active = false;
            this.addFloatingText(turret.wx, turret.wy, 'TURRET AMMO EMPTY', '#f59e0b');
          }
        }
      }
    });
  }

  private updatePlayerMovement(dt: number, dtMs: number): void {
    let sxDir = 0;
    let syDir = 0;
    if (this.keys.up) syDir -= 1;
    if (this.keys.down) syDir += 1;
    if (this.keys.left) sxDir -= 1;
    if (this.keys.right) sxDir += 1;

    if (sxDir !== 0 || syDir !== 0) {
      this.isPlayerMoving = true;
      let dwx = sxDir + syDir;
      let dwy = syDir - sxDir;
      const len = Math.hypot(dwx, dwy);
      if (len > 0) {
        dwx /= len;
        dwy /= len;
      }

      const overdriveMult = this.player.overdriveTimerMs > 0 ? 1.35 : 1.0;
      const baseSpeed = 3.35 * (1 + this.saveData.skills.agility * 0.08) * overdriveMult;
      const nx = this.player.wx + dwx * baseSpeed * dt;
      const ny = this.player.wy + dwy * baseSpeed * dt;

      // Sliding collision resolution
      if (!this.checkCircleTileCollision(nx, this.player.wy, this.player.radius)) {
        this.player.wx = nx;
      }
      if (!this.checkCircleTileCollision(this.player.wx, ny, this.player.radius)) {
        this.player.wy = ny;
      }

      this.player.walkCycle += dt * overdriveMult;
      this.player.moveAngle = Math.atan2(syDir, sxDir);
    } else {
      this.isPlayerMoving = false;
    }

    // Check Toxic Acid Pool hazard (Tile 11)
    const currentTile = this.getTile(Math.floor(this.player.wx), Math.floor(this.player.wy));
    if (currentTile === 11) {
      this.player.acidTickMs += dtMs;
      if (this.player.acidTickMs >= 450) {
        this.player.acidTickMs = 0;
        this.damagePlayer(4);
      }
    } else {
      this.player.acidTickMs = 0;
    }

    // Check automatic extraction when standing on Extraction Pad (Tile 12)
    if (this.extractionReady) {
      const dist = Math.hypot(
        this.player.wx - this.mission.extractionPoint.wx,
        this.player.wy - this.mission.extractionPoint.wy
      );
      if (dist < 0.85) {
        this.completeMission();
      }
    }
  }

  private checkCircleTileCollision(wx: number, wy: number, radius: number): boolean {
    const minTx = Math.floor(wx - radius);
    const maxTx = Math.floor(wx + radius);
    const minTy = Math.floor(wy - radius);
    const maxTy = Math.floor(wy + radius);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.isTileSolidForMovement(tx, ty)) {
          const closestX = Math.max(tx, Math.min(wx, tx + 1));
          const closestY = Math.max(ty, Math.min(wy, ty + 1));
          const dist = Math.hypot(wx - closestX, wy - closestY);
          if (dist < radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateAutoFireAndReload(dtMs: number): void {
    const spec = WEAPONS[this.player.weapon];
    const effStats = getEffectiveWeaponStats(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills
    );
    const effectiveFireRateMs =
      this.player.overdriveTimerMs > 0
        ? Math.max(55, Math.round(effStats.fireRateMs * 0.65))
        : effStats.fireRateMs;

    // Handle reload progress
    if (this.player.reloading) {
      this.player.reloadTimerMs -= dtMs * (this.player.overdriveTimerMs > 0 ? 1.35 : 1);
      if (this.player.reloadTimerMs <= 0) {
        this.player.reloading = false;
        if (spec.infiniteAmmo) {
          this.player.clip = effStats.clipSize;
        } else {
          const avail = this.saveData.ammoInventory[this.player.weapon];
          if (avail <= 0) {
            this.switchWeapon('pistol');
          } else {
            this.player.clip = Math.min(effStats.clipSize, avail);
          }
        }
      }
    }

    // Intelligent Auto-Fire Target Acquisition
    let nearestEnemy: EnemyEntity | null = null;
    let bestDist = effStats.range;

    for (const enemy of this.enemies) {
      if (enemy.state === 'dead' || enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.wx - this.player.wx, enemy.wy - this.player.wy);
      if (dist <= bestDist) {
        if (this.hasLineOfSight(this.player.wx, this.player.wy, enemy.wx, enemy.wy)) {
          bestDist = dist;
          nearestEnemy = enemy;
        }
      }
    }

    if (nearestEnemy) {
      this.lockedEnemyId = nearestEnemy.id;
      const pIso = this.worldToIso(this.player.wx, this.player.wy);
      const eIso = this.worldToIso(nearestEnemy.wx, nearestEnemy.wy);
      this.player.aimAngle = Math.atan2(eIso.sy - pIso.sy, eIso.sx - pIso.sx);

      this.player.lastShotMs += dtMs;
      if (!this.player.reloading && this.player.lastShotMs >= effectiveFireRateMs) {
        if (this.player.clip <= 0) {
          soundFX.playEmptyMag();
          this.startReload();
        } else {
          this.fireWeaponAt(nearestEnemy.wx, nearestEnemy.wy);
          this.player.lastShotMs = 0;
        }
      }
    } else {
      this.lockedEnemyId = null;
      this.player.aimAngle = this.player.moveAngle;
      this.player.lastShotMs = Math.min(this.player.lastShotMs + dtMs, effectiveFireRateMs);
    }
  }

  private fireWeaponAt(targetWx: number, targetWy: number): void {
    const spec = WEAPONS[this.player.weapon];
    const effStats = getEffectiveWeaponStats(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills
    );
    const baseAngle = Math.atan2(targetWy - this.player.wy, targetWx - this.player.wx);
    const baseDmg = getEffectiveWeaponDamage(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills.firepower
    );
    const critChance = 0.1 + this.saveData.skills.firepower * 0.025;
    const isCrit = Math.random() < critChance;
    const dmg = isCrit ? Math.round(baseDmg * 1.45) : baseDmg;

    for (let i = 0; i < spec.pellets; i++) {
      const spread = (Math.random() - 0.5) * spec.spreadRad * 2;
      const angle = baseAngle + spread;
      this.spawnBullet(
        this.player.wx + Math.cos(angle) * 0.15,
        this.player.wy + Math.sin(angle) * 0.15,
        Math.cos(angle) * spec.bulletSpeed,
        Math.sin(angle) * spec.bulletSpeed,
        dmg,
        true,
        spec.color,
        this.player.weapon === 'plasma' ? 0.18 : 0.11,
        Math.round((effStats.range / spec.bulletSpeed) * 1050),
        this.player.weapon === 'plasma',
        this.player.weapon,
        isCrit,
        false
      );
    }

    // Eject brass shell casing and weapon-specific muzzle smoke/plasma/energy particles
    if (this.player.weapon === 'plasma') {
      this.spawnHitSparks(this.player.wx, this.player.wy, '#86efac', 3, 'plasma');
      this.spawnHitSparks(this.player.wx, this.player.wy, '#4ade80', 2, 'energy');
    } else {
      this.spawnHitSparks(this.player.wx, this.player.wy, '#eab308', 1, 'shell');
      if (this.player.weapon === 'shotgun') {
        this.spawnHitSparks(this.player.wx, this.player.wy, '#64748b', 3, 'smoke');
        this.spawnHitSparks(this.player.wx, this.player.wy, '#f97316', 2, 'fire');
      }
    }

    this.player.muzzleFlashMs = 55;
    this.player.clip--;
    if (!spec.infiniteAmmo) {
      this.saveData.ammoInventory[this.player.weapon] = Math.max(
        0,
        this.saveData.ammoInventory[this.player.weapon] - 1
      );
    }

    soundFX.playShoot(this.player.weapon);

    if (this.player.clip <= 0) {
      soundFX.playEmptyMag();
      this.startReload();
    }
  }

  private spawnBullet(
    wx: number,
    wy: number,
    vx: number,
    vy: number,
    damage: number,
    fromPlayer: boolean,
    color: string,
    radius: number,
    maxLifeMs: number,
    piercing = false,
    weaponId?: WeaponId,
    isCrit = false,
    turretShot = false
  ): void {
    const len = this.bullets.length;
    let slot: BulletEntity | null = null;
    for (let i = 0; i < len; i++) {
      const idx = (this.bulletCursor + i) % len;
      if (!this.bullets[idx].active) {
        slot = this.bullets[idx];
        this.bulletCursor = (idx + 1) % len;
        break;
      }
    }
    if (!slot) return;
    slot.active = true;
    slot.wx = wx;
    slot.wy = wy;
    slot.vx = vx;
    slot.vy = vy;
    slot.damage = damage;
    slot.fromPlayer = fromPlayer;
    slot.color = color;
    slot.radius = radius;
    slot.lifeMs = 0;
    slot.maxLifeMs = maxLifeMs;
    slot.piercing = piercing;
    slot.weaponId = weaponId;
    slot.isCrit = isCrit;
    slot.turretShot = turretShot;
  }

  public arePrimaryObjectivesComplete(): boolean {
    if (this.gameMode === 'SURVIVAL') return false;
    if (
      this.currentWave < this.mission.totalWaves ||
      this.spawnQueue.length > 0 ||
      this.enemies.length > 0
    ) {
      return false;
    }

    const obj = this.mission.objectives;
    if (!obj) return true;

    if (obj.surviveDurationMs && this.missionElapsedMs < obj.surviveDurationMs) {
      return false;
    }
    if (obj.requiredTerminals && this.hackedTerminals.size < obj.requiredTerminals) {
      return false;
    }
    if (obj.requiredStructures && this.destroyedStructures < obj.requiredStructures) {
      return false;
    }
    if (obj.protectObject && this.protectedObjectHp <= 0) {
      return false;
    }
    if (obj.requireBossDefeat) {
      const aliveBoss = this.enemies.some((e) => e.type === 'boss' && e.hp > 0);
      if (aliveBoss || this.bossesDefeated < 1) {
        return false;
      }
    }

    return true;
  }

  public damageProtectedObject(rawDamage: number): void {
    const obj = this.mission.objectives?.protectObject;
    if (!obj || this.protectedObjectHp <= 0 || this.player.isDead) return;
    this.protectedObjectHp = Math.max(0, this.protectedObjectHp - rawDamage);
    this.screenShakeMs = 95;
    this.addFloatingText(
      obj.wx,
      obj.wy,
      `${obj.name} HIT! (${this.protectedObjectHp}/${this.protectedObjectMaxHp})`,
      '#f97316'
    );

    if (this.protectedObjectHp <= 0) {
      soundFX.playExplosion();
      soundFX.playMissionFail();
      this.player.isDead = true;
      this.addFloatingText(obj.wx, obj.wy, `${obj.name} DESTROYED!`, '#ef4444');
      persistSaveData(this.saveData);
      this.onMissionEnd(false);
    }
  }

  private updateWaveSpawner(dtMs: number): void {
    if (this.spawnQueue.length > 0) {
      if (this.enemies.length < 14) {
        this.spawnTimerMs -= dtMs;
        if (this.spawnTimerMs <= 0) {
          const nextType = this.spawnQueue.shift()!;
          this.spawnEnemy(nextType);
          this.spawnTimerMs = nextType === 'boss' ? 1200 : 650;
        }
      }
    } else if (this.enemies.length === 0 && !this.extractionReady) {
      if (this.gameMode === 'SURVIVAL') {
        const waveCredits = 60 * this.currentWave;
        const waveXp = 45 * this.currentWave;
        this.saveData.credits += waveCredits;
        this.missionCreditsEarned += waveCredits;
        this.score += waveCredits * 2;
        this.grantXp(waveXp);
        if (this.currentWave > this.saveData.survivalBestWave) {
          this.saveData.survivalBestWave = this.currentWave;
        }
        if (this.score > this.saveData.survivalBestScore) {
          this.saveData.survivalBestScore = this.score;
        }
        if (this.score > this.saveData.highScore) {
          this.saveData.highScore = this.score;
        }
        persistSaveData(this.saveData);
        this.addFloatingText(
          this.player.wx,
          this.player.wy,
          `WAVE ${this.currentWave} CLEARED! +$${waveCredits}`,
          '#4ade80'
        );
        this.prepareWave(this.currentWave + 1);
      } else if (this.currentWave < this.mission.totalWaves) {
        this.prepareWave(this.currentWave + 1);
      } else if (this.arePrimaryObjectivesComplete()) {
        this.extractionReady = true;
        soundFX.playPickup();
        this.addFloatingText(
          this.player.wx,
          this.player.wy,
          'SECTOR CLEAR! GO TO BEACON',
          '#60a5fa'
        );
      }
    }
  }

  private spawnEnemy(type: EnemyType, customPos?: { wx: number; wy: number }): void {
    let pt = customPos;
    if (!pt) {
      if (this.spawnPoints.length > 0) {
        const valid = this.spawnPoints.filter(
          (sp) => Math.hypot(sp.wx - this.player.wx, sp.wy - this.player.wy) > 3.2
        );
        const list = valid.length > 0 ? valid : this.spawnPoints;
        pt = list[Math.floor(Math.random() * list.length)];
      } else {
        pt = { wx: 2.5, wy: 2.5 };
      }
    }

    const jitterX = (Math.random() - 0.5) * 0.4;
    const jitterY = (Math.random() - 0.5) * 0.4;

    const specs: Record<
      EnemyType,
      {
        name: string;
        hp: number;
        speed: number;
        damage: number;
        radius: number;
        attackRange: number;
        cooldown: number;
        xp: number;
        credits: number;
      }
    > = {
      basic: {
        name: 'Gnasher Crawler',
        hp: 48,
        speed: 2.15,
        damage: 9,
        radius: 0.28,
        attackRange: 0.72,
        cooldown: 750,
        xp: 18,
        credits: 12,
      },
      fast: {
        name: 'Crimson Stalker',
        hp: 34,
        speed: 3.25,
        damage: 7,
        radius: 0.25,
        attackRange: 0.68,
        cooldown: 520,
        xp: 22,
        credits: 15,
      },
      heavy: {
        name: 'Armored Crusher',
        hp: 165,
        speed: 1.35,
        damage: 20,
        radius: 0.38,
        attackRange: 0.85,
        cooldown: 1100,
        xp: 48,
        credits: 35,
      },
      ranged: {
        name: 'Acid Spitter',
        hp: 62,
        speed: 1.75,
        damage: 12,
        radius: 0.28,
        attackRange: 5.4,
        cooldown: 1450,
        xp: 30,
        credits: 22,
      },
      boss: {
        name: 'BROOD OVERLORD',
        hp: 950,
        speed: 1.55,
        damage: 28,
        radius: 0.52,
        attackRange: 6.2,
        cooldown: 1300,
        xp: 300,
        credits: 250,
      },
    };

    const s = specs[type];
    const waveScaleHp = this.gameMode === 'SURVIVAL' ? 1 + (this.currentWave - 1) * 0.16 : 1;
    const waveScaleSpd =
      this.gameMode === 'SURVIVAL' ? Math.min(1.45, 1 + (this.currentWave - 1) * 0.04) : 1;
    const waveScaleDmg = this.gameMode === 'SURVIVAL' ? 1 + (this.currentWave - 1) * 0.1 : 1;
    const scaledHp = Math.round(s.hp * waveScaleHp);

    const spawnX = pt.wx + jitterX;
    const spawnY = pt.wy + jitterY;

    this.enemies.push({
      id: this.nextEntityId++,
      type,
      name: s.name,
      wx: spawnX,
      wy: spawnY,
      vx: 0,
      vy: 0,
      radius: s.radius,
      hp: scaledHp,
      maxHp: scaledHp,
      speed: Number((s.speed * waveScaleSpd).toFixed(2)),
      damage: Math.round(s.damage * waveScaleDmg),
      attackRange: s.attackRange,
      attackCooldownMs: s.cooldown,
      lastAttackTime: 0,
      state: 'chase',
      angle: 0,
      animFrame: Math.random() * 10,
      hitFlashTimer: 0,
      xpValue: s.xp,
      creditValue: s.credits,
      bossPhase: 1,
      summonTimer: 5000,
      spawnAnimMs: type === 'boss' ? 900 : 220,
    });

    if (type === 'boss') {
      this.bossAlertBannerMs = 2100;
      this.screenShakeMs = 200;
      soundFX.playBossAttack();
      this.spawnHitSparks(spawnX, spawnY, '#f43f5e', 1, 'shockwave');
      this.spawnHitSparks(spawnX, spawnY, '#fde047', 10, 'energy');
      this.addFloatingText(spawnX, spawnY, 'WARNING: BROOD OVERLORD!', '#f43f5e');
    }
  }

  private computePlayerFlowField(): Int16Array {
    const w = this.mission.width;
    const h = this.mission.height;
    const ptx = Math.max(0, Math.min(w - 1, Math.floor(this.player.wx)));
    const pty = Math.max(0, Math.min(h - 1, Math.floor(this.player.wy)));

    if (!this.flowFieldDirty && ptx === this.lastFlowPlayerTx && pty === this.lastFlowPlayerTy) {
      this.flowFieldCacheHits++;
      return this.flowGrid;
    }

    this.lastFlowPlayerTx = ptx;
    this.lastFlowPlayerTy = pty;
    this.flowFieldDirty = false;
    this.flowFieldRecomputes++;

    const total = w * h;
    const distGrid = this.flowGrid;
    for (let i = 0; i < total; i++) {
      distGrid[i] = 9999;
    }

    const startIdx = pty * w + ptx;
    distGrid[startIdx] = 0;

    const qx = this.flowQueueX;
    const qy = this.flowQueueY;
    qx[0] = ptx;
    qy[0] = pty;
    let head = 0;
    let tail = 1;

    while (head < tail) {
      const cx = qx[head];
      const cy = qy[head];
      head++;
      const nextDist = distGrid[cy * w + cx] + 1;

      for (let d = 0; d < 4; d++) {
        const nx = cx + FLOW_CARDINALS[d][0];
        const ny = cy + FLOW_CARDINALS[d][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nIdx = ny * w + nx;
          if (distGrid[nIdx] === 9999 && !this.isTileSolidForMovement(nx, ny)) {
            distGrid[nIdx] = nextDist;
            qx[tail] = nx;
            qy[tail] = ny;
            tail++;
          }
        }
      }
    }

    return distGrid;
  }

  private hasDirectWalkLine(x0: number, y0: number, x1: number, y1: number, radius: number): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 3);
    if (steps <= 1) return true;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      if (this.checkCircleTileCollision(cx, cy, radius * 0.9)) {
        return false;
      }
    }
    return true;
  }

  private getEnemyChaseDirection(
    e: EnemyEntity,
    flowGrid: Int16Array,
    dx: number,
    dy: number,
    dist: number
  ): { dirX: number; dirY: number } {
    if (dist < 4.5 && this.hasDirectWalkLine(e.wx, e.wy, this.player.wx, this.player.wy, e.radius)) {
      return { dirX: dx / dist, dirY: dy / dist };
    }

    const w = this.mission.width;
    const h = this.mission.height;
    const etx = Math.max(0, Math.min(w - 1, Math.floor(e.wx)));
    const ety = Math.max(0, Math.min(h - 1, Math.floor(e.wy)));

    let bestTx = etx;
    let bestTy = ety;
    let bestCost = flowGrid[ety * w + etx];

    // Check 4 cardinal neighbors first
    for (let i = 0; i < 4; i++) {
      const ntx = etx + FLOW_CARDINALS[i][0];
      const nty = ety + FLOW_CARDINALS[i][1];
      if (ntx >= 0 && ntx < w && nty >= 0 && nty < h) {
        const c = flowGrid[nty * w + ntx];
        if (c < bestCost) {
          bestCost = c;
          bestTx = ntx;
          bestTy = nty;
        }
      }
    }

    // Check 4 diagonal neighbors ONLY if both adjacent cardinal tiles are open (prevents corner snagging)
    for (let i = 0; i < 4; i++) {
      const dxStep = FLOW_DIAGS[i][0];
      const dyStep = FLOW_DIAGS[i][1];
      const ntx = etx + dxStep;
      const nty = ety + dyStep;
      if (
        ntx >= 0 &&
        ntx < w &&
        nty >= 0 &&
        nty < h &&
        !this.isTileSolidForMovement(etx + dxStep, ety) &&
        !this.isTileSolidForMovement(etx, ety + dyStep)
      ) {
        const c = flowGrid[nty * w + ntx];
        if (c < bestCost) {
          bestCost = c;
          bestTx = ntx;
          bestTy = nty;
        }
      }
    }

    if (bestTx !== etx || bestTy !== ety) {
      const targetX = bestTx + 0.5;
      const targetY = bestTy + 0.5;
      const vx = targetX - e.wx;
      const vy = targetY - e.wy;
      const vlen = Math.hypot(vx, vy);
      if (vlen > 0.001) {
        return { dirX: vx / vlen, dirY: vy / vlen };
      }
    }

    return { dirX: dx / dist, dirY: dy / dist };
  }

  private updateEnemies(dt: number, dtMs: number): void {
    const flowGrid = this.enemies.length > 0 ? this.computePlayerFlowField() : null;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        if (e.state !== 'dead') {
          e.state = 'dead';
          e.deathTimerMs = e.type === 'boss' ? 540 : e.type === 'heavy' ? 360 : 250;
          e.deathMaxMs = e.deathTimerMs;
          this.handleEnemyDeath(e);
        } else {
          e.deathTimerMs = (e.deathTimerMs || 0) - dtMs;
          if (e.type === 'boss' && Math.random() < 0.55) {
            this.spawnHitSparks(
              e.wx + (Math.random() - 0.5) * 0.5,
              e.wy + (Math.random() - 0.5) * 0.5,
              '#f97316',
              3,
              'fire'
            );
          } else if (Math.random() < 0.35) {
            this.spawnHitSparks(
              e.wx + (Math.random() - 0.5) * 0.25,
              e.wy + (Math.random() - 0.5) * 0.25,
              e.type === 'fast' ? '#ef4444' : '#84cc16',
              2,
              'blood'
            );
          }
          if (e.deathTimerMs <= 0) {
            this.enemies.splice(i, 1);
          }
        }
        continue;
      }

      if (e.spawnAnimMs && e.spawnAnimMs > 0) e.spawnAnimMs -= dtMs;
      if (e.attackAnimMs && e.attackAnimMs > 0) e.attackAnimMs -= dtMs;
      if (e.hitFlashTimer > 0) e.hitFlashTimer -= dtMs;
      e.lastAttackTime += dtMs;

      const dx = this.player.wx - e.wx;
      const dy = this.player.wy - e.wy;
      const dist = Math.hypot(dx, dy);

      const pIso = this.worldToIso(this.player.wx, this.player.wy);
      const eIso = this.worldToIso(e.wx, e.wy);
      e.angle = Math.atan2(pIso.sy - eIso.sy, pIso.sx - eIso.sx);

      const hasLos = dist < 7.5 && this.hasLineOfSight(e.wx, e.wy, this.player.wx, this.player.wy);

      if (e.type === 'ranged') {
        if (dist <= e.attackRange && hasLos) {
          if (e.lastAttackTime >= e.attackCooldownMs) {
            e.lastAttackTime = 0;
            e.attackAnimMs = 200;
            const ang = Math.atan2(dy, dx);
            this.spawnBullet(
              e.wx + Math.cos(ang) * 0.3,
              e.wy + Math.sin(ang) * 0.3,
              Math.cos(ang) * 6.8,
              Math.sin(ang) * 6.8,
              e.damage,
              false,
              '#a3e635',
              0.15,
              1400
            );
          }
          if (dist < 2.2) {
            this.moveEnemyWithAvoidance(e, -dx / dist, -dy / dist, dt * 0.7);
          }
          continue;
        }
      } else if (e.type === 'boss') {
        e.summonTimer = (e.summonTimer || 5000) - dtMs;
        if (e.summonTimer <= 0 && this.enemies.length < 12) {
          e.summonTimer = 6500;
          e.attackAnimMs = 260;
          soundFX.playBossAttack();
          this.spawnEnemy('fast', { wx: e.wx + 0.6, wy: e.wy });
          this.spawnEnemy('basic', { wx: e.wx - 0.6, wy: e.wy });
          this.addFloatingText(e.wx, e.wy, 'SWARM SUMMON!', '#f43f5e');
        }

        if (dist <= e.attackRange && hasLos && e.lastAttackTime >= e.attackCooldownMs) {
          e.lastAttackTime = 0;
          e.attackAnimMs = 240;
          soundFX.playBossAttack();
          const baseAng = Math.atan2(dy, dx);
          for (let s = -1; s <= 1; s++) {
            const ang = baseAng + s * 0.22;
            this.spawnBullet(
              e.wx + Math.cos(ang) * 0.45,
              e.wy + Math.sin(ang) * 0.45,
              Math.cos(ang) * 7.2,
              Math.sin(ang) * 7.2,
              14,
              false,
              '#fb7185',
              0.18,
              1500
            );
          }
        }
      }

      const meleeReach = e.radius + this.player.radius + 0.18;
      if (dist <= meleeReach) {
        e.attackAnimMs = 180;
        if (e.lastAttackTime >= e.attackCooldownMs) {
          e.lastAttackTime = 0;
          if (e.type === 'boss') {
            soundFX.playBossAttack();
          }
          this.damagePlayer(e.damage);
        }
      } else if (dist > 0.05 && flowGrid) {
        const steer = this.getEnemyChaseDirection(e, flowGrid, dx, dy, dist);
        this.moveEnemyWithAvoidance(e, steer.dirX, steer.dirY, dt);
      }

      for (let j = i - 1; j >= 0; j--) {
        const other = this.enemies[j];
        const odx = e.wx - other.wx;
        const ody = e.wy - other.wy;
        const odist = Math.hypot(odx, ody);
        const minSep = e.radius + other.radius;
        if (odist > 0.001 && odist < minSep) {
          const push = (minSep - odist) * 0.25;
          const px = (odx / odist) * push;
          const py = (ody / odist) * push;
          if (!this.checkCircleTileCollision(e.wx + px, e.wy + py, e.radius)) {
            e.wx += px;
            e.wy += py;
          }
        }
      }
    }
  }

  private moveEnemyWithAvoidance(e: EnemyEntity, dirX: number, dirY: number, dt: number): void {
    e.animFrame += dt;
    const step = e.speed * dt;
    const nx = e.wx + dirX * step;
    const ny = e.wy + dirY * step;

    let movedX = false;
    let movedY = false;

    if (Math.abs(dirX) > 0.01 && !this.checkCircleTileCollision(nx, e.wy, e.radius)) {
      e.wx = nx;
      movedX = true;
    }
    if (Math.abs(dirY) > 0.01 && !this.checkCircleTileCollision(e.wx, ny, e.radius)) {
      e.wy = ny;
      movedY = true;
    }

    // If blocked on X while trying to move horizontally, nudge Y toward current tile center
    if (!movedX && Math.abs(dirX) > 0.15) {
      const centerY = Math.floor(e.wy) + 0.5;
      const diffY = centerY - e.wy;
      const nudgeY = Math.sign(diffY) * Math.min(Math.abs(diffY), step * 0.9);
      if (Math.abs(nudgeY) > 0.001 && !this.checkCircleTileCollision(e.wx, e.wy + nudgeY, e.radius)) {
        e.wy += nudgeY;
      }
    }

    // If blocked on Y while trying to move vertically, nudge X toward current tile center
    if (!movedY && Math.abs(dirY) > 0.15) {
      const centerX = Math.floor(e.wx) + 0.5;
      const diffX = centerX - e.wx;
      const nudgeX = Math.sign(diffX) * Math.min(Math.abs(diffX), step * 0.9);
      if (Math.abs(nudgeX) > 0.001 && !this.checkCircleTileCollision(e.wx + nudgeX, e.wy, e.radius)) {
        e.wx += nudgeX;
      }
    }
  }

  private updateBullets(dt: number, dtMs: number): void {
    const subSteps = 4;
    const subDt = dt / subSteps;

    for (const b of this.bullets) {
      if (!b.active) continue;
      b.lifeMs += dtMs;
      if (b.lifeMs >= b.maxLifeMs) {
        b.active = false;
        continue;
      }

      for (let step = 0; step < subSteps; step++) {
        if (!b.active) break;

        b.wx += b.vx * subDt;
        b.wy += b.vy * subDt;

        const tx = Math.floor(b.wx);
        const ty = Math.floor(b.wy);
        const tile = this.getTile(tx, ty);

        if (tile === 4 || tile === 5 || tile === 13) {
          b.active = false;
          this.spawnHitSparks(
            b.wx,
            b.wy,
            tile === 13 ? '#f59e0b' : b.weaponId === 'plasma' ? '#4ade80' : '#94a3b8',
            3,
            b.weaponId === 'plasma' ? 'energy' : 'spark'
          );
          break;
        }

        if (b.fromPlayer && (tile === 7 || tile === 10 || tile === 16)) {
          b.active = false;
          this.damageProp(tx, ty, b.damage);
          break;
        }

        if (b.fromPlayer) {
          for (const e of this.enemies) {
            if (e.hp <= 0 || e.state === 'dead') continue;
            const dist = Math.hypot(e.wx - b.wx, e.wy - b.wy);
            if (dist <= e.radius + b.radius) {
              e.hp -= b.damage;
              e.hitFlashTimer = e.type === 'boss' ? 110 : 85;
              soundFX.playAlienHit();
              if (b.isCrit) {
                this.spawnHitSparks(b.wx, b.wy, '#fde047', 4, 'energy');
                if (Math.random() < 0.45) {
                  this.addFloatingText(e.wx, e.wy, `CRIT -${b.damage}`, '#fde047');
                }
              } else if (b.weaponId === 'plasma') {
                this.spawnHitSparks(b.wx, b.wy, '#4ade80', 4, 'energy');
              } else {
                this.spawnHitSparks(
                  b.wx,
                  b.wy,
                  e.type === 'fast' ? '#ef4444' : '#84cc16',
                  4,
                  'blood'
                );
              }
              if (!b.piercing) {
                b.active = false;
                break;
              }
            }
          }
        } else {
          const dist = Math.hypot(this.player.wx - b.wx, this.player.wy - b.wy);
          if (dist <= this.player.radius + b.radius) {
            b.active = false;
            this.damagePlayer(b.damage);
            this.spawnHitSparks(b.wx, b.wy, '#a3e635', 5, 'energy');
            break;
          }
        }
      }
    }
  }

  private damageProp(tx: number, ty: number, dmg: number): void {
    const key = `${tx},${ty}`;
    const cur = this.propHp.get(key) !== undefined ? this.propHp.get(key)! : 30;
    const next = cur - dmg;
    const kind = this.tiles[ty][tx];
    this.spawnHitSparks(tx + 0.5, ty + 0.5, kind === 16 ? '#22d3ee' : '#facc15', 4);

    if (next <= 0) {
      this.tiles[ty][tx] = this.mission.id >= 2 ? 3 : 1;
      this.propHp.delete(key);
      this.propMaxHp.delete(key);
      this.flowFieldDirty = true;

      if (kind === 7) {
        this.triggerExplosion(tx + 0.5, ty + 0.5, 2.6, 130);
      } else if (kind === 10) {
        soundFX.playPickup();
        this.addDecal(tx + 0.5, ty + 0.5, 'debris_crate', 7);
        const roll = Math.random();
        const lootType: LootType =
          roll < 0.3
            ? 'medkit'
            : roll < 0.55
            ? 'ammo_rifle'
            : roll < 0.8
            ? 'ammo_shotgun'
            : 'credits';
        const amt = lootType === 'medkit' ? 35 : lootType === 'credits' ? 50 : 24;
        this.spawnLoot(tx + 0.5, ty + 0.5, lootType, amt);
      } else if (kind === 16) {
        this.destroyedStructures++;
        soundFX.playAlienDeath(false);
        this.addDecal(tx + 0.5, ty + 0.5, 'debris_pod', 9);
        this.spawnHitSparks(tx + 0.5, ty + 0.5, '#a3e635', 12);
        if (Math.random() < 0.7) {
          this.spawnLoot(
            tx + 0.5,
            ty + 0.5,
            this.saveData.unlockedWeapons.plasma ? 'ammo_plasma' : 'credits',
            this.saveData.unlockedWeapons.plasma ? 20 : 65
          );
          this.addFloatingText(tx + 0.5, ty + 0.5, 'BIO-POD RUPTURED!', '#22d3ee');
        } else {
          this.spawnEnemy('fast', { wx: tx + 0.5, wy: ty + 0.5 });
          this.addFloatingText(tx + 0.5, ty + 0.5, 'SPECIMEN RELEASED!', '#f43f5e');
        }
      }
    } else {
      this.propHp.set(key, next);
    }
  }

  private triggerExplosion(
    wx: number,
    wy: number,
    radius: number,
    maxDamage: number,
    isGrenade = false
  ): void {
    if (isGrenade) {
      soundFX.playGrenadeExplode();
    } else {
      soundFX.playExplosion();
    }
    this.screenShakeMs = 260;
    this.addDecal(wx, wy, 'scorch', 14);
    this.spawnHitSparks(wx, wy, '#f97316', 1, 'shockwave');
    this.spawnHitSparks(wx, wy, '#f97316', 12, 'fire');
    this.spawnHitSparks(wx, wy, '#facc15', 8, 'spark');
    this.spawnHitSparks(wx, wy, '#64748b', 5, 'smoke');

    for (const e of this.enemies) {
      const d = Math.hypot(e.wx - wx, e.wy - wy);
      if (d <= radius) {
        const falloff = 1 - (d / radius) * 0.5;
        e.hp -= Math.round(maxDamage * falloff);
        e.hitFlashTimer = 140;
      }
    }

    const minTx = Math.max(0, Math.floor(wx - radius));
    const maxTx = Math.min(this.mission.width - 1, Math.floor(wx + radius));
    const minTy = Math.max(0, Math.floor(wy - radius));
    const maxTy = Math.min(this.mission.height - 1, Math.floor(wy + radius));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.tiles[ty][tx] === 7 || this.tiles[ty][tx] === 16) {
          this.damageProp(tx, ty, 999);
        }
      }
    }
  }

  private handleEnemyDeath(e: EnemyEntity): void {
    if (e.type === 'boss') {
      soundFX.playBossDeath();
      this.bossesDefeated++;
      this.screenShakeMs = 340;
      this.spawnHitSparks(e.wx, e.wy, '#f43f5e', 1, 'shockwave');
      this.spawnHitSparks(e.wx, e.wy, '#f97316', 14, 'fire');
      this.spawnHitSparks(e.wx, e.wy, '#fde047', 10, 'energy');
      this.addFloatingText(e.wx, e.wy, 'BROOD OVERLORD SLAIN!', '#fde047');
    } else {
      soundFX.playAlienDeath(e.type === 'heavy');
    }
    this.missionKills++;
    this.saveData.totalKills++;
    this.score += e.xpValue * 5;
    this.saveData.credits += e.creditValue;
    this.missionCreditsEarned += e.creditValue;
    this.grantXp(e.xpValue);

    const corpseType: DecalEntity['type'] =
      e.type === 'heavy' || e.type === 'boss'
        ? 'corpse_heavy'
        : e.type === 'fast'
        ? 'corpse_fast'
        : 'corpse_basic';

    this.addDecal(
      e.wx,
      e.wy,
      corpseType,
      e.type === 'boss' ? 16 : e.type === 'heavy' ? 11 : 8
    );

    this.spawnHitSparks(
      e.wx,
      e.wy,
      e.type === 'fast' ? '#ef4444' : '#84cc16',
      e.type === 'boss' ? 18 : 9,
      'blood'
    );

    if (Math.random() < 0.32 || e.type === 'heavy' || e.type === 'boss') {
      const r = Math.random();
      let ltype: LootType = 'credits';
      let amt = 25;
      if (r < 0.26) {
        ltype = 'medkit';
        amt = 25;
      } else if (r < 0.45) {
        ltype = 'armor';
        amt = 20;
      } else if (r < 0.72) {
        ltype = 'ammo_rifle';
        amt = 30;
      } else {
        ltype = 'ammo_shotgun';
        amt = 10;
      }
      this.spawnLoot(e.wx, e.wy, ltype, amt);
    }
  }

  private grantXp(amount: number): void {
    // STEP 1 FIX (Bug 2): XP, level and skill points were only kept in
    // memory until a mission ended or a wave cleared. If the app was
    // closed after reaching a new level, all of it was lost. Persist
    // immediately on every XP grant (kill and wave rewards both flow here).
    this.saveData.xp += amount;
    const needed = getXpForNextLevel(this.saveData.level);
    if (this.saveData.xp >= needed) {
      this.saveData.xp -= needed;
      this.saveData.level++;
      this.saveData.skillPoints++;
      this.player.hp = this.player.maxHp;
      this.levelUpBannerMs = 1500;
      soundFX.playLevelUp();
      this.spawnHitSparks(this.player.wx, this.player.wy, '#facc15', 10, 'energy');
      this.addFloatingText(
        this.player.wx,
        this.player.wy,
        `LEVEL UP! LV.${this.saveData.level}`,
        '#facc15'
      );
    }
    persistSaveData(this.saveData);
  }

  private damagePlayer(rawDamage: number): void {
    if (this.player.hp <= 0) return;
    this.player.hitFlashMs = 130;
    this.damageFlashMs = 180;
    this.screenShakeMs = 110;

    let remaining = rawDamage;
    if (this.player.armor > 0) {
      const armorTier = Math.max(1, this.saveData.armorTier || 1);
      const absorbRatio = Math.min(
        0.85,
        0.65 + (armorTier - 1) * 0.04 + this.saveData.skills.armorTech * 0.02
      );
      const absorbed = Math.min(this.player.armor, Math.ceil(rawDamage * absorbRatio));
      this.player.armor -= absorbed;
      remaining -= absorbed;
      this.armorFlashMs = 140;
      soundFX.playArmorHit();
      this.spawnHitSparks(this.player.wx, this.player.wy, '#38bdf8', 4, 'energy');
    } else {
      soundFX.playPlayerHit();
    }

    this.player.hp = Math.max(0, this.player.hp - remaining);
    this.addDecal(this.player.wx, this.player.wy, 'blood_red', 6);
    this.spawnHitSparks(this.player.wx, this.player.wy, '#ef4444', 4, 'blood');

    if (this.player.hp <= 0) {
      soundFX.playPlayerDeath();
      soundFX.playMissionFail();
      if (this.score > this.saveData.highScore) {
        this.saveData.highScore = this.score;
      }
      if (this.gameMode === 'SURVIVAL') {
        if (this.currentWave > this.saveData.survivalBestWave) {
          this.saveData.survivalBestWave = this.currentWave;
        }
        if (this.score > this.saveData.survivalBestScore) {
          this.saveData.survivalBestScore = this.score;
        }
      }
      persistSaveData(this.saveData);
      this.player.isDead = true;
      this.player.deathAnimTimerMs = 0;
      this.onMissionEnd(false);
    }
  }

  private completeMission(): void {
    soundFX.playMissionComplete();
    this.spawnHitSparks(this.player.wx, this.player.wy, '#38bdf8', 12, 'energy');
    // STEP 2: per-level reward is a share of the mission reward, so clearing
    // all 4-5 levels totals about the old mission reward plus a small bonus.
    // This preserves the old economy instead of paying full reward per level.
    const lc = this.getMissionLevelCount();
    const levelRewardCredits = Math.round(this.mission.rewardCredits / lc);
    const levelRewardXp = Math.round(this.mission.rewardXp / lc);
    this.saveData.credits += levelRewardCredits;
    this.missionCreditsEarned += levelRewardCredits;
    this.grantXp(levelRewardXp);
    this.score += levelRewardCredits * 2;
    if (this.score > this.saveData.highScore) {
      this.saveData.highScore = this.score;
    }
    if (this.gameMode === 'SURVIVAL') {
      persistSaveData(this.saveData);
      this.onMissionEnd(true);
      return;
    }
    if (!this.saveData.missionLevelProgress) this.saveData.missionLevelProgress = {};
    if (this.currentLevel < lc) {
      // Next level in the same mission, mission itself not yet completed.
      this.saveData.missionLevelProgress[this.mission.id] = this.currentLevel;
      this.pendingNextLevel = this.currentLevel + 1;
    } else {
      this.saveData.missionLevelProgress[this.mission.id] = lc;
      this.pendingNextLevel = 0;
      if (!this.saveData.completedMissions.includes(this.mission.id)) {
        this.saveData.completedMissions.push(this.mission.id);
      }
      if (this.saveData.unlockedMission <= this.mission.id && this.mission.id < MISSIONS.length) {
        this.saveData.unlockedMission = this.mission.id + 1;
      }
    }
    persistSaveData(this.saveData);
    this.onMissionEnd(true);
  }

  private spawnLoot(wx: number, wy: number, type: LootType, amount: number): void {
    this.loots.push({
      id: this.nextEntityId++,
      wx,
      wy,
      type,
      amount,
      bobPhase: Math.random() * Math.PI * 2,
    });
  }

  private updateLoots(dt: number): void {
    for (let i = this.loots.length - 1; i >= 0; i--) {
      const l = this.loots[i];
      l.bobPhase += dt * 4;
      const dist = Math.hypot(this.player.wx - l.wx, this.player.wy - l.wy);
      if (dist <= 0.68) {
        soundFX.playPickup();
        if (l.type === 'medkit') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + l.amount);
          this.addFloatingText(l.wx, l.wy, `+${l.amount} HP`, '#4ade80');
        } else if (l.type === 'armor') {
          this.player.armor = Math.min(this.player.maxArmor, this.player.armor + l.amount);
          this.addFloatingText(l.wx, l.wy, `+${l.amount} ARMOR`, '#38bdf8');
        } else if (l.type === 'ammo_rifle') {
          this.saveData.ammoInventory.rifle += l.amount;
          this.addFloatingText(l.wx, l.wy, `+${l.amount} RIFLE AMMO`, '#fde047');
        } else if (l.type === 'ammo_shotgun') {
          this.saveData.ammoInventory.shotgun += l.amount;
          this.addFloatingText(l.wx, l.wy, `+${l.amount} SHELLS`, '#fb923c');
        } else if (l.type === 'ammo_plasma') {
          this.saveData.ammoInventory.plasma += l.amount;
          this.addFloatingText(l.wx, l.wy, `+${l.amount} PLASMA`, '#4ade80');
        } else if (l.type === 'grenade_pack') {
          this.saveData.tacticalInventory.grenades += l.amount;
          this.addFloatingText(l.wx, l.wy, `+${l.amount} FRAG GRENADE`, '#f97316');
        } else if (l.type === 'credits') {
          this.saveData.credits += l.amount;
          this.missionCreditsEarned += l.amount;
          this.addFloatingText(l.wx, l.wy, `+$${l.amount}`, '#facc15');
        }
        this.loots.splice(i, 1);
      }
    }
  }

  private addDecal(wx: number, wy: number, type: DecalEntity['type'], size: number): void {
    if (this.decals.length >= 55) {
      this.decals.shift();
    }
    this.decals.push({
      wx,
      wy,
      type,
      size,
      angle: Math.random() * Math.PI * 2,
    });
  }

  private spawnHitSparks(
    wx: number,
    wy: number,
    color: string,
    count: number,
    kind: ParticleEntity['kind'] = 'spark'
  ): void {
    if (this.saveData.particlesEnabled === false) return;
    let spawned = 0;
    const len = this.particles.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.particleCursor + i) % len;
      const p = this.particles[idx];
      if (!p.active) {
        p.active = true;
        p.wx = wx;
        p.wy = wy;
        p.wz = kind === 'shell' ? 12 : kind === 'shockwave' ? 1 : 6;
        const ang = Math.random() * Math.PI * 2;
        const spd =
          kind === 'shockwave'
            ? 0
            : kind === 'smoke'
            ? 0.4 + Math.random() * 0.8
            : kind === 'shell'
            ? 0.8 + Math.random() * 1.4
            : 1.2 + Math.random() * 3.2;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd;
        p.vz =
          kind === 'shockwave'
            ? 0
            : kind === 'smoke'
            ? 6 + Math.random() * 8
            : kind === 'shell'
            ? 18 + Math.random() * 12
            : 15 + Math.random() * 25;
        p.color = color;
        p.size =
          kind === 'shockwave'
            ? 5
            : kind === 'smoke'
            ? 3.5 + Math.random() * 3
            : kind === 'plasma' || kind === 'energy'
            ? 2.5 + Math.random() * 2
            : 2 + Math.random() * 1.5;
        p.lifeMs = 0;
        p.maxLifeMs =
          kind === 'shockwave'
            ? 320
            : kind === 'smoke'
            ? 360 + Math.random() * 240
            : kind === 'shell'
            ? 450
            : 220 + Math.random() * 180;
        p.kind = kind;
        spawned++;
        if (spawned >= count) {
          this.particleCursor = (idx + 1) % len;
          break;
        }
      }
    }
  }

  private updateEnvironmentParticles(dtMs: number): void {
    if (this.saveData.particlesEnabled === false) return;
    this.envParticleTimerMs += dtMs;
    if (this.envParticleTimerMs < 360) return;
    this.envParticleTimerMs = 0;

    // Sample a random nearby tile around the player for ambient facility particles
    const ptx = Math.floor(this.player.wx) + Math.floor((Math.random() - 0.5) * 8);
    const pty = Math.floor(this.player.wy) + Math.floor((Math.random() - 0.5) * 8);
    const tile = this.getTile(ptx, pty);
    if (tile === 11) {
      // Bubbling toxic acid pool vapor
      this.spawnHitSparks(ptx + 0.3 + Math.random() * 0.4, pty + 0.3 + Math.random() * 0.4, '#a3e635', 1, 'plasma');
    } else if (tile === 8) {
      // Alien hive vent bio-spores
      this.spawnHitSparks(ptx + 0.5, pty + 0.5, '#fb7185', 1, 'smoke');
    } else if (tile === 3 && Math.random() < 0.35) {
      // Industrial tech grate electrical spark
      this.spawnHitSparks(ptx + 0.5, pty + 0.5, '#38bdf8', 1, 'energy');
    }
  }

  private updateParticles(dt: number, dtMs: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.lifeMs += dtMs;
      if (p.lifeMs >= p.maxLifeMs) {
        p.active = false;
        continue;
      }
      if (p.kind !== 'shockwave') {
        p.wx += p.vx * dt;
        p.wy += p.vy * dt;
        p.wz = Math.max(0, p.wz + p.vz * dt);
        p.vz -= 90 * dt;
      }
    }
  }

  private addFloatingText(wx: number, wy: number, text: string, color: string): void {
    this.floatingTexts.push({
      wx,
      wy,
      wz: 18,
      text,
      color,
      lifeMs: 1100,
    });
  }

  private updateFloatingTexts(dtMs: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.lifeMs -= dtMs;
      ft.wz += dtMs * 0.014;
      if (ft.lifeMs <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public getHudSnapshot(): HudSnapshot {
    const spec = WEAPONS[this.player.weapon];
    const effStats = getEffectiveWeaponStats(
      this.player.weapon,
      this.saveData.weaponLevels[this.player.weapon],
      this.saveData.skills
    );
    const boss = this.enemies.find((e) => e.type === 'boss');

    let contextPrompt: string | null = null;
    let bestPromptDist = 1.65;
    const ptx = Math.floor(this.player.wx);
    const pty = Math.floor(this.player.wy);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = ptx + dx;
        const ty = pty + dy;
        const dist = Math.hypot(tx + 0.5 - this.player.wx, ty + 0.5 - this.player.wy);
        if (dist > bestPromptDist) continue;
        const tile = this.getTile(tx, ty);
        if (tile === 9 && !this.hackedTerminals.has(`${tx},${ty}`)) {
          bestPromptDist = dist;
          contextPrompt = 'PRESS OK: HACK TERMINAL';
        } else if (tile === 13) {
          bestPromptDist = dist;
          contextPrompt = 'PRESS OK: OPEN BLAST DOOR';
        } else if (tile === 15) {
          const tur = this.turrets.get(`${tx},${ty}`);
          if (tur && !tur.active) {
            bestPromptDist = dist;
            contextPrompt = 'PRESS OK: ACTIVATE TURRET';
          } else if (tur && tur.ammoRemaining < tur.maxAmmo) {
            bestPromptDist = dist;
            contextPrompt = 'PRESS OK: RELOAD TURRET';
          }
        }
      }
    }
    if (!contextPrompt && this.extractionReady && this.gameMode === 'CAMPAIGN') {
      contextPrompt = 'STEP ON BLUE BEACON TO EXTRACT';
    }

    let activeTurrets = 0;
    this.turrets.forEach((t) => {
      if (t.active && t.ammoRemaining > 0) activeTurrets++;
    });

    const obj = this.mission.objectives;
    let objectiveText = this.mission.objectiveText;
    if (this.gameMode === 'SURVIVAL') {
      objectiveText = `SURVIVE ENDLESS WAVES (BEST: W-${this.saveData.survivalBestWave})`;
    } else if (this.extractionReady) {
      objectiveText = 'REACH EXTRACTION BEACON';
    } else if (obj?.surviveDurationMs && this.missionElapsedMs < obj.surviveDurationMs) {
      const remSec = Math.ceil((obj.surviveDurationMs - this.missionElapsedMs) / 1000);
      objectiveText = `SURVIVE HOLD (${remSec}s REMAINING)`;
    } else if (obj?.requiredTerminals && this.hackedTerminals.size < obj.requiredTerminals) {
      objectiveText = `HACK TERMINALS (${this.hackedTerminals.size}/${obj.requiredTerminals})`;
    } else if (obj?.requiredStructures && this.destroyedStructures < obj.requiredStructures) {
      objectiveText = `DESTROY BIO-PODS (${this.destroyedStructures}/${obj.requiredStructures})`;
    }

    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      armor: this.player.armor,
      maxArmor: this.player.maxArmor,
      weapon: this.player.weapon,
      clipAmmo: this.player.clip,
      maxClip: effStats.clipSize,
      reserveAmmo: this.saveData.ammoInventory[this.player.weapon],
      infiniteAmmo: spec.infiniteAmmo,
      reloading: this.player.reloading,
      reloadProgress: this.player.reloading
        ? 1 - Math.max(0, this.player.reloadTimerMs / effStats.reloadMs)
        : 1,
      wave: this.currentWave,
      totalWaves: this.mission.totalWaves,
      enemiesRemaining: this.enemies.length + this.spawnQueue.length,
      score: this.score,
      credits: this.saveData.credits,
      xp: this.saveData.xp,
      level: this.saveData.level,
      objectiveText,
      contextPrompt,
      bossName: boss ? boss.name : null,
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      fps: this.fpsCount,
      avgFps: this.avgFps,
      frameTimeMs: this.frameTimeMs,
      updateTimeMs: this.updateTimeMs,
      renderTimeMs: this.renderTimeMs,
      autoTargetLocked: this.lockedEnemyId !== null,
      activeTurrets,
      totalTurrets: this.turrets.size,
      grenades: this.saveData.tacticalInventory.grenades,
      medkits: this.saveData.tacticalInventory.medkits,
      overdrives: this.saveData.tacticalInventory.overdrives,
      overdriveActive: this.player.overdriveTimerMs > 0,
      gameMode: this.gameMode,
      survivalBestWave: this.saveData.survivalBestWave,
      missionElapsedMs: this.missionElapsedMs,
      destroyedStructures: this.destroyedStructures,
      bossesDefeated: this.bossesDefeated,
      protectedObjectName: obj?.protectObject ? obj.protectObject.name : null,
      protectedObjectHp: this.protectedObjectHp,
      protectedObjectMaxHp: this.protectedObjectMaxHp,
      selectedEquipment: this.saveData.selectedEquipment || 'grenade',
      missionLevel: this.currentLevel,
      missionLevelCount: this.getMissionLevelCount(),
    };
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const startRnd = nowMs();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070a0e';
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

    ctx.save();

    // STEP 2 gameplay zoom: 1.25x about the screen centre. World logic,
    // movement, collision and camera centring are unchanged; only the
    // canvas world layer inside this save/restore block is scaled, so
    // HUD, lighting and minimap (drawn after restore) stay at 240x320.
    const GAME_ZOOM = 1.25;
    ctx.translate(NATIVE_W / 2, NATIVE_H / 2);
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    ctx.translate(-NATIVE_W / 2, -NATIVE_H / 2);

    const allowShake = this.saveData.screenShakeEnabled !== false;
    const shakeX = allowShake && this.screenShakeMs > 0 ? (Math.random() - 0.5) * 4 : 0;
    const shakeY = allowShake && this.screenShakeMs > 0 ? (Math.random() - 0.5) * 4 : 0;
    const offsetX = Math.round(NATIVE_W / 2 - this.camX + shakeX);
    const offsetY = Math.round(NATIVE_H / 2 - this.camY + shakeY);
    ctx.translate(offsetX, offsetY);

    // 1. Render flat ground tiles (Pass 1)
    for (let ty = 0; ty < this.mission.height; ty++) {
      for (let tx = 0; tx < this.mission.width; tx++) {
        const iso = this.worldToIso(tx + 0.5, ty + 0.5);
        if (
          iso.sx + offsetX < -40 ||
          iso.sx + offsetX > NATIVE_W + 40 ||
          iso.sy + offsetY < -40 ||
          iso.sy + offsetY > NATIVE_H + 50
        ) {
          continue;
        }

        const kind = this.tiles[ty][tx];
        const floorKind: TileKind =
          kind === 4 ||
          kind === 5 ||
          kind === 6 ||
          kind === 7 ||
          kind === 9 ||
          kind === 10 ||
          kind === 13 ||
          kind === 15 ||
          kind === 16
            ? this.mission.id >= 2 && (kind === 15 || kind === 16)
              ? 3
              : 1
            : kind;
        const tileCanvas = spriteCache.getTileCanvas(floorKind);
        if (tileCanvas) {
          ctx.drawImage(
            tileCanvas,
            Math.round(iso.sx - tileCanvas.width / 2),
            Math.round(iso.sy - tileCanvas.height + ISO_TILE_H / 2 + 2)
          );
        }
      }
    }

    // 2. Render Blood, Scorch & Corpse/Debris Decals on floor
    for (const d of this.decals) {
      const iso = this.worldToIso(d.wx, d.wy);
      spriteCache.drawDecal(ctx, d, Math.round(iso.sx), Math.round(iso.sy));
    }

    // 3. Render Loot Drops on ground
    for (const l of this.loots) {
      const iso = this.worldToIso(l.wx, l.wy);
      const bob = Math.sin(l.bobPhase) * 2.5;
      ctx.fillStyle =
        l.type === 'medkit'
          ? '#ef4444'
          : l.type === 'armor'
          ? '#38bdf8'
          : l.type === 'credits'
          ? '#facc15'
          : l.type === 'grenade_pack'
          ? '#f97316'
          : '#84cc16';
      ctx.fillRect(iso.sx - 5, iso.sy - 6 + bob, 10, 7);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(iso.sx - 5, iso.sy - 6 + bob, 10, 7);
    }

    // 4. Depth-Sorted Render List using Pre-Allocated Render Pool (zero per-frame object allocations)
    const renderList = this.activeRenderSlice;
    renderList.length = 0;
    let poolIdx = 0;

    const allocRenderItem = (): PooledRenderItem => {
      if (poolIdx >= this.renderPool.length) {
        this.renderPool.push({
          kind: 'prop',
          depth: 0,
          tx: 0,
          ty: 0,
          tileKind: 1,
          enemy: null,
        });
      }
      const item = this.renderPool[poolIdx++];
      renderList.push(item);
      return item;
    };

    for (let ty = 0; ty < this.mission.height; ty++) {
      for (let tx = 0; tx < this.mission.width; tx++) {
        const t = this.tiles[ty][tx];
        if (
          t === 4 ||
          t === 5 ||
          t === 6 ||
          t === 7 ||
          t === 9 ||
          t === 10 ||
          t === 13 ||
          t === 15 ||
          t === 16
        ) {
          const iso = this.worldToIso(tx + 0.5, ty + 0.5);
          if (
            iso.sx + offsetX >= -40 &&
            iso.sx + offsetX <= NATIVE_W + 40 &&
            iso.sy + offsetY >= -40 &&
            iso.sy + offsetY <= NATIVE_H + 50
          ) {
            const slot = allocRenderItem();
            slot.kind = 'prop';
            slot.depth = tx + 0.5 + (ty + 0.5);
            slot.tx = tx;
            slot.ty = ty;
            slot.tileKind = t;
            slot.enemy = null;
          }
        }
      }
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const slot = allocRenderItem();
      slot.kind = 'enemy';
      slot.depth = e.wx + e.wy;
      slot.enemy = e;
    }

    const pSlot = allocRenderItem();
    pSlot.kind = 'player';
    pSlot.depth = this.player.wx + this.player.wy;
    pSlot.enemy = null;

    renderList.sort((a, b) => a.depth - b.depth);

    const lockedEnemy = this.enemies.find((e) => e.id === this.lockedEnemyId);
    if (lockedEnemy) {
      const pIso = this.worldToIso(this.player.wx, this.player.wy);
      const eIso = this.worldToIso(lockedEnemy.wx, lockedEnemy.wy);

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pIso.sx, pIso.sy - 10);
      ctx.lineTo(eIso.sx, eIso.sy - 8);
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(eIso.sx, eIso.sy + 1, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < renderList.length; i++) {
      const item = renderList[i];
      if (item.kind === 'prop') {
        const iso = this.worldToIso(item.tx + 0.5, item.ty + 0.5);
        const tileCanvas = spriteCache.getTileCanvas(item.tileKind);
        if (tileCanvas) {
          ctx.drawImage(
            tileCanvas,
            Math.round(iso.sx - tileCanvas.width / 2),
            Math.round(iso.sy - tileCanvas.height + ISO_TILE_H / 2 + 2)
          );
        }

        const key = `${item.tx},${item.ty}`;
        if (item.tileKind === 9) {
          const isHacked = this.hackedTerminals.has(key);
          const blink = Math.floor(this.pulseTimerMs / 250) % 2 === 0;
          // Animated terminal screen scanline & beacon LED
          ctx.fillStyle = isHacked ? '#22c55e' : blink ? '#38bdf8' : '#fde047';
          ctx.fillRect(iso.sx - 2, iso.sy - 26, 4, 4);
          const scanOffset = Math.floor((this.pulseTimerMs / 120) % 4);
          ctx.fillStyle = isHacked ? '#86efac' : '#e0f2fe';
          ctx.fillRect(iso.sx - 4, iso.sy - 16 + scanOffset, 8, 1);
        } else if (item.tileKind === 13) {
          // Animated Laser/Energy Security Barrier across locked Blast Door
          const pulseAlpha = 0.45 + Math.sin(this.pulseTimerMs * 0.01) * 0.25;
          ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha.toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(iso.sx - 12, iso.sy - 14);
          ctx.lineTo(iso.sx + 12, iso.sy - 14);
          ctx.stroke();
        } else if (item.tileKind === 5) {
          // Subtle flickering sector data conduit light
          const flicker = Math.sin(this.pulseTimerMs * 0.015 + item.tx * 3 + item.ty) > 0.7;
          if (flicker) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.fillRect(iso.sx - 2, iso.sy - 16, 4, 2);
          }
        } else if (item.tileKind === 15) {
          const turret = this.turrets.get(key);
          if (turret) {
            spriteCache.drawTurret(ctx, turret, Math.round(iso.sx), Math.round(iso.sy));
          }
        }

        // Draw damage bar for partially damaged destructible props (Barrels, Crates, Bio-Pods)
        const curHp = this.propHp.get(key);
        const maxHp = this.propMaxHp.get(key);
        if (curHp !== undefined && maxHp !== undefined && curHp < maxHp) {
          const pct = Math.max(0, curHp / maxHp);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(iso.sx - 7, iso.sy - 25, 14, 2.5);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(iso.sx - 7, iso.sy - 25, 14 * pct, 2.5);
        }
      } else if (item.kind === 'enemy' && item.enemy) {
        const iso = this.worldToIso(item.enemy.wx, item.enemy.wy);
        spriteCache.drawEnemy(ctx, item.enemy, Math.round(iso.sx), Math.round(iso.sy));
      } else if (item.kind === 'player') {
        const iso = this.worldToIso(this.player.wx, this.player.wy);
        if (this.player.overdriveTimerMs > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(Math.round(iso.sx), Math.round(iso.sy + 1), 10, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        spriteCache.drawPlayer(
          ctx,
          Math.round(iso.sx),
          Math.round(iso.sy),
          this.player.aimAngle,
          this.player.walkCycle,
          this.player.weapon,
          this.player.hitFlashMs > 0,
          this.player.muzzleFlashMs > 0,
          this.saveData.flashlightOn,
          this.player.isDead,
          this.player.deathAnimTimerMs,
          this.player.overdriveTimerMs > 0,
          this.pulseTimerMs
        );
      }
    }

    // 5. Render Projectiles / Bullets & Thrown Frag Grenades
    for (const b of this.bullets) {
      if (!b.active) continue;
      const iso = this.worldToIso(b.wx, b.wy);
      const prevIso = this.worldToIso(b.wx - b.vx * 0.025, b.wy - b.vy * 0.025);
      spriteCache.drawProjectile(
        ctx,
        b,
        Math.round(iso.sx),
        Math.round(iso.sy),
        Math.round(prevIso.sx),
        Math.round(prevIso.sy)
      );
    }

    for (const g of this.grenades) {
      if (!g.active) continue;
      const iso = this.worldToIso(g.wx, g.wy);
      const tIso = this.worldToIso(g.targetWx, g.targetWy);
      // Target blast ring preview
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(Math.round(tIso.sx), Math.round(tIso.sy), 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(Math.round(iso.sx - 2), Math.round(iso.sy - 1), 4, 2);

      // Flying grenade canister + blinking red LED
      const gx = Math.round(iso.sx);
      const gy = Math.round(iso.sy - 6 - g.wz);
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(gx - 2.5, gy - 2.5, 5, 5);
      ctx.fillStyle = Math.floor(g.elapsedMs / 60) % 2 === 0 ? '#ef4444' : '#fde047';
      ctx.fillRect(gx - 1, gy - 3.5, 2, 1.5);
    }

    // 6. Render Hit Sparks, Smoke & Explosion Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      const iso = this.worldToIso(p.wx, p.wy);
      spriteCache.drawParticle(ctx, p, Math.round(iso.sx), Math.round(iso.sy));
    }

    // 7. Render Floating Combat Texts
    ctx.font = 'bold 8px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const iso = this.worldToIso(ft.wx, ft.wy);
      ctx.fillStyle = '#000000';
      ctx.fillText(ft.text, Math.round(iso.sx + 1), Math.round(iso.sy - ft.wz + 1));
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(iso.sx), Math.round(iso.sy - ft.wz));
    }

    ctx.restore();

    // 8. Atmospheric Facility Darkness & Dynamic Emergency Lighting Overlay (Phase 2)
    this.renderLightingOverlay(ctx);

    // 8B. Phase 7 Combat Screen Flash Feedback (Damage Red Vignette & Armor Cyan Deflection)
    if (this.damageFlashMs > 0) {
      const alpha = Math.min(0.35, (this.damageFlashMs / 180) * 0.32);
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
      ctx.fillRect(0, 37, NATIVE_W, 4);
      ctx.fillRect(0, NATIVE_H - 36, NATIVE_W, 4);
      ctx.fillRect(0, 37, 4, NATIVE_H - 69);
      ctx.fillRect(NATIVE_W - 4, 37, 4, NATIVE_H - 69);
    }
    if (this.armorFlashMs > 0) {
      const alpha = Math.min(0.35, (this.armorFlashMs / 140) * 0.3);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 39, NATIVE_W - 4, NATIVE_H - 73);
    }

    // 9. Off-screen Radar Direction Pointers (on 240x320 screen edges)
    this.renderEdgeRadarIndicators(ctx, offsetX, offsetY);

    // 10. Compact On-Canvas Tactical Minimap Radar (Top-Right of 240x320 viewport)
    this.renderMinimapRadar(ctx);

    // 11. Wave / Boss / Level-Up Announcement Banners
    if (this.bossAlertBannerMs > 0) {
      ctx.fillStyle = 'rgba(69, 10, 10, 0.88)';
      ctx.fillRect(16, 70, 208, 24);
      ctx.strokeStyle = '#f43f5e';
      ctx.strokeRect(16, 70, 208, 24);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 9px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WARNING: APEX BOSS DETECTED', 120, 85);
    } else if (this.waveClearBannerMs > 0) {
      ctx.fillStyle = 'rgba(9, 13, 17, 0.82)';
      ctx.fillRect(20, 72, 200, 24);
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(20, 72, 200, 24);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      const bannerTitle =
        this.gameMode === 'SURVIVAL'
          ? `SURVIVAL WAVE ${this.currentWave} INCOMING`
          : `WAVE ${this.currentWave} / ${this.mission.totalWaves} INCOMING`;
      ctx.fillText(bannerTitle, 120, 87);
    } else if (this.levelUpBannerMs > 0) {
      ctx.fillStyle = 'rgba(20, 83, 45, 0.86)';
      ctx.fillRect(32, 72, 176, 22);
      ctx.strokeStyle = '#facc15';
      ctx.strokeRect(32, 72, 176, 22);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`RANK PROMOTION · LV.${this.saveData.level}`, 120, 86);
    }

    const elapsedRnd = nowMs() - startRnd;
    this.renderTimeMs = Number((this.renderTimeMs * 0.8 + elapsedRnd * 0.2).toFixed(2));

    // 12. Optional Debug-Only Performance Monitor Overlay (Disabled by default in normal gameplay)
    if (this.saveData.showPerfOverlay) {
      ctx.fillStyle = 'rgba(7, 10, 14, 0.88)';
      ctx.fillRect(4, 40, 108, 22);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 40, 108, 22);
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 7px "Courier New", Courier, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `FPS:${this.fpsCount} AVG:${this.avgFps} FRM:${this.frameTimeMs}ms`,
        7,
        49
      );
      ctx.fillStyle = '#a3e635';
      ctx.fillText(`UPD:${this.updateTimeMs}ms RND:${this.renderTimeMs}ms`, 7, 58);
    }
  }

  private renderLightingOverlay(ctx: CanvasRenderingContext2D): void {
    const baseDarkness = this.mission.ambientDarkness || 0.2;
    const bLevel = this.saveData.brightnessLevel ?? 1;
    const brightnessFactor = bLevel === 2 ? 0.45 : bLevel === 0 ? 1.25 : 1.0;
    const effectiveDarkness =
      (this.saveData.flashlightOn
        ? baseDarkness * 0.68
        : Math.min(0.68, baseDarkness + 0.16)) * brightnessFactor;

    if (effectiveDarkness <= 0.05) return;

    const innerRadius = this.saveData.flashlightOn ? 46 : 26;
    const outerRadius = this.saveData.flashlightOn ? 142 : 95;
    const alphaStr = Math.min(0.8, effectiveDarkness).toFixed(2);
    const overlayH = NATIVE_H - 69;

    const cachedCanvas = spriteCache.getLightingOverlayCanvas(
      NATIVE_W,
      overlayH,
      innerRadius,
      outerRadius,
      alphaStr
    );
    if (cachedCanvas) {
      ctx.drawImage(cachedCanvas, 0, 37);
      return;
    }

    const grad = ctx.createRadialGradient(
      NATIVE_W / 2,
      NATIVE_H / 2 - 8,
      innerRadius,
      NATIVE_W / 2,
      NATIVE_H / 2 - 8,
      outerRadius
    );
    grad.addColorStop(0, 'rgba(5, 8, 14, 0)');
    grad.addColorStop(1, `rgba(4, 7, 12, ${alphaStr})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 37, NATIVE_W, overlayH);
  }

  private renderMinimapRadar(ctx: CanvasRenderingContext2D): void {
    // Positioned at top-right (below the 37px top HUD bar, shifted down if Boss bar is visible)
    const hasBoss = this.enemies.some((e) => e.type === 'boss');
    const mapW = 38;
    const mapH = 34;
    const mapX = NATIVE_W - mapW - 4;
    const mapY = hasBoss ? 62 : 40;

    ctx.fillStyle = 'rgba(7, 10, 14, 0.82)';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    const cellW = (mapW - 2) / this.mission.width;
    const cellH = (mapH - 2) / this.mission.height;
    const ox = mapX + 1;
    const oy = mapY + 1;

    // Render walls, blast doors, terminals, turrets, and beacon
    for (let ty = 0; ty < this.mission.height; ty++) {
      for (let tx = 0; tx < this.mission.width; tx++) {
        const t = this.tiles[ty][tx];
        if (t === 4 || t === 5) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(ox + tx * cellW, oy + ty * cellH, Math.ceil(cellW), Math.ceil(cellH));
        } else if (t === 13) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(ox + tx * cellW, oy + ty * cellH, Math.ceil(cellW), Math.ceil(cellH));
        } else if (t === 9 && !this.hackedTerminals.has(`${tx},${ty}`)) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(ox + tx * cellW, oy + ty * cellH, 2, 2);
        } else if (t === 15) {
          const tur = this.turrets.get(`${tx},${ty}`);
          ctx.fillStyle = tur && tur.active ? '#22c55e' : '#eab308';
          ctx.fillRect(ox + tx * cellW, oy + ty * cellH, 2, 2);
        } else if (t === 12) {
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(ox + tx * cellW, oy + ty * cellH, 2.5, 2.5);
        }
      }
    }

    // Render live enemy blips
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      ctx.fillStyle = e.type === 'boss' ? '#f43f5e' : '#ef4444';
      const sz = e.type === 'boss' ? 3 : 2;
      ctx.fillRect(ox + e.wx * cellW - 1, oy + e.wy * cellH - 1, sz, sz);
    }

    // Render player position dot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + this.player.wx * cellW - 1, oy + this.player.wy * cellH - 1, 2.5, 2.5);
  }

  private renderEdgeRadarIndicators(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number
  ): void {
    // STEP 3 radar fix: this runs AFTER ctx.restore(), so the 1.25x world
    // zoom no longer applies, but offsetX/offsetY were computed inside the
    // zoom block. The old code tested unzoomed sx/sy against the edges,
    // so an enemy that was actually off-screen after zoom could be
    // missed, and the pointer angle was for the unzoomed position.
    // Convert to the zoomed screen position first, then test/clamp that.
    // The minimap (renderMinimapRadar) is intentionally unchanged: it is
    // a world map using wx/wy directly, not a zoomed world view.
    const GAME_ZOOM = 1.25;
    const toZoomed = (sx: number, sy: number): { x: number; y: number } => ({
      x: NATIVE_W / 2 + (sx - NATIVE_W / 2) * GAME_ZOOM,
      y: NATIVE_H / 2 + (sy - NATIVE_H / 2) * GAME_ZOOM,
    });
    if (this.extractionReady) {
      const bIso = this.worldToIso(
        this.mission.extractionPoint.wx,
        this.mission.extractionPoint.wy
      );
      const z = toZoomed(bIso.sx + offsetX, bIso.sy + offsetY);
      // STEP 4 FIX (RAD-01): the top HUD occupies 0-37px (24px bar + 13px
      // sub-header), so a pointer clamped to y=36 hid behind the DOM HUD.
      // Clamp/test against 40px so pointers stay visible below the HUD.
      if (z.x < 12 || z.x > NATIVE_W - 12 || z.y < 40 || z.y > NATIVE_H - 32) {
        const ang = Math.atan2(z.y - NATIVE_H / 2, z.x - NATIVE_W / 2);
        const rx = Math.max(14, Math.min(NATIVE_W - 14, NATIVE_W / 2 + Math.cos(ang) * 95));
        const ry = Math.max(40, Math.min(NATIVE_H - 36, NATIVE_H / 2 + Math.sin(ang) * 115));
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const e of this.enemies) {
        // STEP 4: dying enemies (deathTimer) must not leave radar dots.
        if (e.hp <= 0 || e.state === 'dead') continue;
        const eIso = this.worldToIso(e.wx, e.wy);
        const z = toZoomed(eIso.sx + offsetX, eIso.sy + offsetY);
        if (z.x < 8 || z.x > NATIVE_W - 8 || z.y < 40 || z.y > NATIVE_H - 32) {
          const ang = Math.atan2(z.y - NATIVE_H / 2, z.x - NATIVE_W / 2);
          const rx = Math.max(10, Math.min(NATIVE_W - 10, NATIVE_W / 2 + Math.cos(ang) * 102));
          const ry = Math.max(40, Math.min(NATIVE_H - 32, NATIVE_H / 2 + Math.sin(ang) * 120));
          ctx.fillStyle = e.type === 'boss' ? '#f43f5e' : '#ef4444';
          ctx.fillRect(rx - 2, ry - 2, 4, 4);
        }
      }
    }
  }
}
