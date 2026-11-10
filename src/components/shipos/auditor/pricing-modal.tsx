"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { BadgeCheck, Check, Crown, Diamond, Lock, RotateCcw, Sparkles, Users } from "@/ui/symbols";
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  SegmentedButton,
  Sheet,
  toast,
} from "@/ui";
import { fireConfetti } from "@/components/shipos/auditor/confetti";
import { isPro, isTeam, useProHydrated, useProStore, type Plan } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// PricingModal — 3 tiers, comparison matrix, demo checkout, manage/restore.
// Server contract: GET/POST /api/pro ({ action: "checkout" | "cancel" | "restore" }).
// ─────────────────────────────────────────────────────────────────────────────

interface ProApiState {
  tier: "FREE" | "PRO" | "TEAM";
  plan: string;
  expiresAt: string | null;
  active: boolean;
}

type CheckoutPlan = "monthly" | "lifetime" | "team";

const COMPARISON_ROWS: { label: string; free: boolean; pro: boolean; team: boolean }[] = [
  { label: "All 50 checks", free: false, pro: true, team: true },
  { label: "Auto Fix to 100/100", free: false, pro: true, team: true },
  { label: "Bulk Audit", free: false, pro: true, team: true },
  { label: "Compare Repos", free: false, pro: true, team: true },
  { label: "Download Bundle", free: false, pro: true, team: true },
  { label: "Git + PR Generator", free: false, pro: true, team: true },
  { label: "Scheduled Audits", free: false, pro: true, team: true },
  { label: "Score Alerts", free: false, pro: true, team: true },
  { label: "Badge Generator", free: false, pro: true, team: true },
  { label: "Unlimited audits", free: false, pro: true, team: true },
  { label: "Team Workspaces", free: false, pro: false, team: true },
  { label: "Assign Fixes", free: false, pro: false, team: true },
  { label: "Comments", free: false, pro: false, team: true },
  { label: "API Access", free: false, pro: false, team: true },
  { label: "SSO", free: false, pro: false, team: true },
];

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body-sm text-on-surface/80">
      <Icon icon={Check} size="sm" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
      <span>{children}</span>
    </li>
  );
}

