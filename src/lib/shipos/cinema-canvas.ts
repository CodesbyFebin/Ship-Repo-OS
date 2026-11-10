// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Cinema Canvas: the Path A render engine.
// A pure (stateless) canvas painter that draws any moment of the VideoScript
// as a cinematic frame — dark stage, neon grading, Ken Burns drift, kinetic
// typography, synced captions, film grain, letterbox. Used by:
//   · the Video Studio live player (rAF loop)
//   · the WebM recorder (canvas.captureStream → MediaRecorder)
// Resolution-agnostic: every coordinate is relative to W×H.
// ─────────────────────────────────────────────────────────────────────────────

import { sceneAt, sceneStart, scriptCaptions, type VideoScript } from "./story-engine";

export interface CinemaFacts {
  score: number;
  stars: number;
  checksPassed: number;
  checksTotal: number;
  fixes: number;
  grade: string;
  categories: { name: string; score: number; max: number }[];
  topFixTitle: string;
  topFixPoints: number;
  // ── Demo Maker extras (optional — the audit visuals never touch these) ──
  repoTitle?: string;
  tagline?: string;
  language?: string;
  licenseName?: string;
  version?: string;
  frameworks?: string[];
  modules?: string[];
  installCmd?: string;
  runCmd?: string;
  testCmd?: string;
  forks?: number;
  contributors?: number;
  commitCount?: number;
  envProvided?: boolean;
}

export interface DrawOpts {
  script: VideoScript;
  time: number;
  facts: CinemaFacts;
  captionsOn: boolean;
  kenBurns: boolean;
  neon: boolean;
  grain: boolean;
}

const PAL = {
  primary: "#6c5ce7",
  secondary: "#00cec9",
  bg: "#0a0a0f",
  bgHot: "#161624",
  fg: "#ececf6",
  dim: "#8b8ba0",
  red: "#ff6b6b",
  green: "#2ecc71",
  amber: "#f59e0b",
} as const;

function easeOut(p: number): number {
  const x = Math.max(0, Math.min(1, p));
  return 1 - Math.pow(1 - x, 3);
}

