"use client";

// Shared helpers for the Story Engine tab family.

import { toast } from "@/ui";

export async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} is on your clipboard.`, tone: "success" });
  } catch {
    toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
  }
}

export function downloadText(filename: string, text: string, mime = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const STORY_ART_PREFIX = "shipos-story";
export function storyKey(jobId: string, part: string): string {
  return `${STORY_ART_PREFIX}:${part}:${jobId}`;
}

export function loadStoryJson<T>(jobId: string, part: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storyKey(jobId, part));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveStoryJson(jobId: string, part: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storyKey(jobId, part), JSON.stringify(value));
  } catch {
    // storage full / private mode — non-critical
  }
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Cine grading hues as Ink roles: primary + tertiary chart colours. */
export const CINE_COLORS = {
  primary: "rgb(var(--md-sys-color-primary-rgb))",
  secondary: "rgb(var(--md-sys-color-tertiary-rgb))",
} as const;