async function fetchProState(): Promise<ProApiState | null> {
  try {
    const res = await fetch("/api/pro", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ProApiState;
  } catch {
    return null;
  }
}

async function postProAction(action: string, plan?: CheckoutPlan): Promise<ProApiState | null> {
  const res = await fetch("/api/pro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, plan }),
  });
  const body = (await res.json()) as ProApiState & { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

// ── Manage subscription (also embedded in the PRO hub tab) ───────────────────

export function ManageSubscription({ onChanged }: { onChanged?: () => void }) {
  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);
  const plan = useProStore((s) => s.plan);
  const setTier = useProStore((s) => s.setTier);
  const [api, setApi] = useState<ProApiState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const sync = useCallback(
    (state: ProApiState | null) => {
      if (!state) return;
      setApi(state);
      setTier(state.tier, (state.plan as Plan) ?? "");
    },
    [setTier]
  );

  const refresh = useCallback(async () => {
    sync(await fetchProState());
  }, [sync]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checkout = async (plan: CheckoutPlan) => {
    setBusy(plan);
    try {
      const state = await postProAction("checkout", plan);
      sync(state);
      fireConfetti();
      toast({
        title: state?.tier === "TEAM" ? "Welcome to PRO TEAM" : "Welcome to PRO",
        description: "All 50 checks, Auto Fix, bulk, compare and scheduled audits are unlocked.",
        tone: "success",
      });
      onChanged?.();
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      const state = await postProAction("cancel");
      sync(state);
      setConfirmCancel(false);
      toast({ title: "Subscription cancelled", description: "You are back on the FREE tier.", tone: "success" });
      onChanged?.();
    } catch (err) {
      toast({ title: "Cancel failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  if (!hydrated) return null;
  const active = isPro(tier);

  return (
    <Card className="flex flex-col gap-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
          <Icon icon={BadgeCheck} size="sm" className="text-premium" />
          {"// MANAGE SUBSCRIPTION"}
        </p>
        {api?.expiresAt && (
          <Badge tone="premium" size="sm" numeric className="font-mono">
            renews {format(new Date(api.expiresAt), "MMM d, yyyy")}
          </Badge>
        )}
      </div>

      {active ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-title-lg font-bold text-on-surface">
              <Icon icon={Crown} size="md" className="text-premium" />
              {tier === "TEAM" ? "PRO TEAM" : "PRO"}
            </span>
            <Badge tone="premium" size="sm" className="font-mono uppercase">
              {plan || "active"}
            </Badge>
            {!api?.expiresAt && plan === "lifetime" && (
              <span className="font-mono text-label-sm text-on-surface-variant">never expires</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {plan !== "lifetime" && (
              <Button variant="outlined" size="xs" icon={Diamond} loading={busy === "lifetime"} disabled={busy !== null} onClick={() => void checkout("lifetime")} className="font-mono">
                Switch to lifetime — $19 once
              </Button>
            )}
            {plan !== "monthly" && (
              <Button variant="outlined" size="xs" icon={Diamond} loading={busy === "monthly"} disabled={busy !== null} onClick={() => void checkout("monthly")} className="font-mono tnum">
                Switch to monthly — $9/mo
              </Button>
            )}
            {tier !== "TEAM" && (
              <Button variant="outlined" size="xs" icon={Users} loading={busy === "team"} disabled={busy !== null} onClick={() => void checkout("team")} className="font-mono tnum">
                Move to PRO TEAM — $49/mo
              </Button>
            )}
          </div>
          <Divider />
          {confirmCancel ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-body-sm text-on-surface-variant">Cancel and downgrade to FREE? Your fixes-applied history stays.</p>
              <Button variant="danger" size="xs" loading={busy === "cancel"} disabled={busy !== null} onClick={() => void cancel()}>
                Yes, downgrade
              </Button>
              <Button variant="text" size="xs" onClick={() => setConfirmCancel(false)}>
                Keep PRO
              </Button>
            </div>
          ) : (
            <Button
              variant="text"
              size="xs"
              onClick={() => setConfirmCancel(true)}
              className="self-start font-mono text-on-surface-variant"
            >
              Cancel subscription / downgrade to FREE
            </Button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body-sm text-on-surface-variant">No active subscription — you are on the FREE tier.</p>
          <Button variant="outlined" size="xs" icon={Diamond} loading={busy === "monthly"} disabled={busy !== null} className="text-premium" onClick={() => void checkout("monthly")}>
            Upgrade to PRO — $9/mo
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── The modal ────────────────────────────────────────────────────────────────

export function PricingModal({
  open,
  onOpenChange,
  initialView = "pricing",
  paywall = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: "pricing" | "manage";
  paywall?: boolean;
}) {
  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);
  const setTier = useProStore((s) => s.setTier);
  const resetDemo = useProStore((s) => s.resetDemo);
  const [view, setView] = useState<"pricing" | "manage">(initialView);
  const [planChoice, setPlanChoice] = useState<"monthly" | "lifetime">("monthly");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [syncedInitial, setSyncedInitial] = useState(initialView);

  // Sync the active view with initialView whenever the modal opens or the
  // requested view changes (render-phase adjustment — no effect needed).
  if (open && initialView !== syncedInitial) {
    setSyncedInitial(initialView);
    setView(initialView);
  }

  const sync = useCallback(
    (state: ProApiState | null) => {
      if (!state) return;
      setTier(state.tier, (state.plan as Plan) ?? "");
    },
    [setTier]
  );

  const refreshPro = useCallback(async () => {
    sync(await fetchProState());
  }, [sync]);

  useEffect(() => {
    if (open) void refreshPro();
  }, [open, refreshPro]);

  const checkout = async (plan: CheckoutPlan) => {
    setBusyPlan(plan);
    try {
      const state = await postProAction("checkout", plan);
      sync(state);
      fireConfetti();
      toast({
        title: state?.tier === "TEAM" ? "Welcome to PRO TEAM" : "Welcome to PRO",
        description: "All 50 checks, Auto Fix, bulk, compare and scheduled audits are unlocked.",
        tone: "success",
      });
    } catch (err) {
      toast({ title: "Checkout failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusyPlan(null);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const state = await postProAction("restore");
      sync(state);
      toast({ title: "Purchase restored", description: `Tier ${state?.tier ?? "PRO"} is active again.`, tone: "success" });
    } catch (err) {
      toast({ title: "Restore failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setRestoring(false);
    }
  };

  const demoReset = () => {
    resetDemo();
    toast({ title: "Demo reset", description: "FREE tier restored — 3 fresh audits for today.", tone: "success" });
  };

  const proActive = hydrated && isPro(tier);
  const teamActive = hydrated && isTeam(tier);

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      size="lg"
      title={
        <span className="flex items-center gap-2 font-mono">
          <Icon icon={Diamond} size="sm" className="text-premium" />
          {view === "manage" ? "Manage your plan" : "ShipOS PRO — every missing point, handled."}
        </span>
      }
      description={
        view === "manage"
          ? "Switch plans, cancel, or review your current license."
          : "50 deterministic checks, one-click Auto Fix to 100/100, bulk + compare, scheduled audits and badges."
      }
    >
      <div className="flex flex-col gap-5">
        {paywall && view === "pricing" && (
          <div className="flex flex-wrap items-center gap-2 rounded-medium bg-premium-container p-3 text-on-premium-container dark:bg-premium dark:text-on-premium">
            <Icon icon={Lock} size="sm" className="shrink-0" />
            <p className="flex-1 text-body-sm">
              You&apos;ve used all {3} free audits for today. Upgrade for unlimited audits — or reset the demo.
            </p>
            <Button variant="text" size="xs" icon={RotateCcw} onClick={demoReset} className="font-mono">
              Reset demo
            </Button>
          </div>
        )}

        {view === "manage" ? (
          <div className="flex flex-col gap-4">
            <ManageSubscription />
            <Button variant="text" size="xs" onClick={() => setView("pricing")} className="self-start font-mono text-on-surface-variant">
              View all plans
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Tier cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {/* FREE */}
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">FREE</span>
                </div>
                <p className="tnum text-headline-lg font-bold text-on-surface">
                  $0<span className="text-body-sm font-normal text-on-surface-variant"> forever</span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  <PlanFeature>3 audits / day</PlanFeature>
                  <PlanFeature>20 basic checks</PlanFeature>
                  <PlanFeature>Manual ranked fixes</PlanFeature>
                  <PlanFeature>1 saved repo</PlanFeature>
                </ul>
                <Button variant="outlined" disabled className="mt-auto font-mono">
                  {!hydrated ? "…" : tier === "FREE" ? "Current plan" : "Free tier"}
                </Button>
              </Card>

              {/* PRO */}
              <Card surface="high" className="relative flex flex-col gap-3">
                <Badge tone="premium" variant="solid" size="sm" className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-mono font-bold uppercase tracking-wider">
                  Most popular
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-label-md uppercase tracking-widest text-premium">
                    <Icon icon={Diamond} size="sm" />
                    PRO
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <SegmentedButton
                    label="PRO billing period"
                    options={[
                      { value: "monthly", label: "$9 / mo" },
                      { value: "lifetime", label: "$19 once" },
                    ]}
                    value={planChoice}
                    onChange={setPlanChoice}
                    className="tnum font-mono"
                  />
                  <p className="font-mono text-label-sm text-on-surface-variant/70">
                    {planChoice === "monthly" ? "cancel anytime" : "one-time purchase, yours forever"}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5">
                  <PlanFeature>All 50 checks + Auto Fix to 100/100</PlanFeature>
                  <PlanFeature>Bulk Audit + Compare Repos</PlanFeature>
                  <PlanFeature>Download bundle + Git + PR generator</PlanFeature>
                  <PlanFeature>Scheduled audits, alerts, badges</PlanFeature>
                  <PlanFeature>Unlimited audits</PlanFeature>
                </ul>
                <Button
                  onClick={() => void checkout(planChoice)}
                  disabled={!hydrated || proActive || busyPlan !== null}
                  loading={busyPlan === planChoice}
                  icon={proActive ? BadgeCheck : Crown}
                  className="mt-auto bg-premium text-on-premium tnum"
                >
                  {proActive ? "Current plan" : planChoice === "monthly" ? "Go PRO — $9/mo" : "Go PRO — $19 lifetime"}
                </Button>
              </Card>

              {/* TEAM */}
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-label-md uppercase tracking-widest text-on-surface/80">
                    <Icon icon={Users} size="sm" className="text-positive" />
                    PRO TEAM
                  </span>
                </div>
                <p className="tnum text-headline-lg font-bold text-on-surface">
                  $49<span className="text-body-sm font-normal text-on-surface-variant"> / mo</span>
                </p>
                <ul className="flex flex-col gap-1.5">
                  <PlanFeature>Everything in PRO</PlanFeature>
                  <PlanFeature>Team workspaces + assign fixes</PlanFeature>
                  <PlanFeature>Comments on fixes</PlanFeature>
                  <PlanFeature>API access (keys + curl)</PlanFeature>
                  <PlanFeature>SSO</PlanFeature>
                </ul>
                <Button
                  variant="outlined"
                  onClick={() => void checkout("team")}
                  disabled={!hydrated || teamActive || busyPlan !== null}
                  loading={busyPlan === "team"}
                  icon={teamActive ? BadgeCheck : Users}
                  className="mt-auto tnum"
                >
                  {teamActive ? "Current plan" : "Go PRO TEAM"}
                </Button>
              </Card>
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto rounded-medium bg-surface-container-high">
              <table className="w-full min-w-[480px] border-collapse text-body-sm">
                <thead>
                  <tr className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2 text-left font-medium">Feature</th>
                    <th className="px-3 py-2 text-center font-medium">FREE</th>
                    <th className="px-3 py-2 text-center font-medium text-premium">PRO</th>
                    <th className="px-3 py-2 text-center font-medium">TEAM</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-outline-variant">
                      <td className="px-3 py-2 text-on-surface/80">{row.label}</td>
                      {([row.free, row.pro, row.team] as const).map((ok, i) => (
                        <td key={i} className="px-3 py-2 text-center">
                          {ok ? (
                            <Icon icon={Check} size="sm" label="included" className="mx-auto text-positive" />
                          ) : (
                            <Icon icon={Lock} size="sm" label="not included" className="mx-auto text-on-surface/[0.25]" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Divider />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="text"
                size="xs"
                icon={RotateCcw}
                loading={restoring}
                onClick={() => void restore()}
                className="font-mono text-on-surface-variant"
              >
                Restore purchase
              </Button>
              <div className="flex items-center gap-2">
                {proActive && (
                  <Button variant="outlined" size="xs" onClick={() => setView("manage")} className="font-mono">
                    Manage subscription
                  </Button>
                )}
                <span className="inline-flex items-center gap-1 font-mono text-label-sm text-on-surface-variant/70">
                  <Icon icon={Sparkles} size="sm" className="h-3 w-3 text-premium" />
                  demo checkout — no card required
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
