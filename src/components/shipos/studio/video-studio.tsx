"use client";

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudio — Path A: the browser Video Studio.
// Cinematic canvas player (Ken Burns · neon grading · captions · film grain)
// with browser TTS narration + a generated WebAudio score, a full Schema
// Editor, and a one-click WebM recorder (canvas.captureStream + MediaRecorder).
// Exports: WebM video · SRT/VTT · video brief · scene schema JSON — and a
// bridge that submits the edited schema straight to Render Cloud (Path B).
//
// Honest constraint: MediaRecorder captures canvas + WebAudio, but the browser
// will not expose speechSynthesis audio to a stream. The WebM therefore ships
// with visuals + score; the studio-grade voiceover is mixed by the Render
// Cloud worker (Kokoro) or any video tool via the copied brief.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Copy,
  Download,
  FileJson,
  Film,
  Gauge,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Sparkles,
  Square,
  Type,
} from "@/ui/symbols";
import {
  Accordion,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  SegmentedButton,
  Select,
  Slider,
  Spinner,
  toast,
} from "@/ui";
import type { AuditJobListItem, AuditJobResponse, AuditRepoMeta, RepoAudit } from "@/lib/shipos/audit-types";
import { buildVideoBrief, buildVideoScript, formatSrt, formatVtt, sceneAt, scriptCaptions, type VideoScript } from "@/lib/shipos/story-engine";
import { drawCinemaFrame, type CinemaFacts } from "@/lib/shipos/cinema-canvas";
import { copyText, downloadText, fmtClock, loadStoryJson, saveStoryJson } from "../auditor/story/story-utils";
import { interactive } from "@/ui/state-layer";
import { SchemaEditor } from "./schema-editor";

type VoiceMode = "calm" | "energetic" | "authoritative";
type ResId = "720p" | "1080p" | "4k";

const VOICE_PRESETS: Record<VoiceMode, { label: string; rate: number; pitch: number }> = {
  calm: { label: "Calm", rate: 0.92, pitch: 1.0 },
  energetic: { label: "Energetic", rate: 1.14, pitch: 1.1 },
  authoritative: { label: "Authoritative", rate: 1.0, pitch: 0.85 },
};

const RESOLUTIONS: Record<ResId, { label: string; w: number; h: number }> = {
  "720p": { label: "720p · fast", w: 1280, h: 720 },
  "1080p": { label: "1080p · full HD", w: 1920, h: 1080 },
  "4k": { label: "4K UHD · PRO", w: 3840, h: 2160 },
};

const SPEEDS = [0.5, 1, 1.5, 2] as const;

function factsFromJob(job: AuditJobResponse): CinemaFacts {
  const audit: RepoAudit | null = job.audit;
  const meta: AuditRepoMeta | null = job.repoMeta;
  return {
    score: audit?.score ?? job.score,
    stars: meta?.stars ?? 0,
    checksPassed: audit?.stats.checksPassed ?? 0,
    checksTotal: audit?.stats.checksTotal ?? 50,
    fixes: audit?.fixes.length ?? job.fixesCount,
    grade: audit?.grade ?? "—",
    categories: (audit?.categories ?? []).map((c) => ({ name: c.name, score: c.score, max: c.max })),
    topFixTitle: audit?.fixes[0]?.title ?? "the heaviest fix",
    topFixPoints: audit?.fixes[0]?.points ?? 0,
  };
}

