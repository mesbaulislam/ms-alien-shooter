import { EquipmentId, SaveData } from './types';

const STORAGE_KEY = 'ms_alien_shooter_kaios_save_v1';

export const DEFAULT_SAVE_DATA: SaveData = {
  xp: 0,
  level: 1,
  skillPoints: 1,
  credits: 250,
  unlockedMission: 1,
  completedMissions: [],
  survivalBestWave: 0,
  survivalBestScore: 0,
  highScore: 0,
  totalKills: 0,
  unlockedWeapons: {
    pistol: true,
    rifle: true,
    shotgun: true,
    plasma: false,
  },
  weaponLevels: {
    pistol: 1,
    rifle: 1,
    shotgun: 1,
    plasma: 1,
  },
  ammoInventory: {
    pistol: 999,
    rifle: 180,
    shotgun: 40,
    plasma: 60,
  },
  tacticalInventory: {
    grenades: 3,
    medkits: 2,
    overdrives: 1,
  },
  armorTier: 1,
  regenImplantLevel: 0,
  selectedEquipment: 'grenade',
  skills: {
    vitality: 0,
    firepower: 0,
    agility: 0,
    armorTech: 0,
    reloadSpeed: 0,
  },
  soundEnabled: true,
  flashlightOn: true,
  masterVolume: 75,
  musicVolume: 75,
  sfxVolume: 75,
  particlesEnabled: true,
  screenShakeEnabled: true,
  brightnessLevel: 1,
  showPerfOverlay: false,
  missionLevelProgress: {},
};

/**
 * Safely normalizes any volume value into {0, 25, 50, 75, 100} within 0–100.
 */
export function normalizeVolumeStep(value: unknown, fallback = 75): number {
  const num = toValidNumber(value, fallback);
  const clamped = Math.max(0, Math.min(100, num));
  return Math.max(0, Math.min(100, Math.round(clamped / 25) * 25));
}

/**
 * Cycles volume strictly through 0 -> 25 -> 50 -> 75 -> 100 -> 0.
 * Safely normalizes any existing non-multiple of 25 before stepping.
 */
export function cycleVolumeStep(current: unknown): number {
  const normalized = normalizeVolumeStep(current, 75);
  return normalized >= 100 ? 0 : normalized + 25;
}

function toValidNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toValidEquipmentId(value: unknown, fallback: EquipmentId): EquipmentId {
  if (value === 'grenade' || value === 'medkit' || value === 'overdrive') {
    return value;
  }
  return fallback;
}

/**
 * Deep clone helper compatible with KaiOS 2.5.3.2 (Gecko 48).
 * Preserves numeric 0 values accurately (e.g. when ammoInventory.pistol is 0)
 * and avoids structuredClone() or ES2018 object spread.
 * Handles missing or corrupted fields safely without erasing player progress.
 */
