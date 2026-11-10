"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Rocket, X } from "@/ui/symbols";
import { Alert, Button, Card, Icon, Progress, Spinner } from "@/ui";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// ShippingProgress — live pipeline view while the claws do the work
// ─────────────────────────────────────────────────────────────────────────────

type Stage = "queued" | "ingesting" | "verifying" | "generating" | "scoring" | "done";

const STAGES: { key: Stage; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "ingesting", label: "Ingesting repo" },
  { key: "verifying", label: "Verifying claims" },
  { key: "generating", label: "Forging artifacts" },
  { key: "scoring", label: "Scoring" },
  { key: "done", label: "Done" },
];

const STAGE_LOGS: Record<Stage, string> = {
  queued: "[0/4] Queued… (waiting for a free claw)",
  ingesting: "[1/4] Ingesting Repo… (commits, manifests, workflows)",
  verifying: "[2/4] Verifying Claims… (claim → commit hash or REJECTED)",
  generating: "[3/4] Generating Assets… (README, Deck, Script, Report)",
  scoring: "[4/4] Scoring… (SEO · README · Health)",
  done: "» all claws finished — package sealed",
};

export interface ShippingProgressProps {
  url: string;
  stage: Stage;
  status: "processing" | "ready" | "error";
  error: string | null;
  onRetry: () => void;
}

export function ShippingProgress({ url, stage, status, error, onRetry }: ShippingProgressProps) {
  const currentIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.key === stage)
  );
  const isDone = status === "ready" || (stage === "done" && status !== "error");
  const isFailed = status === "error";
  const pct = isDone ? 100 : Math.round(((currentIndex + 0.5) / STAGES.length) * 100);

  const visibleLogs = STAGES.slice(0, isDone || isFailed ? STAGES.length : currentIndex + 1)
    .filter((s) => !(isFailed && s.key === "done"))
    .map((s) => STAGE_LOGS[s.key]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card className="flex flex-col gap-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            {"// SHIPPING IN PROGRESS"}
          </p>
          <p className="break-all font-mono text-body-md text-primary sm:text-title-md">{url}</p>
        </div>

        <Progress value={pct} label="Shipping progress" className="h-1.5" />

        {/* Stepper: vertical on mobile, horizontal on desktop */}
        <ol className="flex flex-col sm:flex-row sm:items-start">
          {STAGES.map((step, i) => {
            const failedHere = isFailed && i === currentIndex;
            const completed = !isFailed && (i < currentIndex || isDone);
            const current = !isFailed && i === currentIndex && status === "processing";
            const pending = !completed && !current && !failedHere;
            return (
              <li
                key={step.key}
                className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
              >
                {/* node + mobile connector */}
                <div className="relative flex flex-col items-center">
                  <span
                    className={cn(
                      "z-10 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-label-sm tnum",
                      completed && "bg-positive text-on-positive",
                      current && "bg-primary text-on-primary",
                      failedHere && "bg-error text-on-error",
                      pending && "bg-surface-container-highest text-on-surface-variant"
                    )}
                  >
                    {completed ? (
                      <Icon icon={Check} size="sm" className="h-3.5 w-3.5" />
                    ) : current ? (
                      <Spinner size="sm" label={`${step.label} in progress`} />
                    ) : failedHere ? (
                      <Icon icon={X} size="sm" className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {i < STAGES.length - 1 && (
                    <span
                      className={cn(
                        "absolute top-7 h-[calc(100%-0.5rem)] w-px sm:hidden",
                        completed ? "bg-primary/70" : "bg-outline-variant"
                      )}
                    />
                  )}
                </div>

                <div className={cn("pb-5 sm:pb-0", pending && "opacity-50", failedHere && "opacity-70")}>
                  <p
                    className={cn(
                      "text-label-md",
                      (completed || current) && "text-on-surface",
                      failedHere && "text-error",
                      pending && "text-on-surface-variant"
                    )}
                  >
                    {step.label}
                  </p>
                  {current && (
                    <p className="font-mono text-label-sm text-on-surface-variant">working…</p>
                  )}
                  {failedHere && (
                    <p className="font-mono text-label-sm text-error/80">failed</p>
                  )}
                </div>

                {/* desktop connector */}
                {i < STAGES.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-1/2 top-3 hidden h-px w-[calc(100%-1.5rem)] sm:block",
                      "translate-x-3",
                      completed ? "bg-primary/70" : "bg-outline-variant"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* Terminal log lines */}
        <div className="flex min-h-32 flex-col gap-1 rounded-medium bg-surface p-4 font-mono text-label-sm leading-relaxed sm:min-h-36 sm:text-body-sm">
          <AnimatePresence initial={false}>
            {visibleLogs.map((line, i) => {
              const isCurrent = i === visibleLogs.length - 1 && !isDone;
              return (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    isCurrent ? "text-primary" : "text-on-surface-variant/70",
                    isCurrent && "animate-pulse"
                  )}
                >
                  {line}
                  {isCurrent && <span className="ml-1 animate-pulse">▌</span>}
                </motion.p>
              );
            })}
          </AnimatePresence>
          {isDone && !isFailed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 inline-flex items-center gap-1.5 text-positive"
            >
              <Icon icon={Rocket} size="sm" className="h-3.5 w-3.5" />
              opening dashboard…
            </motion.p>
          )}
          {isFailed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 inline-flex items-center gap-1.5 text-error"
            >
              <Icon icon={AlertTriangle} size="sm" className="h-3.5 w-3.5" />
              pipeline aborted — see error below
            </motion.p>
          )}
        </div>
      </Card>

      {status === "error" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Alert
            tone="danger"
            title="Ship failed"
            action={
              <Button variant="outlined" size="xs" onClick={onRetry}>
                Try again
              </Button>
            }
          >
            <p>{error ?? "The engine hit an unexpected reef."}</p>
          </Alert>
        </motion.div>
      )}
    </div>
  );
}
