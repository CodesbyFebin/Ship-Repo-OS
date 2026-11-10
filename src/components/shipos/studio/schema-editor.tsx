"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SchemaEditor — edit any scene's title, duration and voiceover lines. Changes
// instantly drive the player preview, the SRT and the WebM export. Scenes that
// blow their duration budget are highlighted in error. Persisted per audit in
// localStorage (key: shipos-story:studio-script:<jobId>).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { AlertTriangle, RotateCcw, Save, Timer } from "@/ui/symbols";
import { Badge, Button, Card, Icon, Textarea, TextField, cn } from "@/ui";
import type { VideoScript } from "@/lib/shipos/story-engine";
import { fmtClock } from "../auditor/story/story-utils";

const BUDGET_SLACK = 1.35; // a scene is "over budget" past 1.35× its share

export function SchemaEditor({
  script,
  baseScript,
  onChange,
  onSave,
  saved,
  targetTotal = 120,
}: {
  script: VideoScript;
  baseScript: VideoScript;
  onChange: (next: VideoScript) => void;
  onSave: () => void;
  saved: boolean;
  /** Total cut length the budget bars assume — 120s for the Story Engine, 300s for the Demo Maker. */
  targetTotal?: number;
}) {
  const budget = Math.round(targetTotal / Math.max(1, script.scenes.length));
  const total = script.totalDuration;
  const overBudget = script.scenes.filter((s) => s.duration > budget * BUDGET_SLACK);
  const dirty = useMemo(() => JSON.stringify(script) !== JSON.stringify(baseScript), [script, baseScript]);

  const update = (id: string, patch: Partial<VideoScript["scenes"][number]>) => {
    const scenes = script.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s));
    onChange({
      ...script,
      scenes,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
    });
  };

  return (
    <Card className="flex h-full flex-col gap-3" padding="md">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
          <Icon icon={Timer} size="sm" />
          Schema Editor
        </h3>
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="text" icon={RotateCcw} onClick={() => onChange(baseScript)} disabled={!dirty}>
            Reset
          </Button>
          <Button size="xs" variant="tonal" icon={Save} onClick={onSave} disabled={!dirty}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* duration budget meter */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
          <span>
            total {fmtClock(total)} / target {fmtClock(targetTotal)}
          </span>
          <span className={total > targetTotal ? "text-error" : "text-positive"}>
            {total > targetTotal ? `+${Math.round(total - targetTotal)}s over` : `${Math.round(targetTotal - total)}s free`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Duration budget"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round((total / targetTotal) * 100))}
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-container"
        >
          <div
            className={`h-full rounded-full transition-all ${total > targetTotal ? "bg-error" : "bg-primary"}`}
            style={{ width: `${Math.min(100, (total / targetTotal) * 100)}%` }}
          />
        </div>
        {overBudget.length > 0 && (
          <p className="flex items-center gap-1 text-label-sm text-error">
            <Icon icon={AlertTriangle} size="sm" className="h-3.5 w-3.5" />
            over budget: {overBudget.map((s) => s.id).join(", ")} · scene share ≈ {budget}s
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="flex flex-col gap-3">
          {script.scenes.map((scene, i) => {
            const sceneOver = scene.duration > budget * BUDGET_SLACK;
            return (
              <div
                key={scene.id}
                className={cn(
                  "flex flex-col gap-2 rounded-small p-3",
                  sceneOver ? "bg-error-container/40" : "bg-surface-container-high"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-label-sm uppercase tracking-widest text-primary">
                    {scene.actLabel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {sceneOver && (
                      <Badge tone="error" size="sm">
                        over budget
                      </Badge>
                    )}
                    <span className="font-mono text-label-sm text-on-surface-variant">#{i + 1}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <TextField
                    label="Title"
                    dense
                    value={scene.title}
                    onChange={(e) => update(scene.id, { title: e.target.value })}
                  />
                  <TextField
                    label="Dur (s)"
                    dense
                    className="w-24"
                    type="number"
                    min={4}
                    max={60}
                    value={scene.duration}
                    aria-invalid={sceneOver || undefined}
                    onChange={(e) => update(scene.id, { duration: Math.max(4, Math.min(60, Number(e.target.value) || scene.duration)) })}
                  />
                </div>

                <Textarea
                  label={`Voiceover — one line per caption chunk (${scene.vo.length})`}
                  rows={Math.min(6, Math.max(3, scene.vo.length))}
                  value={scene.vo.join("\n")}
                  onChange={(e) => update(scene.id, { vo: e.target.value.split("\n").filter((l) => l.trim().length > 0) })}
                  className="font-mono text-body-sm"
                />

                <p className="font-mono text-label-sm leading-relaxed text-on-surface-variant/70">{scene.goal}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
