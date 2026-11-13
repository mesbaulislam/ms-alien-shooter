import { SaveData, WeaponId } from './types';

export type MusicTrackMode = 'menu' | 'campaign' | 'survival' | 'boss';

// STEP 2: 0.3s 660Hz sine WAV, generated procedurally, no external audio file.
const SOUND_TEST_WAV_B64 = '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';

class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public bgmEnabled = true;
  public isPaused = false;
  public masterVolume = 0.8;
  public musicVolume = 0.7;
  public sfxVolume = 0.85;
  public currentMusicTrack: MusicTrackMode = 'campaign';
  public activeVoiceCount = 0;
  public bgmNotesPlayed = 0;
  public soundEventLog: string[] = [];

  private bgmStepTimerMs = 0;
  private bgmStepIndex = 0;
  private lastBgmNoteTimestamp = 0;
  private lastSoundTimeMap: Record<string, number> = {};
  private readonly maxConcurrentVoices = 12;
  public audioBackend: string = 'none';
  public lastSoundTest: string = 'NOT TESTED';

  public applySettings(save: SaveData): void {
    this.enabled = save.soundEnabled;
    this.masterVolume = Math.max(0, Math.min(1, (save.masterVolume ?? 75) / 100));
    this.musicVolume = Math.max(0, Math.min(1, (save.musicVolume ?? 75) / 100));
    this.sfxVolume = Math.max(0, Math.min(1, (save.sfxVolume ?? 75) / 100));
  }

  public getSfxScale(): number {
    if (!this.enabled) return 0;
    return this.masterVolume * this.sfxVolume;
  }

  public getMusicScale(): number {
    if (!this.enabled || !this.bgmEnabled) return 0;
    return this.masterVolume * this.musicVolume;
  }

  public pauseAudio(): void {
    this.isPaused = true;
    this.bgmStepTimerMs = 0;
    if (this.ctx && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
      try {
        const r = this.ctx.suspend() as unknown as { catch?: (f: () => void) => void };
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        // Gecko 48 may not return a promise here; suspend is best-effort.
      }
    }
  }

  public resumeAudio(): void {
    this.isPaused = false;
    if (
      this.enabled &&
      this.masterVolume > 0 &&
      this.ctx &&
      this.ctx.state === 'suspended' &&
      typeof this.ctx.resume === 'function'
    ) {
      try {
        const r = this.ctx.resume() as unknown as { catch?: (f: () => void) => void };
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        // Resume from a non-gesture tick may be ignored; a later key
        // gesture (unlockFromGesture) is the authoritative unlock.
      }
    }
  }

  /**
   * STEP 1 FIX (Bug 5): must be called from a real user gesture
   * (keydown/click). KaiOS/Gecko keeps an AudioContext created from a
   * requestAnimationFrame tick suspended, and rAF resume attempts are
   * ignored, which is why the old build was silent in gameplay even
   * though the sound code itself was present. This creates/resumes
   * the context inside the gesture, so later menu, weapon and music
   * calls can actually play.
   */
  public unlockFromGesture(): void {
    if (!this.enabled || this.masterVolume <= 0) return;
    this.isPaused = false;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try {
        const r = ctx.resume() as unknown as { catch?: (f: () => void) => void };
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        // The next gesture will retry.
      }
    }
  }

  /** STEP 2: expose total-silence diagnosis for the Settings Sound Test. */
  public getAudioState(): {
    backend: string;
    ctxState: string;
    enabled: boolean;
    master: number;
    music: number;
    sfx: number;
    lastTest: string;
  } {
    return {
      backend: this.audioBackend,
      ctxState: this.ctx ? this.ctx.state : 'no-context',
      enabled: this.enabled,
      master: Math.round(this.masterVolume * 100),
      music: Math.round(this.musicVolume * 100),
      sfx: Math.round(this.sfxVolume * 100),
      lastTest: this.lastSoundTest,
    };
  }

  public getAudioStateShort(): string {
    const st = this.getAudioState();
    if (!st.enabled) return 'MUTED';
    if (st.master <= 0) return 'MASTER 0%';
    return st.ctxState.toUpperCase();
  }

  /**
   * STEP 2 Sound Test: WebAudio beep first. If the context is still not
   * running after a gesture, try a plain HTML Audio element (data-URI WAV
   * beep, no external file). Never claims success unless a path was tried
   * and the context/state was recorded; device hearing is still the test.
   */
  public testSound(): string {
    if (!this.enabled) {
      this.lastSoundTest = 'MUTED: soundEnabled OFF';
      return this.lastSoundTest;
    }
    if (this.masterVolume <= 0) {
      this.lastSoundTest = 'MUTED: Master 0%';
      return this.lastSoundTest;
    }
    this.unlockFromGesture();
    // Bypass the per-tag rate limiter for an explicit test.
    this.lastSoundTimeMap['ui_beep_hi'] = 0;
    this.playUiBeep(true);
    const state = this.ctx ? this.ctx.state : 'no-context';
    if (state === 'running') {
      // STEP 3: include backend + volumes so the device report is
      // useful, not just 'tried'. Hearing is still the real test.
      this.lastSoundTest = 'WEBAUDIO RUNNING (' + this.audioBackend + ') M' + Math.round(this.masterVolume * 100) + '/Mu' + Math.round(this.musicVolume * 100) + '/SFX' + Math.round(this.sfxVolume * 100) + ': beep played - report if heard';
      return this.lastSoundTest;
    }
    // Fallback path: HTML Audio element.
    try {
      if (typeof window !== 'undefined' && typeof (window as unknown as { Audio?: unknown }).Audio !== 'undefined') {
        const AudioCtor = (window as unknown as { Audio: new (src?: string) => { play: () => unknown; volume: number } }).Audio;
        const el = new AudioCtor('data:audio/wav;base64,' + SOUND_TEST_WAV_B64);
        el.volume = Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume));
        const r = el.play() as unknown as { catch?: (f: () => void) => void };
        if (r && typeof r.catch === 'function') r.catch(() => {});
        this.lastSoundTest = 'WEBAUDIO ' + state.toUpperCase() + ' (' + this.audioBackend + ') -> HTML AUDIO TRIED';
        return this.lastSoundTest;
      }
    } catch {
      // fall through
    }
    this.lastSoundTest = 'WEBAUDIO ' + state.toUpperCase() + ' (' + this.audioBackend + '), HTML AUDIO UNAVAILABLE';
    return this.lastSoundTest;
  }

  private recordEvent(tag: string): void {
    if (this.soundEventLog.length >= 40) {
      this.soundEventLog.shift();
    }
    this.soundEventLog.push(tag);
  }

  private canTriggerSfx(tag: string, minIntervalMs = 22): boolean {
    const scale = this.getSfxScale();
    if (scale <= 0.01) return false;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.lastSoundTimeMap[tag] || 0;
    if (minIntervalMs > 0 && nowMs - prev < minIntervalMs) {
      return false;
    }
    if (this.activeVoiceCount >= this.maxConcurrentVoices) {
      return false;
    }
    this.lastSoundTimeMap[tag] = nowMs;
    this.recordEvent(tag);
    return true;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.masterVolume <= 0) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      // STEP 2 total-silence diagnosis: KaiOS Gecko 48 may expose only
      // an old prefixed constructor. Try standard, webkit, then moz.
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
        mozAudioContext?: typeof AudioContext;
      };
      const AudioCtx = w.AudioContext || w.webkitAudioContext || w.mozAudioContext;
      this.audioBackend = w.AudioContext
        ? 'AudioContext'
        : w.webkitAudioContext
        ? 'webkitAudioContext'
        : w.mozAudioContext
        ? 'mozAudioContext'
        : 'missing';
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.isPaused) {
      try {
        const r = this.ctx.resume() as unknown as { catch?: (f: () => void) => void };
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        // Non-gesture resume may be ignored; unlockFromGesture retries.
      }
    }
    return this.ctx;
  }

  private startAndCleanupVoice(
    ctx: AudioContext,
    osc: OscillatorNode,
    gain: GainNode,
    now: number,
    durationSec: number
  ): void {
    this.activeVoiceCount++;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignore disconnect errors on older WebAudio engines
      }
    };
    osc.onended = cleanup;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec);
    setTimeout(cleanup, Math.ceil(durationSec * 1000) + 40);
  }

  // ==========================================
  // 1. WEAPON SOUNDS
  // ==========================================

  public playShoot(weapon: WeaponId): void {
    if (!this.canTriggerSfx(`shoot_${weapon}`, 30)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (weapon === 'pistol') {
      // Crisp Akimbo Tactical Pistol snap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(82, now + 0.07);
      gain.gain.setValueAtTime(0.14 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.07);
      this.startAndCleanupVoice(ctx, osc, gain, now, 0.075);
    } else if (weapon === 'rifle') {
      // High-velocity Pulse Rifle bark
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(115, now + 0.058);
      gain.gain.setValueAtTime(0.12 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.058);
      this.startAndCleanupVoice(ctx, osc, gain, now, 0.062);
    } else if (weapon === 'shotgun') {
      // Heavy Riot Shotgun concussive boom
      osc.type = 'square';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.145);
      gain.gain.setValueAtTime(0.21 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.145);
      this.startAndCleanupVoice(ctx, osc, gain, now, 0.15);
    } else {
      // Heavy Plasma Cannon resonant energy discharge
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.125);
      gain.gain.setValueAtTime(0.16 * scale, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.125);
      this.startAndCleanupVoice(ctx, osc, gain, now, 0.13);
    }
  }

  public playReload(): void {
    if (!this.canTriggerSfx('reload', 80)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.setValueAtTime(360, now + 0.045);
    osc.frequency.setValueAtTime(520, now + 0.085);
    gain.gain.setValueAtTime(0.1 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.13);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.135);
  }

  public playEmptyMag(): void {
    if (!this.canTriggerSfx('empty_mag', 110)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.setValueAtTime(410, now + 0.02);
    gain.gain.setValueAtTime(0.08 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.045);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.05);
  }

  public playWeaponSwitch(weapon: WeaponId = 'rifle'): void {
    if (!this.canTriggerSfx('weapon_switch', 45)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = weapon === 'plasma' ? 'sine' : 'triangle';
    const startFreq =
      weapon === 'plasma' ? 540 : weapon === 'shotgun' ? 280 : weapon === 'rifle' ? 420 : 350;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(startFreq * 1.45, now + 0.065);
    gain.gain.setValueAtTime(0.095 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.075);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.08);
  }

  // ==========================================
  // 2. COMBAT & BOSS SOUNDS
  // ==========================================

  public playAlienHit(): void {
    if (!this.canTriggerSfx('alien_hit', 28)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.045);
    gain.gain.setValueAtTime(0.075 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.045);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.05);
  }

  public playAlienDeath(isBig = false): void {
    if (!this.canTriggerSfx(isBig ? 'alien_death_big' : 'alien_death', 35)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isBig ? 150 : 290, now);
    osc.frequency.exponentialRampToValueAtTime(isBig ? 36 : 62, now + (isBig ? 0.25 : 0.13));
    gain.gain.setValueAtTime(0.125 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + (isBig ? 0.25 : 0.13));
    this.startAndCleanupVoice(ctx, osc, gain, now, isBig ? 0.26 : 0.14);
  }

  public playPlayerHit(): void {
    if (!this.canTriggerSfx('player_hit', 45)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.095);
    gain.gain.setValueAtTime(0.15 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.095);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.1);
  }

  public playArmorHit(): void {
    if (!this.canTriggerSfx('armor_hit', 45)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.065);
    gain.gain.setValueAtTime(0.11 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.065);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.07);
  }

  public playPlayerDeath(): void {
    if (!this.canTriggerSfx('player_death', 150)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.44);
    gain.gain.setValueAtTime(0.2 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.45);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.46);
  }

  public playExplosion(): void {
    if (!this.canTriggerSfx('explosion', 45)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.32);
    gain.gain.setValueAtTime(0.24 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.32);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.34);
  }

  public playGrenadeThrow(): void {
    if (!this.canTriggerSfx('grenade_throw', 60)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.085);
    gain.gain.setValueAtTime(0.1 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.09);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.095);
  }

  public playGrenadeExplode(): void {
    if (!this.canTriggerSfx('grenade_explode', 50)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.setValueAtTime(95, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.36);
    gain.gain.setValueAtTime(0.25 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.36);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.38);
  }

  public playBossAttack(): void {
    if (!this.canTriggerSfx('boss_attack', 90)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.linearRampToValueAtTime(185, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);
    gain.gain.setValueAtTime(0.16 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.23);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.24);
  }

  public playBossDeath(): void {
    if (!this.canTriggerSfx('boss_death', 150)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.setValueAtTime(130, now + 0.14);
    osc.frequency.setValueAtTime(90, now + 0.28);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.55);
    gain.gain.setValueAtTime(0.24 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.56);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.58);
  }

  public playStimUse(): void {
    if (!this.canTriggerSfx('stim_use', 60)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(660, now + 0.05);
    osc.frequency.setValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.12 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.18);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.19);
  }

  // ==========================================
  // 3. ENVIRONMENT & MISSION SOUNDS
  // ==========================================

  public playDoorOpen(): void {
    if (!this.canTriggerSfx('door_open', 60)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(185, now + 0.18);
    gain.gain.setValueAtTime(0.13 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.2);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.21);
  }

  public playDoorClose(): void {
    if (!this.canTriggerSfx('door_close', 60)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(75, now + 0.17);
    gain.gain.setValueAtTime(0.12 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.19);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.2);
  }

  public playTerminalHack(): void {
    if (!this.canTriggerSfx('terminal_hack', 60)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(740, now + 0.04);
    osc.frequency.setValueAtTime(980, now + 0.08);
    gain.gain.setValueAtTime(0.09 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.15);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.16);
  }

  public playTurretShoot(): void {
    if (!this.canTriggerSfx('turret_shoot', 45)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.048);
    gain.gain.setValueAtTime(0.085 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.05);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.055);
  }

  public playWaveIncoming(): void {
    if (!this.canTriggerSfx('wave_incoming', 100)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(360, now + 0.18);
    gain.gain.setValueAtTime(0.08 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.22);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.23);
  }

  public playLevelUp(): void {
    if (!this.canTriggerSfx('level_up', 80)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.06);
    osc.frequency.setValueAtTime(659, now + 0.12);
    osc.frequency.setValueAtTime(880, now + 0.18);
    gain.gain.setValueAtTime(0.14 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.28);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.29);
  }

  public playPickup(): void {
    if (!this.canTriggerSfx('pickup', 35)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.05);
    gain.gain.setValueAtTime(0.12 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.13);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.14);
  }

  public playMissionComplete(): void {
    if (!this.canTriggerSfx('mission_complete', 150)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392.0, now); // G4
    osc.frequency.setValueAtTime(493.88, now + 0.08); // B4
    osc.frequency.setValueAtTime(587.33, now + 0.16); // D5
    osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
    gain.gain.setValueAtTime(0.16 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.42);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.44);
  }

  public playMissionFail(): void {
    if (!this.canTriggerSfx('mission_fail', 150)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(311.13, now); // D#4
    osc.frequency.setValueAtTime(277.18, now + 0.11); // C#4
    osc.frequency.setValueAtTime(233.08, now + 0.22); // A#3
    osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.42);
    gain.gain.setValueAtTime(0.16 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.44);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.46);
  }

  public playUiBeep(high = false): void {
    if (!this.canTriggerSfx(high ? 'ui_beep_hi' : 'ui_beep_lo', 18)) return;
    const scale = this.getSfxScale();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high ? 660 : 440, now);
    // STEP 4 FIX (AUD-02): menu beep was 0.08 x scale (~0.045 at defaults);
    // raised so a menu keypress is clearly audible on a small speaker.
    gain.gain.setValueAtTime(0.14 * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.045);
    this.startAndCleanupVoice(ctx, osc, gain, now, 0.05);
  }

  // ==========================================
  // 4. MULTI-TRACK PROCEDURAL BACKGROUND MUSIC
  // ==========================================

  /**
   * Procedural Sci-Fi Synth BGM supporting Main Menu, Campaign, Survival, and Boss encounters.
   * Zero external audio assets; prevents duplicate overlapping playback on KaiOS.
   */
  public updateMusic(
    dtMs: number,
    modeOrBoss: boolean | MusicTrackMode = 'campaign'
  ): void {
    if (this.isPaused) return;
    const musicScale = this.getMusicScale();
    if (musicScale <= 0.01) return;

    const targetTrack: MusicTrackMode =
      typeof modeOrBoss === 'boolean'
        ? modeOrBoss
          ? 'boss'
          : 'campaign'
        : modeOrBoss;

    if (this.currentMusicTrack !== targetTrack) {
      this.currentMusicTrack = targetTrack;
      this.bgmStepIndex = 0;
      this.bgmStepTimerMs = 0;
    }

    const intervals: Record<MusicTrackMode, number> = {
      menu: 350,
      campaign: 290,
      survival: 240,
      boss: 200,
    };
    const interval = intervals[targetTrack];
    this.bgmStepTimerMs += Math.min(dtMs, interval);
    if (this.bgmStepTimerMs < interval) return;
    this.bgmStepTimerMs -= interval;

    // Guard against duplicate playback within the same step window
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastBgmNoteTimestamp < interval * 0.45 && this.bgmNotesPlayed > 0) {
      return;
    }
    this.lastBgmNoteTimestamp = nowMs;

    const patterns: Record<MusicTrackMode, number[]> = {
      menu: [110, 130.81, 164.81, 196.0, 220.0, 196.0, 164.81, 146.83],
      campaign: [55, 55, 0, 55, 65.41, 0, 49, 51.91],
      survival: [65.41, 73.42, 87.31, 73.42, 98.0, 87.31, 73.42, 65.41],
      boss: [55, 65.41, 73.42, 65.41, 82.41, 77.78, 61.74, 49],
    };

    const pattern = patterns[targetTrack];
    const freq = pattern[this.bgmStepIndex % pattern.length];
    this.bgmStepIndex = (this.bgmStepIndex + 1) % pattern.length;
    this.bgmNotesPlayed++;

    if (freq <= 0) return;

    // STEP 4 FIX (AUD-02): notes below 110 Hz are barely reproduced by a
    // small KaiOS phone speaker. Shift them up an octave (two octaves when
    // below 55 Hz) so the melody stays the same but becomes audible.
    const playFreq = freq < 55 ? freq * 4 : freq < 110 ? freq * 2 : freq;

    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = targetTrack === 'boss' ? 'sawtooth' : targetTrack === 'menu' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(playFreq, now);
    const noteGain = (targetTrack === 'boss' ? 0.08 : 0.09) * musicScale;
    const noteDur = targetTrack === 'menu' ? 0.24 : 0.16;
    gain.gain.setValueAtTime(noteGain, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + noteDur);
    this.startAndCleanupVoice(ctx, osc, gain, now, noteDur + 0.01);
  }
}

export const soundFX = new SoundManager();

