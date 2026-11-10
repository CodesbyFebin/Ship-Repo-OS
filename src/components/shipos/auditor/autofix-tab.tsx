"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import {
  Braces,
  Check,
  Copy,
  Download,
  FilePlus,
  Folder,
  GitBranch,
  GitMerge,
  ListChecks,
  PenLine,
  Rocket,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Wand2,
} from "@/ui/symbols";
import {
  Accordion,
  Badge,
  Button,
  Card,
  CodeBlock,
  Icon,
  IconButton,
  Progress,
  Spinner,
  Switch,
  toast,
  cn,
  type BadgeTone,
  type IconGlyph,
} from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobResponse, CodeFix, FixFile } from "@/lib/shipos/audit-types";
import { fireConfetti } from "@/components/shipos/auditor/confetti";
import { ProLockOverlay } from "@/components/shipos/auditor/pro-badge";
import { useProStore, type AutoFixSections } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// AutoFixTab — THE PRO showpiece: one-click Auto Fix to 100/100 with an
// animated score climb, fixed-file tree, before/after diff view, zip bundle,
// git + PR generators, progress tracker and per-fix feedback.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SECTION_LABELS: { key: keyof AutoFixSections; label: string; hint: string }[] = [
  { key: "docs", label: "Documentation", hint: "README, docs folder, guides" },
  { key: "quality", label: "Code Quality", hint: "linters, types, formatting" },
  { key: "security", label: "Security", hint: "secret scanning, permissions, CodeQL" },
  { key: "devops", label: "DevOps + Community", hint: "CI/CD, releases, contributing, templates" },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  NEW: "primary",
  UPDATED: "tertiary",
  GUIDE: "neutral",
};

