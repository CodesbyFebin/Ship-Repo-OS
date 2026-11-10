"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ShipOS PRO store — client-side license/plan/usage state (persisted).
// "shipos-pro" localStorage key. Server /api/pro remains the license source of
// truth; this store mirrors it and adds demo counters + per-audit fix tracking.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RepoAudit } from "./audit-types";

export type Tier = "FREE" | "PRO" | "TEAM";
export type Plan = "" | "monthly" | "lifetime" | "team";
export type StrictnessPref = "lenient" | "balanced" | "strict";

export interface CategoryWeights {
  docs: number;
  quality: number;
  security: number;
  devops: number;
  community: number;
}

export interface AutoFixSections {
  docs: boolean;
  security: boolean;
  devops: boolean;
  quality: boolean;
}

export const FREE_DAILY_AUDITS = 3;
export const FREE_VISIBLE_CHECKS = 20;
export const FREE_FREE_FIXES = 5;

export const isPro = (tier: Tier) => tier === "PRO" || tier === "TEAM";
export const isTeam = (tier: Tier) => tier === "TEAM";
export const todayKey = () => new Date().toISOString().slice(0, 10);

export const defaultWeights: CategoryWeights = {
  docs: 25,
  quality: 25,
  security: 20,
  devops: 15,
  community: 15,
};

export const sumWeights = (w: CategoryWeights) => w.docs + w.quality + w.security + w.devops + w.community;

/** Re-scale an audit's score client-side with custom category weights. */
export function applyWeights(audit: RepoAudit, weights: CategoryWeights | null): number {
  if (!weights) return audit.score;
  let total = 0;
  for (const cat of audit.categories) {
    const w = (weights as unknown as Record<string, number>)[cat.id] ?? cat.max;
    total += (cat.score / cat.max) * w;
  }
  return Math.max(0, Math.min(100, Math.round(total)));
}

export interface ProStore {
  tier: Tier;
  plan: Plan;
  auditsDate: string; // local date key of the free counter
  auditsUsed: number; // free audits today (0..3)
  fixesApplied: Record<string, string[]>; // auditId -> fixIds marked applied
  feedback: Record<string, 1 | -1>; // fixId -> vote
  strictness: StrictnessPref;
  customWeights: CategoryWeights | null; // null = default weights
  autoFixSections: AutoFixSections;
  onboarded: boolean;
  proStatsSeed: number; // increments each audit, used for PRO stats

  setTier: (tier: Tier, plan: Plan) => void;
  consumeAudit: () => void;
  auditsLeftToday: () => number;
  markFixApplied: (auditId: string, fixId: string) => void;
  markAllApplied: (auditId: string, fixIds: string[]) => void;
  resetDemo: () => void;
  setStrictness: (s: StrictnessPref) => void;
  setWeights: (w: CategoryWeights | null) => void;
  toggleSection: (k: keyof AutoFixSections) => void;
  setFeedback: (fixId: string, v: 1 | -1) => void;
  setOnboarded: () => void;
}

export const useProStore = create<ProStore>()(
  persist(
    (set, get) => ({
      tier: "FREE",
      plan: "",
      auditsDate: todayKey(),
      auditsUsed: 0,
      fixesApplied: {},
      feedback: {},
      strictness: "balanced",
      customWeights: null,
      autoFixSections: { docs: true, security: true, devops: true, quality: true },
      onboarded: false,
      proStatsSeed: 0,

      setTier: (tier, plan) => set({ tier, plan }),

      consumeAudit: () =>
        set((s) => {
          const t = todayKey();
          const used = s.auditsDate === t ? s.auditsUsed : 0;
          return { auditsDate: t, auditsUsed: used + 1, proStatsSeed: s.proStatsSeed + 1 };
        }),

      auditsLeftToday: () => {
        const s = get();
        if (isPro(s.tier)) return 999;
        const used = s.auditsDate === todayKey() ? s.auditsUsed : 0;
        return Math.max(0, FREE_DAILY_AUDITS - used);
      },

      markFixApplied: (auditId, fixId) =>
        set((s) => {
          const current = s.fixesApplied[auditId] ?? [];
          if (current.includes(fixId)) return s;
          return { fixesApplied: { ...s.fixesApplied, [auditId]: [...current, fixId] } };
        }),

      markAllApplied: (auditId, fixIds) =>
        set((s) => ({ fixesApplied: { ...s.fixesApplied, [auditId]: fixIds } })),

      resetDemo: () => set({ tier: "FREE", plan: "", auditsUsed: 0, fixesApplied: {} }),

      setStrictness: (strictness) => set({ strictness }),

      setWeights: (customWeights) => set({ customWeights }),

      toggleSection: (k) =>
        set((s) => ({ autoFixSections: { ...s.autoFixSections, [k]: !s.autoFixSections[k] } })),

      setFeedback: (fixId, v) => set((s) => ({ feedback: { ...s.feedback, [fixId]: v } })),

      setOnboarded: () => set({ onboarded: true }),
    }),
    {
      name: "shipos-pro",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * SSR-safe hydration guard: persisted zustand state rehydrates after mount,
 * so components must render gated content only once this returns true.
 * Implemented with useSyncExternalStore so React re-reads the snapshot after
 * hydration finishes without calling setState inside an effect.
 */
function subscribeProHydration(onStoreChange: () => void) {
  return useProStore.persist.onFinishHydration(onStoreChange);
}

export function useProHydrated(): boolean {
  return useSyncExternalStore(
    subscribeProHydration,
    () => useProStore.persist.hasHydrated(),
    () => false
  );
}