/** Deterministic LCG so particles never need React state. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── Backdrop ─────────────────────────────────────────────────────────────────

function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.08, W * 0.5, H * 0.5, H * 1.05);
  g.addColorStop(0, PAL.bgHot);
  g.addColorStop(1, PAL.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // perspective grid
  ctx.lineWidth = Math.max(1, H / 1080);
  ctx.strokeStyle = "rgba(108,92,231,0.075)";
  const step = W / 21;
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // drifting motes
  const count = 42;
  for (let i = 0; i < count; i++) {
    const sx = rand(i * 3.7);
    const sy = rand(i * 9.1);
    const speed = 8 + rand(i * 5.3) * 26;
    const x = ((sx * W + t * speed) % (W + 40)) - 20;
    const y = (sy * H + Math.sin(t * 0.6 + i) * 14 + H) % H;
    const r = (0.6 + rand(i * 2.2) * 1.8) * (H / 720);
    ctx.globalAlpha = 0.12 + rand(i * 7.7) * 0.22;
    ctx.fillStyle = i % 4 === 0 ? PAL.secondary : PAL.primary;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Scene visuals ────────────────────────────────────────────────────────────

function drawGauge(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const cx = W * 0.5;
  const cy = H * 0.54;
  const R = H * 0.23;
  const spin = easeOut(p * 1.35);

  ctx.lineCap = "round";
  ctx.lineWidth = H * 0.028;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();

  const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
  grad.addColorStop(0, PAL.primary);
  grad.addColorStop(1, PAL.secondary);
  ctx.strokeStyle = grad;
  ctx.shadowColor = PAL.secondary;
  ctx.shadowBlur = H * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * spin));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // needle tick at the arc head
  const ang = Math.PI * (0.75 + 1.5 * spin);
  ctx.fillStyle = PAL.fg;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, H * 0.011, 0, Math.PI * 2);
  ctx.fill();

  const shown = Math.round(f.score * spin);
  ctx.textAlign = "center";
  ctx.fillStyle = PAL.fg;
  ctx.font = `900 ${Math.round(H * 0.15)}px Inter, system-ui, Arial`;
  ctx.fillText(String(shown), cx, cy + H * 0.05);
  ctx.fillStyle = PAL.dim;
  ctx.font = `700 ${Math.round(H * 0.024)}px Inter, system-ui, Arial`;
  ctx.fillText("SHIP SCORE / 100", cx, cy + H * 0.1);

  // chips: failing checks + points at stake
  const chips = [`${f.checksTotal - f.checksPassed} checks failing`, `${f.fixes} ranked fixes ready`];
  ctx.font = `600 ${Math.round(H * 0.024)}px Inter, system-ui, Arial`;
  chips.forEach((c, i) => {
    const tw = ctx.measureText(c).width;
    const x = cx - (tw + H * 0.05) / 2;
    const y = cy + R + H * 0.06 + i * H * 0.056;
    ctx.globalAlpha = easeOut(p * 3 - i * 0.7);
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    roundRect(ctx, x, y, tw + H * 0.05, H * 0.042, H * 0.021);
    ctx.fill();
    ctx.fillStyle = i === 0 ? PAL.amber : PAL.secondary;
    ctx.textAlign = "center";
    ctx.fillText(c, cx, y + H * 0.029);
    ctx.globalAlpha = 1;
  });
}

function drawStars(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const cx = W * 0.5;
  const cy = H * 0.44;
  const shown = Math.round(f.stars * easeOut(p * 1.2));

  ctx.textAlign = "center";
  ctx.fillStyle = PAL.amber;
  ctx.shadowColor = PAL.amber;
  ctx.shadowBlur = H * 0.045;
  ctx.font = `900 ${Math.round(H * 0.17)}px Inter, system-ui, Arial`;
  ctx.fillText(String(shown), cx, cy + H * 0.055);
  ctx.shadowBlur = 0;

  // five stars row
  const s = H * 0.034;
  for (let i = 0; i < 5; i++) {
    const on = easeOut(p * 4 - i * 0.5) > 0.35;
    const x = cx + (i - 2) * s * 2.6;
    ctx.fillStyle = on ? PAL.amber : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? s : s * 0.42;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const px = x + Math.cos(a) * rr;
      const py = cy + H * 0.1 + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // checks passed bar
  const pct = f.checksTotal ? f.checksPassed / f.checksTotal : 0;
  const bw = W * 0.42;
  const bx = cx - bw / 2;
  const by = cy + H * 0.16;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, bx, by, bw, H * 0.026, H * 0.013);
  ctx.fill();
  const barGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  barGrad.addColorStop(0, PAL.primary);
  barGrad.addColorStop(1, PAL.secondary);
  ctx.fillStyle = barGrad;
  roundRect(ctx, bx, by, bw * pct * easeOut(p * 1.6), H * 0.026, H * 0.013);
  ctx.fill();
  ctx.fillStyle = PAL.dim;
  ctx.font = `600 ${Math.round(H * 0.023)}px Inter, system-ui, Arial`;
  ctx.fillText(`${f.checksPassed} of ${f.checksTotal} checks already pass — the bones are good`, cx, by + H * 0.062);
}

function drawArch(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const nodes = ["Audit", "Rank", "Fix", "Verify", "Ship"];
  const cy = H * 0.47;
  const seg = W / (nodes.length + 1);

  nodes.forEach((label, i) => {
    const np = easeOut(p * 2.2 - i * 0.22);
    if (np <= 0) return;
    const x = seg * (i + 1);
    if (i > 0) {
      ctx.setLineDash([H * 0.02, H * 0.014]);
      ctx.lineDashOffset = -((p * 4) % 1) * H * 0.05;
      ctx.strokeStyle = PAL.secondary;
      ctx.lineWidth = Math.max(2, H * 0.004);
      ctx.globalAlpha = 0.75 * np;
      ctx.beginPath();
      ctx.moveTo(seg * i + H * 0.055, cy);
      ctx.lineTo(x - H * 0.055, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = np;
    ctx.fillStyle = "#15151f";
    roundRect(ctx, x - seg * 0.32, cy - H * 0.055, seg * 0.64, H * 0.11, H * 0.024);
    ctx.fill();
    ctx.strokeStyle = i === 2 ? PAL.green : i % 2 ? PAL.secondary : PAL.primary;
    ctx.lineWidth = Math.max(1.5, H * 0.0035);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = H * 0.02;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PAL.fg;
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(H * 0.03)}px Inter, system-ui, Arial`;
    ctx.fillText(label, x, cy + H * 0.012);
    ctx.fillStyle = PAL.dim;
    ctx.font = `600 ${Math.round(H * 0.019)}px ui-monospace, monospace`;
    ctx.fillText(`0${i + 1}`, x, cy + H * 0.04);
    ctx.globalAlpha = 1;
  });

  // top fix banner
  const bp = easeOut(p * 2.4 - 1.1);
  if (bp > 0) {
    ctx.globalAlpha = bp;
    ctx.textAlign = "center";
    ctx.fillStyle = PAL.green;
    ctx.font = `800 ${Math.round(H * 0.032)}px Inter, system-ui, Arial`;
    ctx.fillText(`fix #1 → +${f.topFixPoints} pts · ${f.topFixTitle}`, W / 2, cy + H * 0.17);
    ctx.globalAlpha = 1;
  }
}

function drawDiff(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const rows: [string, string][] = [
    [`- ${f.checksTotal - f.checksPassed} checks failing · ${100 - f.score} lost points`, PAL.red],
    [`+ ranked fixes, full code attached`, PAL.green],
    [`+ CI workflow · SECURITY.md · dependabot`, PAL.green],
    [`+ ${f.fixes} fixes applied in ranked order`, PAL.green],
    [`+ grade ${f.grade} → S · 100/100`, PAL.green],
  ];
  const shown = Math.ceil(rows.length * easeOut(p * 1.5));
  ctx.textAlign = "left";
  const bw = W * 0.56;
  const bx = W * 0.22;
  rows.forEach(([text, color], i) => {
    if (i >= shown) return;
    const y = H * 0.34 + i * H * 0.088;
    ctx.globalAlpha = easeOut(p * 5 - i * 0.9);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, bx, y, bw, H * 0.068, H * 0.016);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(H * 0.03)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, bx + H * 0.035, y + H * 0.046);
    ctx.globalAlpha = 1;
  });

  const stamp = easeOut(p * 3 - 3.4);
  if (stamp > 0) {
    ctx.globalAlpha = stamp;
    ctx.textAlign = "center";
    ctx.strokeStyle = PAL.green;
    ctx.lineWidth = Math.max(3, H * 0.008);
    ctx.font = `900 ${Math.round(H * 0.08)}px Inter, system-ui, Arial`;
    ctx.strokeText("APPLIED ✓", W * 0.72, H * 0.78);
    ctx.globalAlpha = 1;
  }
}

function drawGraph(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  // commit graph dots
  const cols = 16;
  const rowsN = 4;
  const gx0 = W * 0.24;
  const gy0 = H * 0.34;
  const dx = W * 0.036;
  const dy = H * 0.075;
  for (let d = 0; d < cols * rowsN; d++) {
    const dp = easeOut(p * 3.2 - d / 55);
    if (dp <= 0) continue;
    const x = gx0 + (d % cols) * dx;
    const y = gy0 + Math.floor(d / cols) * dy;
    ctx.globalAlpha = dp * 0.92;
    ctx.fillStyle = d % 6 === 0 ? PAL.secondary : PAL.primary;
    ctx.beginPath();
    ctx.arc(x, y, H * 0.0095, 0, Math.PI * 2);
    ctx.fill();
    if (d % 6 === 0) {
      ctx.strokeStyle = PAL.secondary;
      ctx.lineWidth = Math.max(1, H * 0.002);
      ctx.globalAlpha = dp * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // climbing score
  const climb = easeOut(p * 1.3);
  const from = f.score;
  const to = 100;
  const val = Math.round(from + (to - from) * climb);
  ctx.textAlign = "center";
  ctx.fillStyle = PAL.fg;
  ctx.font = `900 ${Math.round(H * 0.11)}px Inter, system-ui, Arial`;
  ctx.shadowColor = PAL.secondary;
  ctx.shadowBlur = H * 0.04;
  ctx.fillText(`${from} → ${val}`, W / 2, H * 0.72);
  ctx.shadowBlur = 0;
  ctx.fillStyle = climb > 0.98 ? PAL.green : PAL.dim;
  ctx.font = `800 ${Math.round(H * 0.03)}px Inter, system-ui, Arial`;
  ctx.fillText(climb > 0.98 ? "GRADE S · PLATINUM · 100/100" : `GRADE ${f.grade} → S`, W / 2, H * 0.79);
}

function drawCta(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, t: number, f: CinemaFacts): void {
  const pulse = 1 + 0.025 * Math.sin(t * 4.2);
  ctx.save();
  ctx.translate(W / 2, H * 0.48);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  const a1 = easeOut(p * 4);
  const a2 = easeOut(p * 4 - 1.2);
  ctx.globalAlpha = a1;
  ctx.fillStyle = PAL.fg;
  ctx.font = `900 ${Math.round(H * 0.095)}px Inter, system-ui, Arial`;
  ctx.fillText("Star it. Fix it.", 0, -H * 0.035);
  ctx.globalAlpha = a2;
  ctx.fillStyle = PAL.secondary;
  ctx.shadowColor = PAL.secondary;
  ctx.shadowBlur = H * 0.05;
  ctx.fillText("Ship it.", 0, H * 0.075);
  ctx.shadowBlur = 0;
  // underline sweep
  const uw = W * 0.34 * easeOut(p * 5 - 2);
  const barGrad = ctx.createLinearGradient(-uw / 2, 0, uw / 2, 0);
  barGrad.addColorStop(0, PAL.primary);
  barGrad.addColorStop(1, PAL.secondary);
  ctx.fillStyle = barGrad;
  roundRect(ctx, -uw / 2, H * 0.105, uw, H * 0.008, H * 0.004);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.fillStyle = PAL.dim;
  ctx.font = `700 ${Math.round(H * 0.026)}px Inter, system-ui, Arial`;
  ctx.globalAlpha = easeOut(p * 6 - 3.2);
  ctx.fillText("ShipOS Story Engine — every point earns its way back", W / 2, H * 0.68);
  ctx.globalAlpha = 1;
}

// ── Chrome: act label, chips, captions, overlays ─────────────────────────────

function drawChrome(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  opts: DrawOpts,
  sceneIdx: number,
  localT: number,
  sceneDur: number
): void {
  const { script, facts } = opts;
  const scene = script.scenes[sceneIdx];

  // act label — top left
  ctx.textAlign = "left";
  ctx.fillStyle = PAL.primary;
  ctx.font = `800 ${Math.round(H * 0.022)}px Inter, system-ui, Arial`;
  ctx.fillText((scene?.actLabel ?? "").toUpperCase(), W * 0.035, H * 0.07);
  ctx.fillStyle = PAL.dim;
  ctx.font = `500 ${Math.round(H * 0.017)}px ui-monospace, monospace`;
  ctx.fillText(script.title, W * 0.035, H * 0.102);

  // scene title — top right
  ctx.textAlign = "right";
  ctx.fillStyle = PAL.fg;
  ctx.font = `800 ${Math.round(H * 0.026)}px Inter, system-ui, Arial`;
  ctx.fillText(scene?.title ?? "", W * 0.965, H * 0.07);

  // on-screen kinetic chips — right rail, staggered
  const chips = scene?.onScreen ?? [];
  chips.forEach((c, i) => {
    const cp = easeOut((localT / Math.max(0.4, sceneDur)) * 6 - i * 1.1);
    if (cp <= 0) return;
    ctx.globalAlpha = cp;
    ctx.font = `700 ${Math.round(H * 0.021)}px Inter, system-ui, Arial`;
    const tw = ctx.measureText(c).width;
    const x = W * 0.965 - tw - H * 0.036;
    const y = H * 0.14 + i * H * 0.058;
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    roundRect(ctx, x, y, tw + H * 0.036, H * 0.04, H * 0.02);
    ctx.fill();
    ctx.fillStyle = PAL.secondary;
    ctx.beginPath();
    ctx.arc(x + H * 0.016, y + H * 0.02, H * 0.005, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.fg;
    ctx.textAlign = "left";
    ctx.fillText(c, x + H * 0.028, y + H * 0.027);
    ctx.globalAlpha = 1;
  });

  // captions — bottom center
  if (opts.captionsOn) {
    const chunk = scriptCaptions(opts.script).find((c) => opts.time >= c.start && opts.time < c.end);
    if (chunk) {
      const age = (opts.time - chunk.start) / Math.max(0.2, chunk.end - chunk.start);
      const alpha = Math.min(1, age * 6) * Math.min(1, (1 - age) * 8 + 0.4);
      ctx.font = `600 ${Math.round(H * 0.031)}px Inter, system-ui, Arial`;
      const words = chunk.text.split(" ");
      const lines: string[] = [];
      let line = "";
      const maxW = W * 0.72;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      const boxH = lines.length * H * 0.046 + H * 0.03;
      const boxY = H * 0.9 - H * 0.075 - boxH + H * 0.015;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(6,6,12,0.74)";
      roundRect(ctx, W * 0.5 - W * 0.38, boxY, W * 0.76, boxH, H * 0.018);
      ctx.fill();
      ctx.fillStyle = PAL.fg;
      ctx.textAlign = "center";
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, boxY + H * 0.042 + i * H * 0.046);
      });
      ctx.globalAlpha = 1;
    }
  }

  // watermark
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(139,139,160,0.5)";
  ctx.font = `600 ${Math.round(H * 0.015)}px ui-monospace, monospace`;
  ctx.fillText("ShipOS · Story Engine v4.0", W * 0.035, H * 0.965);
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  opts: DrawOpts,
  sceneIdx: number,
  localT: number,
  sceneDur: number
): void {
  // neon grade
  if (opts.neon) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.7);
    g1.addColorStop(0, "rgba(108,92,231,0.30)");
    g1.addColorStop(1, "rgba(108,92,231,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W, H, 0, W, H, W * 0.7);
    g2.addColorStop(0, "rgba(0,206,201,0.24)");
    g2.addColorStop(1, "rgba(0,206,201,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // film grain
  if (opts.grain) {
    const n = 150;
    for (let i = 0; i < n; i++) {
      const sx = rand(i * 13.3 + Math.floor(t * 24) * 7.7);
      const sy = rand(i * 17.9 + Math.floor(t * 24) * 3.1);
      ctx.globalAlpha = 0.03 + rand(i + t) * 0.05;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx * W, sy * H, H / 720, H / 720);
    }
    ctx.globalAlpha = 1;
  }

  // letterbox
  const bar = H * 0.052;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, bar);
  ctx.fillRect(0, H - bar, W, bar);

  // scene fade in/out
  const fade = Math.min(1, localT / 0.55) * Math.min(1, Math.max(0, sceneDur - localT) / 0.55);
  if (fade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${(1 - fade).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // act boundary flash
  if (localT < 0.35 && sceneIdx > 0) {
    ctx.globalAlpha = (0.35 - localT) * 0.5;
    ctx.fillStyle = PAL.primary;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ── Demo Maker visuals ───────────────────────────────────────────────────────

/** Big repo name reveal — hook / intro card. */
function drawIntro(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const cx = W / 2;
  const cy = H * 0.42;
  const title = f.repoTitle ?? "the repo";
  const size = Math.min(W * 0.085, (W * 0.86) / Math.max(6, title.length) * 1.6);

  // neon wipe-in
  const shown = title.slice(0, Math.ceil(title.length * easeOut(p * 1.6)));
  ctx.textAlign = "center";
  ctx.fillStyle = PAL.fg;
  ctx.shadowColor = PAL.primary;
  ctx.shadowBlur = H * 0.06 * easeOut(p * 2);
  ctx.font = `900 ${Math.round(Math.max(H * 0.055, size))}px Inter, system-ui, Arial`;
  ctx.fillText(shown, cx, cy + H * 0.05);
  ctx.shadowBlur = 0;

  // tagline
  const tp = easeOut(p * 3 - 1.2);
  if (tp > 0) {
    ctx.globalAlpha = tp;
    ctx.fillStyle = PAL.dim;
    ctx.font = `500 ${Math.round(H * 0.028)}px Inter, system-ui, Arial`;
    const tag = f.tagline ?? "a repository worth watching";
    ctx.fillText(tag.length > 72 ? `${tag.slice(0, 69)}…` : tag, cx, cy + H * 0.115);
    ctx.globalAlpha = 1;
  }

  // fact chips: language · license · version/stars
  const chips = [
    f.language ?? null,
    f.licenseName ?? null,
    f.version ? `v${f.version}` : f.stars ? `${f.stars} ★` : null,
  ].filter((c): c is string => Boolean(c));
  const cp = easeOut(p * 4 - 2);
  if (cp > 0 && chips.length) {
    ctx.globalAlpha = cp;
    ctx.font = `700 ${Math.round(H * 0.024)}px ui-monospace, monospace`;
    const cw = chips.map((c) => ctx.measureText(c).width + H * 0.05);
    const total = cw.reduce((a, b) => a + b, 0) + H * 0.02 * (chips.length - 1);
    let x = cx - total / 2;
    chips.forEach((c, i) => {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, x, cy + H * 0.16, cw[i], H * 0.05, H * 0.025);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? PAL.secondary : PAL.primary;
      ctx.lineWidth = Math.max(1, H * 0.002);
      roundRect(ctx, x, cy + H * 0.16, cw[i], H * 0.05, H * 0.025);
      ctx.stroke();
      ctx.fillStyle = PAL.fg;
      ctx.fillText(c, x + cw[i] / 2, cy + H * 0.196);
      x += cw[i] + H * 0.02;
    });
    ctx.globalAlpha = 1;
  }
}

