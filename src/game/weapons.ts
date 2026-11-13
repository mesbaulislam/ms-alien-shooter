import { PlayerSkills, WeaponId, WeaponSpec } from './types';

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    keySlot: '1',
    name: 'M9A Dual Tactical Pistols',
    shortName: 'PISTOL',
    category: 'Secondary Sidearm',
    slotType: 'secondary',
    baseDamage: 24,
    fireRateMs: 260,
    range: 6.2,
    bulletSpeed: 13.5,
    pellets: 1,
    spreadRad: 0.04,
    clipSize: 16,
    reloadMs: 750,
    infiniteAmmo: true,
    color: '#facc15',
    unlockCost: 0,
    upgradeBaseCost: 150,
  },
  rifle: {
    id: 'rifle',
    keySlot: '2',
    name: 'KR-47 Pulse Assault Rifle',
    shortName: 'A.RIFLE',
    category: 'Primary Assault',
    slotType: 'primary',
    baseDamage: 22,
    fireRateMs: 115,
    range: 7.4,
    bulletSpeed: 16.0,
    pellets: 1,
    spreadRad: 0.08,
    clipSize: 36,
    reloadMs: 1100,
    infiniteAmmo: false,
    color: '#38bdf8',
    unlockCost: 0,
    upgradeBaseCost: 220,
  },
  shotgun: {
    id: 'shotgun',
    keySlot: '3',
    name: 'SG-12 Combat Breacher',
    shortName: 'SHOTGUN',
    category: 'Primary Close-Quarters',
    slotType: 'primary',
    baseDamage: 19,
    fireRateMs: 620,
    range: 4.8,
    bulletSpeed: 14.0,
    pellets: 6,
    spreadRad: 0.28,
    clipSize: 8,
    reloadMs: 1250,
    infiniteAmmo: false,
    color: '#fb923c',
    unlockCost: 0,
    upgradeBaseCost: 250,
  },
  plasma: {
    id: 'plasma',
    keySlot: '4',
    name: 'X-90 Heavy Plasma Gun',
    shortName: 'PLASMA',
    category: 'Primary Heavy Energy',
    slotType: 'primary',
    baseDamage: 68,
    fireRateMs: 320,
    range: 7.8,
    bulletSpeed: 15.0,
    pellets: 1,
    spreadRad: 0.02,
    clipSize: 20,
    reloadMs: 1300,
    infiniteAmmo: false,
    color: '#4ade80',
    unlockCost: 450,
    upgradeBaseCost: 350,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'rifle', 'shotgun', 'plasma'];

export function getEffectiveWeaponDamage(
  weaponId: WeaponId,
  upgradeLevel: number,
  firepowerSkill: number
): number {
  const base = WEAPONS[weaponId].baseDamage;
  const upgradeMul = 1 + (upgradeLevel - 1) * 0.18;
  const skillMul = 1 + firepowerSkill * 0.1;
  return Math.round(base * upgradeMul * skillMul);
}

export interface EffectiveWeaponStats {
  damage: number;
  fireRateMs: number;
  range: number;
  clipSize: number;
  reloadMs: number;
}

export function getEffectiveWeaponStats(
  weaponId: WeaponId,
  upgradeLevel: number,
  skills: PlayerSkills
): EffectiveWeaponStats {
  const spec = WEAPONS[weaponId];
  const lvBonus = Math.max(0, upgradeLevel - 1);
  const damage = getEffectiveWeaponDamage(weaponId, upgradeLevel, skills.firepower);
  const fireRateReduction = Math.min(0.35, lvBonus * 0.045 + (skills.reloadSpeed || 0) * 0.03);
  const fireRateMs = Math.max(55, Math.round(spec.fireRateMs * (1 - fireRateReduction)));
  const range = Number((spec.range + lvBonus * 0.2).toFixed(1));
  const clipBonusPerLv = weaponId === 'shotgun' ? 1 : 2;
  const clipSize = spec.clipSize + lvBonus * clipBonusPerLv;
  const reloadReduction = Math.min(
    0.55,
    lvBonus * 0.04 + (skills.reloadSpeed || 0) * 0.09 + (skills.agility || 0) * 0.04
  );
  const reloadMs = Math.max(300, Math.round(spec.reloadMs * (1 - reloadReduction)));

  return {
    damage,
    fireRateMs,
    range,
    clipSize,
    reloadMs,
  };
}
