// ─────────────────────────────────────────────────────────────────────────────
// fireConfetti — tiny self-contained canvas confetti (no deps, SSR-safe).
// ~120 particles from center-top, emerald/amber/violet/white, 1.8s fade.
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ["#10b981", "#34d399", "#f59e0b", "#a78bfa", "#ffffff"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

export function fireConfetti(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const particles: Particle[] = [];
  const originX = w / 2;
  const originY = h * 0.18;
  for (let i = 0; i < 120; i++) {
    const angle = (Math.PI / 3) * (Math.random() - 0.5) - Math.PI / 2; // fan downward
    const speed = 6 + Math.random() * 9;
    particles.push({
      x: originX + (Math.random() - 0.5) * 80,
      y: originY,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }

  const DURATION = 1800;
  const start = performance.now();

  const frame = (now: number) => {
    const t = now - start;
    const alpha = t < DURATION * 0.6 ? 1 : Math.max(0, 1 - (t - DURATION * 0.6) / (DURATION * 0.4));
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = alpha;

    for (const p of particles) {
      p.vy += 0.22; // gravity
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    }

    if (t < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}
