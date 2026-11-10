"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RealPictureTab — Problem / Provides / Serves / Why, auto-generated from the
// audit, fully editable, AI-enhanceable, persisted per audit in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Crown, Pencil, RefreshCw, Save, Sparkles } from "@/ui/symbols";
import { Badge, Button, Card, Icon, Textarea, toast } from "@/ui";
import type { AuditJobResponse } from "@/lib/shipos/audit-types";
import { buildRealPicture, type RealPicture } from "@/lib/shipos/story-engine";
import { copyText, downloadText, loadStoryJson, saveStoryJson } from "./story-utils";

type Draft = { problem: string; provides: string; serves: string; why: string };

function toDraft(p: RealPicture): Draft {
  return {
    problem: p.problem,
    provides: p.provides.join("\n"),
    serves: p.serves.map((s) => `${s.who} — ${s.why}`).join("\n"),
    why: p.why.join("\n"),
  };
}

export function RealPictureTab({ job }: { job: AuditJobResponse }) {
  const auto = useMemo(() => buildRealPicture(job), [job]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(auto));
  const [source, setSource] = useState<RealPicture["source"]>("auto");
  const [dirty, setDirty] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Load saved edits (or AI version) once per job.
  useEffect(() => {
    const saved = loadStoryJson<RealPicture>(job.id, "picture");
    if (saved && saved.problem) {
      setDraft(toDraft(saved));
      setSource(saved.source ?? "edited");
      setDirty(saved.source === "edited");
    } else {
      setDraft(toDraft(auto));
      setSource("auto");
      setDirty(false);
    }
  }, [job.id, auto]);

  const persist = (next: Draft, nextSource: RealPicture["source"]) => {
    const picture: RealPicture = {
      problem: next.problem.trim(),
      provides: next.provides.split("\n").map((s) => s.trim()).filter(Boolean),
      serves: next.serves
        .split("\n")
        .map((line) => {
          const idx = line.indexOf("—");
          return idx > 0
            ? { who: line.slice(0, idx).trim(), why: line.slice(idx + 1).trim() }
            : { who: line.trim(), why: "" };
        })
        .filter((s) => s.who),
      why: next.why.split("\n").map((s) => s.trim()).filter(Boolean),
      source: nextSource,
    };
    saveStoryJson(job.id, "picture", picture);
    return picture;
  };

  const save = () => {
    persist(draft, dirty ? "edited" : source);
    setDirty(false);
    toast({ title: "Real Picture saved", description: "Your edits persist for this audit.", tone: "success" });
  };

  const reset = () => {
    setDraft(toDraft(auto));
    setSource("auto");
    setDirty(false);
    saveStoryJson(job.id, "picture", auto);
    toast({ title: "Back to the auto version", description: "Regenerated from the deterministic audit." });
  };

  const enhance = async () => {
    setEnhancing(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, kind: "real-picture" }),
      });
      const body = (await res.json()) as { ok: boolean; realPicture?: RealPicture; enhanced?: boolean; error?: string };
      if (!res.ok || !body.ok || !body.realPicture) {
        toast({ title: "AI enhance unavailable", description: body.error ?? "Keeping the deterministic version.", tone: "danger" });
        return;
      }
      const next = toDraft(body.realPicture);
      setDraft(next);
      setSource(body.realPicture.source);
      setDirty(false);
      saveStoryJson(job.id, "picture", body.realPicture);
      toast({
        title: body.enhanced ? "Real Picture enhanced with AI" : "AI unavailable — deterministic version kept",
        description: body.enhanced ? "Keynote-grade framing, grounded in audit facts only." : "The LLM was unreachable; nothing broke.",
        tone: "success",
      });
    } catch {
      toast({ title: "Network error", description: "Could not reach the Story Engine AI.", tone: "danger" });
    } finally {
      setEnhancing(false);
    }
  };

  const asMarkdown = (): string => {
    const L = [`# Real Picture — ${job.owner}/${job.repo}`, "", `## Problem it solves`, draft.problem, "", `## What it provides`];
    draft.provides.split("\n").filter(Boolean).forEach((p) => L.push(`- ${p}`));
    L.push("", `## Who it serves`);
    draft.serves.split("\n").filter(Boolean).forEach((s) => L.push(`- ${s}`));
    L.push("", `## Why it matters`);
    draft.why.split("\n").filter(Boolean).forEach((w) => L.push(`- ${w}`));
    return L.join("\n");
  };

  const SOURCE_BADGE: Record<RealPicture["source"], { label: string; cls: string }> = {
    auto: { label: "auto · from audit", cls: "text-positive" },
    ai: { label: "AI enhanced", cls: "text-primary" },
    edited: { label: "hand edited", cls: "text-premium" },
  };

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <Badge variant="outlined" icon={BadgeCheck} className={`font-mono ${SOURCE_BADGE[source]?.cls}`}>
          {SOURCE_BADGE[source]?.label}
        </Badge>
        <span className="font-mono text-label-sm text-on-surface-variant/70">generated from the same audit that produced the score — then yours to edit</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="xs" variant="outlined" icon={Sparkles} loading={enhancing} loadingLabel="Enhancing…" onClick={() => void enhance()} className="font-mono">
            AI enhance
          </Button>
          <Button size="xs" variant="outlined" icon={RefreshCw} onClick={reset} className="font-mono">
            Reset
          </Button>
          <Button size="xs" variant="outlined" onClick={() => void copyText(asMarkdown(), "Real Picture")} className="font-mono">
            Copy
          </Button>
          <Button size="xs" variant="outlined" onClick={() => downloadText(`${job.repo}-real-picture.md`, asMarkdown())} className="font-mono">
            Download
          </Button>
          <Button size="xs" icon={dirty ? Pencil : Save} onClick={save} disabled={!dirty} className="font-mono font-semibold">
            {dirty ? "Save edits" : "Saved"}
          </Button>
        </div>
      </Card>

      <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
        <Textarea
          id="rp-problem"
          label="Problem it solves"
          autoResize
          maxHeight={280}
          rows={4}
          value={draft.problem}
          onChange={(e) => {
            setDraft((d) => ({ ...d, problem: e.target.value }));
            setDirty(true);
          }}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
          <Textarea
            id="rp-provides"
            label="What it provides"
            hint="one bullet per line"
            autoResize
            maxHeight={360}
            rows={5}
            value={draft.provides}
            onChange={(e) => {
              setDraft((d) => ({ ...d, provides: e.target.value }));
              setDirty(true);
            }}
          />
        </Card>
        <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
          <Textarea
            id="rp-serves"
            label="Who it serves"
            hint="Audience — why it fits them (one per line)"
            autoResize
            maxHeight={360}
            rows={5}
            value={draft.serves}
            onChange={(e) => {
              setDraft((d) => ({ ...d, serves: e.target.value }));
              setDirty(true);
            }}
          />
        </Card>
        <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
          <Textarea
            id="rp-why"
            label="Why it matters"
            hint="one reason per line"
            autoResize
            maxHeight={360}
            rows={5}
            value={draft.why}
            onChange={(e) => {
              setDraft((d) => ({ ...d, why: e.target.value }));
              setDirty(true);
            }}
          />
        </Card>
      </div>

      <p className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant/70">
        <Icon icon={Crown} size="sm" className="text-premium" />
        AI enhance uses the LLM narrator grounded strictly in audit facts — no invented numbers. Edits save per-audit.
      </p>
    </div>
  );
}
