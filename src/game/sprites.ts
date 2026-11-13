import {
  BulletEntity,
  DecalEntity,
  EnemyEntity,
  ParticleEntity,
  TileKind,
  TurretEntity,
  WeaponId,
} from './types';

export const ISO_TILE_W = 48;
export const ISO_TILE_H = 24;
export const ISO_WALL_H = 20; // STEP 2: slimmer, modern proportions (was 26)

export type OctantDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Converts any angle in radians to an 8-way isometric direction (0 to 7)
 * 0: East, 1: South-East, 2: South, 3: South-West,
 * 4: West, 5: North-West, 6: North, 7: North-East
 */
export function angleToOctant(angle: number): OctantDirection {
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return (Math.round(norm / (Math.PI / 4)) % 8) as OctantDirection;
}

class SpriteCache {
  private tileCanvases: Map<TileKind, HTMLCanvasElement> = new Map();
  private lightingCanvases: Map<string, HTMLCanvasElement> = new Map();
  private flashlightCanvas: HTMLCanvasElement | null = null;
  private initialized = false;

  public init(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    const tileTypes: TileKind[] = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ];
    for (const kind of tileTypes) {
      this.tileCanvases.set(kind, this.bakeTile(kind));
    }
    this.flashlightCanvas = this.bakeFlashlightCone();
  }

  public getTileCanvas(kind: TileKind): HTMLCanvasElement | undefined {
    if (!this.initialized) this.init();
    return this.tileCanvases.get(kind);
  }

  private bakeFlashlightCone(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 112;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cy = 40;
    const grad = ctx.createRadialGradient(8, cy, 2, 60, cy, 56);
    grad.addColorStop(0, 'rgba(224, 242, 254, 0.32)');
    grad.addColorStop(0.7, 'rgba(224, 242, 254, 0.12)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(4, cy);
    ctx.lineTo(105, cy - 36);
    ctx.lineTo(105, cy + 36);
    ctx.closePath();
    ctx.fill();
    return canvas;
  }

  public getLightingOverlayCanvas(
    width: number,
    height: number,
    innerRadius: number,
    outerRadius: number,
    alphaStr: string
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.initialized) this.init();
    const key = `${width}x${height}_${innerRadius}_${outerRadius}_${alphaStr}`;
    const existing = this.lightingCanvases.get(key);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cx = width / 2;
    const cy = 160 - 8 - 37; // Matches NATIVE_H / 2 - 8 relative to y = 37
    const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    grad.addColorStop(0, 'rgba(5, 8, 14, 0)');
    grad.addColorStop(1, `rgba(4, 7, 12, ${alphaStr})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    this.lightingCanvases.set(key, canvas);
    return canvas;
  }

  private drawDiamond(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string
  ): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawIsoBox(
    ctx: CanvasRenderingContext2D,
    cx: number,
    baseY: number,
    w: number,
    h: number,
    boxHeight: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    strokeColor = '#090d11'
  ): void {
    const topY = baseY - boxHeight;

    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, topY);
    ctx.lineTo(cx, topY + h / 2);
    ctx.lineTo(cx, baseY + h / 2);
    ctx.lineTo(cx - w / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, topY);
    ctx.lineTo(cx, topY + h / 2);
    ctx.lineTo(cx, baseY + h / 2);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.stroke();

    // Top diamond
    this.drawDiamond(ctx, cx, topY, w, h, topColor, strokeColor);
  }

  private bakeTile(kind: TileKind): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    // Generous buffer for 3D walls, pillars, pods and terminal antennae
    canvas.width = ISO_TILE_W + 6;
    canvas.height = ISO_TILE_H + ISO_WALL_H + 14;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cx = canvas.width / 2;
    const baseY = canvas.height - ISO_TILE_H / 2 - 3;

    // 1. BASE FLOOR RENDERING
    if (kind === 0) {
      // Scorched Wasteland Perimeter (Cracked dark volcanic soil with mutant alien moss)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#151e18', '#0c120e');
      ctx.fillStyle = '#223326';
      ctx.fillRect(cx - 10, baseY - 3, 4, 2);
      ctx.fillRect(cx + 6, baseY + 1, 4, 2);
      ctx.fillStyle = '#0a0e0b';
      ctx.fillRect(cx - 3, baseY + 4, 5, 2);
      ctx.fillRect(cx + 2, baseY - 5, 3, 2);
    } else if (
      kind === 1 ||
      kind === 6 ||
      kind === 7 ||
      kind === 9 ||
      kind === 10 ||
      kind === 13 ||
      kind === 15 ||
      kind === 16
    ) {
      // Military Concrete Slab with beveled expansion seams & bolted corner plates
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#28303a', '#181e26');
      // Sub-panel division line
      ctx.strokeStyle = '#1b222b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 12, baseY);
      ctx.lineTo(cx + 12, baseY);
      ctx.stroke();
      // Bolted steel corner rivets
      ctx.fillStyle = '#3e4956';
      ctx.fillRect(cx - 14, baseY - 1, 2, 2);
      ctx.fillRect(cx + 12, baseY - 1, 2, 2);
      ctx.fillRect(cx - 1, baseY - 6, 2, 2);
      ctx.fillRect(cx - 1, baseY + 4, 2, 2);
      ctx.fillStyle = '#101418';
      ctx.fillRect(cx - 13, baseY, 1, 1);
      ctx.fillRect(cx + 13, baseY, 1, 1);
      // STEP 2: slim modular panel inset (visual only, no collision change)
      ctx.strokeStyle = '#3b4757';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, baseY);
      ctx.lineTo(cx + 8, baseY);
      ctx.stroke();
    } else if (kind === 2) {
      // Industrial Hazard Chevron Floor (Bold high-contrast angled yellow-black warning stripes)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#20241e', '#131612');
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 14, baseY - 4);
      ctx.lineTo(cx - 4, baseY + 4);
      ctx.moveTo(cx - 5, baseY - 6);
      ctx.lineTo(cx + 5, baseY + 2);
      ctx.moveTo(cx + 4, baseY - 6);
      ctx.lineTo(cx + 14, baseY + 2);
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 10, baseY - 5);
      ctx.lineTo(cx, baseY + 3);
      ctx.moveTo(cx - 1, baseY - 6);
      ctx.lineTo(cx + 9, baseY + 2);
      ctx.stroke();
    } else if (kind === 3) {
      // High-Tech Industrial Grate Floor (Perforated metal mesh over subterranean pipe glow)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#1c2430', '#0f1722');
      // Sub-floor dark pit depth
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.75, ISO_TILE_H * 0.75, '#090e15');
      ctx.fillStyle = '#0f172a';
      for (let dx = -10; dx <= 10; dx += 4) {
        ctx.fillRect(cx + dx, baseY - 3, 2, 2);
        ctx.fillRect(cx + dx - 2, baseY + 2, 2, 2);
      }
      // Amber reactor conduit glow beneath grate
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(cx - 4, baseY - 1, 8, 1);
    } else if (kind === 8) {
      // Alien Spawn Vent / Hive Breach (Jagged chitin fracture with glowing bio-slime core)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#1a1f26', '#0d1014');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.72, ISO_TILE_H * 0.72, '#080d07', '#365314');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.44, ISO_TILE_H * 0.44, '#4d7c0f');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.22, ISO_TILE_H * 0.22, '#a3e635');
      // Organic vein tendrils stretching outward
      ctx.strokeStyle = '#365314';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 12, baseY - 2);
      ctx.lineTo(cx - 5, baseY);
      ctx.moveTo(cx + 12, baseY + 1);
      ctx.lineTo(cx + 6, baseY - 1);
      ctx.stroke();
    } else if (kind === 11) {
      // Toxic Caustic Acid Pool (Bubbling viscous emerald liquid)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#142903', '#0a1601');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.8, ISO_TILE_H * 0.8, '#3f6212');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.45, ISO_TILE_H * 0.45, '#65a30d');
      ctx.fillStyle = '#bef264';
      ctx.fillRect(cx - 7, baseY - 2, 3, 2);
      ctx.fillRect(cx + 4, baseY + 1, 2, 2);
      ctx.fillRect(cx - 1, baseY + 3, 3, 1);
    } else if (kind === 12) {
      // Extraction Beacon Landing Pad (Blue high-intensity strobe rings & landing chevron)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#172554', '#1e3a8a');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.75, ISO_TILE_H * 0.75, '#1e40af', '#3b82f6');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.35, ISO_TILE_H * 0.35, '#93c5fd');
      // Landing crosshairs
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, baseY);
      ctx.lineTo(cx + 8, baseY);
      ctx.moveTo(cx, baseY - 4);
      ctx.lineTo(cx, baseY + 4);
      ctx.stroke();
    } else if (kind === 14) {
      // Open Security Blast Door Threshold (Recessed door tracks with green LED guides)
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W, ISO_TILE_H, '#1b222c', '#10151c');
      this.drawDiamond(ctx, cx, baseY, ISO_TILE_W * 0.78, ISO_TILE_H * 0.78, '#2a3443', '#374151');
      // Heavy hydraulic track slots
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 13, baseY - 2);
      ctx.lineTo(cx + 13, baseY - 2);
      ctx.stroke();
      // Green door jamb status indicators
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(cx - 15, baseY - 3, 3, 3);
      ctx.fillRect(cx + 12, baseY - 3, 3, 3);
    }

    // 2. 3D ISOMETRIC WALLS & PROPS
    if (kind === 4) {
      // Reinforced Military Bunker Wall with structural buttress ribs
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        ISO_TILE_W,
        ISO_TILE_H,
        ISO_WALL_H,
        '#475569',
        '#334155',
        '#1e293b',
        '#0f172a'
      );
      // Heavy horizontal armor band
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - ISO_TILE_W / 2 + 1, baseY - 13);
      ctx.lineTo(cx, baseY + ISO_TILE_H / 2 - 13);
      ctx.lineTo(cx + ISO_TILE_W / 2 - 1, baseY - 13);
      ctx.stroke();
      // Rivet rows on wall
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cx - 14, baseY - 18, 2, 2);
      ctx.fillRect(cx - 6, baseY - 14, 2, 2);
      ctx.fillRect(cx + 6, baseY - 14, 2, 2);
      ctx.fillRect(cx + 14, baseY - 18, 2, 2);
    } else if (kind === 5) {
      // Bio-Lab Containment Wall with illuminated cyan data conduit
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        ISO_TILE_W,
        ISO_TILE_H,
        ISO_WALL_H,
        '#334155',
        '#1e293b',
        '#0f172a',
        '#090d11'
      );
      // Glowing Cyan Data Strip
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - ISO_TILE_W / 2 + 2, baseY - 15);
      ctx.lineTo(cx, baseY + ISO_TILE_H / 2 - 15);
      ctx.lineTo(cx + ISO_TILE_W / 2 - 2, baseY - 15);
      ctx.stroke();
      // Thin secondary hazard line
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - ISO_TILE_W / 2 + 2, baseY - 8);
      ctx.lineTo(cx, baseY + ISO_TILE_H / 2 - 8);
      ctx.lineTo(cx + ISO_TILE_W / 2 - 2, baseY - 8);
      ctx.stroke();
    } else if (kind === 6) {
      // Staggered Burlap Sandbag Barricade
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        ISO_TILE_W * 0.66,
        ISO_TILE_H * 0.66,
        8,
        '#78716c',
        '#57534e',
        '#44403c',
        '#292524'
      );
      // Sandbag seam creases
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, baseY - 6);
      ctx.lineTo(cx, baseY - 2);
      ctx.lineTo(cx + 8, baseY - 6);
      ctx.stroke();
    } else if (kind === 7) {
      // Explosive Red Fuel Drum
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        16,
        9,
        13,
        '#ef4444',
        '#dc2626',
        '#991b1b',
        '#450a0a'
      );
      // Yellow hazard band & explosive insignia
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - 5, baseY - 10, 10, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 2, baseY - 9, 4, 1);
    } else if (kind === 9) {
      // Security Uplink Console Terminal with Dual CRT Screens
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        20,
        11,
        16,
        '#0284c7',
        '#0369a1',
        '#075985',
        '#082f49'
      );
      // Main glowing CRT display
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx - 5, baseY - 16, 10, 5);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(cx - 4, baseY - 15, 8, 2);
      // Keypad interface panel
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 6, baseY - 8, 12, 3);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 4, baseY - 7, 2, 1);
      ctx.fillRect(cx + 2, baseY - 7, 2, 1);
    } else if (kind === 10) {
      // Heavy Military Supply Crate with Corner Braces
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        20,
        11,
        11,
        '#65a30d',
        '#4d7c0f',
        '#365314',
        '#1a2e05'
      );
      // Corner steel reinforcing angle-irons
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 10, baseY - 11, 3, 9);
      ctx.fillRect(cx + 7, baseY - 11, 3, 9);
      // White military stencil emblem
      ctx.fillStyle = '#f7fee7';
      ctx.fillRect(cx - 3, baseY - 9, 6, 2);
      ctx.fillRect(cx - 1, baseY - 11, 2, 6);
    } else if (kind === 13) {
      // Locked Armored Security Blast Door (Hydraulic clamps & caution chevrons)
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        ISO_TILE_W * 0.94,
        ISO_TILE_H * 0.94,
        ISO_WALL_H,
        '#854d0e',
        '#593106',
        '#27272a',
        '#090d11'
      );
      // Hazard yellow diagonal caution stripe
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 15, baseY - 12);
      ctx.lineTo(cx, baseY - 4);
      ctx.lineTo(cx + 15, baseY - 12);
      ctx.stroke();
      // Heavy central hydraulic seal
      ctx.fillStyle = '#18181b';
      ctx.fillRect(cx - 4, baseY - 18, 8, 10);
      // Red locked indicator beacon
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 3, baseY - 23, 6, 4);
    } else if (kind === 15) {
      // Automated Sentry Turret Base Tripod & Hydraulic Platform
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        19,
        10,
        8,
        '#475569',
        '#334155',
        '#1e293b',
        '#0f172a'
      );
      // Base stabilizer feet
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cx - 9, baseY - 4, 3, 3);
      ctx.fillRect(cx + 6, baseY - 4, 3, 3);
      ctx.fillRect(cx - 1, baseY + 1, 3, 3);
    } else if (kind === 16) {
      // Alien Bio-Stasis Containment Pod (Glass tube, glowing nutrient fluid & silhouetted specimen)
      this.drawIsoBox(
        ctx,
        cx,
        baseY,
        19,
        10,
        20,
        '#06b6d4',
        '#0891b2',
        '#0e7490',
        '#164e63'
      );
      // Glass viewport showing bubbling nutrient fluid
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(cx - 5, baseY - 19, 10, 12);
      ctx.fillStyle = '#bef264';
      ctx.fillRect(cx - 3, baseY - 18, 6, 2);
      // Xenomorph embryo silhouette floating inside
      ctx.fillStyle = '#14532d';
      ctx.fillRect(cx - 2, baseY - 15, 4, 6);
      ctx.fillRect(cx - 1, baseY - 16, 2, 2);
      // Heavy metal cap with warning beacon
      this.drawDiamond(ctx, cx, baseY - 24, 22, 12, '#64748b', '#0f172a');
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(cx - 2, baseY - 28, 4, 3);
    }

    return canvas;
  }

  // 3. PERSISTENT DECALS & CORPSES
  public drawDecal(
    ctx: CanvasRenderingContext2D,
    d: DecalEntity,
    sx: number,
    sy: number
  ): void {
    ctx.save();
    ctx.translate(sx, sy);

    if (d.type === 'blood_green' || d.type === 'blood_red' || d.type === 'scorch') {
      ctx.fillStyle =
        d.type === 'blood_green'
          ? 'rgba(101, 163, 13, 0.72)'
          : d.type === 'blood_red'
          ? 'rgba(185, 28, 28, 0.72)'
          : 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.ellipse(0, 0, d.size, d.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Splatter droplets
      ctx.fillStyle =
        d.type === 'blood_green'
          ? '#65a30d'
          : d.type === 'blood_red'
          ? '#991b1b'
          : '#020617';
      ctx.fillRect(-d.size * 0.7, -d.size * 0.3, 2, 2);
      ctx.fillRect(d.size * 0.6, d.size * 0.2, 2, 2);
    } else if (
      d.type === 'corpse_basic' ||
      d.type === 'corpse_fast' ||
      d.type === 'corpse_heavy'
    ) {
      // Dead alien corpse decal on floor
      const bloodColor =
        d.type === 'corpse_fast'
          ? 'rgba(185, 28, 28, 0.68)'
          : d.type === 'corpse_heavy'
          ? 'rgba(88, 28, 135, 0.72)'
          : 'rgba(77, 124, 15, 0.68)';
      ctx.fillStyle = bloodColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.size * 1.1, d.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shattered chitin carapace segments
      ctx.fillStyle =
        d.type === 'corpse_heavy'
          ? '#3b0764'
          : d.type === 'corpse_fast'
          ? '#7f1d1d'
          : '#365314';
      ctx.fillRect(-6, -2, 12, 4);
      ctx.fillRect(-3, -5, 6, 3);
      // Severed scythe claw
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-9, 3);
      ctx.moveTo(6, 0);
      ctx.lineTo(9, -3);
      ctx.stroke();
    } else if (d.type === 'debris_crate') {
      ctx.fillStyle = '#365314';
      ctx.fillRect(-7, -2, 6, 3);
      ctx.fillRect(1, 0, 7, 3);
      ctx.fillStyle = '#78716c';
      ctx.fillRect(-2, -4, 5, 2);
    } else if (d.type === 'debris_pod') {
      ctx.fillStyle = 'rgba(132, 204, 22, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(-6, -3, 3, 2);
      ctx.fillRect(4, 1, 4, 2);
    }

    ctx.restore();
  }

  // 4. AUTOMATED MILITARY SENTRY TURRET
  public drawTurret(
    ctx: CanvasRenderingContext2D,
    turret: TurretEntity,
    sx: number,
    sy: number
  ): void {
    ctx.save();
    ctx.translate(sx, sy);

    const cos = Math.cos(turret.angle);
    const sin = Math.sin(turret.angle);

    // Rotating armored turret swivel dome (at y = -14)
    ctx.fillStyle = turret.active ? '#475569' : '#334155';
    ctx.beginPath();
    ctx.arc(0, -14, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top status beacon LED (green = active online, amber = offline/empty)
    ctx.fillStyle =
      turret.active && turret.ammoRemaining > 0 ? '#22c55e' : '#f59e0b';
    ctx.fillRect(-2, -19, 4, 3);

    // Twin heavy autocannon barrels
    const len = 14;
    const gx = cos * len;
    const gy = sin * len * 0.65 - 14;
    ctx.strokeStyle = turret.active ? '#f1f5f9' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(gx, gy);
    ctx.stroke();

    // Dual muzzle flash
    if (turret.muzzleFlashMs > 0) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(gx + cos * 2.5, gy + sin * 1.8, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(gx + cos * 1.5, gy + sin * 1.2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mini Ammo Bar above active turret
    if (turret.active && turret.ammoRemaining > 0) {
      const w = 15;
      const pct = Math.max(0, turret.ammoRemaining / turret.maxAmmo);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-w / 2, -24, w, 2.5);
      ctx.fillStyle = pct > 0.3 ? '#22c55e' : '#f97316';
      ctx.fillRect(-w / 2, -24, w * pct, 2.5);
    }

    ctx.restore();
  }

  // 5. SCI-FI MARINE SOLDIER PLAYER SPRITE SYSTEM (8-Directional & 6 Animation States)
  public drawPlayer(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    aimAngle: number,
    walkCycle: number,
    weapon: WeaponId,
    hitFlash: boolean,
    muzzleFlash: boolean,
    flashlightOn: boolean,
    isDead = false,
    deathTimerMs = 0,
    isRunning = false,
    idlePulseMs = 0
  ): void {
    ctx.save();
    ctx.translate(sx, sy);

    const octant = angleToOctant(aimAngle);

    // A. Tactical Volumetric Flashlight Cone (uses pre-baked offscreen canvas when available)
    if (flashlightOn && !isDead) {
      ctx.save();
      ctx.rotate(aimAngle);
      if (this.flashlightCanvas) {
        ctx.drawImage(this.flashlightCanvas, 0, -40);
      } else {
        const grad = ctx.createRadialGradient(8, 0, 2, 60, 0, 56);
        grad.addColorStop(0, 'rgba(224, 242, 254, 0.32)');
        grad.addColorStop(0.7, 'rgba(224, 242, 254, 0.12)');
        grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(105, -36);
        ctx.lineTo(105, 36);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // B. Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // C. Death Animation Handling
    if (isDead) {
      const progress = Math.min(1, deathTimerMs / 700);
      ctx.save();
      ctx.translate(progress * 6, progress * 4);
      ctx.rotate(progress * (Math.PI / 2.2));

      // Fallen marine armor
      ctx.fillStyle = '#223326';
      ctx.fillRect(-6, -10, 12, 8);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-4, -6, 8, 5);
      // Helmet with shattered visor
      ctx.fillStyle = '#1c261e';
      ctx.beginPath();
      ctx.arc(3, -12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(2, -13, 2, 2);
      // Blood pool under marine
      ctx.fillStyle = 'rgba(185, 28, 28, 0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 2, 8 * progress, 4 * progress, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.restore();
      return;
    }

    // Running / Overdrive Kinetic Speed Trail
    if (isRunning) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.48)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, -8, 10, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Subtle Idle Breathing Bob
    const idleBob = Math.sin(idlePulseMs * 0.005) * 0.65;

    // D. 4-Frame Walk/Run Leg Stride
    const strideAmp = isRunning ? 4.8 : 3.8;
    const stride = Math.sin(walkCycle * (isRunning ? 14 : 11)) * strideAmp;
    ctx.fillStyle = '#1e293b';
    if (octant === 6 || octant === 7 || octant === 5) {
      // Facing North / NW / NE (back of legs)
      ctx.fillRect(-5, -5 - stride, 4, 6);
      ctx.fillRect(1, -5 + stride, 4, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, -1 - stride, 4, 2);
      ctx.fillRect(1, -1 + stride, 4, 2);
    } else {
      // Facing South / SE / SW / E / W (front of legs)
      ctx.fillRect(-5, -4 + stride, 4, 6);
      ctx.fillRect(1, -4 - stride, 4, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, 0 + stride, 4, 2);
      ctx.fillRect(1, 0 - stride, 4, 2);
    }

    // E. Back Power Pack (Visible when facing North, North-West, North-East)
    const isFacingNorth = octant === 5 || octant === 6 || octant === 7;
    if (isFacingNorth) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-5, -16 + idleBob, 10, 8);
      // Power cells with glowing blue recharge LED
      ctx.fillStyle = isRunning ? '#7dd3fc' : '#38bdf8';
      ctx.fillRect(-3, -15 + idleBob, 6, 2);
    }

    // F. Heavy Armored Marine Torso
    ctx.fillStyle = hitFlash ? '#ffffff' : '#324532';
    ctx.fillRect(-5, -15 + idleBob, 10, 11); // STEP 2: slimmer torso

    // Kevlar Ballistic Vest / Chest Rig
    ctx.fillStyle = hitFlash ? '#fca5a5' : '#1f2937';
    if (!isFacingNorth) {
      ctx.fillRect(-3, -13 + idleBob, 7, 6);
      // Tactical ammo pouches
      ctx.fillStyle = '#374151';
      ctx.fillRect(-4, -9 + idleBob, 3, 2);
      ctx.fillRect(1, -9 + idleBob, 3, 2);
    }

    // Shoulder Pauldrons
    ctx.fillStyle = hitFlash ? '#ffffff' : '#4d664d';
    ctx.fillRect(-7, -15 + idleBob, 2, 6);
    ctx.fillRect(5, -15 + idleBob, 2, 6);

    // G. Tactical Marine Combat Helmet
    ctx.fillStyle = hitFlash ? '#ffffff' : '#233023';
    ctx.beginPath();
    ctx.arc(0, -19 + idleBob, 5, 0, Math.PI * 2); // STEP 2: slimmer helmet
    ctx.fill();

    // STEP 2: slim chest light strip
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-2, -12 + idleBob, 4, 1);

    // H. Holographic Cyan Visor (Oriented by 8 directions)
    if (!isFacingNorth) {
      const visorOffsets: Record<OctantDirection, { x: number; y: number; w: number }> = {
        0: { x: 1, y: -20, w: 4 }, // East
        1: { x: 0.5, y: -19.5, w: 5 }, // South-East
        2: { x: -2.5, y: -19, w: 5 }, // South
        3: { x: -3.5, y: -19.5, w: 5 }, // South-West
        4: { x: -4, y: -20, w: 4 }, // West
        5: { x: -2, y: -21, w: 3 }, // NW
        6: { x: 0, y: -21, w: 2 }, // N
        7: { x: 1, y: -21, w: 3 }, // NE
      };
      const vo = visorOffsets[octant];
      ctx.fillStyle = isRunning ? '#7dd3fc' : '#38bdf8';
      ctx.fillRect(vo.x, vo.y + idleBob, vo.w, 2.5);
      // Visor glare gleam
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(vo.x + 1, vo.y + idleBob, 1.5, 1);
    } else {
      // Helmet rear reinforcement band
      ctx.fillStyle = '#111827';
      ctx.fillRect(-3, -20 + idleBob, 6, 2);
    }

    // I. Weapons and Firing Arms in Marine Hands
    const cos = Math.cos(aimAngle);
    const sin = Math.sin(aimAngle);
    const recoil = muzzleFlash ? -2.2 : 0;

    if (weapon === 'pistol') {
      // M9A Dual Tactical Pistols (Akimbo Dual Wield)
      const pLen = 10;
      const rx1 = cos * (pLen + recoil) - sin * 3;
      const ry1 = sin * (pLen + recoil) * 0.7 + cos * 3 - 11 + idleBob;
      const rx2 = cos * (pLen + recoil) + sin * 3;
      const ry2 = sin * (pLen + recoil) * 0.7 - cos * 3 - 11 + idleBob;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-3, -11 + idleBob);
      ctx.lineTo(rx1, ry1);
      ctx.moveTo(3, -11 + idleBob);
      ctx.lineTo(rx2, ry2);
      ctx.stroke();

      if (muzzleFlash) {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(rx1 + cos * 2, ry1 + sin * 1.5, 3.2, 0, Math.PI * 2);
        ctx.arc(rx2 + cos * 2, ry2 + sin * 1.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx1 + cos * 1.5 - 1, ry1 + sin * 1.2 - 1, 2, 2);
        ctx.fillRect(rx2 + cos * 1.5 - 1, ry2 + sin * 1.2 - 1, 2, 2);
      }
    } else {
      // Two-handed weapons (Rifle, Shotgun, Plasma)
      const gunLen =
        weapon === 'shotgun' ? 14 : weapon === 'plasma' ? 15 : 15;
      const gx = cos * (gunLen + recoil);
      const gy = sin * (gunLen + recoil) * 0.7 - 11 + idleBob;

      ctx.strokeStyle =
        weapon === 'plasma'
          ? '#22c55e'
          : weapon === 'shotgun'
          ? '#cbd5e1'
          : '#94a3b8';
      ctx.lineWidth = weapon === 'plasma' || weapon === 'shotgun' ? 3.2 : 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -11 + idleBob);
      ctx.lineTo(gx, gy);
      ctx.stroke();

      // Top scope / heat shroud details
      if (weapon === 'rifle') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(gx * 0.5 - 1, gy * 0.5 - 6, 2, 2); // Optical scope
      } else if (weapon === 'plasma') {
        // Glowing Green Energy Coils on Plasma Gun
        ctx.fillStyle = '#86efac';
        ctx.fillRect(gx * 0.45 - 2, gy * 0.45 - 6, 4, 3);
      }

      // Weapon Muzzle Flash
      if (muzzleFlash) {
        if (weapon === 'plasma') {
          // Emerald Energy Discharge Ring
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(gx + cos * 3, gy + sin * 2, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx + cos * 2, gy + sin * 1.5, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (weapon === 'shotgun') {
          // Blinding Fiery Cone Muzzle Blast
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(gx + cos * 3.5, gy + sin * 2.2, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(gx + cos * 2, gy + sin * 1.5, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // High-velocity rifle starburst
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(gx + cos * 2.5, gy + sin * 1.8, 4.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx + cos * 1.5, gy + sin * 1.2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // 6. ENEMY SPRITE SYSTEM (Directional & Full Animation States: Idle, Walk, Attack, Hurt, Death, Boss Entrance)
  public drawEnemy(
    ctx: CanvasRenderingContext2D,
    enemy: EnemyEntity,
    sx: number,
    sy: number
  ): void {
    ctx.save();
    ctx.translate(sx, sy);

    const isDying = enemy.state === 'dead';
    const flash = enemy.hitFlashTimer > 0;
    const stride = Math.sin(enemy.animFrame * 12) * 3.5;
    const cos = Math.cos(enemy.angle);
    const sin = Math.sin(enemy.angle);
    const isAttacking = Boolean(enemy.attackAnimMs && enemy.attackAnimMs > 0);
    const attackLunge = isAttacking ? 3.5 : 0;

    // Boss Entrance Shockwave & Alert Ring
    if (enemy.type === 'boss' && enemy.spawnAnimMs && enemy.spawnAnimMs > 0) {
      const spawnPct = 1 - Math.max(0, Math.min(1, enemy.spawnAnimMs / 900));
      ctx.strokeStyle = spawnPct < 0.5 ? '#fde047' : '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 + spawnPct * 24, 6 + spawnPct * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Death Dissolve & Collapse Animation
    if (isDying && enemy.deathTimerMs !== undefined && enemy.deathMaxMs) {
      const dissolvePct = 1 - Math.max(0, enemy.deathTimerMs / enemy.deathMaxMs);
      ctx.scale(1 - dissolvePct * 0.35, 1 - dissolvePct * 0.55);
      ctx.globalAlpha = Math.max(0.15, 1 - dissolvePct * 0.85);
    }

    // Ground Shadow
    const shadowR =
      enemy.type === 'boss' ? 18 : enemy.type === 'heavy' ? 12 : 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 2, shadowR, shadowR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ARCHETYPE A: BASIC ALIEN (Gnasher Crawler)
    if (enemy.type === 'basic') {
      // Jointed Arachnid Scythe Legs
      ctx.strokeStyle = flash ? '#ffffff' : '#365314';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * 4, -5);
        ctx.lineTo(i * 9 + cos * attackLunge, -2 + stride * i);
        ctx.moveTo(i * 4, -8);
        ctx.lineTo(i * 8 - cos * attackLunge, -9 - stride * i);
        ctx.stroke();
      }

      // Ribbed Chitin Thorax
      ctx.fillStyle = flash ? '#ffffff' : '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(0, -7, 6, 4.5, 0, 0, Math.PI * 2); // STEP 2: slimmer basic alien
      ctx.fill();

      // Elongated Xenomorph Crest Skull
      ctx.fillStyle = flash ? '#fca5a5' : '#65a30d';
      ctx.beginPath();
      ctx.ellipse(
        cos * (5 + attackLunge),
        -9 + sin * 3,
        5.5,
        3.8,
        enemy.angle * 0.5,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Glowing Ruby Eyes & Acid Mandibles
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cos * (6.5 + attackLunge) - 1, -10 + sin * 3, 2, 2);
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(cos * (7.5 + attackLunge) - 1, -8 + sin * 3, 1.5, 2);
    }

    // ARCHETYPE B: FAST ALIEN (Crimson Razor Stalker)
    else if (enemy.type === 'fast') {
      // Razor-Spiked Long Limbs
      ctx.strokeStyle = flash ? '#ffffff' : '#991b1b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-10 + cos * attackLunge, 1 + stride);
      ctx.moveTo(6, -6);
      ctx.lineTo(10 + cos * attackLunge, 1 - stride);
      ctx.stroke();

      // Sleek Aerodynamic Crimson Bio-Hull
      ctx.fillStyle = flash ? '#ffffff' : '#dc2626';
      ctx.beginPath();
      ctx.moveTo(cos * (11 + attackLunge), -9 + sin * 5);
      ctx.lineTo(-8, -13);
      ctx.lineTo(-4, -4);
      ctx.lineTo(8, -4);
      ctx.closePath();
      ctx.fill();

      // Whip Razor Tail
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-cos * 7, -7 - sin * 3);
      ctx.lineTo(-cos * 13, -11 - sin * 5);
      ctx.stroke();

      // Predatory Amber Eyes
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cos * (7 + attackLunge) - 1, -10 + sin * 3, 2.5, 2);
    }

    // ARCHETYPE C: HEAVY ALIEN (Armored Crusher Brute)
    else if (enemy.type === 'heavy') {
      // Thick Stomping Limbs
      ctx.fillStyle = flash ? '#ffffff' : '#4c1d95';
      ctx.fillRect(-8, -5 + stride * 0.6, 6, 7);
      ctx.fillRect(3, -5 - stride * 0.6, 6, 7);

      // Colossal Heavy Carapace
      ctx.fillStyle = flash ? '#ffffff' : '#5b21b6';
      ctx.beginPath();
      ctx.arc(0, -14, 9.5, 0, Math.PI * 2); // STEP 2: slimmer heavy alien
      ctx.fill();

      // Carapace Armor Plates with Geothermal Vents
      ctx.fillStyle = flash ? '#fca5a5' : '#7c3aed';
      ctx.fillRect(-8, -20, 16, 5);

      // Glowing Geothermal Spine Vents
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-4, -18, 2, 3);
      ctx.fillRect(2, -18, 2, 3);

      // Spiked Crushing Knuckles
      const smashOffset = isAttacking ? 5 : 0;
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(cos * (11 + smashOffset) - 5, -10 + sin * 5, 4, 0, Math.PI * 2);
      ctx.arc(cos * (11 + smashOffset) + 5, -10 + sin * 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ARCHETYPE D: RANGED ALIEN (Bioluminescent Acid Spitter)
    else if (enemy.type === 'ranged') {
      ctx.fillStyle = flash ? '#ffffff' : '#0f766e';
      ctx.beginPath();
      ctx.ellipse(0, -9, 7.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pulsating Toxic Acid Sac
      ctx.fillStyle = flash ? '#ffffff' : isAttacking ? '#bef264' : '#84cc16';
      ctx.beginPath();
      ctx.arc(-cos * 3, -14, isAttacking ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Distended Spitting Maw
      ctx.fillStyle = isAttacking ? '#a3e635' : '#2dd4bf';
      ctx.fillRect(cos * (7 + attackLunge * 0.6) - 2, -10 + sin * 3, 4, 4);
    }

    // ARCHETYPE E: BOSS ALIEN (Brood Overlord Apex Queen)
    else if (enemy.type === 'boss') {
      // Massive Quadruped Bio-Legs
      ctx.strokeStyle = flash ? '#ffffff' : '#881337';
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(i * 8, -8);
        ctx.lineTo(i * 18 + cos * attackLunge, 2 + stride * i);
        ctx.moveTo(i * 8, -14);
        ctx.lineTo(i * 19 - cos * attackLunge, -11 - stride * i);
        ctx.stroke();
      }

      // Colossal Royal Hive Thorax
      ctx.fillStyle = flash ? '#ffffff' : '#9f1239';
      ctx.beginPath();
      ctx.ellipse(0, -16, 13, 11, 0, 0, Math.PI * 2); // STEP 2: slimmer boss
      ctx.fill();

      // Armored Bio-Crown Crest
      ctx.fillStyle = flash || isAttacking ? '#fde047' : '#e11d48';
      ctx.beginPath();
      ctx.moveTo(-13, -24);
      ctx.lineTo(0, isAttacking ? -36 : -33);
      ctx.lineTo(13, -24);
      ctx.closePath();
      ctx.fill();

      // Dual Thoracic Bio-Cannons (Glow brightly when Boss fires)
      ctx.fillStyle = isAttacking ? '#fde047' : '#f43f5e';
      ctx.fillRect(-7, -26, 3, 5);
      ctx.fillRect(4, -26, 3, 5);
      if (isAttacking) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5.5, -27, 2.5, 0, Math.PI * 2);
        ctx.arc(5.5, -27, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glowing Apex Eyes
      ctx.fillStyle = '#a3e635';
      ctx.fillRect(-5, -19, 3, 3);
      ctx.fillRect(2, -19, 3, 3);
    }

    // Mini HP Bar above wounded living enemy
    if (!isDying && enemy.hp < enemy.maxHp && enemy.type !== 'boss') {
      const barW = 16;
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      const topY = enemy.type === 'heavy' ? -28 : -22;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-barW / 2, topY, barW, 2.5);
      ctx.fillStyle = pct > 0.4 ? '#ef4444' : '#f97316';
      ctx.fillRect(-barW / 2, topY, barW * pct, 2.5);
    }

    ctx.restore();
  }

  // 7. WEAPON PROJECTILE RENDERING (Weapon-Specific Trails & Energy Cores)
  public drawProjectile(
    ctx: CanvasRenderingContext2D,
    b: BulletEntity,
    isoSx: number,
    isoSy: number,
    prevIsoSx: number,
    prevIsoSy: number
  ): void {
    const py = isoSy - 9;
    const prevPy = prevIsoSy - 9;

    if (b.piercing || b.weaponId === 'plasma') {
      // Heavy Plasma Orb with energy wake trail & glowing corona
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(prevIsoSx, prevPy);
      ctx.lineTo(isoSx, py);
      ctx.stroke();

      ctx.fillStyle = b.isCrit ? '#fde047' : '#4ade80';
      ctx.beginPath();
      ctx.arc(isoSx, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(isoSx, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.weaponId === 'shotgun') {
      // Heated Buckshot Pellet with orange-amber trail
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(prevIsoSx, prevPy);
      ctx.lineTo(isoSx, py);
      ctx.stroke();

      ctx.fillStyle = b.isCrit ? '#ffffff' : '#fde047';
      ctx.fillRect(isoSx - 1.5, py - 1.5, 3, 3);
    } else if (b.weaponId === 'rifle' || b.turretShot) {
      // High-Velocity Pulse Rifle / Sentry Turret Streak
      ctx.strokeStyle = b.isCrit ? '#fde047' : b.turretShot ? '#38bdf8' : b.color;
      ctx.lineWidth = b.isCrit ? 2.8 : 2.3;
      ctx.beginPath();
      ctx.moveTo(prevIsoSx, prevPy);
      ctx.lineTo(isoSx, py);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(isoSx - 1, py - 1, 2.5, 2.5);
    } else {
      // Pistol Tracer or Alien Bio-Spit Orb
      ctx.strokeStyle = b.isCrit ? '#fde047' : b.color;
      ctx.lineWidth = b.fromPlayer ? 2.1 : 2.6;
      ctx.beginPath();
      ctx.moveTo(prevIsoSx, prevPy);
      ctx.lineTo(isoSx, py);
      ctx.stroke();

      if (!b.fromPlayer) {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(isoSx, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(isoSx - 1, py - 1, 2, 2);
    }
  }

  // 8. COMBAT PARTICLES & VISUAL EFFECTS (Pooled Sparks, Smoke, Plasma, Shells, Energy & Shockwaves)
  public drawParticle(
    ctx: CanvasRenderingContext2D,
    p: ParticleEntity,
    isoSx: number,
    isoSy: number
  ): void {
    const screenY = Math.round(isoSy - p.wz);
    const screenX = Math.round(isoSx - p.size / 2);

    if (p.kind === 'shockwave') {
      const progress = Math.min(1, p.lifeMs / Math.max(1, p.maxLifeMs));
      const rx = p.size + progress * 22;
      const ry = rx * 0.5;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 2.4 * (1 - progress));
      ctx.beginPath();
      ctx.ellipse(isoSx, isoSy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'energy') {
      ctx.fillStyle = p.color;
      ctx.fillRect(screenX - 1, screenY, p.size + 2, 1.5);
      ctx.fillRect(screenX, screenY - 1, 1.5, p.size + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(isoSx - 0.5, screenY - 0.5, 1.5, 1.5);
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(isoSx, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'plasma') {
      ctx.fillStyle = p.color;
      ctx.fillRect(screenX, screenY, p.size, p.size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(screenX + 0.5, screenY + 0.5, 1, 1);
    } else if (p.kind === 'shell') {
      // Ejected brass shell casing tumbling in air
      ctx.fillStyle = '#eab308';
      ctx.fillRect(screenX, screenY, 2, 3);
    } else {
      // Spark, fire, blood particle
      ctx.fillStyle = p.color;
      ctx.fillRect(screenX, screenY, p.size, p.size);
    }
  }
}

export const spriteCache = new SpriteCache();