const STATUS_ICON: Record<string, IconGlyph> = {
  NEW: FilePlus,
  UPDATED: PenLine,
  GUIDE: Braces,
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} is on your clipboard.`, tone: "success" });
  } catch {
    toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
  }
}

export function AutoFixTab({
  job,
  isProUser,
  onUpgrade,
  onReAudit,
}: {
  job: AuditJobResponse;
  isProUser: boolean;
  onUpgrade: () => void;
  onReAudit: () => void;
}) {
  const audit = job.audit;
  const sections = useProStore((s) => s.autoFixSections);
  const toggleSection = useProStore((s) => s.toggleSection);
  const markAllApplied = useProStore((s) => s.markAllApplied);
  const markFixApplied = useProStore((s) => s.markFixApplied);
  const storedIds = useProStore((s) => s.fixesApplied[job.id]);
  const feedback = useProStore((s) => s.feedback);
  const setFeedback = useProStore((s) => s.setFeedback);

  const [localApplied, setLocalApplied] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [displayScore, setDisplayScore] = useState(() => audit?.score ?? 0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const displayScoreRef = useRef(audit?.score ?? 0);
  const animRef = useRef<{ stop: () => void } | null>(null);

  useEffect(
    () => () => {
      runIdRef.current += 1; // cancel any in-flight sequence
      animRef.current?.stop();
    },
    []
  );

  // checkId -> category id (devops + community grouped as "devops")
  const checkSection = useMemo(() => {
    const map = new Map<string, string>();
    if (!audit) return map;
    for (const cat of audit.categories) {
      for (const ch of cat.checks) {
        map.set(ch.id, cat.id === "community" ? "devops" : cat.id);
      }
    }
    return map;
  }, [audit]);

  const applicable = useMemo(() => {
    if (!audit) return [];
    return audit.fixes.filter((f) =>
      f.checkIds.some((id) => {
        const section = checkSection.get(id);
        return section ? sections[section as keyof AutoFixSections] : true;
      })
    );
  }, [audit, sections, checkSection]);

  const appliedSet = useMemo(() => new Set([...(storedIds ?? []), ...localApplied]), [storedIds, localApplied]);
  const appliedCount = applicable.filter((f) => appliedSet.has(f.id)).length;

  const animateScoreTo = useCallback((to: number) => {
    animRef.current?.stop();
    animRef.current = animate(displayScoreRef.current, to, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => {
        displayScoreRef.current = v;
        setDisplayScore(Math.round(v));
      },
    });
  }, []);

  const runAutoFix = useCallback(async () => {
    if (!audit || running || applicable.length === 0) return;
    const runId = ++runIdRef.current;
    setRunning(true);
    setLocalApplied(new Set());
    displayScoreRef.current = audit.score;
    setDisplayScore(audit.score);

    let acc = audit.score;
    for (let i = 0; i < applicable.length; i++) {
      if (runIdRef.current !== runId) return;
      setStepIdx(i);
      await delay(650);
      if (runIdRef.current !== runId) return;
      acc = Math.min(100, acc + applicable[i].points);
      const fixId = applicable[i].id;
      setLocalApplied((prev) => new Set(prev).add(fixId));
      animateScoreTo(acc);
      await delay(320);
    }
    if (runIdRef.current !== runId) return;

    const allIds = applicable.map((f) => f.id);
    markAllApplied(job.id, allIds);
    setLocalApplied(new Set());
    setStepIdx(-1);
    setRunning(false);
    fireConfetti();
    toast({
      title: "Auto Fix complete — projected 100/100",
      description: "Download the bundle, push the branch, then re-audit to verify.",
      tone: "success",
    });
  }, [audit, running, applicable, markAllApplied, job.id, animateScoreTo]);

  const toggleAppliedManually = (fixId: string) => {
    if (appliedSet.has(fixId)) {
      const next = applicable.filter((f) => f.id !== fixId && appliedSet.has(f.id)).map((f) => f.id);
      markAllApplied(job.id, next);
    } else {
      markFixApplied(job.id, fixId);
    }
  };

  const vote = (fixId: string, helpful: boolean) => {
    if (feedback[fixId] !== undefined) {
      toast({ title: "Already voted", description: "You already rated this fix — thanks!" });
      return;
    }
    setFeedback(fixId, helpful ? 1 : -1);
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixId, helpful }),
    }).catch(() => undefined);
    toast({ title: "Thanks!", description: helpful ? "Glad the fix helped." : "Noted — we'll improve this template.", tone: "success" });
  };

  // ── File tree (grouped by directory) ───────────────────────────────────────
  const tree = useMemo(() => {
    const groups = new Map<string, { file: FixFile; fix: CodeFix }[]>();
    for (const fix of applicable) {
      for (const file of fix.files) {
        const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "(root)";
        const arr = groups.get(dir) ?? [];
        arr.push({ file, fix });
        groups.set(dir, arr);
      }
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [applicable]);

  const selected = useMemo(() => {
    for (const [, files] of tree) {
      const hit = files.find((f) => f.file.path === selectedPath);
      if (hit) return hit;
    }
    return tree[0]?.[1][0] ?? null;
  }, [tree, selectedPath]);

  // ── Generators ─────────────────────────────────────────────────────────────
  const allFixesMarkdown = useMemo(() => {
    if (!audit) return "";
    const lines: string[] = [
      `# Auto Fix bundle — ${job.owner}/${job.repo}`,
      ``,
      `Applies ${applicable.length} ShipOS fixes · projected score: ${audit.score} → 100/100.`,
      ``,
    ];
    for (const fix of applicable) {
      lines.push(`## ${fix.rank}. ${fix.title} (+${fix.points} pts · ${fix.effort})`, ``, fix.why, ``);
      for (const file of fix.files) {
        lines.push(`**File: \`${file.path}\`**`, ``, "```" + file.language, file.content, "```", ``);
      }
      if (fix.manualSteps?.length) {
        lines.push(`**Manual steps:**`, ``, ...fix.manualSteps.map((s, i) => `${i + 1}. ${s}`), ``);
      }
    }
    return lines.join("\n");
  }, [audit, applicable, job.owner, job.repo]);

  const realPaths = useMemo(
    () => applicable.flatMap((f) => f.files.filter((file) => file.status !== "GUIDE").map((file) => file.path)),
    [applicable]
  );

  const gitCommands = useMemo(() => {
    const lines = ["git checkout -b shipos/fix-to-100"];
    if (realPaths.length) lines.push(`git add ${realPaths.join(" ")}`);
    lines.push(`git commit -m "fix: apply ShipOS auditor fixes to reach 100/100"`);
    lines.push(`git push -u origin shipos/fix-to-100`);
    return lines.join("\n");
  }, [realPaths]);

  const prMarkdown = useMemo(() => {
    if (!audit) return "";
    const points = applicable.reduce((s, f) => s + f.points, 0);
    const lines: string[] = [
      `## ShipOS Auto Fix — ${job.owner}/${job.repo} → 100/100`,
      ``,
      `Applies ${applicable.length} ranked fixes, recovering +${points} pts (${audit.score}/100 → 100/100).`,
      ``,
      `| # | Fix | Points | Effort |`,
      `| --- | --- | --- | --- |`,
      ...applicable.map((f) => `| ${f.rank} | ${f.title} | +${f.points} | ${f.effort} |`),
      ``,
      `### Checklist`,
      ...applicable.map((f) => `- [ ] ${f.rank}. ${f.title} — resolves: ${f.checkIds.join(", ")}`),
      ``,
      `_Generated by ShipOS Full Repo Auditor — deterministic 50-check rubric._`,
    ];
    return lines.join("\n");
  }, [audit, applicable, job.owner, job.repo]);

  const downloadBundle = useCallback(async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let count = 0;
      for (const fix of applicable) {
        for (const file of fix.files) {
          zip.file(file.status === "GUIDE" ? `guides/${file.path}` : file.path, file.content);
          count++;
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.repo}-fix-bundle.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Bundle downloaded", description: `${count} files → ${job.repo}-fix-bundle.zip`, tone: "success" });
    } catch {
      toast({ title: "Download failed", description: "Could not build the zip bundle.", tone: "danger" });
    }
  }, [applicable, job.repo]);

  if (!audit) return null;

  const hoursSaved = ((audit.stats.minutesTotal * 3) / 60).toFixed(1);
  const projectedPoints = applicable.reduce((s, f) => s + f.points, 0);
  const target = Math.min(100, audit.score + projectedPoints);

  const settingsPanel = (
    <Card padding="none" className="p-4">
      <p className="mb-3 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// AUTO FIX SETTINGS"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTION_LABELS.map((s) => (
          <div key={s.key} className="rounded-small bg-surface-container-low px-3 py-1">
            <Switch
              checked={sections[s.key]}
              onChange={() => toggleSection(s.key)}
              disabled={running}
              label={s.label}
              hint={s.hint}
            />
          </div>
        ))}
      </div>
    </Card>
  );

  if (!isProUser) {
    return (
      <ProLockOverlay
        title="Auto Fix to 100/100 is a PRO superpower"
        description="One click applies every ranked fix for the sections you pick — full files, zero guesswork — then verifies with a re-audit."
        features={["one-click apply", "zip bundle with real file paths", "git branch + PR description", "≈ " + hoursSaved + " h saved per audit"]}
        onUpgrade={onUpgrade}
        upgradeLabel="Unlock Auto Fix"
        className="min-h-[420px]"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          {settingsPanel}
          <div className="h-12 rounded-small bg-surface-container-low" />
        </div>
      </ProLockOverlay>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Settings + one-click button */}
      {settingsPanel}

      <Card padding="none" className="bg-primary-container p-4 text-on-primary-container sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <motion.div
            key={displayScore}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="flex min-w-[9rem] flex-col items-center rounded-small bg-surface-container-lowest px-4 py-3 text-on-surface"
          >
            <span className={cn("font-mono text-display-sm font-bold tnum", displayScore >= 100 ? "text-premium" : "text-primary")}>
              {displayScore}
            </span>
            <span className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">projected / 100</span>
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-title-sm">One-Click Auto Fix To 100</p>
            <p className="mt-0.5 text-body-sm opacity-90">
              {applicable.length} fix{applicable.length === 1 ? "" : "es"} across enabled sections · recovers{" "}
              <span className="font-mono font-bold">+{projectedPoints} pts</span> ({audit.score} →{" "}
              <span className="font-mono font-bold">{target}</span>)
            </p>
            {running ? (
              <p className="mt-2 flex items-center gap-2 font-mono text-label-md opacity-90">
                <Spinner size="sm" label="Applying fixes" />
                {stepIdx >= 0 && applicable[stepIdx]
                  ? `Applying fix ${stepIdx + 1}/${applicable.length}: ${applicable[stepIdx].title}…`
                  : "Preparing sequence…"}
              </p>
            ) : appliedCount === applicable.length && applicable.length > 0 ? (
              <p className="mt-2 flex items-center gap-2 font-mono text-label-md opacity-90">
                <Icon icon={Sparkles} size="sm" />
                all {applicable.length} fixes applied — re-audit to verify 100/100
              </p>
            ) : (
              <p className="mt-2 font-mono text-label-md opacity-70">
                {appliedCount}/{applicable.length} applied so far
              </p>
            )}
          </div>
          <Button
            size="lg"
            icon={Wand2}
            onClick={() => void runAutoFix()}
            disabled={running || applicable.length === 0}
            loading={running}
            loadingLabel="Fixing…"
            className="min-w-[13rem]"
          >
            {running ? "Fixing…" : appliedCount === applicable.length && applicable.length > 0 ? "Run again" : "One-Click Auto Fix To 100"}
          </Button>
        </div>
        <Progress value={displayScore} label={`Projected score ${displayScore} of 100`} className="mt-4" />
      </Card>

      {/* Fix queue / progress tracker */}
      <Card padding="none" className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={ListChecks} size="sm" className="text-primary" />
            {"// FIX PROGRESS TRACKER"}
          </p>
          <Badge tone="primary" className="font-mono text-label-sm">
            {appliedCount} / {applicable.length} applied
          </Badge>
        </div>
        <Progress value={applicable.length ? (appliedCount / applicable.length) * 100 : 0} label="Fixes applied progress" className="mb-4" />
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
          {applicable.map((fix, i) => {
            const done = appliedSet.has(fix.id);
            const applying = running && i === stepIdx;
            const voteValue = feedback[fix.id];
            return (
              <div
                key={fix.id}
                className={cn(
                  "flex items-center gap-3 rounded-small p-3 transition-colors",
                  done ? "bg-primary-container/50" : applying ? "bg-tertiary-container" : "bg-surface-container-high"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-extra-small bg-surface-container-lowest">
                  {done ? (
                    <Icon icon={Check} size="sm" className="text-positive" />
                  ) : applying ? (
                    <Spinner size="sm" label={`Applying ${fix.title}`} />
                  ) : (
                    <span className="font-mono text-label-md text-on-surface-variant">{fix.rank}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-on-surface">{fix.title}</p>
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    +{fix.points} pts · {fix.effort}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon={ThumbsUp}
                    label={`${fix.title} was helpful`}
                    size="sm"
                    disabled={voteValue !== undefined}
                    onClick={() => vote(fix.id, true)}
                    className={cn(voteValue === 1 && "text-positive", voteValue === -1 && "text-on-surface/[0.38]")}
                  />
                  <IconButton
                    icon={ThumbsDown}
                    label={`${fix.title} was not helpful`}
                    size="sm"
                    disabled={voteValue !== undefined}
                    onClick={() => vote(fix.id, false)}
                    className={cn(voteValue === -1 && "text-error", voteValue === 1 && "text-on-surface/[0.38]")}
                  />
                  <Button
                    type="button"
                    variant={done ? "tonal" : "outlined"}
                    size="xs"
                    icon={done ? Check : undefined}
                    disabled={running}
                    onClick={() => toggleAppliedManually(fix.id)}
                    className={cn("font-mono", done && "text-positive")}
                  >
                    {done ? "Applied" : "Mark applied"}
                  </Button>
                </div>
              </div>
            );
          })}
          {applicable.length === 0 && (
            <p className="py-6 text-center text-body-md text-on-surface-variant">No fixes match the enabled sections — enable a section above.</p>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={Timer} size="sm" className="text-primary" />
          ≈ {hoursSaved} hours saved vs manual work (3× manual multiplier on {audit.stats.minutesTotal} min of fixes)
        </p>
      </Card>

      {/* Fixed file tree + diff view */}
      <Card padding="none" className="p-4 sm:p-5">
        <p className="mb-3 flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
          <Icon icon={Folder} size="sm" className="text-primary" />
          {"// FIXED FILE TREE"}
        </p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <div className="max-h-96 overflow-y-auto rounded-small bg-surface-container-low p-2 pr-1" role="tree" aria-label="Fixed files">
            {tree.map(([dir, files]) => (
              <div key={dir} className="mb-2">
                <p className="flex items-center gap-1.5 px-1.5 py-1 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
                  <Icon icon={Folder} size="sm" />
                  {dir}
                </p>
                {files.map(({ file, fix }) => {
                  const status = file.status ?? "NEW";
                  const statusIcon = STATUS_ICON[status] ?? Braces;
                  const active = selected?.file.path === file.path;
                  return (
                    <button
                      key={`${fix.id}:${file.path}`}
                      type="button"
                      role="treeitem"
                      aria-selected={active}
                      onClick={() => setSelectedPath(file.path)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-extra-small px-2 py-2 text-left transition-colors",
                        active ? "bg-primary-container text-on-primary-container" : interactive()
                      )}
                    >
                      <Icon
                        icon={statusIcon}
                        size="sm"
                        className={cn(
                          "shrink-0",
                          active ? "" : status === "NEW" ? "text-positive" : status === "UPDATED" ? "text-premium" : "text-on-surface-variant"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-label-md">{file.path.split("/").pop()}</span>
                      <Badge tone={STATUS_TONE[status] ?? "neutral"} size="sm" className="shrink-0 font-mono">
                        {status}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ))}
            {tree.length === 0 && <p className="p-4 text-center text-body-sm text-on-surface-variant">No files in the current fix set.</p>}
          </div>

          {/* Diff view */}
          {selected ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">Before</p>
                {selected.file.status === "UPDATED" ? (
                  <div className="rounded-small bg-tertiary-container p-3 text-on-tertiary-container">
                    <p className="font-mono text-label-md">existing file — replace with:</p>
                    <p className="mt-1 font-mono text-label-sm opacity-80">{selected.file.path}</p>
                  </div>
                ) : selected.file.status === "GUIDE" ? (
                  <div className="rounded-small bg-surface-container-low p-3">
                    <p className="font-mono text-label-md text-on-surface-variant">reference guide — keep as documentation</p>
                  </div>
                ) : (
                  <div className="flex min-h-32 items-center justify-center rounded-small border border-dashed border-outline-variant bg-surface-container-low p-4">
                    <p className="text-center font-mono text-label-md text-on-surface-variant">
                      {selected.file.path} did not exist —
                      <br />
                      the fix creates it
                    </p>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-label-sm uppercase tracking-widest text-primary">After (fixed)</p>
                  <Button
                    type="button"
                    variant="outlined"
                    size="xs"
                    aria-label={`Copy ${selected.file.path}`}
                    onClick={() => void copyText(selected.file.content, selected.file.path)}
                    icon={Copy}
                    className="font-mono"
                  >
                    Copy file
                  </Button>
                </div>
                <CodeBlock title={selected.file.path}>{selected.file.content}</CodeBlock>
              </div>
            </div>
          ) : (
            <p className="p-4 text-center text-body-sm text-on-surface-variant">Select a file to preview the fix.</p>
          )}
        </div>
      </Card>

      {/* Actions bar */}
      <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
        <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// ACTIONS"}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={() => void downloadBundle()}>
            Download Bundle (.zip)
          </Button>
          <Button variant="outlined" icon={Copy} onClick={() => void copyText(allFixesMarkdown, "All fixes")} className="font-mono">
            Copy All Fixes
          </Button>
        </div>

        <Accordion
          items={[
            {
              id: "git-commands",
              title: (
                <span className="flex items-center gap-2 font-mono text-label-md text-on-surface">
                  <Icon icon={GitBranch} size="sm" className="text-primary" />
                  Git Commands Generator
                </span>
              ),
              body: (
                <CodeBlock
                  title="branch: shipos/fix-to-100"
                  action={
                    <Button
                      variant="outlined"
                      size="xs"
                      aria-label="Copy git commands"
                      onClick={() => void copyText(gitCommands, "Git commands")}
                      icon={Copy}
                      className="font-mono"
                    >
                      Copy
                    </Button>
                  }
                >
                  {gitCommands}
                </CodeBlock>
              ),
            },
            {
              id: "pr-description",
              title: (
                <span className="flex items-center gap-2 font-mono text-label-md text-on-surface">
                  <Icon icon={GitMerge} size="sm" className="text-primary" />
                  PR Description Generator
                </span>
              ),
              body: (
                <CodeBlock
                  title="fix: apply ShipOS auditor fixes to reach 100/100"
                  action={
                    <Button
                      variant="outlined"
                      size="xs"
                      aria-label="Copy PR description"
                      onClick={() => void copyText(prMarkdown, "PR description")}
                      icon={Copy}
                      className="font-mono"
                    >
                      Copy
                    </Button>
                  }
                >
                  {prMarkdown}
                </CodeBlock>
              ),
            },
          ]}
        />

        {job.source === "github" ? (
          <Button variant="outlined" icon={Rocket} onClick={onReAudit} className="font-semibold text-primary">
            Apply &amp; re-audit to verify 100/100
          </Button>
        ) : (
          <p className="font-mono text-label-sm text-on-surface-variant">re-audit applies to GitHub repos — re-paste your file list to verify offline audits</p>
        )}
      </Card>
    </div>
  );
}
