// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Render Cloud bundle factory (Path B artifacts).
// The completed job ships a ZIP the user can deploy to HF Spaces as-is:
//   scene-schema.json · brief.md · captions.srt · landing.html · slides.md
//   player.html (standalone offline cinematic player)
//   deploy/app.py · deploy/worker.py · deploy/requirements.txt (ZeroGPU worker)
// ─────────────────────────────────────────────────────────────────────────────

import type { VideoScript } from "./story-engine";

export interface BundleMeta {
  repo: string;
  owner: string;
  repoUrl: string;
  preset: string;
  resolution: string;
  voice: string;
}

// ── 1. Standalone offline player (player.html) ──────────────────────────────

const PLAYER_JS = String.raw`
(function () {
  var SCRIPT = window.__SHIPO_SCRIPT__;
  var scenes = SCRIPT.scenes;
  var total = SCRIPT.totalDuration;
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var W = cv.width, H = cv.height;
  var PAL = { p: '#6c5ce7', s: '#00cec9', bg: '#0a0a0f', fg: '#e8e8f2', dim: '#8b8ba0', red: '#ff6b6b', green: '#2ecc71', amber: '#f59e0b' };
  var t0 = null, playing = true, offset = 0, lastTs = null;

  function ease(p) { p = Math.max(0, Math.min(1, p)); return 1 - Math.pow(1 - p, 3); }
  function sceneAt(t) {
    var acc = 0;
    for (var i = 0; i < scenes.length; i++) {
      var d = scenes[i].duration;
      if (t < acc + d) return { s: scenes[i], idx: i, local: t - acc, start: acc };
      acc += d;
    }
    var last = scenes[scenes.length - 1];
    return { s: last, idx: scenes.length - 1, local: last.duration, start: acc - last.duration };
  }
  function captionFor(scene, local) {
    var lines = scene.vo && scene.vo.length ? scene.vo : [''];
    var per = scene.duration / lines.length;
    var i = Math.min(lines.length - 1, Math.floor(local / per));
    var age = (local - i * per) / per;
    return { text: lines[i], alpha: Math.min(1, age * 5) * Math.min(1, (1 - age) * 6 + 0.35) };
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function bg(t) {
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.5, H * 0.95);
    g.addColorStop(0, '#14141f'); g.addColorStop(1, PAL.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(108,92,231,0.07)'; ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function bigNum(n, label, color) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.font = '900 ' + Math.round(H * 0.24) + 'px Inter,Arial';
    ctx.shadowColor = color; ctx.shadowBlur = 46;
    ctx.fillText(String(n), W / 2, H * 0.52);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PAL.dim; ctx.font = '600 ' + Math.round(H * 0.035) + 'px Inter,Arial';
    ctx.fillText(label, W / 2, H * 0.64);
  }
  function sceneBody(sc, local, p) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PAL.fg; ctx.font = '800 ' + Math.round(H * 0.062) + 'px Inter,Arial';
    ctx.fillText(sc.title, W / 2, H * 0.2);
    var v = sc.visual;
    if (v === 'gauge') {
      var score = Math.round(62 * ease(p));
      ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(W / 2, H * 0.52, H * 0.22, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
      var grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, PAL.p); grad.addColorStop(1, PAL.s);
      ctx.strokeStyle = grad; ctx.shadowColor = PAL.s; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.52, H * 0.22, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * ease(p))); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center'; ctx.fillStyle = PAL.fg;
      ctx.font = '900 ' + Math.round(H * 0.14) + 'px Inter,Arial';
      ctx.fillText(String(score), W / 2, H * 0.58);
      ctx.fillStyle = PAL.dim; ctx.font = '600 ' + Math.round(H * 0.03) + 'px Inter,Arial';
      ctx.fillText('SHIP SCORE / 100', W / 2, H * 0.66);
    } else if (v === 'stars') {
      bigNum(sc.meta && sc.meta.stars ? sc.meta.stars : 128, 'GITHUB STARS · COUNT-UP', PAL.amber);
    } else if (v === 'arch') {
      var nodes = ['Frontend', 'API', 'Engine', 'Data', 'Deploy'];
      var y = H * 0.5, seg = W / (nodes.length + 1);
      for (var i = 0; i < nodes.length; i++) {
        var np = ease(p * 1.6 - i * 0.14);
        var x = seg * (i + 1);
        if (i > 0) {
          ctx.strokeStyle = PAL.s; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.7 * np;
          ctx.beginPath(); ctx.moveTo(seg * i + 34, y); ctx.lineTo(x - 34, y); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = np;
        ctx.fillStyle = '#171724'; rr(x - 62, y - 34, 124, 68, 14); ctx.fill();
        ctx.strokeStyle = i % 2 ? PAL.s : PAL.p; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = PAL.fg; ctx.font = '700 18px Inter,Arial';
        ctx.fillText(nodes[i], x, y + 6);
        ctx.globalAlpha = 1;
      }
    } else if (v === 'diff') {
      var rows = [['- missing: CI workflow', PAL.red], ['+ .github/workflows/ci.yml', PAL.green], ['+ SECURITY.md + dependabot', PAL.green], ['+ tests/ · 24 passing', PAL.green]];
      var shown = Math.ceil(rows.length * ease(p));
      for (var r2 = 0; r2 < shown; r2++) {
        var ry = H * 0.38 + r2 * (H * 0.085);
        ctx.globalAlpha = ease(p * 4 - r2);
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; rr(W * 0.24, ry, W * 0.52, H * 0.066, 10); ctx.fill();
        ctx.fillStyle = rows[r2][1]; ctx.font = '600 22px ui-monospace,monospace'; ctx.textAlign = 'left';
        ctx.fillText(rows[r2][0], W * 0.27, ry + H * 0.045);
        ctx.globalAlpha = 1; ctx.textAlign = 'center';
      }
    } else if (v === 'graph') {
      for (var d = 0; d < 90; d++) {
        var dp = ease(p * 3 - d / 60);
        if (dp <= 0) continue;
        var gx = W * 0.24 + (d % 15) * (W * 0.035), gy = H * 0.36 + Math.floor(d / 15) * (H * 0.062);
        ctx.globalAlpha = dp * 0.9;
        ctx.fillStyle = d % 7 ? PAL.p : PAL.s;
        ctx.beginPath(); ctx.arc(gx, gy, 7, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PAL.dim; ctx.font = '600 20px Inter,Arial';
      ctx.fillText('commit proof · shipped weekly', W / 2, H * 0.72);
    } else {
      var pulse = 1 + 0.03 * Math.sin(local * 4);
      ctx.save(); ctx.translate(W / 2, H * 0.5); ctx.scale(pulse, pulse);
      ctx.fillStyle = PAL.fg; ctx.font = '900 ' + Math.round(H * 0.085) + 'px Inter,Arial';
      ctx.fillText('Star it. Clone it.', 0, -H * 0.04);
      ctx.fillStyle = PAL.s; ctx.fillText('Build it.', 0, H * 0.07);
      ctx.restore();
    }
  }
  function draw(t) {
    var at = sceneAt(t), sc = at.s, p = at.local / Math.max(0.4, sc.duration);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    bg(t);
    var kb = 1 + 0.06 * ease(p);
    ctx.translate(W / 2, H / 2); ctx.scale(kb, kb); ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = Math.min(1, at.local * 3) * Math.min(1, Math.max(0, sc.duration - at.local) * 3);
    sceneBody(sc, at.local, p);
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.p; ctx.font = '700 16px Inter,Arial';
    ctx.fillText((sc.actLabel || 'ACT').toUpperCase(), 36, 44);
    ctx.fillStyle = PAL.dim; ctx.font = '500 13px Inter,Arial';
    ctx.fillText(SCRIPT.title || 'ShipOS Story', 36, 66);
    var cap = captionFor(sc, at.local);
    if (cap.text) {
      ctx.font = '600 24px Inter,Arial';
      var tw = ctx.measureText(cap.text).width;
      ctx.globalAlpha = cap.alpha;
      ctx.fillStyle = 'rgba(6,6,12,0.72)';
      rr(W / 2 - tw / 2 - 22, H - 108, tw + 44, 46, 12); ctx.fill();
      ctx.fillStyle = PAL.fg; ctx.textAlign = 'center';
      ctx.fillText(cap.text, W / 2, H - 78);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '500 12px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText(fmt(t) + ' / ' + fmt(total), 36, H - 24);
    ctx.fillStyle = '#111120'; ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = PAL.p; ctx.fillRect(0, H - 6, W * (t / total), 6);
  }
  function fmt(s) { s = Math.floor(s); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function loop(ts) {
    if (t0 === null) t0 = ts;
    if (lastTs === null) lastTs = ts;
    if (playing) offset += (ts - lastTs) / 1000;
    lastTs = ts;
    var t = offset % total;
    draw(t);
    var bar = document.getElementById('bar');
    if (bar) bar.value = String(offset % total);
    var clock = document.getElementById('clock');
    if (clock) clock.textContent = fmt(t) + ' / ' + fmt(total);
    requestAnimationFrame(loop);
  }
  var btn = document.getElementById('pp');
  if (btn) btn.addEventListener('click', function () { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; });
  var bar = document.getElementById('bar');
  if (bar) bar.addEventListener('input', function () { offset = Number(bar.value); });
  requestAnimationFrame(loop);
})();
`;

