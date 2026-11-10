"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cloud, Diamond, FileText, Film, Globe, Brain, Rocket, ScanLine, Wand2, Zap } from "@/ui/symbols";
import type { IconGlyph } from "@/ui";
import { Icon, Spinner, Tabs, toast } from "@/ui";
import type { ProjectListItem, ProjectResponse } from "@/lib/shipos/types";
import { Workbench } from "@/components/shipos/workbench";
import { Landing } from "@/components/shipos/landing";
import { ShippingProgress } from "@/components/shipos/shipping-progress";
import { Dashboard } from "@/components/shipos/dashboard";
import { Upgrader } from "@/components/shipos/upgrader";
import { RepoAuditor } from "@/components/shipos/repo-auditor";
import { OptimizerTab } from "@/components/shipos/optimizer/optimizer-tab";
import { RadarTab } from "@/components/shipos/radar/radar-tab";
import { ModelRadarTab } from "@/components/shipos/radar/model-radar";
import { VideoStudio } from "@/components/shipos/studio/video-studio";
import { DemoMaker } from "@/components/shipos/studio/demo-maker";
import { RenderCloud } from "@/components/shipos/studio/render-cloud";
import { PricingModal } from "@/components/shipos/auditor/pricing-modal";
import { isPro, useProHydrated, useProStore } from "@/lib/shipos/pro-store";

type View = "landing" | "shipping" | "dashboard";
type Mode =
  | "ship"
  | "workbench"
  | "upgrade"
  | "audit"
  | "optimizer"
  | "demo-maker"
  | "video-studio"
  | "render-cloud"
  | "radar"
  | "model-radar";
type ModeTab = Mode | "pro";

const POLL_INTERVAL_MS = 2000;

