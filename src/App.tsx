import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlienShooterEngine, HudSnapshot, NATIVE_H, NATIVE_W } from './game/engine';
import { MISSIONS, SURVIVAL_ARENA_MISSION } from './game/maps';
import { soundFX } from './game/sound';
import {
  cloneSaveData,
  cycleVolumeStep,
  getXpForNextLevel,
  loadSaveData,
  persistSaveData,
  resetSaveData,
} from './game/storage';
import { EquipmentId, PlayerSkills, SaveData, ScreenMode, WeaponId } from './game/types';
import {
  getEffectiveWeaponDamage,
  getEffectiveWeaponStats,
  WEAPON_ORDER,
  WEAPONS,
} from './game/weapons';

type ViewportScale = 'handset' | '2x' | '1x';
type ArmoryTab = 'weapons' | 'equipment';
type ShopCategory = 'weapons' | 'upgrades' | 'armor' | 'equipment' | 'ammo';
type ProfileTab = 'stats' | 'skills';
type SettingsTab = 'audio' | 'gameplay' | 'display' | 'data';
type ConfirmDialogType = null | 'RESTART_MISSION' | 'QUIT_TO_TITLE' | 'NEW_CAMPAIGN' | 'RESET_DATA';

const MISSION_DIFFICULTY: Record<number, { label: string; color: string }> = {
  1: { label: 'NORMAL', color: 'text-emerald-400' },
  2: { label: 'MODERATE', color: 'text-sky-400' },
  3: { label: 'HARD', color: 'text-amber-400' },
  4: { label: 'EXTREME', color: 'text-rose-400' },
};

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [screenMode, setScreenMode] = useState<ScreenMode>('TITLE');
  const screenModeRef = useRef<ScreenMode>('TITLE');
  const previousScreenRef = useRef<ScreenMode>('TITLE');

  const [selectedMissionId, setSelectedMissionId] = useState<number>(1);
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [menuCursor, setMenuCursor] = useState<number>(0);
  // STEP 3: synchronous cursor ref. React state updates are async and
  // slow on E241S, so a fast DOWN then OK could select the old item.
  // UP/DOWN update this ref immediately; OK reads it, not stale state.
  const menuCursorRef = useRef<number>(0);

  // Sub-screen tabs
  const [armoryTab, setArmoryTab] = useState<ArmoryTab>('weapons');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('weapons');
  const [profileTab, setProfileTab] = useState<ProfileTab>('stats');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('audio');

  // STEP 4 (NAV-03): Mission Detail panel state. The detail panel uses its
  // own level cursor (detailLevelRef) so the mission-list cursor in
  // menuCursorRef is untouched while the panel is open.
  const [missionDetailOpen, setMissionDetailOpen] = useState<boolean>(false);
  const [detailMissionId, setDetailMissionId] = useState<number>(1);
  const [detailLevel, setDetailLevel] = useState<number>(1);
  const detailLevelRef = useRef<number>(1);

  // Confirmation modal & status feedback banner
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [launchBanner, setLaunchBanner] = useState<string | null>(null);

  const [isNativeSmallScreen, setIsNativeSmallScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 320 : false
  );

  const [viewportScale, setViewportScale] = useState<ViewportScale>(() =>
    typeof window !== 'undefined' && window.innerWidth <= 320 ? '1x' : 'handset'
  );

  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<
    'game' | 'missions' | 'armory' | 'kaios'
  >('game');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const engineRef = useRef<AlienShooterEngine | null>(null);

  // Initialize Canvas 2D Context once when the canvas element mounts or remounts
  const handleCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (el) {
      const ctx = el.getContext('2d', { alpha: false }) || el.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
      ctxRef.current = ctx;
    } else {
      ctxRef.current = null;
    }
  }, []);

  const [hud, setHud] = useState<HudSnapshot>({
    hp: 100,
    maxHp: 100,
    armor: 25,
    maxArmor: 100,
    weapon: 'rifle',
    clipAmmo: 36,
    maxClip: 36,
    reserveAmmo: 180,
    infiniteAmmo: false,
    reloading: false,
    reloadProgress: 1,
    wave: 1,
    totalWaves: 3,
    enemiesRemaining: 9,
    score: 0,
    credits: 250,
    xp: 0,
    level: 1,
    objectiveText: 'Eliminate Swarm & Reach Beacon',
    contextPrompt: null,
    bossName: null,
    bossHp: 0,
    bossMaxHp: 1,
    fps: 30,
    avgFps: 30,
    frameTimeMs: 16.7,
    updateTimeMs: 0.4,
    renderTimeMs: 0.7,
    autoTargetLocked: false,
    activeTurrets: 0,
    totalTurrets: 2,
    grenades: 3,
    medkits: 2,
    overdrives: 1,
    overdriveActive: false,
    gameMode: 'CAMPAIGN',
    survivalBestWave: 0,
    missionElapsedMs: 0,
    destroyedStructures: 0,
    bossesDefeated: 0,
    protectedObjectName: null,
    protectedObjectHp: 0,
    protectedObjectMaxHp: 0,
    selectedEquipment: 'grenade',
    missionLevel: 1,
    missionLevelCount: 4,
  });

  const navigateToScreen = useCallback(
    (nextScreen: ScreenMode, resetCursor = true) => {
      previousScreenRef.current = screenModeRef.current;
      // STEP 3: update refs synchronously, not only in the screen effect.
      // Otherwise a second keypress before re-render is routed by the old
      // screen/cursor and selects the wrong option.
      screenModeRef.current = nextScreen;
      setConfirmDialog(null);
      setShopNotice(null);
      setMissionDetailOpen(false);
      setScreenMode(nextScreen);
      if (resetCursor) {
        menuCursorRef.current = 0;
        setCursorSync(0);
      }
    },
    []
  );

  // STEP 3: move cursor by count, updating the ref synchronously.
  const moveCursor = useCallback((count: number, delta: number) => {
    const next = (menuCursorRef.current + delta + count) % count;
    menuCursorRef.current = next;
    setCursorSync(next);
  }, []);

  // STEP 4 FIX (NAV-02): single cursor setter that updates the ref AND the
  // state synchronously, so a fast OK press can never read a stale cursor
  // from a path (onClick rows, tab switches, mission-end, visibility) that
  // previously only set state and relied on the post-render effect sync.
  const setCursorSync = useCallback((next: number) => {
    menuCursorRef.current = next;
    setMenuCursor(next);
  }, []);

  // Keep the ref in sync for paths that set state directly (onClick rows,
  // mission start, etc.). moveCursor already set the same value, so this
  // is a no-op in the fast-key path and a safety net elsewhere.
  useEffect(() => {
    menuCursorRef.current = menuCursor;
  }, [menuCursor]);

  // Keep screenModeRef synchronized, manage pause/resume audio lifecycle, and clear held keys when leaving PLAYING state
  // STEP 1 FIX (Bugs 1, 2, 3): blur any DOM button focus so Enter/OK cannot
  // double-fire a focused button plus the keypad handler, and checkpoint the
  // campaign save whenever gameplay is left (pause, title, victory, etc.),
  // so kill/XP/credit progress is not lost if the app is closed afterwards.
  useEffect(() => {
    screenModeRef.current = screenMode;
    if (typeof document !== 'undefined' && document.activeElement) {
      const el = document.activeElement as HTMLElement;
      if (el && typeof el.blur === 'function') el.blur();
    }
    if (screenMode !== 'PLAYING' && engineRef.current) {
      engineRef.current.keys = { up: false, down: false, left: false, right: false };
      persistSaveData(engineRef.current.saveData);
      setSaveData(cloneSaveData(engineRef.current.saveData));
    }
    if (screenMode === 'PAUSED') {
      soundFX.pauseAudio();
    } else {
      soundFX.resumeAudio();
    }
  }, [screenMode]);

  // Clear transient shop notice after 1.6s
  useEffect(() => {
    if (!shopNotice) return;
    const id = window.setTimeout(() => setShopNotice(null), 1600);
    return () => window.clearTimeout(id);
  }, [shopNotice]);

  // Clear transient mission launch banner after 900ms
  useEffect(() => {
    if (!launchBanner) return;
    const id = window.setTimeout(() => setLaunchBanner(null), 900);
    return () => window.clearTimeout(id);
  }, [launchBanner]);

  // Monitor viewport resize for native 240x320 KaiOS screen detection
  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth <= 320;
      setIsNativeSmallScreen(small);
      if (small) {
        setViewportScale('1x');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Engine once for the TITLE screen only.
  // STEP 1 FIX (Bug 1): a fresh launch must show the Main Menu first.
  // The mission below is loaded ONLY as the live canvas background behind
  // the menu; it is not an active session (hasActiveSession stays false)
  // and gameplay does not start until the user chooses Continue, New
  // Campaign, a mission, or Survival. Nothing is persisted here, so a valid
  // saved campaign is never overwritten by initialization.
  useEffect(() => {
    const initialSave = loadSaveData();
    soundFX.applySettings(initialSave);

    const engine = new AlienShooterEngine(initialSave, (victory) => {
      setSaveData(cloneSaveData(engine.saveData));
      setHud(engine.getHudSnapshot());
      setHasActiveSession(false);
      if (engine.gameMode === 'SURVIVAL') {
        setScreenMode('SURVIVAL_OVER');
      } else {
        setScreenMode(victory ? 'VICTORY' : 'GAME_OVER');
      }
      setCursorSync(0);
    });
    engine.startMission(initialSave.unlockedMission || 1);
    setSelectedMissionId(initialSave.unlockedMission || 1);
    engineRef.current = engine;
    setSaveData(cloneSaveData(initialSave));
    setHasActiveSession(false);
    setScreenMode('TITLE');
    setCursorSync(0);
    setHud(engine.getHudSnapshot());
  }, []);

  // Application lifecycle pause on visibility change / blur (KaiOS 2.5.3.2 requirement)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (engineRef.current) {
          persistSaveData(engineRef.current.saveData);
          setSaveData(cloneSaveData(engineRef.current.saveData));
        }
        soundFX.pauseAudio();
        if (screenModeRef.current === 'PLAYING') {
          if (engineRef.current) {
            engineRef.current.keys = { up: false, down: false, left: false, right: false };
          }
          setScreenMode('PAUSED');
          setCursorSync(0);
        }
      } else if (screenModeRef.current !== 'PAUSED') {
        soundFX.resumeAudio();
      }
    };
    const handleBlur = () => {
      if (engineRef.current) {
        engineRef.current.keys = { up: false, down: false, left: false, right: false };
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Continuous requestAnimationFrame loop with delta-time clamping and reused 2D context
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncTimer = 0;

    const loop = (now: number) => {
      const rawDtMs = now - lastTime;
      lastTime = now;
      const dtMs = Math.max(0, Math.min(rawDtMs, 50));

      const engine = engineRef.current;
      const ctx = ctxRef.current;
      if (engine && ctx) {
        const mode = screenModeRef.current;
        if (mode === 'PLAYING') {
          engine.update(dtMs);
        } else if (
          mode === 'TITLE' ||
          mode === 'MISSION_SELECT' ||
          mode === 'SURVIVAL_MENU' ||
          mode === 'ARMORY' ||
          mode === 'SHOP' ||
          mode === 'PROFILE' ||
          mode === 'SETTINGS' ||
          mode === 'CONTROLS_HELP'
        ) {
          soundFX.updateMusic(dtMs, 'menu');
        }
        engine.render(ctx);

        if (mode === 'PLAYING') {
          hudSyncTimer += dtMs;
          if (hudSyncTimer >= 95) {
            hudSyncTimer = 0;
            setHud(engine.getHudSnapshot());
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // STEP 2: selecting a mission starts at its next uncompleted level.
  // A fully cleared mission replays from Level 1. New Campaign resets
  // progress first, so it also starts at Level 1.
  const startMissionById = useCallback((missionId: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const progress = engine.saveData.missionLevelProgress || {};
    const mission = MISSIONS.find((m) => m.id === missionId);
    const lc = mission ? mission.levelCount || 1 : 1;
    const done = progress[missionId] || 0;
    const level = done >= lc ? 1 : done + 1;
    setSelectedMissionId(missionId);
    engine.startMission(missionId, level);
    setHud(engine.getHudSnapshot());
    setHasActiveSession(true);
    setConfirmDialog(null);
    setLaunchBanner(`DEPLOYING M-0${missionId} L${level}/${lc}`);
    screenModeRef.current = 'PLAYING';
    setScreenMode('PLAYING');
    setCursorSync(0);
    soundFX.playUiBeep(true);
  }, []);

  const startMissionLevelById = useCallback((missionId: number, level: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const mission = MISSIONS.find((m) => m.id === missionId);
    const lc = mission ? mission.levelCount || 1 : 1;
    setSelectedMissionId(missionId);
    engine.startMission(missionId, level);
    setHud(engine.getHudSnapshot());
    setHasActiveSession(true);
    setConfirmDialog(null);
    setLaunchBanner(`DEPLOYING M-0${missionId} L${level}/${lc}`);
    screenModeRef.current = 'PLAYING';
    setScreenMode('PLAYING');
    setCursorSync(0);
    soundFX.playUiBeep(true);
  }, []);

  // STEP 4 (NAV-03): open the detail panel for a mission instead of
  // deploying immediately. Default level = next uncompleted level (or 1
  // for a fully cleared mission, i.e. replay).
  const openMissionDetail = (missionId: number) => {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;
    const progress = (saveData.missionLevelProgress || {})[missionId] || 0;
    const lc = mission.levelCount || 1;
    const next = progress >= lc ? 1 : progress + 1;
    setDetailMissionId(missionId);
    detailLevelRef.current = next;
    setDetailLevel(next);
    setMissionDetailOpen(true);
    soundFX.playUiBeep(false);
  };

  const startSurvivalRun = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startSurvivalMode();
    setHud(engine.getHudSnapshot());
    setHasActiveSession(true);
    setConfirmDialog(null);
    setLaunchBanner('SURVIVAL ARENA ONLINE');
    screenModeRef.current = 'PLAYING';
    setScreenMode('PLAYING');
    setCursorSync(0);
    soundFX.playUiBeep(true);
  }, []);

  const handleDownloadZip = useCallback(() => {
    fetch('./MS-Alien-Shooter-Phase8-Final.zip')
      .then((res) => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'MS-Alien-Shooter-Phase8-Final.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      })
      .catch(() => {
        window.location.href = './download';
      });
  }, []);

  // STEP 1 FIX (Bug 2): Continue reads the authoritative engine save
  // (which is persisted on kills/level-ups/pause), not the possibly stale
  // React saveData snapshot. If there is a live session, resume it;
  // otherwise start the unlocked campaign mission, never Mission 01 by
  // default when later progress exists.
  const handleContinueGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (hasActiveSession && !engine.player.isDead) {
      setConfirmDialog(null);
      screenModeRef.current = 'PLAYING';
      setScreenMode('PLAYING');
      soundFX.playUiBeep(true);
    } else {
      const freshUnlocked = engine.saveData.unlockedMission || 1;
      setSaveData(cloneSaveData(engine.saveData));
      startMissionById(freshUnlocked);
    }
  }, [hasActiveSession, startMissionById]);

  const syncAndSave = useCallback((mutator: (draft: SaveData) => void) => {
    const engine = engineRef.current;
    if (!engine) return;
    mutator(engine.saveData);
    soundFX.applySettings(engine.saveData);
    persistSaveData(engine.saveData);
    setSaveData(cloneSaveData(engine.saveData));
    setHud(engine.getHudSnapshot());
  }, []);

  const handleUpgradeWeapon = useCallback(
    (wId: WeaponId) => {
      const spec = WEAPONS[wId];
      const engine = engineRef.current;
      if (!engine) return;
      const s = engine.saveData;

      if (!s.unlockedWeapons[wId]) {
        if (s.credits >= spec.unlockCost) {
          syncAndSave((draft) => {
            draft.credits -= spec.unlockCost;
            draft.unlockedWeapons[wId] = true;
            draft.ammoInventory[wId] += spec.clipSize * 3;
          });
          setShopNotice(`${spec.shortName} UNLOCKED!`);
          soundFX.playPickup();
        } else {
          setShopNotice(`NEED $${spec.unlockCost} CREDITS`);
          soundFX.playUiBeep(false);
        }
        return;
      }

      const curLv = s.weaponLevels[wId];
      if (curLv >= 6) {
        setShopNotice(`${spec.shortName} AT MAX LEVEL`);
        soundFX.playUiBeep(false);
        return;
      }
      const cost = Math.round(spec.upgradeBaseCost * Math.pow(1.45, curLv - 1));
      if (s.credits >= cost) {
        syncAndSave((draft) => {
          draft.credits -= cost;
          draft.weaponLevels[wId] = curLv + 1;
        });
        setShopNotice(`${spec.shortName} UPGRADED LV.${curLv + 1}!`);
        soundFX.playPickup();
      } else {
        setShopNotice(`NEED $${cost} CREDITS`);
        soundFX.playUiBeep(false);
      }
    },
    [syncAndSave]
  );

  const handleBuyAmmo = useCallback(
    (wId: WeaponId) => {
      const spec = WEAPONS[wId];
      if (spec.infiniteAmmo) return;
      const engine = engineRef.current;
      if (!engine) return;
      if (!engine.saveData.unlockedWeapons[wId]) {
        setShopNotice('UNLOCK WEAPON FIRST');
        soundFX.playUiBeep(false);
        return;
      }
      const cost = wId === 'rifle' ? 45 : wId === 'shotgun' ? 50 : 85;
      const pack = wId === 'rifle' ? 60 : wId === 'shotgun' ? 16 : 25;
      if (engine.saveData.credits >= cost) {
        syncAndSave((draft) => {
          draft.credits -= cost;
          draft.ammoInventory[wId] += pack;
        });
        setShopNotice(`+${pack} ${spec.shortName} AMMO`);
        soundFX.playPickup();
      } else {
        setShopNotice(`NEED $${cost} CREDITS`);
        soundFX.playUiBeep(false);
      }
    },
    [syncAndSave]
  );

  const handleBuyTacticalGear = useCallback(
    (
      gearKey:
        | 'grenade'
        | 'medkit'
        | 'overdrive'
        | 'armor'
        | 'armorTier'
        | 'regenImplant'
    ) => {
      const engine = engineRef.current;
      if (!engine) return;
      const s = engine.saveData;

      if (gearKey === 'armorTier') {
        const curTier = Math.max(1, s.armorTier || 1);
        const cost = 140 * curTier;
        if (curTier >= 4) {
          setShopNotice('ARMOR SUIT AT MAX TIER');
          soundFX.playUiBeep(false);
          return;
        }
        if (s.credits < cost) {
          setShopNotice(`NEED $${cost} CREDITS`);
          soundFX.playUiBeep(false);
          return;
        }
        syncAndSave((draft) => {
          draft.credits -= cost;
          draft.armorTier = curTier + 1;
          engine.player.maxArmor = 100 + (draft.armorTier - 1) * 25;
          engine.player.armor = Math.min(engine.player.maxArmor, engine.player.armor + 25);
        });
        setShopNotice(`ARMOR SUIT MK.${curTier + 1} EQUIPPED!`);
        soundFX.playPickup();
        return;
      }

      if (gearKey === 'regenImplant') {
        const curRegen = Math.max(0, s.regenImplantLevel || 0);
        const cost = 160 * (curRegen + 1);
        if (curRegen >= 3) {
          setShopNotice('BIO-REGEN AT MAX LEVEL');
          soundFX.playUiBeep(false);
          return;
        }
        if (s.credits < cost) {
          setShopNotice(`NEED $${cost} CREDITS`);
          soundFX.playUiBeep(false);
          return;
        }
        syncAndSave((draft) => {
          draft.credits -= cost;
          draft.regenImplantLevel = curRegen + 1;
        });
        setShopNotice(`BIO-REGEN LV.${curRegen + 1} INSTALLED!`);
        soundFX.playPickup();
        return;
      }

      const costs = { grenade: 65, medkit: 75, overdrive: 110, armor: 60 };
      const cost = costs[gearKey];
      if (gearKey === 'armor' && engine.player.armor >= engine.player.maxArmor) {
        setShopNotice('ARMOR ALREADY FULL');
        soundFX.playUiBeep(false);
        return;
      }
      if (s.credits < cost) {
        setShopNotice(`NEED $${cost} CREDITS`);
        soundFX.playUiBeep(false);
        return;
      }
      syncAndSave((draft) => {
        draft.credits -= cost;
        if (gearKey === 'grenade') draft.tacticalInventory.grenades += 2;
        else if (gearKey === 'medkit') draft.tacticalInventory.medkits += 1;
        else if (gearKey === 'overdrive') draft.tacticalInventory.overdrives += 1;
        else if (gearKey === 'armor') {
          engine.player.armor = Math.min(engine.player.maxArmor, engine.player.armor + 50);
        }
      });
      setShopNotice(
        gearKey === 'grenade'
          ? '+2 FRAG GRENADES'
          : gearKey === 'medkit'
          ? '+1 NANO-MED STIM'
          : gearKey === 'overdrive'
          ? '+1 COMBAT OVERDRIVE'
          : '+50 TACTICAL ARMOR'
      );
      soundFX.playPickup();
    },
    [syncAndSave]
  );

  const handleUpgradeSkill = useCallback(
    (skillKey: keyof PlayerSkills) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (engine.saveData.skills[skillKey] >= 5) {
        setShopNotice('SKILL AT MAX LEVEL');
        soundFX.playUiBeep(false);
        return;
      }
      if (engine.saveData.skillPoints <= 0) {
        setShopNotice('NO SKILL POINTS (SP)');
        soundFX.playUiBeep(false);
        return;
      }
      syncAndSave((draft) => {
        draft.skillPoints -= 1;
        draft.skills[skillKey] += 1;
        if (skillKey === 'vitality') {
          engine.player.maxHp = 100 + draft.skills.vitality * 25;
          engine.player.hp = Math.min(engine.player.maxHp, engine.player.hp + 25);
        } else if (skillKey === 'armorTech') {
          engine.player.armor = Math.min(engine.player.maxArmor, engine.player.armor + 20);
        }
      });
      setShopNotice('SKILL UPGRADED!');
      soundFX.playPickup();
    },
    [syncAndSave]
  );

  const toggleSound = useCallback(() => {
    syncAndSave((draft) => {
      draft.soundEnabled = !draft.soundEnabled;
    });
  }, [syncAndSave]);

  const toggleFlashlight = useCallback(() => {
    syncAndSave((draft) => {
      draft.flashlightOn = !draft.flashlightOn;
    });
    soundFX.playUiBeep(true);
  }, [syncAndSave]);

  const handleSettingsAction = useCallback(
    (tab: SettingsTab, rowIndex: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (tab === 'audio') {
        if (rowIndex === 0) {
          syncAndSave((d) => {
            d.masterVolume = cycleVolumeStep(d.masterVolume);
          });
        } else if (rowIndex === 1) {
          syncAndSave((d) => {
            d.musicVolume = cycleVolumeStep(d.musicVolume);
          });
        } else if (rowIndex === 2) {
          syncAndSave((d) => {
            d.sfxVolume = cycleVolumeStep(d.sfxVolume);
          });
        } else if (rowIndex === 3) {
          toggleSound();
        } else if (rowIndex === 4) {
          // STEP 2 Sound Test: show state, try WebAudio then HTML Audio.
          // Do not add another beep after it; the test itself is the sound.
          const result = soundFX.testSound();
          setShopNotice(result);
          return;
        }
        soundFX.playUiBeep(true);
      } else if (tab === 'gameplay') {
        if (rowIndex === 2) {
          navigateToScreen('CONTROLS_HELP');
        }
      } else if (tab === 'display') {
        if (rowIndex === 0) {
          syncAndSave((d) => {
            d.brightnessLevel = ((d.brightnessLevel ?? 1) + 1) % 3;
          });
        } else if (rowIndex === 1) {
          syncAndSave((d) => {
            d.particlesEnabled = !d.particlesEnabled;
          });
        } else if (rowIndex === 2) {
          syncAndSave((d) => {
            d.screenShakeEnabled = !d.screenShakeEnabled;
          });
        } else if (rowIndex === 3) {
          toggleFlashlight();
        } else if (rowIndex === 4) {
          syncAndSave((d) => {
            d.showPerfOverlay = !d.showPerfOverlay;
          });
        }
        soundFX.playUiBeep(true);
      } else if (tab === 'data') {
        if (rowIndex === 0) {
          persistSaveData(engine.saveData);
          setShopNotice('GAME PROGRESS SAVED');
          soundFX.playPickup();
        } else if (rowIndex === 1) {
          setConfirmDialog('RESET_DATA');
        }
      }
    },
    [navigateToScreen, syncAndSave, toggleFlashlight, toggleSound]
  );

  const executeConfirmDialog = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (confirmDialog === 'RESTART_MISSION') {
      setConfirmDialog(null);
      if (engine.gameMode === 'SURVIVAL') startSurvivalRun();
      else startMissionById(selectedMissionId);
    } else if (confirmDialog === 'QUIT_TO_TITLE') {
      // STEP 1 FIX (Bugs 2, 3): checkpoint before leaving, and go through
      // navigateToScreen so the menu cursor resets to 0 and the previous
      // screen is recorded. hasActiveSession is kept, so Continue in the
      // same run resumes this session instead of restarting it.
      persistSaveData(engine.saveData);
      setSaveData(cloneSaveData(engine.saveData));
      setConfirmDialog(null);
      navigateToScreen('TITLE');
    } else if (confirmDialog === 'NEW_CAMPAIGN') {
      setConfirmDialog(null);
      startMissionById(1);
    } else if (confirmDialog === 'RESET_DATA') {
      // STEP 1 FIX (Bug 2): reset must land on TITLE with no active
      // session. The old code started Mission 01 and then switched to
      // TITLE, leaving a phantom active session behind.
      const fresh = resetSaveData();
      engine.saveData = fresh;
      soundFX.applySettings(fresh);
      setSaveData(fresh);
      setConfirmDialog(null);
      setHasActiveSession(false);
      setSelectedMissionId(1);
      navigateToScreen('TITLE');
    }
  }, [confirmDialog, navigateToScreen, selectedMissionId, startMissionById, startSurvivalRun]);

  // Unified KaiOS Keypad Action Handler
  const triggerKaiKey = useCallback(
    (
      key:
        | 'UP'
        | 'DOWN'
        | 'LEFT'
        | 'RIGHT'
        | 'OK'
        | 'LSK'
        | 'RSK'
        | '1'
        | '2'
        | '3'
        | '4'
        | '7'
        | '8'
        | '9'
        | 'HASH'
        | 'STAR'
        | '0'
        | 'BACK'
    ) => {
      const engine = engineRef.current;
      if (!engine) return;

      // STEP 3: OK/RSK handlers read this, not possibly-stale state.
      const curCursor = menuCursorRef.current;

      // STEP 3 BACK: KaiOS Back (Backspace) is NOT SoftRight. Previously
      // both mapped to RSK, so Back on TITLE jumped to Settings.
      // BACK now: cancel a dialog, pause in gameplay, no-op on TITLE,
      // otherwise behave like RSK (which is Back on most screens).
      if (key === 'BACK') {
        if (confirmDialog) {
          setConfirmDialog(null);
          soundFX.playUiBeep(false);
          return;
        }
        if (screenMode === 'TITLE') {
          return;
        }
        if (screenMode === 'PLAYING') {
          engine.keys = { up: false, down: false, left: false, right: false };
          navigateToScreen('PAUSED');
          soundFX.playUiBeep(false);
          return;
        }
        triggerKaiKey('RSK');
        return;
      }

      // Handle active confirmation modal first
      if (confirmDialog) {
        if (key === 'OK' || key === 'LSK') {
          executeConfirmDialog();
        } else if (key === 'RSK' || key === '0') {
          setConfirmDialog(null);
          soundFX.playUiBeep(false);
        }
        return;
      }

      if (key === 'STAR') {
        toggleFlashlight();
        return;
      }

      // PLAYING MODE CONTROLS
      if (screenMode === 'PLAYING') {
        if (key === 'LSK' || key === '0') {
          engine.keys = { up: false, down: false, left: false, right: false };
          navigateToScreen('PAUSED');
          soundFX.playUiBeep(false);
        } else if (key === 'RSK') {
          engine.keys = { up: false, down: false, left: false, right: false };
          navigateToScreen('ARMORY');
          soundFX.playUiBeep(true);
        } else if (key === 'OK') {
          engine.triggerContextAction();
        } else if (key === '1') {
          engine.switchWeapon('pistol');
        } else if (key === '2') {
          engine.switchWeapon('rifle');
        } else if (key === '3') {
          engine.switchWeapon('shotgun');
        } else if (key === '4') {
          engine.switchWeapon('plasma');
        } else if (key === '7') {
          if (engine.useFragGrenade()) {
            setSaveData(cloneSaveData(engine.saveData));
            setHud(engine.getHudSnapshot());
          }
        } else if (key === '8') {
          if (engine.useMedkitStim()) {
            setSaveData(cloneSaveData(engine.saveData));
            setHud(engine.getHudSnapshot());
          }
        } else if (key === '9') {
          if (engine.useCombatOverdrive()) {
            setSaveData(cloneSaveData(engine.saveData));
            setHud(engine.getHudSnapshot());
          }
        } else if (key === 'HASH') {
          engine.cycleWeapon();
        }
        return;
      }

      // MAIN MENU (TITLE) - 8 OPTIONS
      if (screenMode === 'TITLE') {
        const itemsCount = 8;
        // STEP 1 FIX (Bug 3): LEFT/RIGHT is not applicable to this vertical
        // list. Explicitly ignore it instead of letting it fall through
        // ambiguously; UP/DOWN move, OK/LSK select, RSK opens Settings.
        if (key === 'LEFT' || key === 'RIGHT') {
          return;
        }
        if (key === 'UP') {
          moveCursor(itemsCount, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(itemsCount, 1);
          soundFX.playUiBeep(false);
        } else if (key === '0') {
          toggleSound();
        } else if (key === 'RSK') {
          navigateToScreen('SETTINGS');
        } else if (key === 'OK' || key === 'LSK') {
          if (curCursor === 0) handleContinueGame();
          else if (curCursor === 1) {
            if (saveData.completedMissions.length > 0 || saveData.unlockedMission > 1) {
              setConfirmDialog('NEW_CAMPAIGN');
            } else {
              startMissionById(1);
            }
          } else if (curCursor === 2) navigateToScreen('SURVIVAL_MENU');
          else if (curCursor === 3) navigateToScreen('MISSION_SELECT');
          else if (curCursor === 4) navigateToScreen('ARMORY');
          else if (curCursor === 5) navigateToScreen('SHOP');
          else if (curCursor === 6) navigateToScreen('PROFILE');
          else if (curCursor === 7) navigateToScreen('SETTINGS');
        }
        return;
      }

      // PAUSE MENU (PAUSED) - 4 OPTIONS WITH CONFIRMATION
      if (screenMode === 'PAUSED') {
        const itemsCount = 4;
        if (key === 'UP') {
          moveCursor(itemsCount, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(itemsCount, 1);
          soundFX.playUiBeep(false);
        } else if (key === 'LSK' || key === '0') {
          screenModeRef.current = 'PLAYING';
          setScreenMode('PLAYING');
        } else if (key === 'RSK') {
          setConfirmDialog('QUIT_TO_TITLE');
        } else if (key === 'OK') {
          if (curCursor === 0) { screenModeRef.current = 'PLAYING'; setScreenMode('PLAYING'); }
          else if (curCursor === 1) setConfirmDialog('RESTART_MISSION');
          else if (curCursor === 2) navigateToScreen('SETTINGS');
          else if (curCursor === 3) setConfirmDialog('QUIT_TO_TITLE');
        }
        return;
      }

      // GAME MODE & CAMPAIGN MISSION SELECT
      if (screenMode === 'MISSION_SELECT') {
        // STEP 4 (NAV-03): while the detail panel is open, keys drive the
        // level cursor inside the panel, not the mission list.
        if (missionDetailOpen) {
          const dm = MISSIONS.find((m) => m.id === detailMissionId);
          if (dm) {
            const prog = (saveData.missionLevelProgress || {})[dm.id] || 0;
            const maxLv = Math.min(dm.levelCount || 1, prog + 1);
            if (key === 'UP') {
              const nl = Math.max(1, detailLevelRef.current - 1);
              detailLevelRef.current = nl;
              setDetailLevel(nl);
              soundFX.playUiBeep(false);
            } else if (key === 'DOWN') {
              const nl = Math.min(maxLv, detailLevelRef.current + 1);
              detailLevelRef.current = nl;
              setDetailLevel(nl);
              soundFX.playUiBeep(false);
            } else if (key === 'OK') {
              setMissionDetailOpen(false);
              startMissionLevelById(dm.id, detailLevelRef.current);
            } else if (key === 'RSK' || key === 'LSK') {
              setMissionDetailOpen(false);
              soundFX.playUiBeep(false);
            }
          }
          return;
        }
        if (key === 'LEFT' || key === 'RIGHT' || key === 'LSK') {
          navigateToScreen('SURVIVAL_MENU');
          return;
        }
        if (key === 'UP') {
          moveCursor(MISSIONS.length, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(MISSIONS.length, 1);
          soundFX.playUiBeep(false);
        } else if (key === 'RSK') {
          navigateToScreen('TITLE');
        } else if (key === 'OK') {
          const m = MISSIONS[curCursor];
          if (m && m.id <= saveData.unlockedMission) {
            openMissionDetail(m.id);
          } else {
            setShopNotice('SECTOR LOCKED — CLEAR PREVIOUS');
            soundFX.playUiBeep(false);
          }
        }
        return;
      }

      // SURVIVAL MODE SCREEN
      if (screenMode === 'SURVIVAL_MENU') {
        if (key === 'LEFT' || key === 'RIGHT' || key === 'LSK') {
          navigateToScreen('MISSION_SELECT');
          return;
        }
        if (key === 'RSK') {
          navigateToScreen('TITLE');
        } else if (key === 'OK') {
          startSurvivalRun();
        }
        return;
      }

      // ARMORY & INVENTORY UI (Weapons & Equipment)
      if (screenMode === 'ARMORY') {
        const tabs: ArmoryTab[] = ['weapons', 'equipment'];
        const itemsCount = armoryTab === 'weapons' ? 4 : 5;
        if (key === 'LEFT' || key === 'RIGHT') {
          setArmoryTab((t) => (t === 'weapons' ? 'equipment' : 'weapons'));
          setCursorSync(0);
          soundFX.playUiBeep(true);
        } else if (key === 'UP') {
          moveCursor(itemsCount, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(itemsCount, 1);
          soundFX.playUiBeep(false);
        } else if (key === 'RSK') {
          navigateToScreen(previousScreenRef.current === 'PLAYING' ? 'PLAYING' : 'TITLE');
        } else if (key === 'OK') {
          if (armoryTab === 'weapons') {
            const wId = WEAPON_ORDER[curCursor];
            if (saveData.unlockedWeapons[wId]) {
              engine.switchWeapon(wId);
              setHud(engine.getHudSnapshot());
              setShopNotice(`${WEAPONS[wId].shortName} EQUIPPED`);
            } else {
              handleUpgradeWeapon(wId);
            }
          } else {
            if (curCursor === 0) {
              handleBuyTacticalGear('armorTier');
            } else if (curCursor === 1) {
              engine.cycleSelectedEquipment();
              setSaveData(cloneSaveData(engine.saveData));
              setHud(engine.getHudSnapshot());
              setShopNotice(`ACTIVE BELT: ${engine.saveData.selectedEquipment.toUpperCase()}`);
            } else if (curCursor === 2) {
              syncAndSave((draft) => {
                draft.selectedEquipment = 'grenade';
              });
              setShopNotice('FRAG GRENADE SELECTED');
            } else if (curCursor === 3) {
              syncAndSave((draft) => {
                draft.selectedEquipment = 'medkit';
              });
              setShopNotice('NANO-MED STIM SELECTED');
            } else if (curCursor === 4) {
              syncAndSave((draft) => {
                draft.selectedEquipment = 'overdrive';
              });
              setShopNotice('COMBAT OVERDRIVE SELECTED');
            }
          }
        } else if (key === 'LSK') {
          if (armoryTab === 'weapons') {
            handleUpgradeWeapon(WEAPON_ORDER[curCursor]);
          } else {
            navigateToScreen('SHOP');
          }
        }
        return;
      }

      // SHOP UI (5 Categories: Weapons, Upgrades, Armor, Equipment, Ammunition)
      if (screenMode === 'SHOP') {
        const cats: ShopCategory[] = ['weapons', 'upgrades', 'armor', 'equipment', 'ammo'];
        const counts: Record<ShopCategory, number> = {
          weapons: 4,
          upgrades: 4,
          armor: 3,
          equipment: 3,
          ammo: 3,
        };
        const itemsCount = counts[shopCategory];
        if (key === 'LEFT') {
          setShopCategory((c) => cats[(cats.indexOf(c) - 1 + cats.length) % cats.length]);
          setCursorSync(0);
          soundFX.playUiBeep(true);
        } else if (key === 'RIGHT' || key === 'LSK') {
          setShopCategory((c) => cats[(cats.indexOf(c) + 1) % cats.length]);
          setCursorSync(0);
          soundFX.playUiBeep(true);
        } else if (key === 'UP') {
          moveCursor(itemsCount, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(itemsCount, 1);
          soundFX.playUiBeep(false);
        } else if (key === 'RSK') {
          navigateToScreen('TITLE');
        } else if (key === 'OK') {
          if (shopCategory === 'weapons' || shopCategory === 'upgrades') {
            handleUpgradeWeapon(WEAPON_ORDER[curCursor]);
          } else if (shopCategory === 'armor') {
            const armorActions: ('armor' | 'armorTier' | 'regenImplant')[] = [
              'armor',
              'armorTier',
              'regenImplant',
            ];
            handleBuyTacticalGear(armorActions[curCursor]);
          } else if (shopCategory === 'equipment') {
            const eqActions: ('grenade' | 'medkit' | 'overdrive')[] = [
              'grenade',
              'medkit',
              'overdrive',
            ];
            handleBuyTacticalGear(eqActions[curCursor]);
          } else if (shopCategory === 'ammo') {
            const ammoWeapons: WeaponId[] = ['rifle', 'shotgun', 'plasma'];
            handleBuyAmmo(ammoWeapons[curCursor]);
          }
        }
        return;
      }

      // PLAYER PROFILE & SKILL UPGRADE UI
      if (screenMode === 'PROFILE') {
        if (key === 'LEFT' || key === 'RIGHT' || key === 'LSK') {
          setProfileTab((t) => (t === 'stats' ? 'skills' : 'stats'));
          setCursorSync(0);
          soundFX.playUiBeep(true);
          return;
        }
        if (key === 'RSK') {
          navigateToScreen('TITLE');
          return;
        }
        if (profileTab === 'stats') {
          if (key === 'OK') {
            setProfileTab('skills');
            setCursorSync(0);
          }
        } else {
          const skillKeys: (keyof PlayerSkills)[] = [
            'vitality',
            'armorTech',
            'firepower',
            'reloadSpeed',
            'agility',
          ];
          if (key === 'UP') {
            moveCursor(skillKeys.length, -1);
            soundFX.playUiBeep(false);
          } else if (key === 'DOWN') {
            moveCursor(skillKeys.length, 1);
            soundFX.playUiBeep(false);
          } else if (key === 'OK') {
            handleUpgradeSkill(skillKeys[curCursor]);
          }
        }
        return;
      }

      // SETTINGS MENU (Audio, Gameplay, Display, Data)
      if (screenMode === 'SETTINGS') {
        const tabs: SettingsTab[] = ['audio', 'gameplay', 'display', 'data'];
        const counts: Record<SettingsTab, number> = {
          audio: 5, // STEP 2: + Sound Test row
          gameplay: 3,
          display: 5,
          data: 2,
        };
        const itemsCount = counts[settingsTab];
        if (key === 'LEFT') {
          setSettingsTab((t) => tabs[(tabs.indexOf(t) - 1 + tabs.length) % tabs.length]);
          setCursorSync(0);
          soundFX.playUiBeep(true);
        } else if (key === 'RIGHT' || key === 'LSK') {
          setSettingsTab((t) => tabs[(tabs.indexOf(t) + 1) % tabs.length]);
          setCursorSync(0);
          soundFX.playUiBeep(true);
        } else if (key === 'UP') {
          moveCursor(itemsCount, -1);
          soundFX.playUiBeep(false);
        } else if (key === 'DOWN') {
          moveCursor(itemsCount, 1);
          soundFX.playUiBeep(false);
        } else if (key === 'RSK') {
          navigateToScreen(previousScreenRef.current === 'PAUSED' ? 'PAUSED' : 'TITLE');
        } else if (key === 'OK') {
          handleSettingsAction(settingsTab, curCursor);
        }
        return;
      }

      if (screenMode === 'VICTORY' || screenMode === 'GAME_OVER') {
        if (key === 'OK' || key === 'LSK') {
          const engineV = engineRef.current;
          if (screenMode === 'VICTORY' && engineV && engineV.pendingNextLevel > 0) {
            startMissionLevelById(selectedMissionId, engineV.pendingNextLevel);
          } else if (screenMode === 'VICTORY' && selectedMissionId < MISSIONS.length) {
            startMissionById(selectedMissionId + 1);
          } else {
            startMissionById(selectedMissionId);
          }
        } else if (key === 'RSK') {
          navigateToScreen('MISSION_SELECT');
        }
        return;
      }

      if (screenMode === 'SURVIVAL_OVER') {
        if (key === 'OK' || key === 'LSK') {
          startSurvivalRun();
        } else if (key === 'RSK') {
          navigateToScreen('TITLE');
        }
        return;
      }

      if (screenMode === 'CONTROLS_HELP') {
        if (key === 'OK' || key === 'LSK' || key === 'RSK') {
          navigateToScreen(previousScreenRef.current === 'SETTINGS' ? 'SETTINGS' : 'TITLE');
        }
      }
    },
    [
      armoryTab,
      confirmDialog,
      detailMissionId,
      missionDetailOpen,
      openMissionDetail,
      saveData.missionLevelProgress,
      executeConfirmDialog,
      handleBuyAmmo,
      handleBuyTacticalGear,
      handleContinueGame,
      handleSettingsAction,
      handleUpgradeSkill,
      handleUpgradeWeapon,
      moveCursor,
      navigateToScreen,
      profileTab,
      saveData.completedMissions.length,
      saveData.unlockedMission,
      saveData.unlockedWeapons,
      screenMode,
      selectedMissionId,
      settingsTab,
      shopCategory,
      startMissionById,
      startMissionLevelById,
      startSurvivalRun,
      syncAndSave,
      toggleFlashlight,
      toggleSound,
    ]
  );

  // STEP 1 FIX (Bugs 3, 4, 5): stable keypad handling.
  // The old effect re-registered window listeners on every cursor/save
  // change because triggerKaiKey changed identity, which dropped or
  // delayed rapid keypad presses on KaiOS. These refs always point at the
  // latest handler/screen/confirm state, so listeners are registered once.
  const triggerKaiKeyRef = useRef(triggerKaiKey);
  triggerKaiKeyRef.current = triggerKaiKey;
  const confirmDialogRef = useRef(confirmDialog);
  confirmDialogRef.current = confirmDialog;

  // Physical Keyboard & KaiOS 2.5.3.2 Hardware Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      // STEP 1 FIX (Bug 5): KaiOS/Gecko will not start a suspended
      // AudioContext from a requestAnimationFrame tick. The first real
      // keypad gesture must unlock it, otherwise menu, weapon and music
      // sounds stay silent for the whole session.
      soundFX.unlockFromGesture();

      // STEP 1 FIX (Bug 3): a focused DOM button plus the keypad handler
      // can both fire on Enter/OK. Blur it so only the handler acts.
      if (typeof document !== 'undefined' && document.activeElement) {
        const el = document.activeElement as HTMLElement;
        if (el && el.tagName === 'BUTTON' && typeof el.blur === 'function') el.blur();
      }

      const preventKeys = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'SoftLeft',
        'SoftRight',
        'Backspace',
        'Escape',
        'F1',
        'F2',
        'Call',
        'EndCall',
        ' ',
        'Tab',
        '#',
        '*',
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
      ];
      if (preventKeys.indexOf(e.key) !== -1) {
        e.preventDefault();
      }

      const mode = screenModeRef.current;
      const dialog = confirmDialogRef.current;
      const trigger = triggerKaiKeyRef.current;

      // STEP 1 FIX (Bugs 3, 4): ignore auto-repeat for menu actions
      // (OK/LSK/RSK and number actions). A held key must not queue a
      // burst of React re-renders and double selections. Arrow repeat
      // in PLAYING is movement (engine.keys), so it is not blocked here.
      // STEP 4 FIX (NAV-01): arrow/WASD repeats are also menu actions
      // outside PLAYING. A held UP/DOWN must not queue cursor moves.
      const isArrowKey =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 's' ||
        e.key === 'S' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'd' ||
        e.key === 'D';
      const isActionKey =
        e.key === 'Enter' ||
        e.key === '5' ||
        e.key === ' ' ||
        e.key === 'SoftLeft' ||
        e.key === 'Escape' ||
        e.key === 'q' ||
        e.key === 'Q' ||
        e.key === 'F1' ||
        e.key === 'SoftRight' ||
        e.key === 'Backspace' ||
        e.key === 'e' ||
        e.key === 'E' ||
        e.key === 'F2' ||
        e.key === '1' ||
        e.key === '2' ||
        e.key === '3' ||
        e.key === '4' ||
        e.key === '7' ||
        e.key === '8' ||
        e.key === '9' ||
        e.key === '#' ||
        e.key === '*' ||
        e.key === '0';
      if ((e as KeyboardEvent & { repeat?: boolean }).repeat && mode !== 'PLAYING' && (isActionKey || isArrowKey)) {
        return;
      }

      if (mode === 'PLAYING' && !dialog) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') engine.keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') engine.keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') engine.keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') engine.keys.right = true;
      } else {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') trigger('UP');
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') trigger('DOWN');
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') trigger('LEFT');
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') trigger('RIGHT');
      }

      if (e.key === 'Enter' || e.key === '5' || e.key === ' ') {
        trigger('OK');
      } else if (
        e.key === 'SoftLeft' ||
        e.key === 'Escape' ||
        e.key === 'q' ||
        e.key === 'Q' ||
        e.key === 'F1'
      ) {
        trigger('LSK');
      } else if (e.key === 'Backspace') {
        // STEP 3: distinct from SoftRight, see triggerKaiKey BACK.
        trigger('BACK');
      } else if (
        e.key === 'SoftRight' ||
        e.key === 'e' ||
        e.key === 'E' ||
        e.key === 'F2'
      ) {
        trigger('RSK');
      } else if (e.key === '1') {
        trigger('1');
      } else if (e.key === '2') {
        trigger('2');
      } else if (e.key === '3') {
        trigger('3');
      } else if (e.key === '4') {
        trigger('4');
      } else if (e.key === '7' || e.key === 'g' || e.key === 'G') {
        trigger('7');
      } else if (e.key === '8' || e.key === 'h' || e.key === 'H') {
        trigger('8');
      } else if (e.key === '9' || e.key === 'b' || e.key === 'B') {
        trigger('9');
      } else if (e.key === '#' || e.key === '/' || e.key === 'Tab') {
        trigger('HASH');
      } else if (e.key === '*' || e.key === 'f' || e.key === 'F') {
        trigger('STAR');
      } else if (e.key === '0') {
        trigger('0');
      } else if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') engine.keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') engine.keys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') engine.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') engine.keys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleSound]);

  // STEP 2: every button click is also a gesture, so it must unlock audio
  // too, not only keydown. This covers Settings Sound Test and menu taps.
  useEffect(() => {
    const onClick = () => soundFX.unlockFromGesture();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const setMoveDir = (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (screenMode === 'PLAYING' && !confirmDialog) {
      engine.keys[dir] = active;
    } else if (active) {
      triggerKaiKey(dir.toUpperCase() as 'UP' | 'DOWN' | 'LEFT' | 'RIGHT');
    }
  };

  // Render the 240x320 native screen content (Canvas + Compact HUD + KaiOS Overlays)
  const renderKaiOsScreen = () => {
    const curWeaponSpec = WEAPONS[hud.weapon];
    const xpNext = getXpForNextLevel(saveData.level);
    const inspectedWeaponId = WEAPON_ORDER[Math.min(WEAPON_ORDER.length - 1, menuCursor)];
    const inspectedSpec = WEAPONS[inspectedWeaponId];
    const inspectedStats = getEffectiveWeaponStats(
      inspectedWeaponId,
      saveData.weaponLevels[inspectedWeaponId],
      saveData.skills
    );

    return (
      <div
        className={`relative bg-[#070a0e] overflow-hidden select-none shrink-0 ${
          isNativeSmallScreen ? '' : 'border border-slate-800'
        }`}
        style={{
          width: viewportScale === '2x' ? 480 : 240,
          height: viewportScale === '2x' ? 640 : 320,
        }}
      >
        {/* Scaled Inner 240x320 Coordinate Container */}
        <div
          className="relative w-[240px] h-[320px] origin-top-left"
          style={{
            transform: viewportScale === '2x' ? 'scale(2)' : 'scale(1)',
          }}
        >
          <canvas
            ref={handleCanvasRef}
            width={NATIVE_W}
            height={NATIVE_H}
            className="pixel-canvas block w-[240px] h-[320px]"
          />

          {/* COMPACT 240x320 IN-GAME HUD */}
          {screenMode === 'PLAYING' && (
            <>
              {/* Top Status Strip (24px high) */}
              <div className="absolute top-0 left-0 right-0 h-[24px] bg-[#070b10]/92 border-b border-sky-900/60 px-1.5 flex items-center justify-between text-[10px] leading-none font-mono-tabular">
                <div className="flex items-center gap-1">
                  <div className="w-[48px] h-[7px] bg-slate-900 border border-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }}
                    />
                  </div>
                  <span className="text-white font-bold">{hud.hp}</span>
                  <div className="w-[32px] h-[7px] bg-slate-900 border border-slate-700 overflow-hidden ml-0.5">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${Math.max(0, (hud.armor / hud.maxArmor) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sky-300">{hud.armor}</span>
                </div>

                <div className="flex items-center gap-1 text-amber-400 font-semibold">
                  <span>
                    {hud.gameMode === 'SURVIVAL'
                      ? `SURV W${hud.wave}`
                      : `W${hud.wave}/${hud.totalWaves}`}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-rose-400">E:{hud.enemiesRemaining}</span>
                </div>

                <div className="text-emerald-400 font-bold">${hud.credits}</div>
              </div>

              {/* Sub-header Mission Objective & Tactical Belt (13px high) */}
              <div className="absolute top-[24px] left-0 right-0 h-[13px] bg-[#05080c]/80 border-b border-slate-800/60 px-1.5 flex items-center justify-between text-[10px] leading-none font-mono-tabular">
                <span className="text-cyan-300 truncate max-w-[112px]">{hud.objectiveText}</span>
                <span className="text-slate-300">
                  <span
                    className={
                      hud.selectedEquipment === 'grenade'
                        ? 'text-orange-300 font-bold underline'
                        : 'text-orange-400'
                    }
                  >
                    7:G{hud.grenades}
                  </span>{' '}
                  <span
                    className={
                      hud.selectedEquipment === 'medkit'
                        ? 'text-emerald-300 font-bold underline'
                        : 'text-emerald-400'
                    }
                  >
                    8:M{hud.medkits}
                  </span>{' '}
                  <span
                    className={
                      hud.overdriveActive || hud.selectedEquipment === 'overdrive'
                        ? 'text-sky-300 font-bold underline'
                        : 'text-sky-400'
                    }
                  >
                    9:OD{hud.overdrives}
                  </span>{' '}
                  · T:{hud.activeTurrets}/{hud.totalTurrets}
                </span>
              </div>

              {/* Mission Launch Transition Banner */}
              {launchBanner && (
                <div className="absolute top-[42px] left-4 right-4 bg-sky-950/90 border border-sky-400 py-1 px-2 text-center text-[10px] leading-none font-mono-tabular text-sky-200 font-bold">
                  {launchBanner}
                </div>
              )}

              {/* Boss Health Bar if Boss is Active */}
              {hud.bossName && (
                <div className="absolute top-[39px] left-2 right-2 bg-[#1a060b]/90 border border-rose-700 px-1.5 py-0.5">
                  <div className="flex justify-between text-[10px] leading-none font-mono-tabular text-rose-300 font-bold">
                    <span>{hud.bossName}</span>
                    <span>
                      {hud.bossHp}/{hud.bossMaxHp}
                    </span>
                  </div>
                  <div className="w-full h-[4px] bg-slate-950 mt-0.5">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.max(0, (hud.bossHp / hud.bossMaxHp) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Contextual Action Prompt Banner */}
              {hud.contextPrompt && (
                <div className="absolute bottom-[36px] left-3 right-3 bg-sky-950/90 border border-sky-400 py-0.5 px-1.5 text-center text-[10px] leading-none font-mono-tabular text-sky-200 font-bold">
                  {hud.contextPrompt}
                </div>
              )}

              {/* Bottom Weapon Bar + KaiOS Softkey Strip (32px total) */}
              <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-[#070b10]/95 border-t border-sky-900/60 flex flex-col justify-between">
                <div className="h-[17px] px-1.5 flex items-center justify-between text-[10px] leading-none font-mono-tabular">
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-bold">
                      [{curWeaponSpec.keySlot}] {curWeaponSpec.shortName}
                    </span>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('HASH')}
                      className="text-[10px] text-sky-300 hover:text-white px-1 border border-sky-800/80 bg-sky-950/40"
                      title="Press # to cycle weapon"
                    >
                      #:NEXT
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {hud.reloading ? (
                      <div className="flex items-center gap-1">
                        <span className="text-amber-300 font-bold text-[10px]">RELOAD</span>
                        <div className="w-[34px] h-[5px] bg-slate-900 border border-amber-500/70">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-100 font-bold">
                        MAG {hud.clipAmmo} / {hud.infiniteAmmo ? 'INF' : hud.reserveAmmo}
                      </span>
                    )}
                  </div>
                </div>

                {/* KaiOS 2.5.3.2 Standard 3-Softkey Bar */}
                <div className="h-[20px] bg-[#0d141f] border-t border-slate-800/80 px-1.5 flex items-center justify-between text-[10px] leading-none font-mono-tabular text-slate-300">
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('LSK')}
                    className="hover:text-white font-semibold"
                  >
                    Pause
                  </button>
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('OK')}
                    className="text-cyan-400 font-bold hover:text-cyan-300"
                  >
                    OK:Action
                  </button>
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('RSK')}
                    className="hover:text-white font-semibold"
                  >
                    Armory
                  </button>
                </div>
              </div>
            </>
          )}

          {/* OVERLAY 1: SCI-FI MAIN MENU (TITLE) - ALL 8 REQUIRED OPTIONS */}
          {screenMode === 'TITLE' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100 transition-opacity duration-150">
              {/* STEP 4: compact brand header — tight leading so the 8 rows
                  fit 240x320 without clipping (previously rows overflowed). */}
              <div className="border-b-2 border-cyan-500/70 pb-1 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-mono-tabular text-cyan-300 font-bold tracking-wider leading-none">
                    TACTICAL DEFENSE COMMAND · KAIOS 2.5
                  </div>
                  <h1 className="font-display text-[20px] font-bold tracking-wide text-white leading-none mt-1">
                    MS ALIEN SHOOTER
                  </h1>
                </div>
                <div className="text-right font-mono-tabular text-[11px] leading-tight">
                  <div className="text-sky-300 font-bold">LV.{saveData.level}</div>
                  <div className="text-emerald-400 font-bold">${saveData.credits}</div>
                </div>
              </div>

              {/* STEP 4: compact level + credits panel (was a loose strip at
                  the bottom). XP bar, kills and high score in one panel. */}
              <div className="mt-1 bg-[#0b111a] border border-slate-800 px-1.5 py-1">
                <div className="flex justify-between text-[10px] font-mono-tabular leading-none">
                  <span className="text-cyan-300 font-bold">
                    XP {saveData.xp}/{xpNext}
                  </span>
                  <span className="text-slate-300">
                    KILLS {saveData.totalKills} · HI {saveData.highScore}
                  </span>
                  <span className={saveData.soundEnabled ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {saveData.soundEnabled ? 'SOUND ON' : 'MUTED'}
                  </span>
                </div>
                <div className="w-full h-[5px] bg-slate-950 border border-slate-700 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, Math.round((saveData.xp / xpNext) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[3px] my-auto">
                {[
                  {
                    label: 'Continue Game',
                    meta: hasActiveSession ? `M-0${selectedMissionId} L${hud.missionLevel}/${hud.missionLevelCount} Active` : `M-0${saveData.unlockedMission} L${((saveData.missionLevelProgress || {})[saveData.unlockedMission] || 0) + 1}/${MISSIONS.find((m) => m.id === saveData.unlockedMission)?.levelCount || 1}`,
                  },
                  {
                    label: 'New Campaign',
                    meta: 'Start Sector 01',
                  },
                  {
                    label: 'Survival Mode',
                    meta: `Best W-${saveData.survivalBestWave}`,
                  },
                  {
                    label: 'Missions',
                    meta: `${saveData.completedMissions.length}/${MISSIONS.length} Cleared`,
                  },
                  {
                    label: 'Armory',
                    meta: WEAPONS[hud.weapon].shortName,
                  },
                  {
                    label: 'Shop',
                    meta: `$${saveData.credits} Cr`,
                  },
                  {
                    label: 'Player Profile',
                    meta: `${saveData.skillPoints} SP`,
                  },
                  {
                    label: 'Settings',
                    meta: saveData.soundEnabled ? 'Audio ON' : 'Muted',
                  },
                ].map((item, idx) => {
                  const active = menuCursor === idx;
                  return (
                    <button
                      tabIndex={-1}
                      key={item.label}
                      onClick={() => {
                        setCursorSync(idx);
                        if (idx === 0) handleContinueGame();
                        else if (idx === 1) {
                          if (saveData.completedMissions.length > 0 || saveData.unlockedMission > 1) {
                            setConfirmDialog('NEW_CAMPAIGN');
                          } else {
                            startMissionById(1);
                          }
                        } else if (idx === 2) navigateToScreen('SURVIVAL_MENU');
                        else if (idx === 3) navigateToScreen('MISSION_SELECT');
                        else if (idx === 4) navigateToScreen('ARMORY');
                        else if (idx === 5) navigateToScreen('SHOP');
                        else if (idx === 6) navigateToScreen('PROFILE');
                        else if (idx === 7) navigateToScreen('SETTINGS');
                      }}
                      className={`w-full text-left px-2 py-[4px] text-[12px] leading-none font-mono-tabular border flex items-center justify-between transition-colors ${
                        active
                          ? 'bg-[#0e2a3d]/95 border-cyan-300 text-white font-bold'
                          : 'bg-[#0b111a]/90 border-slate-700 text-slate-200'
                      }`}
                    >
                      <span>
                        {active ? '▸ ' : '  '}
                        {item.label}
                      </span>
                      <span className={active ? 'text-cyan-300 text-[11px] leading-none' : 'text-slate-400 text-[11px] leading-none'}>
                        {item.meta}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-2.5 -mb-2.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('OK')}>Select</button>
                <span className="text-cyan-400 font-bold">OK:Open</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('SETTINGS')}>Settings</button>
              </div>
            </div>
          )}

          {/* OVERLAY 2: PAUSE MENU (Resume, Restart Mission, Settings, Return to Main Menu) */}
          {screenMode === 'PAUSED' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1">
                <div className="text-[10px] leading-none font-mono-tabular text-cyan-400 font-bold">
                  {hud.gameMode === 'SURVIVAL' ? 'SURVIVAL OPERATION PAUSED' : 'TACTICAL MISSION PAUSED'}
                </div>
                <div className="text-[14px] leading-none font-bold text-white truncate mt-0.5">
                  {hud.gameMode === 'SURVIVAL'
                    ? SURVIVAL_ARENA_MISSION.title
                    : MISSIONS.find((m) => m.id === selectedMissionId)?.title}
                </div>
                <div className="text-[10px] leading-none font-mono-tabular text-slate-400 mt-1">
                  HP {hud.hp}/{hud.maxHp} · AR {hud.armor}/{hud.maxArmor} · Wave {hud.wave}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 my-auto">
                {[
                  'Resume',
                  'Restart Mission',
                  'Settings',
                  'Return to Main Menu',
                ].map((label, idx) => (
                  <button tabIndex={-1}
                    key={label}
                    onClick={() => {
                      setCursorSync(idx);
                      if (idx === 0) { screenModeRef.current = 'PLAYING'; setScreenMode('PLAYING'); }
                      else if (idx === 1) setConfirmDialog('RESTART_MISSION');
                      else if (idx === 2) navigateToScreen('SETTINGS');
                      else if (idx === 3) setConfirmDialog('QUIT_TO_TITLE');
                    }}
                    className={`w-full text-left px-2 py-[5px] text-[12px] leading-none font-mono-tabular border ${
                      menuCursor === idx
                        ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4 text-white font-bold'
                        : 'bg-[#0b111a]/90 border-slate-800 text-slate-300'
                    }`}
                  >
                    {menuCursor === idx ? '▸ ' : '  '}
                    {label}
                  </button>
                ))}
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-2.5 -mb-2.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => setScreenMode('PLAYING')}>Resume</button>
                <span className="text-cyan-400 font-bold">OK:Select</span>
                <button tabIndex={-1} onClick={() => setConfirmDialog('QUIT_TO_TITLE')}>Main Menu</button>
              </div>
            </div>
          )}

          {/* OVERLAY 3: GAME MODE & CAMPAIGN MISSION SELECTION */}
          {screenMode === 'MISSION_SELECT' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1 flex items-center justify-between">
                <div className="flex gap-1">
                  <button tabIndex={-1}
                    onClick={() => navigateToScreen('MISSION_SELECT', false)}
                    className="px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular bg-cyan-700 text-white font-bold"
                  >
                    CAMPAIGN (4 · 18 LV)
                  </button>
                  <button tabIndex={-1}
                    onClick={() => navigateToScreen('SURVIVAL_MENU')}
                    className="px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular bg-slate-900 text-slate-400 hover:text-white"
                  >
                    SURVIVAL MODE
                  </button>
                </div>
                <span className="text-[11px] font-mono-tabular text-emerald-400 font-bold">
                  ${saveData.credits}
                </span>
              </div>

              {shopNotice && (
                <div className="bg-rose-950/90 border border-rose-500 px-1.5 py-0.5 text-[11px] font-mono-tabular text-rose-200 text-center">
                  {shopNotice}
                </div>
              )}

              <div className="flex flex-col gap-0.5 my-auto">
                {MISSIONS.map((m, idx) => {
                  const unlocked = m.id <= saveData.unlockedMission;
                  const completed = saveData.completedMissions.includes(m.id);
                  const diff = MISSION_DIFFICULTY[m.id] || MISSION_DIFFICULTY[1];
                  const active = menuCursor === idx;
                  return (
                    <button tabIndex={-1}
                      key={m.id}
                      onClick={() => {
                        setCursorSync(idx);
                        if (unlocked) openMissionDetail(m.id);
                        else setShopNotice('SECTOR LOCKED — CLEAR PREVIOUS');
                      }}
                      className={`w-full text-left p-1.5 border transition-colors ${
                        active
                          ? 'bg-[#0e2a3d]/95 border-cyan-400'
                          : 'bg-[#0b111a]/90 border-slate-800'
                      } ${!unlocked ? 'opacity-55' : ''}`}
                    >
                      <div className="flex justify-between items-center text-[12px] leading-none font-mono-tabular">
                        <span className="font-bold text-white truncate max-w-[138px]">
                          {m.title}
                        </span>
                        <span
                          className={
                            !unlocked
                              ? 'text-rose-400 font-bold'
                              : completed
                              ? 'text-emerald-400 font-bold'
                              : 'text-cyan-300 font-bold'
                          }
                        >
                          {!unlocked
                            ? 'LOCKED'
                            : completed
                            ? 'COMPLETED ✓'
                            : (saveData.missionLevelProgress || {})[m.id]
                            ? `L${((saveData.missionLevelProgress || {})[m.id] || 0) + 1}/${m.levelCount || 1}`
                            : 'UNLOCKED'}
                        </span>
                      </div>
                      {/* STEP 4: level-progress bar on the mission card. */}
                      <div className="w-full h-[4px] bg-slate-900 border border-slate-700 mt-1 overflow-hidden">
                        <div
                          className={`h-full ${completed ? 'bg-emerald-500' : unlocked ? 'bg-cyan-400' : 'bg-slate-700'}`}
                          style={{ width: `${(((saveData.missionLevelProgress || {})[m.id] || 0) / (m.levelCount || 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] leading-none font-mono-tabular mt-1">
                        <span className={diff.color}>DIFF: {diff.label}</span>
                        <span className="text-amber-300">
                          Reward: +${m.rewardCredits} · +{m.rewardXp}XP
                        </span>
                      </div>
                      <p className="text-[9px] leading-tight text-slate-400 mt-0.5 line-clamp-1">
                        {m.briefing}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* STEP 4 (NAV-03): MISSION DETAIL PANEL — briefing, progress,
                  level picker and deploy, over the mission list. */}
              {missionDetailOpen && (() => {
                const dm = MISSIONS.find((m) => m.id === detailMissionId) || MISSIONS[0];
                const prog = (saveData.missionLevelProgress || {})[dm.id] || 0;
                const lc = dm.levelCount || 1;
                const cleared = Math.min(prog, lc);
                const maxLv = Math.min(lc, prog + 1);
                const diff = MISSION_DIFFICULTY[dm.id] || MISSION_DIFFICULTY[1];
                return (
                  <div className="absolute inset-0 z-20 bg-[#060a10] border border-cyan-500/70 flex flex-col p-2 text-slate-100">
                    <div className="border-b-2 border-cyan-500/70 pb-1">
                      <div className="text-[9px] font-mono-tabular text-cyan-300 font-bold tracking-wider">
                        MISSION DETAIL · M-0{dm.id}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-display text-[13px] font-bold text-white truncate max-w-[150px]">
                          {dm.title}
                        </span>
                        <span className={`text-[10px] font-mono-tabular font-bold ${diff.color}`}>
                          {diff.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-300 leading-snug mt-1 line-clamp-2">
                      {dm.briefing}
                    </p>
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[10px] font-mono-tabular">
                        <span className="text-slate-400">PROGRESS</span>
                        <span className="text-emerald-400 font-bold">
                          {cleared}/{lc} LEVELS
                        </span>
                      </div>
                      <div className="w-full h-[6px] bg-slate-900 border border-slate-700 mt-0.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${(cleared / lc) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono-tabular mt-1">
                        <span className="text-amber-300">Reward: +${dm.rewardCredits} · +{dm.rewardXp}XP</span>
                        <span className="text-cyan-300 font-bold">
                          {cleared >= lc ? 'COMPLETED ✓' : `NEXT: L${cleared + 1}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {[1, 2, 3, 4, 5].filter((n) => n <= lc).map((n) => {
                        const locked = n > maxLv;
                        const isCurrent = n === detailLevel;
                        const stateText = n <= cleared ? 'CLEARED ✓' : locked ? 'LOCKED' : 'READY';
                        return (
                          <button tabIndex={-1}
                            key={n}
                            onClick={() => {
                              if (!locked) {
                                detailLevelRef.current = n;
                                setDetailLevel(n);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-1.5 py-[3px] border text-[11px] font-mono-tabular ${isCurrent
                              ? 'bg-[#0e2a3d] border-cyan-400 text-white font-bold'
                              : locked
                              ? 'bg-[#0b111a] border-slate-800 text-slate-500'
                              : 'bg-[#0b111a] border-slate-800 text-slate-200'
                            }`}
                          >
                            <span>▸ LEVEL {n}</span>
                            <span className={n <= cleared ? 'text-emerald-400' : locked ? 'text-rose-400' : 'text-cyan-300'}>
                              {stateText}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button tabIndex={-1}
                      onClick={() => {
                        setMissionDetailOpen(false);
                        startMissionLevelById(dm.id, detailLevelRef.current);
                      }}
                      className="w-full py-[6px] mt-1.5 bg-emerald-700 text-white text-[12px] font-mono-tabular font-bold border border-emerald-400"
                    >
                      ▸ DEPLOY LEVEL {detailLevel}
                    </button>
                    <div className="h-[20px] bg-[#0d141f] -mx-2 -mb-2 mt-auto px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                      <button tabIndex={-1} onClick={() => setMissionDetailOpen(false)}>RSK:Back</button>
                      <span className="text-cyan-400 font-bold">OK:Deploy</span>
                      <span>↑↓:Level</span>
                    </div>
                  </div>
                );
              })()}
              <div className="h-[20px] bg-[#0d141f] -mx-1.5 -mb-1.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => navigateToScreen('SURVIVAL_MENU')}>LSK:Survival</button>
                <span className="text-cyan-400 font-bold">OK:Details</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('TITLE')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 4: DEDICATED SURVIVAL MODE SCREEN */}
          {screenMode === 'SURVIVAL_MENU' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1 flex items-center justify-between">
                <div className="flex gap-1">
                  <button tabIndex={-1}
                    onClick={() => navigateToScreen('MISSION_SELECT')}
                    className="px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular bg-slate-900 text-slate-400 hover:text-white"
                  >
                    CAMPAIGN (4 · 18 LV)
                  </button>
                  <button tabIndex={-1}
                    onClick={() => navigateToScreen('SURVIVAL_MENU', false)}
                    className="px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular bg-amber-600 text-slate-950 font-bold"
                  >
                    SURVIVAL MODE
                  </button>
                </div>
                <span className="text-[11px] font-mono-tabular text-emerald-400 font-bold">
                  ${saveData.credits}
                </span>
              </div>

              <div className="bg-[#0b111a] border border-amber-500/50 p-2 text-[11px] font-mono-tabular space-y-1.5 my-auto">
                <div className="text-amber-400 font-bold text-[11px]">
                  {SURVIVAL_ARENA_MISSION.title}
                </div>
                <p className="text-slate-300 leading-snug text-[9px]">
                  Hold the fortified military arena against endless, escalating alien waves. Enemy
                  numbers, health and speed increase every wave, with Brood Overlord bosses
                  spawning every 3rd wave.
                </p>

                <div className="border-t border-slate-800 pt-1.5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best Wave Record:</span>
                    <span className="text-cyan-300 font-bold">
                      Wave {saveData.survivalBestWave}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best Survival Score:</span>
                    <span className="text-amber-300 font-bold">{saveData.survivalBestScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wave Clear Rewards:</span>
                    <span className="text-emerald-400 font-bold">+$60×Wave · +45×Wave XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Boss Bounty:</span>
                    <span className="text-rose-400 font-bold">+$250 Credits · +300 XP</span>
                  </div>
                </div>
              </div>

              <button tabIndex={-1}
                onClick={startSurvivalRun}
                className="w-full py-[6px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-tabular font-bold text-[11px] border border-amber-300"
              >
                ▸ Start Survival Mode
              </button>

              <div className="h-[20px] bg-[#0d141f] -mx-2 -mb-2 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => navigateToScreen('MISSION_SELECT')}>LSK:Campaign</button>
                <span className="text-amber-400 font-bold">OK:Start</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('TITLE')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 5: ARMORY & INVENTORY UI (Weapons & Equipment + Stat Inspector) */}
          {screenMode === 'ARMORY' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-0.5 flex items-center justify-between">
                <div className="flex gap-1">
                  <button tabIndex={-1}
                    onClick={() => {
                      setArmoryTab('weapons');
                      setCursorSync(0);
                    }}
                    className={`px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular ${
                      armoryTab === 'weapons'
                        ? 'bg-cyan-700 text-white font-bold'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    WEAPONS
                  </button>
                  <button tabIndex={-1}
                    onClick={() => {
                      setArmoryTab('equipment');
                      setCursorSync(0);
                    }}
                    className={`px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular ${
                      armoryTab === 'equipment'
                        ? 'bg-cyan-700 text-white font-bold'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    EQUIPMENT
                  </button>
                </div>
                <span className="text-[11px] font-mono-tabular text-emerald-400 font-bold">
                  ${saveData.credits}
                </span>
              </div>

              {shopNotice && (
                <div className="bg-[#0e2a3d]/95 border border-cyan-400 px-1 py-0.5 text-[9px] font-mono-tabular text-cyan-200 text-center">
                  {shopNotice}
                </div>
              )}

              {armoryTab === 'weapons' ? (
                <div className="flex flex-col gap-0.5 my-auto">
                  {WEAPON_ORDER.map((wId, idx) => {
                    const spec = WEAPONS[wId];
                    const unlocked = saveData.unlockedWeapons[wId];
                    const lv = saveData.weaponLevels[wId];
                    const eff = getEffectiveWeaponStats(wId, lv, saveData.skills);
                    const isEquipped = hud.weapon === wId;
                    const active = menuCursor === idx;
                    return (
                      <div
                        key={wId}
                        onClick={() => {
                          setCursorSync(idx);
                          if (unlocked) {
                            engineRef.current?.switchWeapon(wId);
                            if (engineRef.current) setHud(engineRef.current.getHudSnapshot());
                          }
                        }}
                        className={`px-1.5 py-1 border text-[11px] leading-none font-mono-tabular ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white">
                            [{spec.keySlot}] {spec.shortName}{' '}
                            <span className="text-slate-400">Lv.{lv}/6</span>
                          </span>
                          <span
                            className={
                              isEquipped
                                ? 'text-amber-300 font-bold'
                                : unlocked
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {isEquipped
                              ? 'EQUIPPED'
                              : unlocked
                              ? 'UNLOCKED'
                              : `LOCKED ($${spec.unlockCost})`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-[9px] leading-tight mt-0.5">
                          <span>
                            DMG:{eff.damage} · MAG:{eff.clipSize} · AMMO:
                            {spec.infiniteAmmo ? 'INF' : saveData.ammoInventory[wId]}
                          </span>
                          <button tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpgradeWeapon(wId);
                            }}
                            className="px-1 bg-emerald-950 text-emerald-300 border border-emerald-700"
                          >
                            {!unlocked ? `Unlock $${spec.unlockCost}` : lv < 6 ? 'Upg' : 'MAX'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Weapon Stat Inspector Box */}
                  <div className="bg-[#090e16] border border-cyan-800/70 p-1.5 text-[10px] leading-tight font-mono-tabular text-slate-300">
                    <div className="flex justify-between text-cyan-300 font-bold">
                      <span>{inspectedSpec.name}</span>
                      <span>{inspectedSpec.category}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5 mt-0.5 text-slate-300">
                      <span>DMG: {inspectedStats.damage}</span>
                      <span>RATE: {(1000 / inspectedStats.fireRateMs).toFixed(1)}/s</span>
                      <span>RNG: {inspectedStats.range}m</span>
                      <span>MAG: {inspectedStats.clipSize}</span>
                      <span>RLD: {(inspectedStats.reloadMs / 1000).toFixed(2)}s</span>
                      <span>LV: {saveData.weaponLevels[inspectedWeaponId]}/6</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 my-auto">
                  {[
                    {
                      title: `Armor Suit Mk.${saveData.armorTier}/4`,
                      sub: `Current AR: ${hud.armor}/${hud.maxArmor} · Bio-Regen Lv.${saveData.regenImplantLevel}/3`,
                      badge: saveData.armorTier < 4 ? `Upg $${140 * saveData.armorTier}` : 'MAX TIER',
                    },
                    {
                      title: `Active Belt Slot: ${saveData.selectedEquipment.toUpperCase()}`,
                      sub: 'Press OK to cycle active tactical gadget',
                      badge: 'CYCLE',
                    },
                    {
                      title: '[Key 7] Frag Grenade',
                      sub: 'High-explosive 2.6m AoE cluster blast',
                      badge: `Qty: ${saveData.tacticalInventory.grenades}`,
                    },
                    {
                      title: '[Key 8] Nano-Med Stim',
                      sub: `Instant +${60 + saveData.skills.vitality * 10} HP & clears acid`,
                      badge: `Qty: ${saveData.tacticalInventory.medkits}`,
                    },
                    {
                      title: '[Key 9] Combat Overdrive',
                      sub: '6s +35% Move Speed & +45% Fire/Reload',
                      badge: `Qty: ${saveData.tacticalInventory.overdrives}`,
                    },
                  ].map((eq, idx) => {
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={eq.title}
                        onClick={() => {
                          setCursorSync(idx);
                          triggerKaiKey('OK');
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">{eq.title}</div>
                          <div className="text-slate-400 text-[9px] leading-tight">{eq.sub}</div>
                        </div>
                        <span className="text-cyan-300 font-bold">{eq.badge}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="h-[20px] bg-[#0d141f] -mx-1.5 -mb-1.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('LSK')}>
                  {armoryTab === 'weapons' ? 'LSK:Upgrade' : 'LSK:Shop'}
                </button>
                <span className="text-cyan-400 font-bold">
                  {armoryTab === 'weapons' ? 'OK:Equip' : 'OK:Select'}
                </span>
                <button tabIndex={-1} onClick={() => triggerKaiKey('RSK')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 6: DEDICATED SHOP UI (5 Categories: Weapons, Upgrades, Armor, Equipment, Ammo) */}
          {screenMode === 'SHOP' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-0.5">
                <div className="flex justify-between items-center text-[12px] leading-none font-mono-tabular mb-1">
                  <span className="text-cyan-400 font-bold">MILITARY SUPPLY SHOP</span>
                  <span className="text-emerald-400 font-bold">CREDITS: ${saveData.credits}</span>
                </div>
                <div className="flex gap-0.5 justify-between">
                  {(
                    [
                      { id: 'weapons', label: 'WPN' },
                      { id: 'upgrades', label: 'UPG' },
                      { id: 'armor', label: 'ARM' },
                      { id: 'equipment', label: 'EQP' },
                      { id: 'ammo', label: 'AMMO' },
                    ] as const
                  ).map((tab) => (
                    <button tabIndex={-1}
                      key={tab.id}
                      onClick={() => {
                        setShopCategory(tab.id);
                        setCursorSync(0);
                      }}
                      className={`flex-1 py-[5px] text-[10px] leading-none font-mono-tabular text-center ${
                        shopCategory === tab.id
                          ? 'bg-cyan-700 text-white font-bold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {shopNotice && (
                <div className="bg-[#0e2a3d]/95 border border-cyan-400 px-1 py-0.5 text-[9px] font-mono-tabular text-cyan-200 text-center">
                  {shopNotice}
                </div>
              )}

              <div className="flex flex-col gap-0.5 my-auto">
                {shopCategory === 'weapons' &&
                  WEAPON_ORDER.map((wId, idx) => {
                    const spec = WEAPONS[wId];
                    const unlocked = saveData.unlockedWeapons[wId];
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={wId}
                        onClick={() => {
                          setCursorSync(idx);
                          handleUpgradeWeapon(wId);
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">
                            [{spec.keySlot}] {spec.name}
                          </div>
                          <div className="text-slate-400 text-[9px] leading-tight">
                            {spec.category} · Base DMG {spec.baseDamage}
                          </div>
                        </div>
                        <span
                          className={
                            unlocked ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'
                          }
                        >
                          {unlocked ? 'OWNED' : `$${spec.unlockCost}`}
                        </span>
                      </button>
                    );
                  })}

                {shopCategory === 'upgrades' &&
                  WEAPON_ORDER.map((wId, idx) => {
                    const spec = WEAPONS[wId];
                    const unlocked = saveData.unlockedWeapons[wId];
                    const lv = saveData.weaponLevels[wId];
                    const cost = Math.round(spec.upgradeBaseCost * Math.pow(1.45, lv - 1));
                    const eff = getEffectiveWeaponStats(wId, lv, saveData.skills);
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={wId}
                        onClick={() => {
                          setCursorSync(idx);
                          handleUpgradeWeapon(wId);
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">
                            {spec.shortName} Tuning (Lv.{lv}/6)
                          </div>
                          <div className="text-slate-400 text-[9px] leading-tight">
                            DMG:{eff.damage} · MAG:{eff.clipSize} · RLD:
                            {(eff.reloadMs / 1000).toFixed(2)}s
                          </div>
                        </div>
                        <span className="text-emerald-400 font-bold">
                          {!unlocked ? `Unlock $${spec.unlockCost}` : lv < 6 ? `$${cost}` : 'MAX'}
                        </span>
                      </button>
                    );
                  })}

                {shopCategory === 'armor' &&
                  [
                    {
                      key: 'armor' as const,
                      name: '[AR] Tactical Armor Plate',
                      desc: `Restore +50 Armor (Now: ${hud.armor}/${hud.maxArmor})`,
                      status: hud.armor >= hud.maxArmor ? 'FULL' : '$60',
                    },
                    {
                      key: 'armorTier' as const,
                      name: `[SUIT] Exo-Armor Suit Mk.${saveData.armorTier}/4`,
                      desc: '+25 Max Armor & +4% Damage Absorption',
                      status: saveData.armorTier >= 4 ? 'MAX' : `$${140 * saveData.armorTier}`,
                    },
                    {
                      key: 'regenImplant' as const,
                      name: `[BIO] Nano-Regen Implant Lv.${saveData.regenImplantLevel}/3`,
                      desc: 'Passive +2 HP/Lv every 2.5s in combat',
                      status:
                        saveData.regenImplantLevel >= 3
                          ? 'MAX'
                          : `$${160 * (saveData.regenImplantLevel + 1)}`,
                    },
                  ].map((item, idx) => {
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={item.key}
                        onClick={() => {
                          setCursorSync(idx);
                          handleBuyTacticalGear(item.key);
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-slate-400 text-[9px] leading-tight">{item.desc}</div>
                        </div>
                        <span className="text-emerald-400 font-bold">{item.status}</span>
                      </button>
                    );
                  })}

                {shopCategory === 'equipment' &&
                  [
                    {
                      key: 'grenade' as const,
                      name: '[7] Frag Grenade Pack (×2)',
                      desc: `Owned: ${saveData.tacticalInventory.grenades} · High AoE Cluster Blast`,
                      cost: '$65',
                    },
                    {
                      key: 'medkit' as const,
                      name: '[8] Nano-Med Stim (×1)',
                      desc: `Owned: ${saveData.tacticalInventory.medkits} · Instant +${60 + saveData.skills.vitality * 10} HP`,
                      cost: '$75',
                    },
                    {
                      key: 'overdrive' as const,
                      name: '[9] Combat Overdrive (×1)',
                      desc: `Owned: ${saveData.tacticalInventory.overdrives} · 6s +35% Speed & Fire`,
                      cost: '$110',
                    },
                  ].map((item, idx) => {
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={item.key}
                        onClick={() => {
                          setCursorSync(idx);
                          handleBuyTacticalGear(item.key);
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-slate-400 text-[9px] leading-tight">{item.desc}</div>
                        </div>
                        <span className="text-emerald-400 font-bold">{item.cost}</span>
                      </button>
                    );
                  })}

                {shopCategory === 'ammo' &&
                  (['rifle', 'shotgun', 'plasma'] as WeaponId[]).map((wId, idx) => {
                    const spec = WEAPONS[wId];
                    const unlocked = saveData.unlockedWeapons[wId];
                    const cost = wId === 'rifle' ? 45 : wId === 'shotgun' ? 50 : 85;
                    const pack = wId === 'rifle' ? 60 : wId === 'shotgun' ? 16 : 25;
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={wId}
                        onClick={() => {
                          setCursorSync(idx);
                          handleBuyAmmo(wId);
                        }}
                        className={`w-full text-left p-1.5 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">
                            {spec.shortName} Ammo Pack (+{pack})
                          </div>
                          <div className="text-slate-400 text-[9px] leading-tight">
                            Reserve: {saveData.ammoInventory[wId]} rounds
                          </div>
                        </div>
                        <span className="text-emerald-400 font-bold">
                          {unlocked ? `$${cost}` : 'LOCKED'}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-1.5 -mb-1.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('LSK')}>LSK:Category</button>
                <span className="text-cyan-400 font-bold">OK:Buy / Upgrade</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('TITLE')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 7: PLAYER PROFILE & SKILL UPGRADE UI */}
          {screenMode === 'PROFILE' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-0.5 flex items-center justify-between">
                <div className="flex gap-1">
                  <button tabIndex={-1}
                    onClick={() => {
                      setProfileTab('stats');
                      setCursorSync(0);
                    }}
                    className={`px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular ${
                      profileTab === 'stats'
                        ? 'bg-cyan-700 text-white font-bold'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    PROFILE
                  </button>
                  <button tabIndex={-1}
                    onClick={() => {
                      setProfileTab('skills');
                      setCursorSync(0);
                    }}
                    className={`px-1.5 py-[5px] text-[11px] leading-none font-mono-tabular ${
                      profileTab === 'skills'
                        ? 'bg-cyan-700 text-white font-bold'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    SKILLS ({saveData.skillPoints} SP)
                  </button>
                </div>
                <span className="text-[11px] font-mono-tabular text-sky-300 font-bold">
                  LV.{saveData.level}
                </span>
              </div>

              {shopNotice && (
                <div className="bg-[#0e2a3d]/95 border border-cyan-400 px-1 py-0.5 text-[9px] font-mono-tabular text-cyan-200 text-center">
                  {shopNotice}
                </div>
              )}

              {profileTab === 'stats' ? (
                <div className="bg-[#0b111a] border border-slate-800 p-1.5 text-[12px] leading-none font-mono-tabular space-y-1.5 my-auto">
                  <div>
                    <div className="flex justify-between text-white font-bold">
                      <span>Marine Level {saveData.level}</span>
                      <span className="text-cyan-300">
                        XP {saveData.xp} / {xpNext}
                      </span>
                    </div>
                    <div className="w-full h-[6px] bg-slate-950 border border-slate-700 mt-0.5 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${Math.min(100, Math.round((saveData.xp / xpNext) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Credits:</span>
                    <span className="text-emerald-400 font-bold">${saveData.credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Available Skill Points:</span>
                    <span className="text-amber-300 font-bold">{saveData.skillPoints} SP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Completed Missions:</span>
                    <span className="text-white font-bold">
                      {saveData.completedMissions.length} / {MISSIONS.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Enemies Eliminated:</span>
                    <span className="text-rose-400 font-bold">{saveData.totalKills}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best Survival Wave:</span>
                    <span className="text-sky-300 font-bold">Wave {saveData.survivalBestWave}</span>
                  </div>

                  <button tabIndex={-1}
                    onClick={() => {
                      setProfileTab('skills');
                      setCursorSync(0);
                    }}
                    className="w-full py-[6px] mt-1 bg-cyan-800 hover:bg-cyan-700 text-white font-bold text-center"
                  >
                    ▸ Upgrade Marine Skills ({saveData.skillPoints} SP)
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 my-auto">
                  {(
                    [
                      {
                        key: 'vitality',
                        label: 'Maximum Health',
                        next: '+25 Max HP',
                      },
                      {
                        key: 'armorTech',
                        label: 'Armor Strength',
                        next: '+20 Start AR & +2% Resist',
                      },
                      {
                        key: 'firepower',
                        label: 'Weapon Damage',
                        next: '+10% All Weapon DMG',
                      },
                      {
                        key: 'reloadSpeed',
                        label: 'Reload Speed',
                        next: '+9% Reload & +3% Rate',
                      },
                      {
                        key: 'agility',
                        label: 'Movement Speed',
                        next: '+8% Walk Speed',
                      },
                    ] as const
                  ).map((sk, idx) => {
                    const lv = saveData.skills[sk.key];
                    const canUpg = saveData.skillPoints > 0 && lv < 5;
                    const active = menuCursor === idx;
                    return (
                      <button tabIndex={-1}
                        key={sk.key}
                        onClick={() => {
                          setCursorSync(idx);
                          handleUpgradeSkill(sk.key);
                        }}
                        className={`w-full text-left px-1.5 py-1 border text-[11px] leading-none font-mono-tabular flex justify-between items-center ${
                          active
                            ? 'bg-[#0e2a3d]/95 border-cyan-400 border-l-4'
                            : 'bg-[#0b111a] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-white">
                            {sk.label} <span className="text-cyan-300">Lv.{lv}/5</span>
                          </div>
                          <div className="text-slate-400 text-[9px] leading-tight">Next: {sk.next}</div>
                        </div>
                        <span
                          className={
                            lv >= 5
                              ? 'text-slate-500 font-bold'
                              : canUpg
                              ? 'text-emerald-400 font-bold'
                              : 'text-amber-500 font-bold'
                          }
                        >
                          {lv >= 5 ? 'MAX' : canUpg ? '1 SP ▸' : 'NEED 1 SP'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="h-[20px] bg-[#0d141f] -mx-1.5 -mb-1.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('LSK')}>LSK:Switch Tab</button>
                <span className="text-cyan-400 font-bold">
                  {profileTab === 'skills' ? 'OK:Upgrade' : 'OK:Skills'}
                </span>
                <button tabIndex={-1} onClick={() => navigateToScreen('TITLE')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 8: SETTINGS MENU (Audio, Gameplay, Display, Data) */}
          {screenMode === 'SETTINGS' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-0.5">
                <div className="text-[13px] leading-none font-mono-tabular text-cyan-400 font-bold mb-1">
                  SYSTEM CONFIGURATION
                </div>
                <div className="flex gap-0.5">
                  {(
                    [
                      { id: 'audio', label: 'AUDIO' },
                      { id: 'gameplay', label: 'GAME' },
                      { id: 'display', label: 'DISPLAY' },
                      { id: 'data', label: 'DATA' },
                    ] as const
                  ).map((tab) => (
                    <button tabIndex={-1}
                      key={tab.id}
                      onClick={() => {
                        setSettingsTab(tab.id);
                        setCursorSync(0);
                      }}
                      className={`flex-1 py-[5px] text-[11px] leading-none font-mono-tabular text-center ${
                        settingsTab === tab.id
                          ? 'bg-cyan-700 text-white font-bold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {shopNotice && (
                <div className="bg-emerald-950/90 border border-emerald-400 px-1 py-[6px] text-[9px] font-mono-tabular text-emerald-200 text-center">
                  {shopNotice}
                </div>
              )}

              <div className="flex flex-col gap-1 my-auto">
                {settingsTab === 'audio' &&
                  [
                    { label: 'Master Volume', value: `${saveData.masterVolume}%` },
                    { label: 'Music Volume', value: `${saveData.musicVolume}%` },
                    { label: 'Sound Effects Volume', value: `${saveData.sfxVolume}%` },
                    { label: 'Audio Mute Status', value: saveData.soundEnabled ? 'ACTIVE' : 'MUTED' },
                    {
                      label: 'Sound Test (Beep)',
                      value: soundFX.getAudioStateShort() + ' ' + soundFX.audioBackend + ' ▸',
                    },
                  ].map((row, idx) => (
                    <button tabIndex={-1}
                      key={row.label}
                      onClick={() => {
                        setCursorSync(idx);
                        handleSettingsAction('audio', idx);
                      }}
                      className={`w-full text-left px-2 py-[5px] border text-[12px] leading-none font-mono-tabular flex justify-between items-center ${
                        menuCursor === idx
                          ? 'bg-[#0e2a3d]/95 border-cyan-400 text-white font-bold'
                          : 'bg-[#0b111a] border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{row.label}</span>
                      <span className="text-cyan-300 font-bold">{row.value}</span>
                    </button>
                  ))}

                {settingsTab === 'audio' && (
                  <div className="bg-[#0b111a] border border-slate-800 px-2 py-1 text-[10px] leading-tight font-mono-tabular text-slate-300">
                    DIAG: {soundFX.audioBackend} · {soundFX.getAudioStateShort()} · M
                    {saveData.masterVolume}% Mu{saveData.musicVolume}% SFX
                    {saveData.sfxVolume}% · {soundFX.lastSoundTest}
                  </div>
                )}

                {settingsTab === 'gameplay' &&
                  [
                    { label: 'Auto-Fire System', value: 'ACTIVE (LOS Lock)' },
                    { label: 'Keypad Navigation', value: '8-Way Isometric' },
                    { label: 'Keypad Control Guide', value: 'OPEN GUIDE ▸' },
                  ].map((row, idx) => (
                    <button tabIndex={-1}
                      key={row.label}
                      onClick={() => {
                        setCursorSync(idx);
                        handleSettingsAction('gameplay', idx);
                      }}
                      className={`w-full text-left px-2 py-[5px] border text-[12px] leading-none font-mono-tabular flex justify-between items-center ${
                        menuCursor === idx
                          ? 'bg-[#0e2a3d]/95 border-cyan-400 text-white font-bold'
                          : 'bg-[#0b111a] border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{row.label}</span>
                      <span className="text-cyan-300 font-bold">{row.value}</span>
                    </button>
                  ))}

                {settingsTab === 'display' &&
                  [
                    {
                      label: 'Screen Brightness',
                      value:
                        saveData.brightnessLevel === 2
                          ? 'BRIGHT'
                          : saveData.brightnessLevel === 0
                          ? 'DARK'
                          : 'STANDARD',
                    },
                    {
                      label: 'Particle Effects',
                      value: saveData.particlesEnabled ? 'ENABLED' : 'OFF',
                    },
                    {
                      label: 'Screen Shake',
                      value: saveData.screenShakeEnabled ? 'ENABLED' : 'OFF',
                    },
                    {
                      label: 'Tactical Flashlight (*)',
                      value: saveData.flashlightOn ? 'ON' : 'OFF',
                    },
                    {
                      label: 'Perf Monitor (Debug)',
                      value: saveData.showPerfOverlay ? 'ON' : 'OFF',
                    },
                  ].map((row, idx) => (
                    <button tabIndex={-1}
                      key={row.label}
                      onClick={() => {
                        setCursorSync(idx);
                        handleSettingsAction('display', idx);
                      }}
                      className={`w-full text-left px-2 py-[5px] border text-[12px] leading-none font-mono-tabular flex justify-between items-center ${
                        menuCursor === idx
                          ? 'bg-[#0e2a3d]/95 border-cyan-400 text-white font-bold'
                          : 'bg-[#0b111a] border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{row.label}</span>
                      <span className="text-cyan-300 font-bold">{row.value}</span>
                    </button>
                  ))}

                {settingsTab === 'data' &&
                  [
                    {
                      label: 'Save Status: LocalStorage Synced',
                      value: 'SAVE NOW',
                      danger: false,
                    },
                    {
                      label: 'Reset Game Data (Requires Confirm)',
                      value: 'RESET ▸',
                      danger: true,
                    },
                  ].map((row, idx) => (
                    <button tabIndex={-1}
                      key={row.label}
                      onClick={() => {
                        setCursorSync(idx);
                        handleSettingsAction('data', idx);
                      }}
                      className={`w-full text-left px-2 py-[5px] border text-[12px] leading-none font-mono-tabular flex justify-between items-center ${
                        menuCursor === idx
                          ? row.danger
                            ? 'bg-rose-950/90 border-rose-500 text-white font-bold'
                            : 'bg-[#0e2a3d]/95 border-cyan-400 text-white font-bold'
                          : 'bg-[#0b111a] border-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{row.label}</span>
                      <span className={row.danger ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {row.value}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-1.5 -mb-1.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('LSK')}>LSK:Next Tab</button>
                <span className="text-cyan-400 font-bold">OK:Change</span>
                <button tabIndex={-1} onClick={() => triggerKaiKey('RSK')}>RSK:Back</button>
              </div>
            </div>
          )}

          {/* OVERLAY 9: SURVIVAL RESULT SCREEN */}
          {screenMode === 'SURVIVAL_OVER' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1 text-center">
                <div className="font-display text-[16px] leading-none font-bold tracking-wide text-amber-400">
                  SURVIVAL RUN COMPLETE
                </div>
                <div className="text-[9px] font-mono-tabular text-slate-400">
                  {SURVIVAL_ARENA_MISSION.title}
                </div>
              </div>

              <div className="bg-[#0b111a] border border-slate-800 p-1.5 text-[11px] leading-none font-mono-tabular space-y-1.5 my-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Wave Reached:</span>
                  <span className="text-amber-300 font-bold">Wave {hud.wave}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Best Survival Wave:</span>
                  <span className="text-cyan-400 font-bold">Wave {saveData.survivalBestWave}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostiles Eliminated:</span>
                  <span className="text-white font-bold">
                    {engineRef.current?.missionKills ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Survival Score:</span>
                  <span className="text-amber-400 font-bold">{hud.score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Credits Earned:</span>
                  <span className="text-emerald-400 font-bold">
                    +${engineRef.current?.missionCreditsEarned ?? 0}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button tabIndex={-1}
                  onClick={startSurvivalRun}
                  className="w-full py-[6px] bg-amber-500 hover:bg-amber-400 text-slate-950 text-[12px] leading-none font-mono-tabular font-bold"
                >
                  ▸ Deploy New Survival Run
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('SHOP')}
                  className="w-full py-[6px] bg-slate-800 hover:bg-slate-700 text-white text-[11px] leading-none font-mono-tabular font-bold"
                >
                  ▸ Open Supply Shop
                </button>
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-2.5 -mb-2.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={startSurvivalRun}>Replay</button>
                <span className="text-cyan-400 font-bold">OK:Retry</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('TITLE')}>Main Menu</button>
              </div>
            </div>
          )}

          {/* OVERLAY 10: VICTORY / GAME OVER */}
          {(screenMode === 'VICTORY' || screenMode === 'GAME_OVER') && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1 text-center">
                <div
                  className={`font-display text-[16px] leading-none font-bold tracking-wide ${
                    screenMode === 'VICTORY' ? 'text-emerald-400' : 'text-rose-500'
                  }`}
                >
                  {screenMode === 'VICTORY' ? 'MISSION ACCOMPLISHED' : 'MARINE KIA — MISSION FAILED'}
                </div>
                <div className="text-[9px] font-mono-tabular text-slate-400">
                  {MISSIONS.find((m) => m.id === selectedMissionId)?.title}
                </div>
              </div>

              <div className="bg-[#0b111a] border border-slate-800 p-1.5 text-[11px] leading-none font-mono-tabular space-y-1.5 my-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostiles Eliminated:</span>
                  <span className="text-white font-bold">
                    {engineRef.current?.missionKills ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Combat Score:</span>
                  <span className="text-amber-400 font-bold">{hud.score}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Credits Earned:</span>
                  <span className="text-emerald-400 font-bold">
                    +${engineRef.current?.missionCreditsEarned ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Marine Rank:</span>
                  <span className="text-cyan-400 font-bold">
                    Lv.{saveData.level} ({saveData.skillPoints} SP)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {screenMode === 'VICTORY' && (engineRef.current?.pendingNextLevel ?? 0) > 0 && (
                  <button tabIndex={-1}
                    onClick={() =>
                      startMissionLevelById(selectedMissionId, engineRef.current?.pendingNextLevel || 1)
                    }
                    className="w-full py-[6px] bg-emerald-700 hover:bg-emerald-600 text-white text-[12px] leading-none font-mono-tabular font-bold"
                  >
                    ▸ Next Level (L{engineRef.current?.pendingNextLevel}/{hud.missionLevelCount})
                  </button>
                )}
                {screenMode === 'VICTORY' &&
                  (engineRef.current?.pendingNextLevel ?? 0) === 0 &&
                  selectedMissionId < MISSIONS.length && (
                    <button tabIndex={-1}
                      onClick={() => startMissionById(selectedMissionId + 1)}
                      className="w-full py-[6px] bg-emerald-700 hover:bg-emerald-600 text-white text-[12px] leading-none font-mono-tabular font-bold"
                    >
                      ▸ Next Mission (M-0{selectedMissionId + 1})
                    </button>
                  )}
                <button tabIndex={-1}
                  onClick={() => startMissionLevelById(selectedMissionId, hud.missionLevel)}
                  className="w-full py-[6px] bg-sky-800 hover:bg-sky-700 text-white text-[12px] leading-none font-mono-tabular font-bold"
                >
                  ▸ Replay Level L{hud.missionLevel}
                </button>
              </div>

              <div className="h-[20px] bg-[#0d141f] -mx-2.5 -mb-2.5 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => startMissionLevelById(selectedMissionId, hud.missionLevel)}>Replay</button>
                <span className="text-cyan-400 font-bold">OK:Continue</span>
                <button tabIndex={-1} onClick={() => navigateToScreen('MISSION_SELECT')}>Missions</button>
              </div>
            </div>
          )}

          {/* OVERLAY 11: CONTROLS HELP */}
          {screenMode === 'CONTROLS_HELP' && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-[#060a10]/96 flex flex-col justify-between p-2 text-slate-100">
              <div className="border-b border-sky-900/70 pb-1 text-[13px] leading-none font-mono-tabular font-bold text-cyan-400">
                KAIOS 2.5.3.2 KEYPAD CONTROLS
              </div>
              <div className="text-[10px] leading-tight font-mono-tabular space-y-1 my-auto text-slate-300">
                <div>
                  <span className="text-white font-bold">D-Pad / Arrows / WASD:</span> 8-Way
                  Isometric Movement & Menu Selection
                </div>
                <div>
                  <span className="text-emerald-400 font-bold">Auto-Fire System:</span> Automatically
                  aims & fires at nearest alien in Line-of-Sight
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">OK / Enter / 5:</span> Hack Terminal /
                  Open Blast Door / Activate Turret / Extract / Reload
                </div>
                <div>
                  <span className="text-amber-400 font-bold">Keys 1, 2, 3, 4 / #:</span> Switch Weapon
                </div>
                <div>
                  <span className="text-orange-400 font-bold">Keys 7 / 8 / 9:</span> Frag Grenade (7)
                  / Nano-Med Stim (8) / Combat Overdrive (9)
                </div>
                <div>
                  <span className="text-white font-bold">LSK / 0 / RSK:</span> Pause Menu (LSK/0) /
                  Armory & Back (RSK)
                </div>
                <div>
                  <span className="text-white font-bold">* (Star) / M:</span> Flashlight / Audio Mute
                </div>
              </div>
              <div className="h-[20px] bg-[#0d141f] -mx-2 -mb-2 px-2 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 border-t border-slate-800">
                <button tabIndex={-1} onClick={() => triggerKaiKey('RSK')}>Back</button>
                <span className="text-cyan-400 font-bold">OK:Return</span>
                <span>E241S</span>
              </div>
            </div>
          )}

          {/* CONFIRMATION MODAL DIALOG (Restart / Quit / New Campaign / Reset Data) */}
          {confirmDialog && (
            <div className="absolute inset-0 ms-panel border border-cyan-900/60 bg-black/85 flex flex-col items-center justify-center p-3 z-30">
              <div className="w-full bg-[#0b111a] border-2 border-amber-400 p-2.5 text-center font-mono-tabular space-y-2">
                <div className="text-[11px] font-bold text-amber-400">
                  {confirmDialog === 'RESET_DATA'
                    ? 'CONFIRM DATA RESET'
                    : confirmDialog === 'RESTART_MISSION'
                    ? 'RESTART MISSION?'
                    : confirmDialog === 'NEW_CAMPAIGN'
                    ? 'START NEW CAMPAIGN?'
                    : 'RETURN TO MAIN MENU?'}
                </div>
                <p className="text-[9px] text-slate-300 leading-snug">
                  {confirmDialog === 'RESET_DATA'
                    ? 'All credits, unlocked weapons, skills and mission records will be permanently erased.'
                    : confirmDialog === 'RESTART_MISSION'
                    ? 'Current mission progress will be lost. Restart sector from Wave 1?'
                    : confirmDialog === 'NEW_CAMPAIGN'
                    ? 'Deploy to Mission 01 (Outpost Perimeter) from the beginning?'
                    : 'Leave active combat and return to the Main Menu?'}
                </p>
                <div className="flex gap-2 pt-1">
                  <button tabIndex={-1}
                    onClick={executeConfirmDialog}
                    className="flex-1 py-[6px] bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px]"
                  >
                    OK: Confirm
                  </button>
                  <button tabIndex={-1}
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-[6px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px]"
                  >
                    RSK: Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Native 1x 240x320 Mode:
  if (viewportScale === '1x') {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden relative">
        {renderKaiOsScreen()}
        {!isNativeSmallScreen && (
          <button tabIndex={-1}
            onClick={() => setViewportScale('handset')}
            className="fixed top-3 right-3 px-2.5 py-[6px] text-xs font-mono-tabular text-slate-300 hover:text-white bg-slate-900/90 border border-slate-700 rounded"
          >
            Exit 1:1 Native 240×320 Mode
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d11] text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800/80 bg-[#0b1016]">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            navigateToScreen('TITLE');
            setActiveWorkspaceSection('game');
          }}
          className="font-display text-xl font-bold tracking-wide text-white whitespace-nowrap shrink-0"
        >
          MS ALIEN SHOOTER
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button tabIndex={-1}
            onClick={() => {
              navigateToScreen('PLAYING');
              setActiveWorkspaceSection('game');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'PLAYING' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Combat Simulator
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('TITLE')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'TITLE' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Main Menu
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('MISSION_SELECT')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'MISSION_SELECT' || screenMode === 'SURVIVAL_MENU'
                ? 'text-white underline underline-offset-4'
                : ''
            }`}
          >
            Missions & Survival
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('ARMORY')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'ARMORY' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Armory
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('SHOP')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'SHOP' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Shop
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('PROFILE')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'PROFILE' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Profile
          </button>
          <button tabIndex={-1}
            onClick={() => navigateToScreen('SETTINGS')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              screenMode === 'SETTINGS' ? 'text-white underline underline-offset-4' : ''
            }`}
          >
            Settings
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="./MS-Alien-Shooter-Phase8-Final.zip"
            download="MS-Alien-Shooter-Phase8-Final.zip"
            className="px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/60 hover:bg-emerald-900 rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Download MS-Alien-Shooter-Phase8-Final.zip containing source code and full dist/ production folder"
          >
            <span>⬇ Download Phase 8 ZIP</span>
          </a>
          <button tabIndex={-1}
            onClick={() => startMissionById(selectedMissionId)}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-600 rounded transition-colors whitespace-nowrap shrink-0"
          >
            Deploy Mission 0{selectedMissionId}
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* PROMINENT DIRECT DOWNLOAD BANNER */}
        <div className="mb-6 p-4 bg-emerald-950/80 border-2 border-emerald-500/80 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 text-emerald-100 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900 border border-emerald-400/60 flex items-center justify-center text-xl shrink-0">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">MS-Alien-Shooter-Phase8-Final.zip</span>
                <span className="bg-emerald-900 text-emerald-300 border border-emerald-500/50 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
                  183.7 KB
                </span>
              </div>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Complete Project Archive: Full TypeScript Source + KaiOS Gecko 48 Production Build (<code className="bg-emerald-950 px-1 py-0.5 rounded text-white font-mono">dist/</code>) + Icons & Manifest.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <button tabIndex={-1}
              onClick={handleDownloadZip}
              className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-slate-950 font-bold text-xs rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⬇ Download ZIP (183.7 KB)</span>
            </button>
            <a
              href="./download"
              download="MS-Alien-Shooter-Phase8-Final.zip"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-600/50 text-xs font-semibold rounded-lg transition text-center whitespace-nowrap"
            >
              Direct Link
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT / CENTER COLUMN: ENERGIZER E241S KAIOS HANDSET OR 2X VIEWPORT */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-4">
              <button tabIndex={-1}
                onClick={() => setViewportScale('handset')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewportScale === 'handset'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                E241S Handset (240×320)
              </button>
              <button tabIndex={-1}
                onClick={() => setViewportScale('2x')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewportScale === '2x'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2× Crisp Pixel (480×640)
              </button>
              <button tabIndex={-1}
                onClick={() => setViewportScale('1x')}
                className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white rounded transition-colors whitespace-nowrap shrink-0"
              >
                1:1 Native Only
              </button>
            </div>

            {viewportScale === 'handset' ? (
              <div className="bg-[#141922] border border-slate-700/80 rounded-[28px] p-4 shadow-2xl flex flex-col items-center w-[284px]">
                <div className="w-full flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-2 px-2">
                  <span>ENERGIZER E241S</span>
                  <div className="w-10 h-1 bg-slate-700 rounded-full" />
                  <span>KAIOS 2.5.3</span>
                </div>

                <div className="p-1.5 bg-black rounded-md border border-slate-800">
                  {renderKaiOsScreen()}
                </div>

                <div className="w-full mt-3 space-y-2 select-none">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex flex-col gap-1.5">
                      <button tabIndex={-1}
                        onClick={() => triggerKaiKey('LSK')}
                        className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-600 rounded text-[10px] font-mono-tabular font-bold text-slate-200"
                      >
                        LSK (Soft L)
                      </button>
                      <button tabIndex={-1}
                        onClick={() => navigateToScreen('TITLE')}
                        className="h-7 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[9px] font-mono-tabular text-cyan-400"
                      >
                        MAIN MENU
                      </button>
                    </div>

                    <div className="relative w-[84px] h-[84px] mx-auto bg-slate-900 border-2 border-slate-600 rounded-xl flex items-center justify-center">
                      <button tabIndex={-1}
                        onMouseDown={() => setMoveDir('up', true)}
                        onMouseUp={() => setMoveDir('up', false)}
                        onMouseLeave={() => setMoveDir('up', false)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setMoveDir('up', true);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          setMoveDir('up', false);
                        }}
                        className="absolute top-0.5 left-1/2 -translate-x-1/2 w-7 h-6 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded-t text-[10px] text-white flex items-center justify-center"
                      >
                        ▲
                      </button>
                      <button tabIndex={-1}
                        onMouseDown={() => setMoveDir('down', true)}
                        onMouseUp={() => setMoveDir('down', false)}
                        onMouseLeave={() => setMoveDir('down', false)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setMoveDir('down', true);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          setMoveDir('down', false);
                        }}
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-7 h-6 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded-b text-[10px] text-white flex items-center justify-center"
                      >
                        ▼
                      </button>
                      <button tabIndex={-1}
                        onMouseDown={() => setMoveDir('left', true)}
                        onMouseUp={() => setMoveDir('left', false)}
                        onMouseLeave={() => setMoveDir('left', false)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setMoveDir('left', true);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          setMoveDir('left', false);
                        }}
                        className="absolute left-0.5 top-1/2 -translate-y-1/2 w-6 h-7 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded-l text-[10px] text-white flex items-center justify-center"
                      >
                        ◄
                      </button>
                      <button tabIndex={-1}
                        onMouseDown={() => setMoveDir('right', true)}
                        onMouseUp={() => setMoveDir('right', false)}
                        onMouseLeave={() => setMoveDir('right', false)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setMoveDir('right', true);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          setMoveDir('right', false);
                        }}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-7 bg-slate-800 hover:bg-slate-700 active:bg-sky-700 rounded-r text-[10px] text-white flex items-center justify-center"
                      >
                        ►
                      </button>
                      <button tabIndex={-1}
                        onClick={() => triggerKaiKey('OK')}
                        className="w-8 h-8 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-950 font-bold text-[10px] font-mono-tabular rounded-md shadow"
                      >
                        OK
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button tabIndex={-1}
                        onClick={() => triggerKaiKey('RSK')}
                        className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-600 rounded text-[10px] font-mono-tabular font-bold text-slate-200"
                      >
                        RSK (Back)
                      </button>
                      <button tabIndex={-1}
                        onClick={() => navigateToScreen('SHOP')}
                        className="h-7 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[9px] font-mono-tabular text-emerald-400"
                      >
                        SHOP
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('1')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-amber-400">1</span>
                      <span className="text-[8px] text-slate-300">PISTOL</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('2')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-sky-400">2</span>
                      <span className="text-[8px] text-slate-300">A.RIFLE</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('3')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-orange-400">3</span>
                      <span className="text-[8px] text-slate-300">SHOTGUN</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('4')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-emerald-400">4</span>
                      <span className="text-[8px] text-slate-300">PLASMA</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('OK')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-white">5</span>
                      <span className="text-[8px] text-slate-300">ACTION</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('HASH')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-amber-300">#</span>
                      <span className="text-[8px] text-slate-300">CYCLE</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('7')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-orange-400">7</span>
                      <span className="text-[8px] text-slate-300">FRAG({hud.grenades})</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('8')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-emerald-400">8</span>
                      <span className="text-[8px] text-slate-300">STIM({hud.medkits})</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('9')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-sky-400">9</span>
                      <span className="text-[8px] text-slate-300">BOOST({hud.overdrives})</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('STAR')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-sky-300">*</span>
                      <span className="text-[8px] text-slate-300">LIGHT</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => triggerKaiKey('0')}
                      className="h-7 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded text-[10px] font-mono-tabular text-white flex items-center justify-between px-2"
                    >
                      <span className="font-bold text-slate-300">0</span>
                      <span className="text-[8px] text-slate-300">PAUSE</span>
                    </button>
                    <button tabIndex={-1}
                      onClick={() => navigateToScreen('SETTINGS')}
                      className="h-7 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[8px] font-mono-tabular text-slate-300 hover:text-cyan-300"
                    >
                      SETTINGS
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {renderKaiOsScreen()}
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('LSK')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular rounded"
                  >
                    LSK: Pause / Tab
                  </button>
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('OK')}
                    className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono-tabular rounded"
                  >
                    OK: Action / Select
                  </button>
                  <button tabIndex={-1}
                    onClick={() => triggerKaiKey('RSK')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular rounded"
                  >
                    RSK: Armory / Back
                  </button>
                  <button tabIndex={-1}
                    onClick={() => navigateToScreen('TITLE')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono-tabular rounded"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: TACTICAL COMMAND DASHBOARD */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-[#0e141d] border border-slate-800 rounded-xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs text-slate-400">
                    Active Operation · Isometric Diamond-Tile Engine · Auto-Fire Combat
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-wide text-white mt-0.5">
                    {hud.gameMode === 'SURVIVAL'
                      ? SURVIVAL_ARENA_MISSION.title
                      : MISSIONS.find((m) => m.id === selectedMissionId)?.title}
                  </h2>
                </div>
                <div className="text-xs font-mono-tabular text-slate-300">
                  <span>Marine Lv.{saveData.level}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-emerald-400 font-semibold">${saveData.credits} Credits</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span>High Score: {saveData.highScore}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('TITLE')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Main Menu
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('MISSION_SELECT')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Missions
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('SURVIVAL_MENU')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Survival Mode
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('ARMORY')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Armory
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('SHOP')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Shop
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('PROFILE')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Player Profile
                </button>
                <button tabIndex={-1}
                  onClick={() => navigateToScreen('SETTINGS')}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Settings
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 font-mono-tabular">
                <div>
                  <div className="text-xs text-slate-400">Vitality & Armor</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {hud.hp}/{hud.maxHp} HP · {hud.armor} AR
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Equipped Weapon</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {WEAPONS[hud.weapon].shortName} ({hud.clipAmmo}/
                    {hud.infiniteAmmo ? '∞' : hud.reserveAmmo})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Swarm Progress</div>
                  <div className="text-base font-bold text-rose-400 mt-0.5">
                    Wave {hud.wave}/{hud.totalWaves} · {hud.enemiesRemaining} Left
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Auto-Targeting</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {hud.autoTargetLocked ? 'Target Locked' : 'Scanning LOS'}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#0e141d] border border-slate-800 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base font-semibold text-white">
                  01. Tactical Campaign Sectors & Endless Survival Mode
                </h3>
                <button tabIndex={-1}
                  onClick={startSurvivalRun}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                >
                  Deploy Endless Survival Arena (Best: W-{saveData.survivalBestWave})
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MISSIONS.map((m) => {
                  const unlocked = m.id <= saveData.unlockedMission;
                  const completed = saveData.completedMissions.includes(m.id);
                  const isCurrent = hud.gameMode === 'CAMPAIGN' && m.id === selectedMissionId;
                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-slate-900/90 border-sky-500/80'
                          : 'bg-[#090d11] border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between text-xs font-mono-tabular text-slate-400">
                          <span>
                            {m.code} · {m.location}
                          </span>
                          <span className={completed ? 'text-emerald-400' : 'text-slate-500'}>
                            {completed ? 'Completed ✓' : unlocked ? 'Unlocked' : 'Locked'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">{m.title}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {m.totalWaves} Waves · Reward ${m.rewardCredits} · {m.rewardXp} XP
                        </div>
                      </div>
                      <button tabIndex={-1}
                        onClick={() => {
                          if (unlocked) startMissionById(m.id);
                        }}
                        disabled={!unlocked}
                        className={`mt-3 w-full py-1.5 px-3 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          !unlocked
                            ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                            : isCurrent
                            ? 'bg-sky-700 hover:bg-sky-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {!unlocked ? 'Sector Locked' : isCurrent ? 'Restart Sector' : 'Deploy Sector'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-[#0e141d] border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white">
                  02. Military Weapons & Auto-Fire Specs
                </h3>
                <span className="text-xs text-slate-400">
                  Press keys 1–4 or # to switch during combat
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {WEAPON_ORDER.map((wId) => {
                  const spec = WEAPONS[wId];
                  const unlocked = saveData.unlockedWeapons[wId];
                  const lv = saveData.weaponLevels[wId];
                  const dmg = getEffectiveWeaponDamage(wId, lv, saveData.skills.firepower);
                  const upgCost = Math.round(spec.upgradeBaseCost * Math.pow(1.45, lv - 1));
                  const isEquipped = hud.weapon === wId;

                  return (
                    <div
                      key={wId}
                      className={`p-3 rounded-lg border ${
                        isEquipped
                          ? 'bg-slate-900 border-amber-500/70'
                          : 'bg-[#090d11] border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          [{spec.keySlot}] {spec.name}
                        </span>
                        <span className="text-xs font-mono-tabular text-amber-400">
                          Lv.{lv} · {dmg} DMG
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono-tabular">
                        Range: {spec.range}m · Rate: {Math.round(1000 / spec.fireRateMs)}/s · Ammo:{' '}
                        {spec.infiniteAmmo ? 'Infinite' : saveData.ammoInventory[wId]}
                      </div>
                      <div className="flex items-center gap-2 mt-2.5">
                        {unlocked && (
                          <button tabIndex={-1}
                            onClick={() => engineRef.current?.switchWeapon(wId)}
                            className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 ${
                              isEquipped
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        )}
                        <button tabIndex={-1}
                          onClick={() => handleUpgradeWeapon(wId)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 whitespace-nowrap shrink-0"
                        >
                          {!unlocked
                            ? `Unlock ($${spec.unlockCost})`
                            : lv < 6
                            ? `Upgrade ($${upgCost})`
                            : 'Max Level'}
                        </button>
                        {unlocked && !spec.infiniteAmmo && (
                          <button tabIndex={-1}
                            onClick={() => handleBuyAmmo(wId)}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 whitespace-nowrap shrink-0"
                          >
                            +Ammo (${wId === 'rifle' ? 45 : wId === 'shotgun' ? 50 : 85})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
