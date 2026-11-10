"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DemoMaker — one command: repo URL → 5-minute demo film.
// Paste a URL, pick a cut (60s / 150s / 300s) and a style; the pipeline ingests
// the repo, runs the audit if the repo doesn't have one (audit before filming),
// writes the scene schema, then the LLM rewrites the voiceover (template
// fallback stands). The player, SchemaEditor, WebM recorder, SRT/VTT/brief
// exports and the Render Cloud handoff are the same machinery as Path A.
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
  Trash2,
  Type,
  Wand2,
} from "@/ui/symbols";
import {
  Accordion,
  Badge,
  Button,
  Card,
  Chip,
  Icon,
  SegmentedButton,
  Select,
  Slider,
  Spinner,
  TextField,
  toast,
} from "@/ui";
import type { CinemaFacts } from "@/lib/shipos/cinema-canvas";
import { drawCinemaFrame } from "@/lib/shipos/cinema-canvas";
import { downloadRecording, startCanvasRecording } from "@/lib/shipos/canvas-recording.mjs";
import { buildDemoBrief, DEMO_STYLES, DEMO_TARGETS, type DemoStyle, type DemoTarget, type DemoVoice } from "@/lib/shipos/demo-shared";
import type { DemoJobListItem, DemoJobResponse } from "@/lib/shipos/demo-runner";
import { formatSrt, formatVtt, sceneAt, scriptCaptions, type VideoScript } from "@/lib/shipos/story-engine";
import { copyText, downloadText, fmtClock, loadStoryJson, saveStoryJson } from "../auditor/story/story-utils";
import { interactive } from "@/ui/state-layer";
import { SchemaEditor } from "./schema-editor";

type VoiceMode = DemoVoice;
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

const STYLE_TO_PRESET: Record<DemoStyle, string> = {
  launch: "product-launch",
  hackathon: "meta-hackathon",
  academic: "academic",
  product: "product-launch",
};

const STAGES: { id: DemoJobResponse["stage"]; label: string; detail: string }[] = [
  { id: "queued", label: "Queued", detail: "job accepted — the camera is loading" },
  { id: "ingesting", label: "Ingesting", detail: "repo metadata, tree, README, manifests" },
  { id: "auditing", label: "Auditing", detail: "50 deterministic checks — audit before filming" },
  { id: "writing", label: "Writing the schema", detail: "acts, visuals, on-screen chips, caption budget" },
  { id: "enhancing", label: "Directing the voiceover", detail: "LLM keynote rewrite — template fallback stands" },
];

/** facts → canvas: real audit numbers when the audit landed, repo numbers always. */
function factsFromDemo(job: DemoJobResponse): CinemaFacts {
  const meta = job.meta;
  const audit = meta?.audit ?? null;
  return {
    score: audit?.score ?? 0,
    stars: meta?.repo.stars ?? 0,
    checksPassed: audit?.checksPassed ?? 0,
    checksTotal: audit?.checksTotal ?? 0,
    fixes: audit?.fixesCount ?? 0,
    grade: audit?.grade ?? "—",
    categories: audit?.categories ?? [],
    topFixTitle: audit?.topFixTitle ?? "the heaviest fix",
    topFixPoints: audit?.topFixPoints ?? 0,
    repoTitle: meta?.repoTitle ?? job.repoUrl,
    tagline: meta?.tagline,
    language: meta?.repo.language,
    licenseName: meta?.repo.license ?? undefined,
    version: meta?.version ?? undefined,
    frameworks: meta?.frameworks,
    modules: meta?.modules,
    installCmd: meta?.installCmd,
    runCmd: "run the dev server",
    testCmd: meta?.testCmd,
    forks: meta?.repo.forks,
    contributors: meta?.contributors,
    commitCount: meta?.commitCount ?? undefined,
    envProvided: meta?.envProvided,
  };
}

