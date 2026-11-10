"use client";

import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeftRight, History, LineChart as LineChartIcon } from "@/ui/symbols";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState, Icon, cn } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobListItem } from "@/lib/shipos/audit-types";

// ─────────────────────────────────────────────────────────────────────────────
// HistoryTab — score-over-time chart across every finished audit + open list.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

/** Score → the role colour it reads as. */
function scoreClass(score: number): string {
  if (score >= 85) return "text-positive";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-premium";
  return "text-error";
}

export function HistoryTab({ items, onOpen }: { items: AuditJobListItem[]; onOpen: (id: string) => void }) {
  const ready = useMemo(
    () =>
      items
        .filter((i) => i.status === "ready")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items]
  );

  const data = useMemo(
    () =>
      ready.map((item) => ({
        name: format(new Date(item.createdAt), "MMM d HH:mm"),
        score: item.score,
        repo: `${item.owner}/${item.repo}`,
      })),
    [ready]
  );

  if (ready.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No finished audits yet"
        description="Run your first audit and this tab fills with a score-over-time chart — perfect for watching a repo climb to 100."
        size="inline"
        className="p-10"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={LineChartIcon} size="sm" className="text-primary" />
            {"// SCORE OVER TIME"}
          </p>
          <span className="font-mono text-label-sm text-on-surface-variant">
            {ready.length} finished audit{ready.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="historyLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgb(var(--md-sys-color-outline-variant-rgb))" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: "rgb(var(--md-sys-color-on-surface-variant-rgb))", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgb(var(--md-sys-color-outline-variant-rgb))" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "rgb(var(--md-sys-color-on-surface-variant-rgb))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(var(--md-sys-color-surface-container-high-rgb))",
                  border: "1px solid rgb(var(--md-sys-color-outline-variant-rgb))",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "rgb(var(--md-sys-color-on-surface-rgb))",
                }}
                labelStyle={{ color: "rgb(var(--md-sys-color-on-surface-variant-rgb))" }}
                itemStyle={{ color: "rgb(var(--md-sys-color-on-surface-rgb))" }}
                cursor={{ stroke: "rgb(var(--md-sys-color-outline-variant-rgb))" }}
                formatter={(value: number | string) => [`${value}/100`, "score"]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="url(#historyLine)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "var(--chart-1)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "rgb(var(--md-sys-color-surface-rgb))" }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={ArrowLeftRight} size="sm" className="text-primary" />
          compare any two runs — oldest → newest, x-axis is the audit timestamp
        </p>
      </Card>

      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
        {[...ready].reverse().map((item) => (
          <HistoryRow key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({ item, onOpen }: { item: AuditJobListItem; onOpen: (id: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(item.id);
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-small bg-surface-container px-4 py-3",
        interactive()
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-positive" aria-hidden />
      <span className="truncate font-mono text-body-md text-on-surface">
        {item.owner}/{item.repo}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-label-md">
        <span className={cn(scoreClass(item.score), "tnum")}>{item.score}/100</span>
        {item.fixesCount > 0 && (
          <span className="text-on-surface-variant">
            · {item.fixesCount} fix{item.fixesCount === 1 ? "" : "es"}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 font-mono text-label-sm text-on-surface-variant sm:inline">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}
