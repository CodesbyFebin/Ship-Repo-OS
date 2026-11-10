"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoTab — Cinematic Narrator: a simple, powerful video maker that plays the
// 5-act story script with browser TTS voiceover, synced captions, Ken Burns
// motion, neon/dark grading and per-act scene engines (CINE.MAP):
//   gauge-spin + whoosh · stars count-up + coin-drop · arch mermaid-flow ·
//   diff-scroll + success-chime · commit-graph proof · cta zoom
// Pipeline: Parse Slides → Voiceover TTS → Sync Captions → Render → Export
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  Crown,
  Download,
  Film,
  Gauge,
  Mic,
  Music,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Wand2,
} from "@/ui/symbols";
import { Badge, Button, Card, Chip, CodeBlock, Icon, IconButton, SegmentedButton, Slider, cn } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobResponse } from "@/lib/shipos/audit-types";
import {
  buildVideoBrief,
  buildVideoScript,
  formatSrt,
  formatVtt,
  sceneAt,
  scriptCaptions,
  type VideoScript,
} from "@/lib/shipos/story-engine";
import { copyText, downloadText, fmtClock } from "./story-utils";

type VoiceMode = "calm" | "energetic" | "authoritative";
const SPEEDS = [0.5, 1, 1.5, 2] as const;
const VOICE_PRESETS: Record<VoiceMode, { label: string; rate: number; pitch: number }> = {
  calm: { label: "Calm", rate: 0.92, pitch: 1.0 },
  energetic: { label: "Energetic", rate: 1.14, pitch: 1.1 },
  authoritative: { label: "Authoritative", rate: 1.0, pitch: 0.85 },
};

/* The screen is a fixed-dark media surface (the cinema) inside a themed page.
   Two local roles derive it from system colours in BOTH schemes:
   --screen-ink  the content colour on the screen
   --screen-bg   the screen's own base                              */
const SCREEN_VARS =
  "[--screen-ink:var(--md-sys-color-inverse-on-surface-rgb)] dark:[--screen-ink:var(--md-sys-color-on-surface-rgb)] " +
  "[--screen-bg:var(--md-sys-color-inverse-surface-rgb)] dark:[--screen-bg:var(--md-sys-color-surface-container-lowest-rgb)]";

function useCountUp(target: number, durationMs: number, restartKey: string): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, restartKey]);
  return val;
}