export function VideoStudio({
  isProUser,
  onUpgrade,
  onOpenCloud,
  onGoAudit,
  initialAuditId,
}: {
  isProUser: boolean;
  onUpgrade: () => void;
  onOpenCloud?: () => void;
  onGoAudit?: () => void;
  initialAuditId?: string | null;
}) {
  // ── audit loading ──────────────────────────────────────────────────────────
  const [list, setList] = useState<AuditJobListItem[]>([]);
  const [job, setJob] = useState<AuditJobResponse | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/audit", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as AuditJobListItem[];
      setList(items.filter((i) => i.status === "ready"));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openAudit = useCallback(async (id: string) => {
    setLoadingJob(true);
    try {
      const res = await fetch(`/api/audit/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setJob((await res.json()) as AuditJobResponse);
    } catch {
      toast({ title: "Could not open audit", tone: "danger" });
    } finally {
      setLoadingJob(false);
    }
  }, []);

  useEffect(() => {
    if (initialAuditId && list.some((i) => i.id === initialAuditId)) {
      void openAudit(initialAuditId);
    } else if (list.length > 0) {
      void openAudit(list[0].id);
    }
  }, [list.length, initialAuditId]);

  // ── script state ───────────────────────────────────────────────────────────
  const baseScript = useMemo(() => (job?.audit ? buildVideoScript(job) : { title: "", scenes: [], totalDuration: 0 }), [job]);
  const [script, setScript] = useState<VideoScript>(baseScript);
  const [savedFlag, setSavedFlag] = useState(true);

  useEffect(() => {
    if (!job) return;
    const edited = loadStoryJson<VideoScript>(job.id, "studio-script");
    setScript(edited && edited.scenes?.length ? edited : baseScript);
    setSavedFlag(!edited);
  }, [job, baseScript]);

  const saveScript = useCallback(() => {
    if (!job) return;
    saveStoryJson(job.id, "studio-script", script);
    setSavedFlag(true);
    toast({ title: "Schema saved", description: "Player, captions and exports now use this cut.", tone: "success" });
  }, [job, script]);

  // ── playback state ─────────────────────────────────────────────────────────
  const total = script.totalDuration;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [voice, setVoice] = useState<VoiceMode>("authoritative");
  const [speakOn, setSpeakOn] = useState(true);
  const [musicVol, setMusicVol] = useState(25);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [kenBurns, setKenBurns] = useState(true);
  const [neon, setNeon] = useState(true);
  const [grain, setGrain] = useState(true);
  const [res, setRes] = useState<ResId>("720p");
  const [recording, setRecording] = useState(false);
  const [rendering2, setRendering2] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const optsRef = useRef({ captionsOn, kenBurns, neon, grain });
  const scriptRef = useRef(script);
  const factsRef = useRef(factsFromJob({ ...(job as AuditJobResponse) }));
  const lastSceneRef = useRef<string | null>(null);
  const lastUiPush = useRef(0);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[]; dest: MediaStreamAudioDestinationNode } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const facts = useMemo(() => (job ? factsFromJob(job) : null), [job]);
  useEffect(() => {
    if (facts) factsRef.current = facts;
  }, [facts]);
  useEffect(() => {
    scriptRef.current = script;
  }, [script]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    optsRef.current = { captionsOn, kenBurns, neon, grain };
  }, [captionsOn, kenBurns, neon, grain]);

  const chunks = useMemo(() => scriptCaptions(script), [script]);
  const srt = useMemo(() => formatSrt(chunks), [chunks]);
  const vtt = useMemo(() => formatVtt(chunks), [chunks]);
  const brief = useMemo(() => (job ? buildVideoBrief(job, script) : ""), [job, script]);

  // ── music bed ──────────────────────────────────────────────────────────────
  const startMusic = useCallback(() => {
    if (audioRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = (musicVol / 100) * 0.06;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 0.014;
      lfo.connect(lfoGain).connect(gain.gain);
      const freqs = [110, 164.81, 220, 277.18];
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      lfo.start();
      const dest = ctx.createMediaStreamDestination();
      gain.connect(ctx.destination);
      gain.connect(dest);
      audioRef.current = { ctx, gain, oscs: [...oscs, lfo], dest };
    } catch {
      // audio unavailable — continue silently
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
    if (audioRef.current) audioRef.current.gain.gain.value = (musicVol / 100) * 0.06;
  }, [musicVol]);

  const cancelTts = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }, []);

  const speakScene = useCallback(
    (sceneId: string) => {
      if (!speakOn) return;
      const scene = scriptRef.current.scenes.find((s) => s.id === sceneId);
      if (!scene || typeof window === "undefined" || !window.speechSynthesis) return;
      cancelTts();
      const u = new SpeechSynthesisUtterance(scene.vo.join(" "));
      const preset = VOICE_PRESETS[voice];
      u.rate = Math.min(2, Math.max(0.5, preset.rate * speedRef.current));
      u.pitch = preset.pitch;
      window.speechSynthesis.speak(u);
    },
    [speakOn, voice, cancelTts]
  );

  // ── canvas render loop ─────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      if (last === null) last = ts;
      const dt = ((ts - last) / 1000) * speedRef.current;
      last = ts;
      const s = scriptRef.current;
      if (playingRef.current && s.totalDuration > 0) {
        timeRef.current = Math.min(s.totalDuration, timeRef.current + dt);
        const { scene } = sceneAt(s, timeRef.current);
        if (scene && scene.id !== lastSceneRef.current) {
          lastSceneRef.current = scene.id;
          speakScene(scene.id);
        }
        if (timeRef.current >= s.totalDuration) {
          playingRef.current = false;
          setPlaying(false);
          cancelTts();
          stopMusic();
          if (recorderRef.current && recorderRef.current.state === "recording") {
            recorderRef.current.stop();
          }
        }
      }
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          drawCinemaFrame(ctx, cv.width, cv.height, {
            script: s,
            time: timeRef.current,
            facts: factsRef.current,
            captionsOn: optsRef.current.captionsOn,
            kenBurns: optsRef.current.kenBurns,
            neon: optsRef.current.neon,
            grain: optsRef.current.grain,
          });
        }
      }
      if (ts - lastUiPush.current > 120) {
        lastUiPush.current = ts;
        setTime(timeRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speakScene, cancelTts, stopMusic]);

  const togglePlay = () => {
    if (!script.scenes.length) return;
    const next = !playingRef.current;
    if (next && timeRef.current >= total - 0.01) {
      timeRef.current = 0;
      lastSceneRef.current = null;
    }
    playingRef.current = next;
    setPlaying(next);
    if (next) {
      startMusic();
      const { scene } = sceneAt(script, timeRef.current);
      if (scene && scene.id !== lastSceneRef.current) {
        lastSceneRef.current = scene.id;
        speakScene(scene.id);
      }
    } else {
      cancelTts();
      stopMusic();
    }
  };

  const restart = () => {
    timeRef.current = 0;
    lastSceneRef.current = null;
    setTime(0);
    cancelTts();
  };

  const seek = (t: number) => {
    timeRef.current = Math.max(0, Math.min(total, t));
    lastSceneRef.current = null;
    setTime(timeRef.current);
    cancelTts();
  };

  // ── WebM recorder (Path A export) ──────────────────────────────────────────
  const recordWebm = () => {
    const cv = canvasRef.current;
    if (!cv || !script.scenes.length || recording) return;
    if (typeof MediaRecorder === "undefined") {
      toast({ title: "Recording unavailable", description: "This browser does not expose MediaRecorder.", tone: "danger" });
      return;
    }
    try {
      const stream = cv.captureStream(30);
      // ensure the music bed exists so the export carries the cinematic score
      startMusic();
      const a = audioRef.current;
      if (a) a.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: res === "4k" ? 24_000_000 : res === "1080p" ? 10_000_000 : 5_000_000 } : undefined);
      const blobChunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) blobChunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(blobChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${job?.repo ?? "shipos"}-story-${res}.webm`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        recorderRef.current = null;
        setRecording(false);
        cancelTts();
        stopMusic();
        toast({ title: "WebM exported", description: `${(blob.size / 1_048_576).toFixed(1)} MB · visuals + cinematic score.`, tone: "success" });
      };
      recorderRef.current = rec;
      // play from the top at 1x for a true cut
      speedRef.current = 1;
      setSpeed(1);
      timeRef.current = 0;
      lastSceneRef.current = null;
      rec.start(250);
      setRecording(true);
      playingRef.current = true;
      setPlaying(true);
      const { scene } = sceneAt(script, 0);
      if (scene) {
        lastSceneRef.current = scene.id;
        speakScene(scene.id);
      }
    } catch {
      setRecording(false);
      toast({ title: "Recorder failed", description: "Canvas capture is blocked in this context.", tone: "danger" });
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
    playingRef.current = false;
    setPlaying(false);
    cancelTts();
    stopMusic();
  };

  // ── Render Cloud bridge (Path B) ───────────────────────────────────────────
  const sendToCloud = async () => {
    if (!job) return;
    setRendering2(true);
    try {
      // `http`, not `res`: the old local shadowed the `res` resolution state
      // inside its own initializer (TDZ — every submit died as "Network error").
      const http = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: job.repoUrl, auditId: job.id, preset: "meta-hackathon", resolution: res === "4k" ? "4k" : "1080p", voice, scriptJson: script }),
      });
      const body = (await http.json()) as { ok: boolean; id?: string; message?: string; error?: string };
      if (body.ok) {
        toast({ title: "Submitted to Render Cloud", description: body.message, tone: "success" });
        onOpenCloud?.();
      } else {
        toast({ title: "Render Cloud refused", description: body.error ?? `HTTP ${http.status}`, tone: "danger" });
      }
    } catch {
      toast({ title: "Network error", tone: "danger" });
    } finally {
      setRendering2(false);
    }
  };

  const actBounds = useMemo(() => {
    const marks: { at: number; label: string; dur: number }[] = [];
    let acc = 0;
    for (const s of script.scenes) {
      marks.push({ at: acc, label: s.actLabel, dur: s.duration });
      acc += s.duration;
    }
    return marks;
  }, [script]);

  const { scene: activeScene } = useMemo(() => sceneAt(script, Math.min(time, Math.max(0, total - 0.01))), [script, time]);

  // ── empty state ────────────────────────────────────────────────────────────
  if (list.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={Film}
        title="Video Studio needs an audit"
        description="The studio renders the story of an audit — run the Full Repo Auditor first, then come back and the cut will be waiting."
        action={
          <Button icon={ScanLine} onClick={onGoAudit}>
            Run the Full Repo Auditor
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* header row: audit picker + resolution */}
      <div className="flex flex-wrap items-center gap-3 rounded-small bg-secondary-container px-4 py-3 text-on-secondary-container">
        <Icon icon={Film} size="sm" className="shrink-0" />
        <p className="mr-auto min-w-0 text-body-sm">
          <span className="font-semibold">Video Studio (Path A)</span> — cinematic canvas player + browser recorder. Edit the schema, play the story,
          export WebM instantly — zero server.
        </p>
        <Select
          label="Audit"
          dense
          className="w-[240px]"
          value={job?.id ?? ""}
          onChange={(e) => void openAudit(e.target.value)}
        >
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.owner}/{i.repo} · {i.score}/100
            </option>
          ))}
        </Select>
      </div>

      {loadingJob || !job || !facts ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-3 font-mono text-body-sm text-on-surface-variant">
          <Spinner size="sm" label="Loading the cut" />
          loading the cut…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* ── left: player + controls ───────────────────────────────────── */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative overflow-hidden rounded-medium bg-surface-container-lowest">
              <canvas
                ref={canvasRef}
                width={RESOLUTIONS[res].w}
                height={RESOLUTIONS[res].h}
                className="block h-auto w-full"
                aria-label="Cinematic story player"
                onClick={togglePlay}
              />
              {!playing && !recording && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Play the story"
                  className={`absolute inset-0 flex items-center justify-center bg-scrim/25 ${interactive({ inverse: true })}`}
                >
                  <span className="flex size-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-level-2">
                    <Icon icon={Play} size="md" className="ml-1" />
                  </span>
                </button>
              )}
              {recording && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-inverse-surface px-3 py-1.5 font-mono text-label-sm text-inverse-on-surface">
                  <span className="size-2 animate-pulse rounded-full bg-error" />
                  REC {fmtClock(time)} / {fmtClock(total)}
                </div>
              )}
            </div>

            {/* timeline */}
            <div className="flex flex-col gap-1.5">
              <Slider
                label="Timeline scrubber"
                hideLabel
                min={0}
                max={Math.max(1, total)}
                step={0.1}
                value={time}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
                {actBounds.map((a, i) => (
                  <div
                    key={i}
                    title={a.label}
                    className={`h-full ${i % 2 ? "bg-tertiary-container" : "bg-primary"}`}
                    style={{ width: `${(a.dur / Math.max(1, total)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between font-mono text-label-sm text-on-surface-variant">
                <span>{fmtClock(time)} / {fmtClock(total)}</span>
                <span className="truncate">
                  {activeScene ? `${activeScene.actLabel} — ${activeScene.title}` : ""}
                </span>
              </div>
            </div>

            {/* transport + options */}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs" className="w-[92px]" icon={playing ? Pause : Play} onClick={togglePlay}>
                {playing ? "Pause" : "Play"}
              </Button>
              <Button size="xs" variant="outlined" icon={RotateCcw} onClick={restart}>
                Restart
              </Button>
              <div className="flex items-center gap-2">
                <Slider
                  label="Playback speed"
                  hideLabel
                  min={0.5}
                  max={2}
                  step={0.5}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}
                  className="w-24"
                />
                <span className="text-label-md font-mono text-on-surface-variant tnum">{speed}x</span>
              </div>
              <SegmentedButton
                label="Narrator voice"
                options={(Object.keys(VOICE_PRESETS) as VoiceMode[]).map((v) => ({ value: v, label: VOICE_PRESETS[v].label }))}
                value={voice}
                onChange={setVoice}
              />
              <div className="flex items-center gap-1.5">
                <Icon icon={Music} size="sm" className="text-on-surface-variant" />
                <Slider
                  label="Music volume"
                  hideLabel
                  min={0}
                  max={100}
                  value={musicVol}
                  onChange={(e) => setMusicVol(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <Select
                label="Resolution"
                dense
                className="w-[190px]"
                value={res}
                onChange={(e) => {
                  const v = e.target.value as ResId;
                  if (v === "4k" && !isProUser) {
                    toast({ title: "4K is PRO", description: "3840×2160 canvas + 24 Mbps export unlocks with PRO." });
                    onUpgrade();
                    return;
                  }
                  setRes(v);
                }}
              >
                {(Object.keys(RESOLUTIONS) as ResId[]).map((r) => (
                  <option key={r} value={r}>
                    {RESOLUTIONS[r].label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { on: captionsOn, set: setCaptionsOn, icon: Type, label: "Captions" },
                { on: speakOn, set: setSpeakOn, icon: Mic, label: "Voiceover" },
                { on: kenBurns, set: setKenBurns, icon: Sparkles, label: "Ken Burns" },
                { on: neon, set: setNeon, icon: Sparkles, label: "Neon grade" },
                { on: grain, set: setGrain, icon: Sparkles, label: "Film grain" },
              ].map((t) => (
                <Chip key={t.label} kind="filter" selected={t.on} icon={t.icon} onClick={() => t.set(!t.on)}>
                  {t.label}
                </Chip>
              ))}
            </div>

            {/* export row */}
            <Card padding="sm" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {recording ? (
                  <Button size="xs" variant="danger" icon={Square} onClick={cancelRecording}>
                    Stop recording
                  </Button>
                ) : (
                  <Button size="xs" icon={Download} onClick={recordWebm} disabled={!script.scenes.length}>
                    Download WebM
                  </Button>
                )}
                <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(srt, "captions.srt")}>
                  Copy SRT
                </Button>
                <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(vtt, "captions.vtt")}>
                  Copy VTT
                </Button>
                <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(brief, "video brief")}>
                  Copy Brief
                </Button>
                <Button
                  size="xs"
                  variant="outlined"
                  icon={FileJson}
                  onClick={() => downloadText(`${job.repo}-scene-schema.json`, JSON.stringify(script, null, 2), "application/json")}
                >
                  Schema JSON
                </Button>
                <Button size="xs" variant="tonal" icon={Cloud} loading={rendering2} loadingLabel="Submitting to Render Cloud" onClick={() => void sendToCloud()}>
                  Render on Cloud
                </Button>
              </div>
              <p className="text-label-sm leading-relaxed text-on-surface-variant">
                WebM export = canvas visuals + generated cinematic score (browsers don&apos;t expose TTS audio to recorders — the studio voiceover narrates live,
                and the Render Cloud worker mixes the real VO). Schema JSON drops straight into Path B.
              </p>
            </Card>

            {/* captions preview */}
            <Accordion
              items={[
                {
                  title: (
                    <span className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
                      captions preview · {chunks.length} chunks · SRT
                    </span>
                  ),
                  body: (
                    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-body-sm leading-relaxed text-on-surface-variant">{srt}</pre>
                  ),
                },
              ]}
            />
          </div>

          {/* ── right: schema editor ──────────────────────────────────────── */}
          <div className="min-h-[420px] lg:max-h-[calc(100vh-220px)]">
            <SchemaEditor script={script} baseScript={baseScript} onChange={setScript} onSave={saveScript} saved={savedFlag} />
          </div>
        </div>
      )}
    </div>
  );
}
