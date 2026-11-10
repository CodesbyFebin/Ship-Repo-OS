// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Demo Maker engine, server half. LLM voiceover enhancement only —
// the pure script builder lives in demo-shared.ts (client-safe, no SDK).
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData } from "./types";
import type { RepoAudit } from "./audit-types";
import type { VideoScript } from "./story-engine";
import { installCommand, modulesOf, type DemoStyle } from "./demo-shared";

// ── LLM voiceover enhancement ────────────────────────────────────────────────

const DEMO_SYSTEM = `You are the ShipOS Demo Maker — a keynote narrator who turns repositories into 5-minute demo films.
Voice: confident, concrete, fast. Short spoken sentences (8-22 words). Never generic filler.
Use ONLY the facts provided — never invent stars, benchmarks, users or features. Strict JSON only.`;

/** One call rewrites every scene's voiceover lines. Returns null on failure — the template stands. */
export async function enhanceDemoVo(
  repo: RepoData,
  audit: RepoAudit | null,
  script: VideoScript,
  opts: { style: DemoStyle },
): Promise<string[][] | null> {
  const { chatJson } = await import("./llm");
  const { z } = await import("zod");

  const n = script.scenes.length;
  const schema = z.object({
    lines: z.array(z.array(z.string().min(6).max(240)).min(2).max(7)).length(n),
  });

  const facts = {
    repo: `${repo.owner}/${repo.repo}`,
    description: repo.description,
    language: repo.detected.language,
    frameworks: repo.detected.frameworks.slice(0, 6),
    topics: repo.topics.slice(0, 10),
    license: repo.license?.spdx ?? null,
    stars: repo.stars,
    forks: repo.forks,
    contributors: repo.contributors.length,
    commitCount: repo.commitCount,
    releaseCount: repo.releaseCount,
    version: repo.manifest?.version ?? null,
    modules: modulesOf(repo).slice(0, 8),
    install: installCommand(repo),
    hasTests: repo.hasTests,
    ciWorkflows: repo.ciWorkflows.length,
    audit: audit
      ? {
          score: audit.score,
          grade: audit.grade,
          checksFailed: audit.stats.checksFailed,
          checksPassed: audit.stats.checksPassed,
          checksTotal: audit.stats.checksTotal,
          pointsAtStake: audit.stats.pointsAtStake,
          topFixes: audit.fixes.slice(0, 3).map((f) => ({ title: f.title, points: f.points })),
        }
      : null,
  };

  const sceneOutline = script.scenes.map((s, i) => `${i + 1}. [${s.actLabel}] ${s.title} — on screen: ${s.onScreen.join(" · ")}`).join("\n");

  const user = `FACTS:\n${JSON.stringify(facts)}\n\nSCENE OUTLINE (${n} scenes, ${script.totalDuration}s total):\n${sceneOutline}\n\nRewrite the spoken voiceover for every scene. Keep each scene's on-screen purpose; improve the words.
Style: ${opts.style}. JSON shape: {"lines": [[scene1 line1, ...], [scene2...], ...]} — exactly ${n} arrays, 3-6 lines each, spoken-word lines only.`;

  const ai = await chatJson({ system: DEMO_SYSTEM, user, schema, retries: 2, maxTokens: 3200 });
  return ai ? ai.lines : null;
}


export * from "./demo-shared";