export function DemoMaker({
  isProUser,
  onUpgrade,
  onOpenCloud,
}: {
  isProUser: boolean;
  onUpgrade: () => void;
  onOpenCloud?: () => void;
}) {
  // ── job list + submit ──────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState<DemoTarget>(300);
  const [style, setStyle] = useState<DemoStyle>("launch");
  const [voice, setVoice] = useState<DemoVoice>("authoritative");
  const [list, setList] = useState<DemoJobListItem[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<DemoJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/demo", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as DemoJobListItem[];
      setList(Array.isArray(items) ? items : []);
    } catch {
      // history rail is non-critical
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // ── polling loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let failures = 0;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const res = await fetch(`/api/demo/${jobId}`, { cache: "no-store", signal: controller.signal });
        if (res.status === 404 && !stopped) {
          toast({ title: "Demo run unavailable", description: "The run may have been deleted. Choose another run or start a new one.", tone: "danger" });
          setJobId(null);
          setJob(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DemoJobResponse;
        if (stopped) return;
        failures = 0;
        setJob(data);
        if (data.status === "processing") {
          pollTimer.current = setTimeout(tick, 2500);
          return;
        }
        if (data.status === "ready") {
          void loadList();
          toast({
            title: "Demo film forged",
            description: `${data.owner}/${data.repo} — ${data.script?.scenes.length ?? 0} scenes · ${data.script?.totalDuration ?? 0}s${data.enhanced ? " · LLM voiceover" : ""}.`,
            tone: "success",
          });
        }
      } catch {
        if (stopped) return;
        if (++failures < 4) {
          pollTimer.current = setTimeout(tick, failures * 2000);
        } else {
          toast({ title: "Demo status unreachable", description: "Reopen the run from history to resume checking progress.", tone: "danger" });
          setJobId(null);
          setJob(null);
        }
      }
    };
    void tick();
    return () => {
      stopped = true;
      controller.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [jobId, loadList]);

  const openDemo = useCallback(async (id: string) => {
    setJob(null);
    setJobId(id);
  }, []);

  const deleteDemo = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/demo/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setList((items) => items.filter((i) => i.id !== id));
        if (jobId === id) {
          setJobId(null);
          setJob(null);
        }
        toast({ title: "Demo run deleted", tone: "success" });
      } catch {
        toast({ title: "Delete failed", tone: "danger" });
      }
    },
    [jobId],
  );

  const submit = useCallback(async () => {
    if (!url.trim()) {
      toast({ title: "Repository URL required", description: "Paste a public GitHub repo URL.", tone: "danger" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url.trim(), targetSeconds: target, style, voice }),
      });
      const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !body.ok || !body.id) {
        toast({ title: "Demo rejected", description: body.error ?? `HTTP ${res.status}`, tone: "danger" });
        return;
      }
      setJob(null);
      setJobId(body.id);
      void loadList();
    } catch {
      toast({ title: "Network error", description: "Could not reach the Demo Maker engine.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [url, target, style, voice, loadList]);

  // ── schema state (editable, persisted per demo run) ────────────────────────
  const readyScript = job?.status === "ready" ? job.script ?? null : null;
  const [script, setScript] = useState<VideoScript | null>(null);
  const [savedFlag, setSavedFlag] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setScript(null);
      return;
    }
    if (!readyScript) {
      setScript(null);
      return;
    }
    setScript(loadStoryJson<VideoScript>(jobId, "demo-script") ?? readyScript);
    setSavedFlag(loadStoryJson<VideoScript>(jobId, "demo-script") != null);
  }, [jobId, readyScript]);

  const saveScript = useCallback(() => {
    if (jobId && script) {
      saveStoryJson(jobId, "demo-script", script);
      setSavedFlag(true);
      toast({ title: "Schema saved", description: "Your edit drives the player, the exports and Path B.", tone: "success" });
    }
  }, [jobId, script]);

  // ── player state ───────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(voice);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [speakOn, setSpeakOn] = useState(true);
  const [kenBurns, setKenBurns] = useState(true);
  const [neon, setNeon] = useState(true);
  const [grain, setGrain] = useState(true);
  const [musicVol, setMusicVol] = useState(45);
  const [res, setRes] = useState<ResId>("720p");
  const [recording, setRecording] = useState(false);
  const [sendingCloud, setSendingCloud] = useState(false);

  const speedRef = useRef(speed);
  const optsRef = useRef({ captionsOn, kenBurns, neon, grain });
  const scriptRef = useRef<VideoScript | null>(null);
  const factsRef = useRef<CinemaFacts>(factsFromDemo({ ...(job as DemoJobResponse) }));
  const lastSceneRef = useRef<string | null>(null);
  const lastUiPush = useRef(0);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[]; dest: MediaStreamAudioDestinationNode } | null>(null);
  const recorderRef = useRef<ReturnType<typeof startCanvasRecording> | null>(null);

  const total = script?.totalDuration ?? 0;
  useEffect(() => { recorderRef.current?.cancel(); }, [jobId]);

  const facts = useMemo(() => (job ? factsFromDemo(job) : null), [job]);
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

  const chunks = useMemo(() => (script ? scriptCaptions(script) : []), [script]);
  const srt = useMemo(() => formatSrt(chunks), [chunks]);
  const vtt = useMemo(() => formatVtt(chunks), [chunks]);
  const brief = useMemo(
    () =>
      script && job?.meta
        ? buildDemoBrief(
            {
              repoTitle: job.meta.repoTitle,
              tagline: job.meta.tagline,
              language: job.meta.repo.language,
              license: job.meta.repo.license,
              homepage: job.meta.repo.homepage,
              stars: job.meta.repo.stars,
              version: job.meta.version,
              installCmd: job.meta.installCmd,
              modules: job.meta.modules,
              auditScore: job.meta.audit?.score ?? null,
            },
            script,
            { style: (job.style as DemoStyle) ?? "launch", voice: (job.voice as DemoVoice) ?? "authoritative", targetSeconds: (job.targetSeconds as DemoTarget) ?? 300 },
          )
        : "",
    [script, job],
  );

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
      if (!speakOn || recorderRef.current) return;
      const scene = scriptRef.current?.scenes.find((s) => s.id === sceneId);
      if (!scene || typeof window === "undefined" || !window.speechSynthesis) return;
      cancelTts();
      const u = new SpeechSynthesisUtterance(scene.vo.join(" "));
      const preset = VOICE_PRESETS[voiceMode];
      u.rate = Math.min(2, Math.max(0.5, preset.rate * speedRef.current));
      u.pitch = preset.pitch;
      window.speechSynthesis.speak(u);
    },
    [speakOn, voiceMode, cancelTts],
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
      if (playingRef.current && s && s.totalDuration > 0) {
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
          if (!recorderRef.current) stopMusic();
        }
      }
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext("2d");
        if (ctx && s) {
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
      if (s && timeRef.current >= s.totalDuration && recorderRef.current) recorderRef.current.finish();
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
    if (recorderRef.current) return;
    if (!script?.scenes.length) return;
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
    if (recorderRef.current) return;
    timeRef.current = 0;
    lastSceneRef.current = null;
    setTime(0);
    cancelTts();
  };

  const seek = (t: number) => {
    if (recorderRef.current) return;
    timeRef.current = Math.max(0, Math.min(total, t));
    lastSceneRef.current = null;
    setTime(timeRef.current);
    cancelTts();
  };

  // Browser export owns its capture stream and discards interrupted cuts.
  useEffect(() => () => {
    const recording = recorderRef.current;
    recorderRef.current = null;
    recording?.cancel();
    playingRef.current = false;
    cancelTts();
    stopMusic();
  }, [cancelTts, stopMusic]);

  const recordVideo = (includeMusic = true) => {
    const canvas = canvasRef.current;
    if (!canvas || !script?.scenes.length || !Number.isFinite(total) || total <= 0 || recorderRef.current) return;
    try {
      cancelTts();
      const withMusic = includeMusic && musicVol > 0;
      if (withMusic) startMusic();
      else stopMusic();
      const audioTrack = withMusic ? audioRef.current?.dest.stream.getAudioTracks()[0] : undefined;
      const videoBitsPerSecond = res === "4k" ? 24_000_000 : res === "1080p" ? 10_000_000 : 5_000_000;
      timeRef.current = 0;
      setTime(0);
      lastSceneRef.current = null;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The video canvas is unavailable.");
      drawCinemaFrame(context, canvas.width, canvas.height, {
        script, time: 0, facts: factsRef.current, ...optsRef.current,
      });
      const capture = startCanvasRecording(canvas, { audioTrack, videoBitsPerSecond });
      recorderRef.current = capture;
      speedRef.current = 1;
      setRecording(true);
      playingRef.current = true;
      setPlaying(true);
      void capture.done.then((result) => {
        if (recorderRef.current !== capture) return;
        recorderRef.current = null;
        speedRef.current = speed;
        playingRef.current = false;
        setPlaying(false);
        setRecording(false);
        stopMusic();
        if (result.status === "ready") {
          try {
            downloadRecording(result.blob, `${job?.repo ?? "shipos"}-demo-${res}.${result.extension}`);
            toast({ title: "Video exported", description: `${(result.blob.size / 1_048_576).toFixed(1)} MB`, tone: "success" });
          } catch {
            toast({ title: "Download failed", description: "The browser could not download the exported video.", tone: "danger" });
          }
        } else if (result.status === "error" && result.reason === "empty" && audioTrack) {
          toast({ title: "Retrying without music", description: "The browser returned an empty recording with the audio track attached." });
          recordVideo(false);
        } else if (result.status === "error") {
          toast({ title: "Export interrupted", description: result.message, tone: "danger" });
        }
      });
    } catch (error) {
      stopMusic();
      playingRef.current = false;
      setPlaying(false);
      toast({ title: "Recorder failed", description: error instanceof Error ? error.message : "Canvas recording could not start.", tone: "danger" });
    }
  };

  const cancelRecording = () => recorderRef.current?.cancel();

  // ── Render Cloud bridge (Path B) ───────────────────────────────────────────
  const sendToCloud = async () => {
    if (!job || !script) return;
    setSendingCloud(true);
    try {
      const http = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: job.repoUrl,
          preset: STYLE_TO_PRESET[(job.style as DemoStyle) ?? "launch"],
          resolution: res === "4k" ? "4k" : "1080p",
          voice: job.voice,
          scriptJson: script,
        }),
      });
      const body = (await http.json()) as { ok: boolean; id?: string; message?: string; error?: string };
      if (body.ok) {
        toast({ title: "Submitted to Render Cloud", description: body.message ?? "The 4K worker picked up the demo schema.", tone: "success" });
        onOpenCloud?.();
      } else {
        toast({ title: "Render Cloud refused", description: body.error ?? `HTTP ${http.status}`, tone: "danger" });
      }
    } catch {
      toast({ title: "Network error", tone: "danger" });
    } finally {
      setSendingCloud(false);
    }
  };

  const actBounds = useMemo(() => {
    if (!script) return [] as { at: number; label: string; dur: number }[];
    const marks: { at: number; label: string; dur: number }[] = [];
    let acc = 0;
    for (const s of script.scenes) {
      marks.push({ at: acc, label: s.actLabel, dur: s.duration });
      acc += s.duration;
    }
    return marks;
  }, [script]);

  const { scene: activeScene } = useMemo(
    () => (script ? sceneAt(script, Math.min(time, Math.max(0, total - 0.01))) : { scene: null }),
    [script, time, total],
  );

  // ── submit form (always visible above the pipeline/player) ─────────────────
  const form = (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon icon={Film} size="md" className="text-primary" />
        <h2 className="text-title-lg text-on-surface">One command. Five minutes. Zero lies.</h2>
        <Badge tone="tertiary" className="ml-auto">
          audit before filming
        </Badge>
      </div>
      <TextField
        label="Repository URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !submitting) void submit();
        }}
      />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">Cut length</span>
          <SegmentedButton
            label="Cut length"
            options={DEMO_TARGETS.map((t) => ({ value: String(t.seconds), label: t.label }))}
            value={String(target)}
            onChange={(v) => setTarget(Number(v) as DemoTarget)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">Style</span>
          <Select label="Style" dense className="w-[200px]" value={style} onChange={(e) => setStyle(e.target.value as DemoStyle)}>
            {DEMO_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.hint}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">Voice</span>
          <Select label="Voice" dense className="w-[160px]" value={voice} onChange={(e) => setVoice(e.target.value as DemoVoice)}>
            {(Object.keys(VOICE_PRESETS) as VoiceMode[]).map((v) => (
              <option key={v} value={v}>
                {VOICE_PRESETS[v].label}
              </option>
            ))}
          </Select>
        </div>
        <Button className="mt-auto" icon={Wand2} loading={submitting} loadingLabel="Forging…" onClick={() => void submit()}>
          Forge the demo film
        </Button>
      </div>
      <p className="text-label-sm text-on-surface-variant">
        No audit yet? The pipeline runs one first — 50 deterministic checks feed the film, so every number on screen is real.
      </p>
    </Card>
  );

  const historyRail =
    list.length > 0 ? (
      <Card padding="sm" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">recent demo runs</span>
        {list.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1">
            <Chip kind="assist" onClick={() => void openDemo(item.id)}>
              {item.repo} · {item.targetSeconds}s{item.enhanced ? " · ai" : ""}
            </Chip>
            <Button variant="text" size="xs" icon={Trash2} aria-label={`Delete ${item.repo} demo run`} onClick={() => void deleteDemo(item.id)} />
          </span>
        ))}
      </Card>
    ) : null;

  // ── pipeline in flight ─────────────────────────────────────────────────────
  const pipeline = job && job.status === "processing" ? (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Spinner size="sm" label="Forging the demo film" />
        <h3 className="font-mono text-title-sm uppercase tracking-widest text-on-surface">Forging {job.owner}/{job.repo}…</h3>
      </div>
      <div className="flex flex-col gap-3">
        {STAGES.map((stage, i) => {
          const order = STAGES.findIndex((s) => s.id === job.stage);
          const state = i < order ? "done" : i === order ? "active" : "todo";
          return (
            <div key={stage.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-label-md font-bold ${
                  state === "done"
                    ? "bg-primary text-on-primary"
                    : state === "active"
                      ? "border-2 border-primary text-primary"
                      : "border border-outline-variant text-on-surface-variant"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-title-sm ${state === "todo" ? "text-on-surface-variant" : "text-on-surface"}`}>{stage.label}</p>
                <p className="text-body-sm text-on-surface-variant">{stage.detail}</p>
              </div>
              {state === "active" && <Spinner size="sm" label={`${stage.label} in progress`} />}
            </div>
          );
        })}
      </div>
    </Card>
  ) : null;

  const errorCard = job?.status === "error" ? (
    <Card padding="lg" className="flex flex-col gap-2 border border-error/40">
      <h3 className="text-title-md text-error">The film got stuck</h3>
      <p className="text-body-sm text-on-surface-variant">{job.error}</p>
      <Button variant="outlined" icon={ScanLine} onClick={() => void submit()}>
        Try again
      </Button>
    </Card>
  ) : null;

  // ── player view ────────────────────────────────────────────────────────────
  const player = job && job.status === "ready" && script ? (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative overflow-hidden rounded-medium bg-surface-container-lowest">
          <canvas
            ref={canvasRef}
            width={RESOLUTIONS[res].w}
            height={RESOLUTIONS[res].h}
            className="block h-auto w-full"
            aria-label="Cinematic demo player"
            onClick={togglePlay}
          />
          {!playing && !recording && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label="Play the demo film"
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
          <Slider label="Timeline scrubber" disabled={recording} hideLabel min={0} max={Math.max(1, total)} step={0.1} value={time} onChange={(e) => seek(Number(e.target.value))} />
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
            <span>
              {fmtClock(time)} / {fmtClock(total)}
            </span>
            <span className="truncate">{activeScene ? `${activeScene.actLabel} — ${activeScene.title}` : ""}</span>
          </div>
        </div>

        {/* transport + options */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" className="w-[92px]" icon={playing ? Pause : Play} onClick={togglePlay} disabled={recording}>
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="xs" variant="outlined" icon={RotateCcw} onClick={restart} disabled={recording}>
            Restart
          </Button>
          <div className="flex items-center gap-2">
            <Slider label="Playback speed" disabled={recording} hideLabel min={0.5} max={2} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-24" />
            <span className="font-mono text-label-md text-on-surface-variant tnum">{speed}x</span>
          </div>
          <SegmentedButton
            label="Narrator voice"
            options={(Object.keys(VOICE_PRESETS) as VoiceMode[]).map((v) => ({ value: v, label: VOICE_PRESETS[v].label }))}
            value={voiceMode}
            onChange={setVoiceMode}
          />
          <div className="flex items-center gap-1.5">
            <Icon icon={Music} size="sm" className="text-on-surface-variant" />
            <Slider label="Music volume" disabled={recording} hideLabel min={0} max={100} value={musicVol} onChange={(e) => setMusicVol(Number(e.target.value))} className="w-24" />
          </div>
          <Select
            label="Resolution" disabled={recording}
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
            { on: speakOn, set: setSpeakOn, icon: Mic, label: "Preview voice" },
            { on: kenBurns, set: setKenBurns, icon: Sparkles, label: "Ken Burns" },
            { on: neon, set: setNeon, icon: Sparkles, label: "Neon grade" },
            { on: grain, set: setGrain, icon: Sparkles, label: "Film grain" },
          ].map((t) => (
            <Chip key={t.label} kind="filter" selected={t.on} icon={t.icon} onClick={() => { if (!recorderRef.current) t.set(!t.on); }}>
              {t.label}
            </Chip>
          ))}
        </div>

        {/* export row */}
        <Card padding="sm" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {recording ? (
              <Button size="xs" variant="danger" icon={Square} onClick={cancelRecording}>
                Cancel export
              </Button>
            ) : (
              <Button size="xs" icon={Download} onClick={() => recordVideo()} disabled={!script.scenes.length}>
                Export video
              </Button>
            )}
            <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(srt, "captions.srt")}>
              Copy SRT
            </Button>
            <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(vtt, "captions.vtt")}>
              Copy VTT
            </Button>
            <Button size="xs" variant="outlined" icon={Download} onClick={() => downloadText(`${job.repo}-captions.vtt`, vtt, "text/vtt")}>
              Download captions
            </Button>
            <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(brief, "demo brief")}>
              Copy Brief
            </Button>
            <Button
              size="xs"
              variant="outlined"
              icon={FileJson}
              onClick={() => downloadText(`${job.repo}-demo-schema.json`, JSON.stringify(script, null, 2), "application/json")}
            >
              Schema JSON
            </Button>
            <Button size="xs" variant="tonal" icon={Cloud} loading={sendingCloud} loadingLabel="Submitting to Render Cloud" onClick={() => void sendToCloud()}>
              Render on Cloud
            </Button>
          </div>
          <p className="text-label-sm leading-relaxed text-on-surface-variant">
            Browser export includes canvas visuals and the generated music bed when available. Preview narration plays only in the browser. Keep this tab visible during export.
            Schema JSON drops straight into Path B or any agent&apos;s hands.
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
              body: <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-body-sm leading-relaxed text-on-surface-variant">{srt}</pre>,
            },
          ]}
        />
      </div>

      {/* ── right: schema editor + scene map ──────────────────────────────── */}
      <div className="flex min-h-[420px] flex-col gap-3 lg:max-h-[calc(100vh-220px)]">
        <SchemaEditor script={script} baseScript={readyScript ?? script} onChange={(next) => { if (!recorderRef.current) setScript(next); }} onSave={saveScript} saved={savedFlag} targetTotal={target} />
        <Card padding="sm" className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 font-mono text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
            <Icon icon={Gauge} size="sm" />
            scene map
          </h4>
          <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {script.scenes.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-small px-2 py-1.5 text-body-sm">
                <span className="font-mono text-label-md text-on-surface-variant">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-on-surface">{s.title}</span>
                <Badge tone="neutral">{s.visual}</Badge>
                <span className="font-mono text-label-md text-on-surface-variant">{s.duration}s</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-small bg-secondary-container px-4 py-3 text-on-secondary-container">
        <Icon icon={Film} size="sm" className="shrink-0" />
        <p className="min-w-0 text-body-sm">
          <span className="font-semibold">Demo Maker</span> — the /brag answer, long-form: paste a repo URL, get a 5-minute cinematic demo with a real audit
          behind every number.
        </p>
        {job && (
          <Button size="xs" variant="text" icon={RotateCcw} disabled={recording} onClick={() => { setJob(null); setJobId(null); setScript(null); }}>
            New run
          </Button>
        )}
      </div>

      {form}
      {historyRail}
      {pipeline}
      {errorCard}
      {player}
    </div>
  );
}