export function cloneSaveData(source: Partial<SaveData> | SaveData | null | undefined): SaveData {
  const safe = source && typeof source === 'object' ? source : {};
  const uw =
    safe.unlockedWeapons && typeof safe.unlockedWeapons === 'object'
      ? safe.unlockedWeapons
      : DEFAULT_SAVE_DATA.unlockedWeapons;
  const wl =
    safe.weaponLevels && typeof safe.weaponLevels === 'object'
      ? safe.weaponLevels
      : DEFAULT_SAVE_DATA.weaponLevels;
  const ai =
    safe.ammoInventory && typeof safe.ammoInventory === 'object'
      ? safe.ammoInventory
      : DEFAULT_SAVE_DATA.ammoInventory;
  const ti =
    safe.tacticalInventory && typeof safe.tacticalInventory === 'object'
      ? safe.tacticalInventory
      : DEFAULT_SAVE_DATA.tacticalInventory;
  const sk =
    safe.skills && typeof safe.skills === 'object' ? safe.skills : DEFAULT_SAVE_DATA.skills;

  const rawCompleted = Array.isArray(safe.completedMissions) ? safe.completedMissions : [];
  const completedMissions: number[] = [];
  for (let i = 0; i < rawCompleted.length; i++) {
    const n = toValidNumber(rawCompleted[i], -1);
    if (n > 0 && completedMissions.indexOf(n) === -1) {
      completedMissions.push(n);
    }
  }

  // STEP 2 campaign migration: old saves have no missionLevelProgress.
  // A completed old mission means all its levels are cleared (M01 4, M02 4,
  // M03 5, M04 5). If the field is present, keep it exactly; do not overwrite.
  const LEVEL_COUNT_BY_MISSION: Record<number, number> = { 1: 4, 2: 4, 3: 5, 4: 5 };
  const missionLevelProgress: Record<number, number> = {};
  const rawProgress = (safe as { missionLevelProgress?: unknown }).missionLevelProgress;
  if (rawProgress && typeof rawProgress === 'object') {
    const rp = rawProgress as Record<string, unknown>;
    for (const k of Object.keys(rp)) {
      const mid = toValidNumber(k, -1);
      const lv = toValidNumber(rp[k], 0);
      if (mid > 0 && lv >= 0) missionLevelProgress[mid] = Math.min(5, Math.max(0, lv));
    }
  } else {
    for (let i = 0; i < completedMissions.length; i++) {
      const mid = completedMissions[i];
      if (LEVEL_COUNT_BY_MISSION[mid]) missionLevelProgress[mid] = LEVEL_COUNT_BY_MISSION[mid];
    }
  }

  return {
    missionLevelProgress,
    xp: Math.max(0, toValidNumber(safe.xp, DEFAULT_SAVE_DATA.xp)),
    level: Math.max(1, toValidNumber(safe.level, DEFAULT_SAVE_DATA.level)),
    skillPoints: Math.max(0, toValidNumber(safe.skillPoints, DEFAULT_SAVE_DATA.skillPoints)),
    credits: Math.max(0, toValidNumber(safe.credits, DEFAULT_SAVE_DATA.credits)),
    unlockedMission: Math.max(
      1,
      toValidNumber(safe.unlockedMission, DEFAULT_SAVE_DATA.unlockedMission)
    ),
    completedMissions,
    survivalBestWave: Math.max(
      0,
      toValidNumber(safe.survivalBestWave, DEFAULT_SAVE_DATA.survivalBestWave)
    ),
    survivalBestScore: Math.max(
      0,
      toValidNumber(safe.survivalBestScore, DEFAULT_SAVE_DATA.survivalBestScore)
    ),
    highScore: Math.max(0, toValidNumber(safe.highScore, DEFAULT_SAVE_DATA.highScore)),
    totalKills: Math.max(0, toValidNumber(safe.totalKills, DEFAULT_SAVE_DATA.totalKills)),
    unlockedWeapons: {
      pistol: uw.pistol !== undefined ? Boolean(uw.pistol) : DEFAULT_SAVE_DATA.unlockedWeapons.pistol,
      rifle: uw.rifle !== undefined ? Boolean(uw.rifle) : DEFAULT_SAVE_DATA.unlockedWeapons.rifle,
      shotgun:
        uw.shotgun !== undefined ? Boolean(uw.shotgun) : DEFAULT_SAVE_DATA.unlockedWeapons.shotgun,
      plasma: uw.plasma !== undefined ? Boolean(uw.plasma) : DEFAULT_SAVE_DATA.unlockedWeapons.plasma,
    },
    weaponLevels: {
      pistol: Math.max(1, toValidNumber(wl.pistol, DEFAULT_SAVE_DATA.weaponLevels.pistol)),
      rifle: Math.max(1, toValidNumber(wl.rifle, DEFAULT_SAVE_DATA.weaponLevels.rifle)),
      shotgun: Math.max(1, toValidNumber(wl.shotgun, DEFAULT_SAVE_DATA.weaponLevels.shotgun)),
      plasma: Math.max(1, toValidNumber(wl.plasma, DEFAULT_SAVE_DATA.weaponLevels.plasma)),
    },
    ammoInventory: {
      pistol: Math.max(0, toValidNumber(ai.pistol, DEFAULT_SAVE_DATA.ammoInventory.pistol)),
      rifle: Math.max(0, toValidNumber(ai.rifle, DEFAULT_SAVE_DATA.ammoInventory.rifle)),
      shotgun: Math.max(0, toValidNumber(ai.shotgun, DEFAULT_SAVE_DATA.ammoInventory.shotgun)),
      plasma: Math.max(0, toValidNumber(ai.plasma, DEFAULT_SAVE_DATA.ammoInventory.plasma)),
    },
    tacticalInventory: {
      grenades: Math.max(0, toValidNumber(ti.grenades, DEFAULT_SAVE_DATA.tacticalInventory.grenades)),
      medkits: Math.max(0, toValidNumber(ti.medkits, DEFAULT_SAVE_DATA.tacticalInventory.medkits)),
      overdrives: Math.max(
        0,
        toValidNumber(ti.overdrives, DEFAULT_SAVE_DATA.tacticalInventory.overdrives)
      ),
    },
    armorTier: Math.max(1, Math.min(4, toValidNumber(safe.armorTier, DEFAULT_SAVE_DATA.armorTier))),
    regenImplantLevel: Math.max(
      0,
      Math.min(3, toValidNumber(safe.regenImplantLevel, DEFAULT_SAVE_DATA.regenImplantLevel))
    ),
    selectedEquipment: toValidEquipmentId(
      safe.selectedEquipment,
      DEFAULT_SAVE_DATA.selectedEquipment
    ),
    skills: {
      vitality: Math.max(0, toValidNumber(sk.vitality, DEFAULT_SAVE_DATA.skills.vitality)),
      firepower: Math.max(0, toValidNumber(sk.firepower, DEFAULT_SAVE_DATA.skills.firepower)),
      agility: Math.max(0, toValidNumber(sk.agility, DEFAULT_SAVE_DATA.skills.agility)),
      armorTech: Math.max(0, toValidNumber(sk.armorTech, DEFAULT_SAVE_DATA.skills.armorTech)),
      reloadSpeed: Math.max(0, toValidNumber(sk.reloadSpeed, DEFAULT_SAVE_DATA.skills.reloadSpeed)),
    },
    soundEnabled: safe.soundEnabled !== undefined ? Boolean(safe.soundEnabled) : true,
    flashlightOn: safe.flashlightOn !== undefined ? Boolean(safe.flashlightOn) : true,
    masterVolume: normalizeVolumeStep(safe.masterVolume, DEFAULT_SAVE_DATA.masterVolume),
    musicVolume: normalizeVolumeStep(safe.musicVolume, DEFAULT_SAVE_DATA.musicVolume),
    sfxVolume: normalizeVolumeStep(safe.sfxVolume, DEFAULT_SAVE_DATA.sfxVolume),
    particlesEnabled:
      safe.particlesEnabled !== undefined ? Boolean(safe.particlesEnabled) : true,
    screenShakeEnabled:
      safe.screenShakeEnabled !== undefined ? Boolean(safe.screenShakeEnabled) : true,
    brightnessLevel: Math.max(
      0,
      Math.min(2, toValidNumber(safe.brightnessLevel, DEFAULT_SAVE_DATA.brightnessLevel))
    ),
    showPerfOverlay:
      safe.showPerfOverlay !== undefined ? Boolean(safe.showPerfOverlay) : false,
  };
}

export function loadSaveData(): SaveData {
  try {
    if (typeof localStorage === 'undefined') {
      return cloneSaveData(DEFAULT_SAVE_DATA);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSaveData(DEFAULT_SAVE_DATA);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return cloneSaveData(DEFAULT_SAVE_DATA);
    }
    return cloneSaveData(parsed);
  } catch {
    return cloneSaveData(DEFAULT_SAVE_DATA);
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors on constrained KaiOS environments
  }
}

export function resetSaveData(): SaveData {
  const fresh = cloneSaveData(DEFAULT_SAVE_DATA);
  persistSaveData(fresh);
  return fresh;
}

export function getXpForNextLevel(level: number): number {
  return level * 300;
}