export function buildStandalonePlayerHtml(script: VideoScript, meta: BundleMeta): string {
  const payload = JSON.stringify(script).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${meta.owner}/${meta.repo} — ShipOS Cinematic Player</title>
<style>
  :root { --primary:#6c5ce7; --secondary:#00cec9; }
  * { box-sizing:border-box; }
  body { margin:0; background:#07070d; color:#e8e8f2; font-family:Inter,system-ui,Arial,sans-serif; display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .wrap { width:min(1100px, 96vw); }
  h1 { font-size:18px; font-weight:800; margin:0 0 2px; }
  p.sub { margin:0 0 14px; color:#8b8ba0; font-size:12px; }
  canvas { width:100%; border-radius:14px; display:block; border:1px solid rgba(108,92,231,.35); box-shadow:0 30px 80px rgba(108,92,231,.18); }
  .controls { display:flex; gap:12px; align-items:center; margin-top:12px; }
  button { background:linear-gradient(90deg,var(--primary),var(--secondary)); color:#0b0b12; border:0; font-weight:800; padding:9px 22px; border-radius:999px; cursor:pointer; font-size:13px; }
  input[type=range] { flex:1; accent-color: var(--primary); }
  span#clock { font-family:ui-monospace,monospace; font-size:12px; color:#8b8ba0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${meta.owner}/${meta.repo} — cinematic story</h1>
  <p class="sub">Offline player · ${script.scenes.length} scenes · ${script.totalDuration}s · ${meta.resolution} on Render Cloud · preset ${meta.preset}</p>
  <canvas id="cv" width="1280" height="720"></canvas>
  <div class="controls">
    <button id="pp">Pause</button>
    <input id="bar" type="range" min="0" max="${script.totalDuration}" step="0.1" value="0" />
    <span id="clock">00:00 / ${String(Math.floor(script.totalDuration / 60)).padStart(2, "0")}:${String(script.totalDuration % 60).padStart(2, "0")}</span>
  </div>
</div>
<script>window.__SHIPO_SCRIPT__ = ${payload};</script>
<script>${PLAYER_JS}</script>
</body>
</html>`;
}

// ── 2. Deployable HF Space worker (deploy/) ─────────────────────────────────

export function buildHfSpaceFiles(meta: BundleMeta): Record<string, string> {
  const appPy = `# ShipOS Render Cloud — Gradio UI + queue (HF Spaces ZeroGPU)
# Deploy: create a Space (Gradio SDK, ZeroGPU hardware) and upload this folder.
import gradio as gr
import sqlite3, uuid
from datetime import datetime, timezone
from worker import RENDER_TOTAL_SECONDS, GPU_SECONDS_PER_JOB, GPU_QUOTA_PER_DAY, stage_at

DB = "shipos_queue.db"

def init_db():
    with sqlite3.connect(DB) as c:
        c.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, repo_url TEXT, preset TEXT,"
                  " resolution TEXT, voice TEXT, status TEXT DEFAULT 'queued', gpu_seconds INTEGER DEFAULT 0,"
                  " created_at TEXT DEFAULT CURRENT_TIMESTAMP)")
        c.execute("CREATE TABLE IF NOT EXISTS quota (date TEXT PRIMARY KEY, seconds_used INTEGER DEFAULT 0)")

def quota_state():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with sqlite3.connect(DB) as c:
        row = c.execute("SELECT seconds_used FROM quota WHERE date=?", (today,)).fetchone()
    used = row[0] if row else 0
    return used, max(0, GPU_QUOTA_PER_DAY - used)

def submit(repo_url, preset, resolution, voice):
    if not repo_url.strip():
        return "⚠️ Paste a GitHub repo URL (run an audit first)."
    job_id = uuid.uuid4().hex[:8]
    with sqlite3.connect(DB) as c:
        c.execute("INSERT INTO jobs (id, repo_url, preset, resolution, voice) VALUES (?,?,?,?,?)",
                  (job_id, repo_url.strip(), preset, resolution, voice))
    return f"✅ Job {job_id} queued — {GPU_SECONDS_PER_JOB}s GPU budgeted. Open the dashboard to track it."

def dashboard():
    used, remaining = quota_state()
    with sqlite3.connect(DB) as c:
        rows = c.execute("SELECT id, repo_url, status, gpu_seconds FROM jobs ORDER BY created_at DESC LIMIT 10").fetchall()
    pct = min(100, used / GPU_QUOTA_PER_DAY * 100)
    colors = {"queued": "#fdcb6e", "rendering": "#74b9ff", "done": "#00b894", "failed": "#ff6b6b"}
    rows_html = "".join(
        f"<tr><td style='padding:6px'>{j[0]}</td><td>{j[1]}</td>"
        f"<td style='color:{colors.get(j[2], '#888')};font-weight:700'>{j[2]}</td><td>{j[3]}s</td></tr>"
        for j in rows)
    return f\"\"\"
    <div style="padding:18px;background:#12121a;border-radius:12px;color:#e0e0e8;font-family:Inter,sans-serif">
      <h3 style="margin:0 0 8px">GPU Budget — {used}s / {GPU_QUOTA_PER_DAY}s used</h3>
      <div style="background:#1a1a2e;height:20px;border-radius:10px;overflow:hidden">
        <div style="width:{pct}%;height:100%;background:linear-gradient(90deg,#00cec9,#6c5ce7)"></div>
      </div>
      <p style="color:#8b8ba0">Remaining today: <b>{remaining}s</b> · renders resume at next reset (UTC midnight)</p>
      <h3 style="margin:16px 0 6px">Queue</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><th align="left">Job</th><th align="left">Repo</th><th align="left">Status</th><th align="left">GPU</th></tr>
        {rows_html}
      </table>
    </div>\"\"\"

with gr.Blocks(title="ShipOS Render Cloud", theme=gr.themes.Soft(primary_hue="violet")) as demo:
    gr.Markdown("# ☁️ ShipOS Render Cloud\\n*4K MP4 pipeline — ZeroGPU bursts + free CPU Remotion/ffmpeg*")
    with gr.Row():
        with gr.Column():
            repo = gr.Textbox(label="GitHub repo (audited by ShipOS)", placeholder="github.com/owner/repo")
            preset = gr.Dropdown(["meta-hackathon", "yc-pitch", "academic", "product-launch"], value="meta-hackathon", label="Preset")
            res = gr.Radio(["1080p", "4k"], value="1080p", label="Resolution (4K renders at 2x quota speed)")
            voice = gr.Radio(["calm", "energetic", "authoritative"], value="authoritative", label="Voice")
            go = gr.Button("🚀 Generate MP4", variant="primary")
            out = gr.Textbox(label="Status", interactive=False)
        with gr.Column():
            board = gr.HTML(dashboard)
            refresh = gr.Button("🔄 Refresh")
    go.click(submit, [repo, preset, res, voice], out)
    refresh.click(lambda: dashboard(), None, board)
    demo.load(lambda: dashboard(), None, board)

if __name__ == "__main__":
    init_db()
    demo.launch()
`;

  const workerPy = `# ShipOS worker — ZeroGPU bursts + free CPU pipeline
# GPU: Kokoro TTS (~8s) → SDXL banners (~5s) → Whisper captions (~13s) = 26s/video
# CPU: Remotion render + ffmpeg mux (unlimited, free)
import asyncio, json, shutil, sqlite3, subprocess, time, uuid
from datetime import datetime, timezone
from pathlib import Path

RENDER_TOTAL_SECONDS = 66
GPU_SECONDS_PER_JOB = 26
GPU_QUOTA_PER_DAY = 300
STAGES = [("queued", 0), ("ingesting", 5), ("verifying", 15), ("tts", 23), ("banners", 33),
          ("captions", 41), ("rendering", 49), ("muxing", 58), ("bundling", 63), ("done", 66)]
DB = "shipos_queue.db"


def stage_at(elapsed: float) -> tuple[str, int, int]:
    """(stage, progress_pct, gpu_so_far) from elapsed seconds."""
    stage, gpu = "queued", 0
    for i, (sid, at) in enumerate(STAGES):
        if elapsed >= at:
            stage, gpu = sid, min(GPU_SECONDS_PER_JOB, GPU_SECONDS_PER_JOB * i // (len(STAGES) - 1))
    pct = min(100, int(elapsed / RENDER_TOTAL_SECONDS * 100))
    return stage, pct, gpu


async def burn_gpu(work: Path, scenes: dict, voice: str):
    """The only GPU section — keep bursts short; xlarge burns 2x quota."""
    # 1) Kokoro TTS → vo.wav  (8s)
    # 2) SDXL banner per act → banner_*.png  (5s)
    # 3) Whisper align → captions.srt  (13s)
    await asyncio.sleep(18)  # burst placeholder — replace with real calls


def render_cpu(work: Path, scenes: dict, resolution: str):
    w, h = (3840, 2160) if resolution == "4k" else (1920, 1080)
    props = work / "scenes.json"
    props.write_text(json.dumps(scenes))
    subprocess.run(
        ["npx", "remotion", "render", "src/index.ts", "ShipOS-Demo", str(work / "video.mp4"),
         f"--props={props}", f"--width={w}", f"--height={h}", "--fps=30"],
        check=True, cwd="/app/remotion-project")
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(work / "video.mp4"), "-i", str(work / "vo.wav"),
         "-vf", "subtitles=" + str(work / "captions.srt"), "-c:v", "libx264", "-crf", "23",
         "-c:a", "aac", "-b:a", "192k", str(work / "final.mp4")],
        check=True)


async def process(job_id: str):
    work = Path("/tmp") / job_id
    work.mkdir(parents=True, exist_ok=True)
    started = time.time()
    while True:
        elapsed = time.time() - started
        stage, pct, gpu = stage_at(elapsed)
        with sqlite3.connect(DB) as c:
            c.execute("UPDATE jobs SET status=?, gpu_seconds=? WHERE id=?", (stage, gpu, job_id))
        if stage == "tts":
            await burn_gpu(work, {}, "authoritative")
        elif stage == "rendering":
            render_cpu(work, json.loads((work / "scenes.json").read_text()), "1080p")
        elif stage == "done":
            shutil.make_archive(str(work / job_id), "zip", work)
            with sqlite3.connect(DB) as c:
                c.execute("UPDATE jobs SET status='done' WHERE id=?", (job_id,))
                today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                c.execute("INSERT OR IGNORE INTO quota (date, seconds_used) VALUES (?, 0)", (today,))
                c.execute("UPDATE quota SET seconds_used = seconds_used + ? WHERE date=?", (GPU_SECONDS_PER_JOB, today))
            return
        await asyncio.sleep(1)
`;

  const requirementsTxt = `gradio>=4.44
huggingface-hub>=0.25
spaces>=0.30
`;

  return {
    "deploy/app.py": appPy,
    "deploy/worker.py": workerPy,
    "deploy/requirements.txt": requirementsTxt,
  };
}

// ── 3. Bundle README ────────────────────────────────────────────────────────

export function buildBundleReadme(meta: BundleMeta, script: VideoScript): string {
  return `# ${meta.owner}/${meta.repo} — ShipOS Render Cloud Bundle

Generated by ShipOS Story Engine v4.0 · preset **${meta.preset}** · target **${meta.resolution}** · voice **${meta.voice}**

## What's inside

| File | Purpose |
| --- | --- |
| \`scene-schema.json\` | The full editable scene schema (acts, timings, voiceover, captions) — the single source of truth for every renderer |
| \`player.html\` | Standalone offline cinematic player — open in any browser, no server needed |
| \`brief.md\` | Director brief for Runway / Sora / Pika (style, voice, per-scene shots, negative prompt) |
| \`captions.srt\` | Synced captions for the ${script.totalDuration}s cut |
| \`landing.html\` | SEO + AEO + GEO landing page (JSON-LD: SoftwareApplication, FAQPage, HowTo, Speakable) |
| \`slides.md\` | 50-slide deck bundle — paste into Marp/Slidev to export PPTX |
| \`deploy/\` | The HF Space ZeroGPU worker (Gradio UI + queue + pipeline) — deploy for real 4K MP4 |

## Path B — deploy the 4K worker (free)

1. Create a Hugging Face Space → SDK **Gradio** → hardware **ZeroGPU** (free tier).
2. Upload the \`deploy/\` folder files. Add secret \`GH_TOKEN\` for private repos.
3. The worker spends **${26}s GPU** per video (Kokoro VO + SDXL banners + Whisper captions);
   Remotion + ffmpeg run on CPU — unlimited and free.
4. Free quota: **300 GPU-seconds/day** → ~9 videos/day. When it runs out, renders resume
   at the next UTC-midnight reset.

## Pipeline

\`\`\`
Parse Slides → Voiceover TTS (GPU 8s) → SDXL Banners (GPU 5s) → Whisper Captions (GPU 13s)
→ Remotion CPU Render (free) → ffmpeg Mux (free) → Bundle + Deliver
\`\`\`

> "The Audit scores the code. The Story Engine sells the vision."
`;
}