/** Module map — architecture without a whiteboard. */
function drawRepoMap(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const mods = (f.modules ?? []).slice(0, 8);
  const cols = mods.length > 6 ? 4 : mods.length > 3 ? 3 : Math.max(1, mods.length);
  const rowsN = Math.ceil(Math.max(1, mods.length) / cols);
  const gw = W * 0.7;
  const gx0 = W * 0.15;
  const gy0 = H * 0.32;
  const cw = gw / cols;
  const ch = H * 0.11;
  const gap = H * 0.025;

  mods.forEach((m, i) => {
    const dp = easeOut(p * 3.2 - i * 0.28);
    if (dp <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gx0 + col * cw;
    const y = gy0 + row * (ch + gap);
    ctx.globalAlpha = dp;
    ctx.fillStyle = "#15151f";
    roundRect(ctx, x + 4, y + 4, cw - 16, ch, H * 0.02);
    ctx.fill();
    ctx.strokeStyle = i % 2 ? PAL.secondary : PAL.primary;
    ctx.lineWidth = Math.max(1.5, H * 0.003);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = H * 0.015;
    roundRect(ctx, x + 4, y + 4, cw - 16, ch, H * 0.02);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PAL.fg;
    ctx.textAlign = "center";
    ctx.font = `700 ${Math.round(H * 0.026)}px ui-monospace, monospace`;
    const label = m.length > 14 ? `${m.slice(0, 13)}…` : m;
    ctx.fillText(label, x + (cw - 12) / 2, y + ch / 2 + H * 0.008);
    ctx.fillStyle = PAL.dim;
    ctx.font = `600 ${Math.round(H * 0.017)}px ui-monospace, monospace`;
    ctx.fillText(`0${i + 1}`, x + (cw - 12) / 2, y + ch * 0.82);
    ctx.globalAlpha = 1;
  });

  // stack strip
  const stacks = (f.frameworks ?? []).slice(0, 4);
  const sp = easeOut(p * 4 - 2.4);
  if (sp > 0 && (stacks.length || f.language)) {
    ctx.globalAlpha = sp;
    ctx.textAlign = "center";
    ctx.fillStyle = PAL.secondary;
    ctx.font = `700 ${Math.round(H * 0.024)}px Inter, system-ui, Arial`;
    ctx.fillText([f.language, ...stacks].filter(Boolean).join("  ·  "), W / 2, gy0 + rowsN * (ch + gap) + H * 0.045);
    ctx.globalAlpha = 1;
  }
}

/** Terminal type-out — quickstart as the money shot. */
function drawTerminal(ctx: CanvasRenderingContext2D, W: number, H: number, p: number, f: CinemaFacts): void {
  const bx = W * 0.18;
  const by = H * 0.24;
  const bw = W * 0.64;
  const bh = H * 0.46;

  // window chrome
  ctx.fillStyle = "#101018";
  roundRect(ctx, bx, by, bw, bh, H * 0.02);
  ctx.fill();
  ctx.strokeStyle = "rgba(108,92,231,0.4)";
  ctx.lineWidth = Math.max(1, H * 0.002);
  roundRect(ctx, bx, by, bw, bh, H * 0.02);
  ctx.stroke();
  const dotR = H * 0.008;
  ["#ff6b6b", "#f59e0b", "#2ecc71"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(bx + H * 0.035 + i * H * 0.032, by + H * 0.035, dotR, 0, Math.PI * 2);
    ctx.fill();
  });

  const lines: [string, string][] = [
    ["$", f.installCmd ?? "npm install"],
    ["#", f.runCmd ?? "npm run dev"],
    ["$", f.testCmd ?? "npm test"],
    ["✓", "ready — open the browser"],
  ];
  const totalStops = lines.length + 1;
  ctx.textAlign = "left";
  lines.forEach(([prompt, cmd], i) => {
    const lp = easeOut(p * totalStops - i * 1.0);
    if (lp <= 0) return;
    const y = by + H * 0.095 + i * H * 0.085;
    ctx.globalAlpha = Math.min(1, lp);
    ctx.font = `600 ${Math.round(H * 0.028)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = prompt === "✓" ? PAL.green : PAL.secondary;
    ctx.fillText(`${prompt} `, bx + H * 0.045, y);
    const typed = cmd.slice(0, Math.ceil(cmd.length * Math.min(1, lp * 1.6)));
    ctx.fillStyle = prompt === "✓" ? PAL.green : PAL.fg;
    ctx.fillText(typed, bx + H * 0.09, y);
    ctx.globalAlpha = 1;
  });

  // cursor blink
  if (p < 0.96) {
    const blink = (Date.now() / 500) % 2 > 1;
    if (blink) {
      const lastY = by + H * 0.095 + Math.min(lines.length - 1, Math.floor(p * totalStops)) * H * 0.085;
      ctx.fillStyle = PAL.fg;
      ctx.fillRect(bx + H * 0.095, lastY - H * 0.022, H * 0.012, H * 0.03);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Paint one cinematic frame of the script at `time` (seconds). */
export function drawCinemaFrame(ctx: CanvasRenderingContext2D, W: number, H: number, opts: DrawOpts): void {
  const { script, time } = opts;
  if (!script.scenes.length) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const { scene, index } = sceneAt(script, Math.min(time, script.totalDuration - 0.001));
  if (!scene) return;
  const start = sceneStart(script, index);
  const localT = Math.max(0, time - start);
  const p = Math.min(1, localT / Math.max(0.4, scene.duration));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackdrop(ctx, W, H, time);

  // Ken Burns drift
  if (opts.kenBurns) {
    const kb = 1 + 0.06 * easeOut(p);
    const driftX = Math.sin(index * 2.1) * W * 0.006 * p;
    const driftY = Math.cos(index * 1.7) * H * 0.005 * p;
    ctx.translate(W / 2 + driftX, H / 2 + driftY);
    ctx.scale(kb, kb);
    ctx.translate(-W / 2, -H / 2);
  }

  switch (scene.visual) {
    case "gauge":
      drawGauge(ctx, W, H, p, opts.facts);
      break;
    case "stars":
      drawStars(ctx, W, H, p, opts.facts);
      break;
    case "arch":
      drawArch(ctx, W, H, p, opts.facts);
      break;
    case "diff":
      drawDiff(ctx, W, H, p, opts.facts);
      break;
    case "graph":
      drawGraph(ctx, W, H, p, opts.facts);
      break;
    case "intro":
      drawIntro(ctx, W, H, p, opts.facts);
      break;
    case "repo":
      drawRepoMap(ctx, W, H, p, opts.facts);
      break;
    case "terminal":
      drawTerminal(ctx, W, H, p, opts.facts);
      break;
    default:
      drawCta(ctx, W, H, p, time, opts.facts);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawChrome(ctx, W, H, time, opts, index, localT, scene.duration);
  drawOverlays(ctx, W, H, time, opts, index, localT, scene.duration);
}

export const CINE_PALETTE = PAL;