export default function Home() {
  const [mode, setMode] = useState<Mode>("ship");
  const [view, setView] = useState<View>("landing");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [recent, setRecent] = useState<ProjectListItem[]>([]);
  const [shipUrl, setShipUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);

  const refreshRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as ProjectListItem[];
      setRecent(Array.isArray(items) ? items : []);
    } catch {
      // Recent list is non-critical; silently ignore.
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  // ── Polling loop: while shipping, poll the project detail every 2s ────────
  useEffect(() => {
    if (view !== "shipping" || !projectId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProjectResponse;
        if (stopped) return;
        setProject(data);

        if (data.status === "processing") {
          pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        if (data.status === "ready") {
          setView("dashboard");
          void refreshRecent();
          toast({
            title: "Package forged",
            description: `${data.owner}/${data.repo} is ready — every claim audited.`,
            tone: "success",
          });
        }
        // status === "error": stop polling; the shipping view renders the alert.
      } catch {
        if (!stopped) pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [view, projectId, refreshRecent]);

  const handleShip = useCallback(
    async (repoUrl: string, preset: string) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/ship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl, preset }),
        });
        const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
        if (!res.ok || !body.ok || !body.id) {
          toast({
            title: "Ship rejected",
            description: body.error ?? `Request failed (HTTP ${res.status}).`,
            tone: "danger",
          });
          return;
        }
        setProject(null);
        setShipUrl(repoUrl);
        setProjectId(body.id);
        setView("shipping");
      } catch {
        toast({
          title: "Network error",
          description: "Could not reach the ShipOS engine. Try again.",
          tone: "danger",
        });
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const openProject = useCallback(async (id: string) => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProjectResponse;
      setProjectId(data.id);
      setShipUrl(data.repoUrl);
      if (data.status === "ready" && data.data) {
        setProject(data);
        setView("dashboard");
      } else if (data.status === "error") {
        setProject(data);
        setView("shipping");
      } else {
        setProject(data);
        setView("shipping"); // polling effect takes over
      }
    } catch {
      toast({
        title: "Could not open project",
        description: "The ship log for this project is unreachable.",
        tone: "danger",
      });
    } finally {
      setRestoring(false);
    }
  }, []);

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setRecent((items) => items.filter((item) => item.id !== id));
        toast({ title: "Ship log deleted", tone: "success" });
      } catch {
        toast({
          title: "Delete failed",
          description: "Could not delete this ship log.",
          tone: "danger",
        });
      }
    },
    []
  );

  const backToLanding = useCallback(() => {
    setView("landing");
    setProjectId(null);
    setProject(null);
    void refreshRecent();
  }, [refreshRecent]);

  const viewMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  const modes: { id: ModeTab; label: string; icon: IconGlyph; hint: string }[] = [
    { id: "workbench", label: "GitHub Workbench", icon: ScanLine, hint: "40 checks · 30 assets · 30 utilities" },
    { id: "ship", label: "Full Package", icon: Rocket, hint: "README · demo · deck · report" },
    { id: "audit", label: "Full Repo Auditor", icon: ScanLine, hint: "repo-wide 0-100 + ranked full-code fixes" },
    { id: "optimizer", label: "Optimization Engine", icon: Wand2, hint: "SEO · AEO · GEO evidence and drafts" },
    { id: "demo-maker", label: "Demo Maker", icon: Zap, hint: "repo URL → 5-min demo film" },
    { id: "upgrade", label: "README Upgrader", icon: FileText, hint: "score → 100/100 README" },
    { id: "video-studio", label: "Video Studio", icon: Film, hint: "Path A · cinematic WebM in-browser" },
    { id: "render-cloud", label: "Render Cloud", icon: Cloud, hint: "Path B · 4K on free ZeroGPU" },
    { id: "radar", label: "Competitor Radar", icon: Globe, hint: "repo-to-video field · how ShipOS wins" },
    { id: "model-radar", label: "Model Radar", icon: Brain, hint: "100 free/open HF models · the $0 stack" },
    { id: "pro", label: "PRO", icon: Diamond, hint: "unlock 100% + 4K" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-4 sm:px-6">
      {/* ── Mode switcher ──────────────────────────────────────────────────── */}
      <nav aria-label="ShipOS modes" className="mb-4 flex justify-center">
        <Tabs<ModeTab>
          label="ShipOS modes"
          items={modes.map((m) => ({
            value: m.id,
            label: (
              <span className="flex items-center gap-2">
                <Icon icon={m.icon} size="sm" />
                <span>{m.label}</span>
                <span className="hidden font-mono text-[10px] text-on-surface-variant lg:inline">
                  {m.hint}
                </span>
              </span>
            ),
          }))}
          value={mode as ModeTab}
          onChange={(next) => {
            if (next === "pro") setPricingOpen(true);
            else setMode(next);
          }}
        />
      </nav>

      {restoring ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-body-md text-on-surface-variant">
          <Spinner size="sm" label="Pulling ship log" />
          pulling ship log…
        </div>
      ) : mode === "video-studio" || mode === "render-cloud" || mode === "demo-maker" ? (
        <AnimatePresence mode="wait">
          {mode === "video-studio" ? (
            <motion.div key="video-studio" {...viewMotion}>
              <VideoStudio
                isProUser={hydrated && isPro(tier)}
                onUpgrade={() => setPricingOpen(true)}
                onOpenCloud={() => setMode("render-cloud")}
                onGoAudit={() => setMode("audit")}
              />
            </motion.div>
          ) : mode === "demo-maker" ? (
            <motion.div key="demo-maker" {...viewMotion}>
              <DemoMaker
                isProUser={hydrated && isPro(tier)}
                onUpgrade={() => setPricingOpen(true)}
                onOpenCloud={() => setMode("render-cloud")}
              />
            </motion.div>
          ) : (
            <motion.div key="render-cloud" {...viewMotion}>
              <RenderCloud
                isProUser={hydrated && isPro(tier)}
                onUpgrade={() => setPricingOpen(true)}
                onGoAudit={() => setMode("audit")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      ) : mode === "workbench" ? (
        <Workbench onOpenVideo={() => setMode("video-studio")} />
      ) : mode === "optimizer" ? (
        <AnimatePresence mode="wait">
          <OptimizerTab onBack={() => setMode("ship")} />
        </AnimatePresence>
      ) : mode === "radar" ? (
        <AnimatePresence mode="wait">
          <RadarTab onBack={() => setMode("ship")} />
        </AnimatePresence>
      ) : mode === "model-radar" ? (
        <AnimatePresence mode="wait">
          <ModelRadarTab onBack={() => setMode("ship")} />
        </AnimatePresence>
      ) : mode === "upgrade" ? (
        <AnimatePresence mode="wait">
          <Upgrader onBack={() => setMode("ship")} />
        </AnimatePresence>
      ) : mode === "audit" ? (
        <AnimatePresence mode="wait">
          <RepoAuditor onBack={() => setMode("ship")} />
        </AnimatePresence>
      ) : (
        <AnimatePresence mode="wait">
          {view === "landing" && (
            <motion.div key="landing" {...viewMotion}>
              <Landing
                recent={recent}
                shipping={submitting}
                initialUrl={shipUrl}
                onShip={handleShip}
                onOpenProject={openProject}
                onDeleteProject={deleteProject}
              />
            </motion.div>
          )}

          {view === "shipping" && (
            <motion.div key="shipping" {...viewMotion}>
              <ShippingProgress
                url={shipUrl}
                stage={project?.stage ?? "queued"}
                status={project?.status ?? "processing"}
                error={project?.error ?? null}
                onRetry={backToLanding}
              />
            </motion.div>
          )}

          {view === "dashboard" && project?.data && (
            <motion.div key="dashboard" {...viewMotion}>
              <Dashboard project={project} onBack={backToLanding} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* PRO pricing — opened from the mode rail or any gated surface */}
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
    </main>
  );
}
