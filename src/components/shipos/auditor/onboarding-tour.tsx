"use client";

import { useState } from "react";
import { ListChecks, MousePointerClick, Wand2 } from "@/ui/symbols";
import { Button, Icon, Sheet } from "@/ui";
import { useProHydrated, useProStore } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingTour — 3-step intro dialog on the auditor's first visit.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Paste a repo — get a 0-100 score",
    body: "GitHub URL or a pasted file list. 50 deterministic checks across 5 weighted categories score the whole repository — no LLM guessing, the same repo always scores the same.",
    hint: "// STEP 1 OF 3 — AUDIT",
  },
  {
    icon: ListChecks,
    title: "Every missing point has a ranked fix",
    body: "Each failed check maps to a fix with full copy-paste code, ordered by points recovered. Tick fixes as you apply them and watch the projected score climb toward 100.",
    hint: "// STEP 2 OF 3 — ROADMAP",
  },
  {
    icon: Wand2,
    title: "PRO: one-click Auto Fix to 100/100",
    body: "Let ShipOS apply every fix for the sections you pick, download the bundle, copy the git commands, generate the PR description — then re-audit to verify the jump. Bulk, compare and scheduled audits included.",
    hint: "// STEP 3 OF 3 — GO PRO",
  },
];

export function OnboardingTour() {
  const hydrated = useProHydrated();
  const onboarded = useProStore((s) => s.onboarded);
  const setOnboarded = useProStore((s) => s.setOnboarded);
  const [step, setStep] = useState(0);

  const open = hydrated && !onboarded;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    setOnboarded();
    setStep(0);
  };

  return (
    <Sheet
      open={open}
      onClose={finish}
      title={
        <span className="flex items-center gap-2">
          <Icon icon={current.icon} size="md" className="text-primary" />
          {current.title}
        </span>
      }
      description={current.body}
      size="fit"
      footer={
        <>
          <Button variant="text" onClick={finish} className="font-mono text-on-surface-variant">
            Skip
          </Button>
          <Button onClick={() => (isLast ? finish() : setStep((s) => s + 1))} className="min-w-24">
            {isLast ? "Start auditing" : "Next"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="font-mono text-label-sm uppercase tracking-widest text-primary">{current.hint}</p>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-surface-container-highest"}`} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