export function VideoTab({ job, isProUser, onUpgrade }: { job: AuditJobResponse; isProUser: boolean; onUpgrade: () => void }) {
  const baseScript = useMemo(() => buildVideoScript(job), [job]);
  const [aiScript, setAiScript] = useState<VideoScript | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const script = aiScript ?? baseScript;
  const total = script.totalDuration;

  const chunks = useMemo(() => scriptCaptions(script), [script]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [voice, setVoice] = useState<VoiceMode>("authoritative");
  const [musicVol, setMusicVol] = useState(25);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [speakOn, setSpeakOn] = useState(true);
  const [elevenLabs, setElevenLabs] = useState(false);
  const [ultraHd, setUltraHd] = useState(false);
  const [kenBurns, setKenBurns] = useState(true);
  const [neon, setNeon] = useState(true);
  const [vttMode, setVttMode] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const speakRef = useRef(false);
  const lastSpokenRef = useRef<string | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[] } | null>(null);

  const { scene, index: sceneIndex } = useMemo(() => sceneAt(script, time), [script, time]);
  const currentChunk = chunks.find((c) => time >= c.start && time < c.end) ?? null;
  const nextChunk = chunks.find((c) => c.start > time) ?? null;
  const brief = useMemo(() => buildVideoBrief(job, script), [job, script]);
  const captionsText = useMemo(() => (vttMode ? formatVtt(chunks) : formatSrt(chunks)), [chunks, vttMode]);

  // Hooks must run unconditionally — count-up target is 0 when no audit exists.
  const scoreShown = useCountUp(job.audit?.score ?? 0, 2200, `${scene?.id ?? "x"}`);

  // ── Music pad (WebAudio, generated — no assets needed) ─────────────────────
  const startMusic = useCallback(() => {
    if (audioRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = (musicVol / 100) * 0.055;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(gain.gain);
      const freqs = [110, 164.81, 220];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      lfo.start();
      gain.connect(ctx.destination);
      audioRef.current = { ctx, gain, oscs: [...oscs, lfo] };
    } catch {
      // audio blocked — silently continue without music
    }
  }, [musicVol]);

  const stopMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.oscs.forEach((o) => o.stop());
      void a.ctx.close();
    } catch {
      // ignore
    }
    audioRef.current = null;
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.gain.gain.value = (musicVol / 100) * 0.055;
  }, [musicVol]);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTime((t) => {
        const next = t + 0.1 * speed;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed, total]);

  // ── Voiceover: speak each scene when it becomes active during playback ──────
  useEffect(() => {
    speakRef.current = speakOn;
  }, [speakOn]);

  useEffect(() => {
    if (!playing || !speakRef.current || !scene) return;
    if (lastSpokenRef.current === scene.id) return;
    lastSpokenRef.current = scene.id;
    try {
      window.speechSynthesis.cancel();
      if (elevenLabs && !isProUser) {
        // gated below; never reaches here
      }
      const u = new SpeechSynthesisUtterance(scene.vo.join(" "));
      const preset = VOICE_PRESETS[voice];
      u.rate = Math.min(2, Math.max(0.5, preset.rate * speed));
      u.pitch = preset.pitch;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch {
      // TTS unavailable
    }
  }, [playing, scene, voice, speed, elevenLabs, isProUser]);

  // Stop speaking + music when paused / unmounted / finished
  useEffect(() => {
    if (!playing) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      stopMusic();
    }
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [playing, stopMusic]);

  useEffect(() => stopMusic, [stopMusic]);

  const togglePlay = () => {
    if (!playing && time >= total) {
      setTime(0);
      lastSpokenRef.current = null;
    }
    setPlaying((p) => {
      if (!p) startMusic();
      return !p;
    });
  };

  const restart = () => {
    setTime(0);
    lastSpokenRef.current = null;
    setPlaying(false);
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  };

  const seek = (t: number) => {
    setTime(t);
    lastSpokenRef.current = null;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  };

  const enhanceScript = async () => {
    setEnhancing(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, kind: "video" }),
      });
      const body = (await res.json()) as { ok: boolean; script?: VideoScript; enhanced?: boolean; error?: string };
      if (body.ok && body.script) {
        setAiScript(body.script);
      }
    } catch {
      // network error — deterministic script remains
    } finally {
      setEnhancing(false);
    }
  };

  const resetScript = () => {
    setAiScript(null);
    lastSpokenRef.current = null;
  };

  const exportMp4 = () => {
    // Honest demo behavior: browser-preview render + brief/SRT exports.
    downloadText(`${job.repo}-video-brief.md`, brief);
    downloadText(`${job.repo}-captions.srt`, formatSrt(chunks), "text/plain;charset=utf-8");
  };

  if (!job.audit || !script.scenes.length) return null;

  const a = job.audit;

  return (
    <div className="flex flex-col gap-4">
      {/* Pipeline */}
      <Card padding="none" className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
        <span className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={Film} size="sm" className="text-primary" />
          CINEMATIC NARRATOR
        </span>
        {["Parse Slides", "Voiceover TTS", "Sync Captions", "Render", "Export"].map((s, i) => (
          <span key={s} className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant/80">
            {i > 0 && <span className="text-on-surface-variant/40">→</span>}
            <span className={cn("size-1.5 rounded-full", i < 3 ? "bg-positive" : "bg-on-surface/30")} />
            {s}
          </span>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {aiScript && (
            <Badge variant="outlined" icon={Sparkles} className="font-mono text-primary">
              AI script
            </Badge>
          )}
          <Button size="xs" variant="outlined" icon={Wand2} loading={enhancing} loadingLabel="Writing…" onClick={() => void enhanceScript()} className="font-mono">
            LLM story script
          </Button>
          {aiScript && (
            <Button size="xs" variant="text" onClick={resetScript} className="font-mono text-on-surface-variant">
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* Player */}
      <Card padding="none" className={cn("overflow-hidden", ultraHd && "ring-1 ring-primary/40")}>
        {/* viewport */}
        <div className={cn("relative mx-auto w-full overflow-hidden", SCREEN_VARS, ultraHd ? "max-w-none" : "max-w-4xl")}>
          <div className="relative aspect-video w-full">
            {/* cinematic background — Ken Burns + parallax + grading */}
            <div
              key={`bg-${scene?.id ?? 0}-${kenBurns ? "k" : "s"}`}
              className="absolute inset-0 bg-[rgb(var(--screen-bg))]"
              style={{
                backgroundImage:
                  "radial-gradient(900px 460px at 18% 24%, rgb(var(--md-sys-color-primary-rgb) / 0.34), transparent 62%), radial-gradient(860px 460px at 82% 72%, rgb(var(--md-sys-color-tertiary-rgb) / 0.26), transparent 60%), radial-gradient(500px 300px at 50% 110%, rgb(var(--md-sys-color-primary-rgb) / 0.22), transparent 60%)",
                animation: kenBurns
                  ? `${sceneIndex % 2 === 0 ? "cine-kenburns" : "cine-kenburns-alt"} ${Math.max(16, (scene?.duration ?? 24) / speed)}s ease-in-out forwards`
                  : undefined,
                transform: !kenBurns ? "scale(1.02)" : undefined,
              }}
            />
            {/* film grain */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: "repeating-conic-gradient(rgb(var(--screen-ink) / 0.6) 0% 25%, transparent 0% 50%)",
                backgroundSize: "3px 3px",
                animation: "cine-grain 1.1s steps(2) infinite",
              }}
              aria-hidden
            />
            {/* neon grading overlay */}
            <div
              className={cn("pointer-events-none absolute inset-0 transition-opacity duration-700", neon ? "opacity-100" : "opacity-0")}
              style={{ background: "linear-gradient(120deg, rgb(var(--md-sys-color-primary-rgb) / 0.10), transparent 40%, rgb(var(--md-sys-color-tertiary-rgb) / 0.10))", mixBlendMode: "screen" }}
              aria-hidden
            />

            {/* scene content */}
            <AnimatePresence mode="wait">
              {scene && (
                <motion.div
                  key={scene.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col justify-between p-5 sm:p-8"
                  style={{ animation: sceneIndex === 0 ? "cine-whoosh 0.9s ease-out" : undefined }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-label-sm uppercase tracking-[0.32em] text-[rgb(var(--screen-ink)/0.9)]">{scene.actLabel}</p>
                      <h3 className="mt-1 max-w-xl text-headline-sm font-bold leading-tight text-[rgb(var(--screen-ink))] sm:text-headline-lg">{scene.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-extra-small bg-[rgb(var(--screen-ink)/0.06)] px-2 py-1 font-mono text-label-sm text-[rgb(var(--screen-ink)/0.7)]">
                      {ultraHd ? "4K · 3840×2160" : "1080p · 1920×1080"}
                    </span>
                  </div>

                  <div className="flex flex-1 items-center justify-center py-2">
                    <SceneEngine scene={scene} audit={a} stars={job.repoMeta?.stars ?? 0} scoreShown={scoreShown} speed={speed} restartKey={`${scene.id}`} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {scene.onScreen.map((t, i) => (
                      <motion.span
                        key={`${scene.id}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.7 }}
                        className="rounded-small bg-[rgb(var(--screen-ink)/0.06)] px-2.5 py-1 font-mono text-label-sm text-[rgb(var(--screen-ink)/0.85)] backdrop-blur-sm"
                      >
                        {t}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* captions */}
            {captionsOn && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-[linear-gradient(to_top,rgb(var(--screen-bg)/0.85),rgb(var(--screen-bg)/0.4),transparent)] px-4 pb-4 pt-10">
                <p key={currentChunk?.start ?? "idle"} className="max-w-2xl text-center text-body-md font-semibold leading-snug text-[rgb(var(--screen-ink))] drop-shadow-lg sm:text-body-lg">
                  {currentChunk?.text ?? (playing ? "…" : "Press play — the story tells itself.")}
                </p>
                {nextChunk && <p className="max-w-xl text-center text-label-sm text-[rgb(var(--screen-ink)/0.45)]">{nextChunk.text}</p>}
              </div>
            )}

            {/* play overlay */}
            {!playing && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play the narrative video"
                className="group absolute inset-0 z-10 flex items-center justify-center bg-[rgb(var(--screen-bg)/0.25)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-[rgb(var(--screen-ink)/0.1)] shadow-[inset_0_0_0_1px_rgb(var(--screen-ink)/0.3)] backdrop-blur-md transition-transform group-hover:scale-110">
                  <Icon icon={Play} filled className="size-7 text-[rgb(var(--screen-ink))]" />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="flex flex-col gap-3 bg-surface-container-high px-4 py-3">
          <div className="flex items-center gap-3">
            <IconButton icon={playing ? Pause : Play} label={playing ? "Pause" : "Play"} variant="outlined" size="md" onClick={togglePlay} className="shrink-0" />
            <IconButton icon={RotateCcw} label="Restart" variant="outlined" size="md" onClick={restart} className="shrink-0" />
            <span className="shrink-0 font-mono text-label-sm text-on-surface-variant tnum">
              {fmtClock(time)} / {fmtClock(total)}
            </span>
            <Slider
              label="Timeline scrubber"
              hideLabel
              min={0}
              max={total}
              step={0.1}
              value={time}
              onInput={(e) => seek(Number(e.currentTarget.value))}
              className="min-w-24 flex-1"
            />
            <span className="hidden shrink-0 font-mono text-label-sm text-on-surface-variant sm:inline">
              Act {sceneIndex + 1}/5
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* speed */}
            <div className="flex items-center gap-1">
              <Icon icon={Gauge} size="sm" className="text-on-surface-variant" />
              <SegmentedButton
                label="Playback speed"
                options={SPEEDS.map((s) => ({ value: String(s), label: `${s}x` }))}
                value={String(speed)}
                onChange={(v) => setSpeed(Number(v) as (typeof SPEEDS)[number])}
              />
            </div>

            {/* voice */}
            <div className="flex items-center gap-1">
              <Icon icon={Mic} size="sm" className="text-on-surface-variant" />
              <SegmentedButton
                label="Narrator voice"
                options={(Object.keys(VOICE_PRESETS) as VoiceMode[]).map((v) => ({ value: v, label: VOICE_PRESETS[v].label }))}
                value={voice}
                onChange={setVoice}
              />
            </div>

            {/* music volume */}
            <div className="flex w-32 items-center gap-2">
              <Icon icon={Music} size="sm" className="shrink-0 text-on-surface-variant" />
              <Slider
                label="Music volume"
                hideLabel
                min={0}
                max={100}
                step={1}
                value={musicVol}
                onInput={(e) => setMusicVol(Number(e.currentTarget.value))}
                className="flex-1"
              />
            </div>

            <Chip kind="filter" selected={speakOn} icon={speakOn ? Volume2 : VolumeX} onClick={() => setSpeakOn((s) => !s)} className="font-mono">
              Voiceover
            </Chip>

            <Chip kind="filter" selected={captionsOn} icon={MessageSquare} onClick={() => setCaptionsOn((c) => !c)} className="font-mono">
              Captions
            </Chip>

            {/* ElevenLabs (PRO) */}
            <Chip
              kind="filter"
              selected={elevenLabs && isProUser}
              onClick={() => {
                if (!isProUser) {
                  onUpgrade();
                  return;
                }
                setElevenLabs((e) => !e);
              }}
              className="font-mono"
            >
              <Icon icon={Crown} size="sm" className="text-premium" />
              ElevenLabs Premium
            </Chip>

            {/* 4K (PRO) */}
            <Chip
              kind="filter"
              selected={ultraHd && isProUser}
              onClick={() => {
                if (!isProUser) {
                  onUpgrade();
                  return;
                }
                setUltraHd((u) => !u);
              }}
              className="font-mono"
            >
              <Icon icon={Crown} size="sm" className="text-premium" />
              4K 3840×2160
            </Chip>

            {/* effects */}
            <Chip kind="filter" selected={kenBurns} onClick={() => setKenBurns((k) => !k)} className="font-mono">
              Ken Burns
            </Chip>
            <Chip kind="filter" selected={neon} onClick={() => setNeon((n) => !n)} className="font-mono">
              Neon grading
            </Chip>
          </div>
        </div>
      </Card>

      {/* Act strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {script.scenes.map((sc, i) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => {
              const start = script.scenes.slice(0, i).reduce((s, x) => s + x.duration, 0);
              seek(start);
            }}
            aria-pressed={i === sceneIndex}
            className={cn(
              "flex flex-col gap-0.5 rounded-small p-2.5 text-left",
              i === sceneIndex ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface",
              interactive(),
            )}
          >
            <span className="font-mono text-label-sm text-primary">{sc.actLabel}</span>
            <span className="truncate text-body-sm font-semibold">{sc.title}</span>
            <span className="font-mono text-label-sm text-on-surface-variant/70">
              {fmtClock(script.scenes.slice(0, i).reduce((s, x) => s + x.duration, 0))} · {sc.vo.length} lines
            </span>
          </button>
        ))}
      </div>

      {/* Captions + Brief */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="none" className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <Icon icon={MessageSquare} size="sm" className="text-tertiary" />
            <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// CAPTIONS"}</p>
            <div className="ml-auto">
              <SegmentedButton
                label="Caption format"
                options={[
                  { value: "srt", label: "SRT" },
                  { value: "vtt", label: "WebVTT" },
                ]}
                value={vttMode ? "vtt" : "srt"}
                onChange={(v) => setVttMode(v === "vtt")}
              />
            </div>
          </div>
          <CodeBlock lang="text" className="max-h-56 overflow-y-auto">
            {captionsText}
          </CodeBlock>
          <div className="flex gap-2">
            <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(captionsText, vttMode ? "WebVTT captions" : "SRT captions")} className="flex-1 font-mono">
              Copy {vttMode ? "VTT" : "SRT"}
            </Button>
            <Button
              size="xs"
              variant="outlined"
              icon={Download}
              onClick={() => downloadText(`${job.repo}-captions.${vttMode ? "vtt" : "srt"}`, captionsText, "text/plain;charset=utf-8")}
              className="flex-1 font-mono"
            >
              Download
            </Button>
          </div>
        </Card>

        <Card padding="none" className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <Icon icon={Film} size="sm" className="text-premium" />
            <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// VIDEO BRIEF — RUNWAY · SORA · PIKA"}</p>
            <Button size="xs" variant="outlined" onClick={() => setBriefOpen((o) => !o)} className="ml-auto font-mono">
              {briefOpen ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Paste this brief into any LLM video tool — style, voice, per-scene timings, on-screen text and the negative prompt are all included.
          </p>
          {briefOpen && (
            <CodeBlock lang="text" className="max-h-56 overflow-y-auto">
              {brief}
            </CodeBlock>
          )}
          <div className="flex gap-2">
            <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(brief, "Video brief")} className="flex-1 font-mono">
              Copy brief
            </Button>
            <Button size="xs" variant="outlined" icon={Download} onClick={() => downloadText(`${job.repo}-video-brief.md`, brief)} className="flex-1 font-mono">
              Download brief
            </Button>
          </div>
        </Card>
      </div>

      {/* Export row */}
      <Card padding="none" className="flex flex-wrap items-center gap-3 bg-positive-container/30 p-4">
        <Icon icon={Film} size="sm" className="shrink-0 text-positive" />
        <p className="min-w-0 flex-1 text-body-sm text-on-surface">
          <span className="font-mono font-bold">One-click workflow:</span> Paste Repo → Story Engine → Generate Cinematic Video → download Brief + SRT +
          Landing HTML. MP4 rendering ships via Remotion/FFmpeg in the production stack — the browser preview above is the exact storyboard.
        </p>
        <Button size="xs" icon={Download} onClick={exportMp4} className="font-mono font-semibold">
          Export brief + SRT
        </Button>
      </Card>
    </div>
  );
}

// ── CINE.MAP scene engines ───────────────────────────────────────────────────

function SceneEngine({ scene, audit, stars, scoreShown, speed, restartKey }: { scene: { visual: string; vo: string[]; id: string }; audit: NonNullable<AuditJobResponse["audit"]>; stars: number; scoreShown: number; speed: number; restartKey: string }) {
  switch (scene.visual) {
    case "gauge":
      return <CineGauge score={scoreShown || audit.score} restartKey={restartKey} />;
    case "stars":
      return <CineStars stars={stars} passed={audit.stats.checksPassed} total={audit.stats.checksTotal} restartKey={restartKey} />;
    case "arch":
      return <CineArch restartKey={restartKey} speed={speed} />;
    case "diff":
      return <CineDiff audit={audit} restartKey={restartKey} />;
    case "graph":
      return <CineGraph restartKey={restartKey} />;
    default:
      return <CineCta lines={scene.vo.slice(-2)} restartKey={restartKey} />;
  }
}

function CineGauge({ score, restartKey }: { score: number; restartKey: string }) {
  const R = 78;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative size-52 sm:size-64" key={restartKey}>
      <svg viewBox="0 0 180 180" className="size-full -rotate-90 drop-shadow-[0_0_28px_rgb(var(--md-sys-color-primary-rgb)/0.45)]" role="img" aria-label={`Score ${score} of 100`}>
        <circle cx="90" cy="90" r={R} fill="none" stroke="rgb(var(--screen-ink) / 0.08)" strokeWidth="13" />
        <motion.circle
          cx="90"
          cy="90"
          r={R}
          fill="none"
          stroke="url(#cineGrad)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C, rotate: -40 }}
          animate={{ strokeDashoffset: C * (1 - score / 100), rotate: 0 }}
          transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "90px 90px" }}
        />
        <defs>
          <linearGradient id="cineGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--md-sys-color-primary-rgb))" />
            <stop offset="1" stopColor="rgb(var(--md-sys-color-tertiary-rgb))" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display-lg font-bold text-[rgb(var(--screen-ink))] tnum sm:text-display-xl">{score}</span>
        <span className="font-mono text-label-sm uppercase tracking-[0.3em] text-[rgb(var(--screen-ink)/0.5)]">/ 100</span>
      </div>
    </div>
  );
}

function CineStars({ stars, passed, total, restartKey }: { stars: number; passed: number; total: number; restartKey: string }) {
  const shown = useCountUp(stars > 0 ? stars : passed, 2400, restartKey);
  return (
    <div className="flex flex-col items-center gap-3" key={restartKey}>
      <motion.div initial={{ y: -26, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 130, damping: 13 }} className="text-5xl" aria-hidden>
        ⭐
      </motion.div>
      <span className="font-mono text-display-lg font-bold text-[rgb(var(--screen-ink))] tnum sm:text-display-xl">{shown.toLocaleString()}</span>
      <p className="font-mono text-label-md text-[rgb(var(--screen-ink)/0.55)]">
        {passed}/{total} checks already pass · the bones are good
      </p>
    </div>
  );
}

function CineArch({ restartKey, speed }: { restartKey: string; speed: number }) {
  const nodes = ["your repo", "50 checks", "ranked fixes", "100/100"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4" key={restartKey}>
      {nodes.map((n, i) => (
        <div key={n} className="flex items-center gap-2 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: (0.4 * i) / speed, duration: 0.5 }}
            className={cn(
              "rounded-large px-5 py-4 font-mono text-label-md backdrop-blur-sm sm:text-body-md",
              i === nodes.length - 1
                ? "bg-positive-container text-on-positive-container shadow-[0_0_36px_-6px_rgb(var(--md-sys-color-positive-rgb)/0.5)]"
                : "bg-[rgb(var(--screen-ink)/0.05)] text-[rgb(var(--screen-ink)/0.85)]",
            )}
          >
            {n}
          </motion.div>
          {i < nodes.length - 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ delay: (0.4 * i) / speed, duration: 1.4, repeat: Infinity }}
              className="font-mono text-[rgb(var(--screen-ink)/0.6)]"
            >
              ──▶
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

function CineDiff({ audit, restartKey }: { audit: NonNullable<AuditJobResponse["audit"]>; restartKey: string }) {
  const fixes = audit.fixes.slice(0, 4);
  return (
    <div className="w-full max-w-xl overflow-hidden rounded-large bg-[rgb(var(--screen-bg)/0.55)] backdrop-blur-md" key={restartKey}>
      <div className="flex items-center gap-1.5 bg-[rgb(var(--screen-ink)/0.05)] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-error/80" />
        <span className="size-2.5 rounded-full bg-premium/80" />
        <span className="size-2.5 rounded-full bg-positive/80" />
        <span className="ml-2 font-mono text-label-sm text-[rgb(var(--screen-ink)/0.45)]">auto-fix · {audit.fixes.length} ranked patches</span>
        <span className="ml-auto font-mono text-label-sm text-positive">+{audit.stats.pointsAtStake} pts</span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        {fixes.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 + i * 0.75 }}
            className="flex items-center gap-2 font-mono text-label-md"
          >
            <span className="text-positive">+</span>
            <span className="min-w-0 flex-1 truncate text-[rgb(var(--screen-ink)/0.85)]">{f.title}</span>
            <span className="text-[rgb(var(--md-sys-color-tertiary-rgb))]">+{f.points}</span>
            <span className="text-[rgb(var(--screen-ink)/0.35)]">{f.effort}</span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.4, 1] }}
          transition={{ delay: 0.45 + fixes.length * 0.75 }}
          className="mt-1 font-mono text-label-md text-positive"
          style={{ animation: "cine-chime 1.6s ease-out 1.2s" }}
        >
          ✓ all checks pass — 100/100
        </motion.div>
      </div>
    </div>
  );
}

function CineGraph({ restartKey }: { restartKey: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-1" key={restartKey}>
      <svg viewBox="0 0 360 110" className="h-28 w-full max-w-xl" role="img" aria-label="Score trajectory graph">
        <defs>
          <linearGradient id="cineLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(var(--md-sys-color-primary-rgb))" />
            <stop offset="1" stopColor="rgb(var(--md-sys-color-tertiary-rgb))" />
          </linearGradient>
        </defs>
        <motion.polyline
          points="10,88 60,74 110,78 160,58 210,50 260,32 310,24 350,10"
          fill="none"
          stroke="url(#cineLine)"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.6, ease: "easeInOut" }}
          style={{ filter: "drop-shadow(0 0 8px rgb(var(--md-sys-color-primary-rgb) / 0.7))" }}
        />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <motion.circle
            key={i}
            cx={10 + i * 48.6}
            cy={88 - i * 11.2 + (i % 2) * 6}
            r="4.5"
            fill={i === 7 ? "rgb(var(--md-sys-color-tertiary-rgb))" : "rgb(var(--md-sys-color-primary-rgb))"}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.3 }}
          />
        ))}
      </svg>
      <p className="font-mono text-label-md text-[rgb(var(--screen-ink)/0.55)]">score climbs with every applied fix — and stays</p>
    </div>
  );
}

function CineCta({ lines, restartKey }: { lines: string[]; restartKey: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" key={restartKey}>
      <motion.h3
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="bg-[linear-gradient(to_right,rgb(var(--md-sys-color-primary-rgb)),rgb(var(--md-sys-color-secondary-rgb)),rgb(var(--md-sys-color-tertiary-rgb)))] bg-clip-text text-display-md font-bold text-transparent drop-shadow-[0_0_30px_rgb(var(--md-sys-color-primary-rgb)/0.4)] sm:text-display-xl"
      >
        Star it. Fix it. Ship it.
      </motion.h3>
      {lines.map((l, i) => (
        <motion.p key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.6 }} className="max-w-xl font-mono text-label-md text-[rgb(var(--screen-ink)/0.6)] sm:text-body-md">
          {l}
        </motion.p>
      ))}
    </div>
  );
}
