"use client";

import { useMemo } from "react";
import {
  Bot,
  Braces,
  Copy,
  Download,
  FileText,
  FileJson,
  Megaphone,
  MessagesSquare,
  Quote,
  Search,
  Sparkles,
  Target,
  Type,
} from "@/ui/symbols";
import { Badge, Card, Chip, CodeBlock, Icon, IconButton, toast, type IconGlyph } from "@/ui";
import type { OptimizationPack } from "@/lib/shipos/optimize-types";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${what} is on your clipboard.`, tone: "success" });
  } catch {
    toast({ title: "Copy failed", description: "Clipboard unavailable — select the text manually.", tone: "danger" });
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function faqMarkdown(pack: OptimizationPack): string {
  return `# FAQ\n\n${pack.faq.map((f) => `## ${f.q}\n\n${f.a}`).join("\n\n")}\n`;
}

function comparisonMarkdown(pack: OptimizationPack): string {
  const head = `| ${pack.comparison.headers.join(" | ")} |`;
  const rule = `| ${pack.comparison.headers.map(() => "---").join(" | ")} |`;
  const rows = pack.comparison.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${rule}\n${rows}\n`;
}

// ── shared card shell ────────────────────────────────────────────────────────

function AssetCard({
  title,
  icon,
  badge,
  copy,
  filename,
  content,
  children,
  className,
}: {
  title: string;
  icon: IconGlyph;
  badge?: string;
  copy: string;
  filename?: string;
  content?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col gap-3 p-4", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon icon={icon} size="sm" className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-title-sm">{title}</span>
        {badge ? (
          <Badge tone="tertiary" size="sm">
            {badge}
          </Badge>
        ) : null}
        <span className="flex shrink-0 items-center gap-1">
          <IconButton
            icon={Copy}
            size="sm"
            variant="tonal"
            label={`Copy ${title}`}
            
            onClick={() => void copyText(copy, title)}
          />
          {filename && content ? (
            <IconButton
              icon={Download}
              size="sm"
              variant="tonal"
              label={`Download ${filename}`}
              
              onClick={() => downloadText(filename, content)}
            />
          ) : null}
        </span>
      </div>
      {children}
    </Card>
  );
}

function CopyRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-small bg-surface-container p-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-label-md text-on-surface-variant">{label}</div>
        <div className="whitespace-pre-wrap break-words text-body-sm">{text}</div>
      </div>
      <IconButton
        icon={Copy}
        size="sm"
        variant="standard"
        label={`Copy ${label}`}
        
        onClick={() => void copyText(text, label)}
      />
    </div>
  );
}

// ── headline assets (the 4 the user asked for by name) ───────────────────────

export function HeadlineAssets({ pack, owner, repo }: { pack: OptimizationPack; owner: string; repo: string }) {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AssetCard title="Repo description" icon={Target} badge="asset" copy={pack.description} filename="description.txt" content={pack.description}>
        <p className="text-body-md">{pack.description}</p>
        <p className="text-label-md text-on-surface-variant">
          {pack.description.length} chars · paste into GitHub → About ⚙ · mirrors manifest + registries
        </p>
      </AssetCard>

      <AssetCard title="GitHub topics" icon={Search} badge="asset" copy={pack.topics.join(" ")} filename="topics.txt" content={pack.topics.join("\n")}>
        <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {pack.topics.map((t) => (
            <Chip key={t}>{`#${t}`}</Chip>
          ))}
        </div>
        <p className="text-label-md text-on-surface-variant">{pack.topics.length} topics · paste into GitHub → About ⚙ → Topics</p>
      </AssetCard>

      <AssetCard title="agents.txt" icon={Bot} badge="asset" copy={pack.agentsTxt} filename="agents.txt" content={pack.agentsTxt}>
        <div className="max-h-80 overflow-y-auto rounded-small">
          <CodeBlock title="agents.txt — orientation for AI coding agents" wrap>
            {pack.agentsTxt}
          </CodeBlock>
        </div>
        <p className="text-label-md text-on-surface-variant">
          Commit at repo root — Codex, Cursor, Devin and Claude Code read it first.
        </p>
      </AssetCard>

      <AssetCard title="llms.txt" icon={Sparkles} badge="asset" copy={pack.llmsTxt} filename="llms.txt" content={pack.llmsTxt}>
        <div className="max-h-80 overflow-y-auto rounded-small">
          <CodeBlock title="llms.txt — the LLM front-door (Answer.AI standard)" wrap>
            {pack.llmsTxt}
          </CodeBlock>
        </div>
        <p className="text-label-md text-on-surface-variant">
          Commit at repo root — ChatGPT, Claude and Perplexity crawlers read it before anything else.
        </p>
      </AssetCard>
    </div>
  );
}

// ── full pack assets (the other 50) ─────────────────────────────────────────

export function PackAssets({ pack }: { pack: OptimizationPack }) {
  const jsonLd = useMemo(() => JSON.stringify(pack.jsonLd, null, 2), [pack.jsonLd]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AssetCard
        title="Search meta"
        icon={Type}
        copy={`Title: ${pack.metaTitle}\nDescription: ${pack.metaDescription}`}
        filename="meta.txt"
        content={`Title: ${pack.metaTitle}\nDescription: ${pack.metaDescription}`}
      >
        <CopyRow label="Meta title (≤60)" text={pack.metaTitle} />
        <CopyRow label="Meta description (140-160)" text={pack.metaDescription} />
      </AssetCard>

      <AssetCard title="Search keywords" icon={Search} copy={pack.keywords.join(", ")} filename="keywords.txt" content={pack.keywords.join("\n")}>
        <div className="flex flex-wrap gap-1.5">
          {pack.keywords.map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
        </div>
        <p className="text-label-md text-on-surface-variant">Mirror into package.json “keywords” and docs frontmatter.</p>
      </AssetCard>

      <AssetCard title="Quick answer block" icon={Quote} copy={pack.quickAnswer} filename="quick-answer.md" content={pack.quickAnswer}>
        <p className="text-body-sm">{pack.quickAnswer}</p>
        <p className="text-label-md text-on-surface-variant">Drop under the README H1 — answer engines quote it verbatim.</p>
      </AssetCard>

      <AssetCard title="Quotable About block" icon={Quote} copy={pack.aboutPara} filename="about.md" content={pack.aboutPara}>
        <p className="text-body-sm">{pack.aboutPara}</p>
        <p className="text-label-md text-on-surface-variant">40-90 words + a hard number — the paragraph GEO engines cite with attribution.</p>
      </AssetCard>

      <AssetCard title="FAQ (6 answers)" icon={MessagesSquare} copy={faqMarkdown(pack)} filename="FAQ.md" content={faqMarkdown(pack)}>
        <div className="flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
          {pack.faq.map((f) => (
            <div key={f.q} className="rounded-small bg-surface-container p-2.5">
              <div className="text-title-sm">{f.q}</div>
              <p className="mt-1 text-body-sm text-on-surface-variant">{f.a}</p>
            </div>
          ))}
        </div>
      </AssetCard>

      <AssetCard title="JSON-LD schema" icon={FileJson} copy={jsonLd} filename="schema.jsonld" content={jsonLd}>
        <div className="max-h-72 overflow-y-auto rounded-small">
          <CodeBlock title="SoftwareApplication node — paste into docs <head> or README" wrap>
            {jsonLd}
          </CodeBlock>
        </div>
      </AssetCard>

      <AssetCard title="robots.txt — AI rules" icon={Braces} copy={pack.robotsAiTxt} filename="robots.txt" content={pack.robotsAiTxt}>
        <div className="max-h-60 overflow-y-auto rounded-small">
          <CodeBlock title="robots.txt — GPTBot · ClaudeBot · PerplexityBot allowed" wrap>
            {pack.robotsAiTxt}
          </CodeBlock>
        </div>
      </AssetCard>

      <AssetCard title="llms-full.txt" icon={FileText} copy={pack.llmsFullTxt} filename="llms-full.txt" content={pack.llmsFullTxt}>
        <div className="max-h-60 overflow-y-auto rounded-small">
          <CodeBlock title="llms-full.txt — expanded context for big-budget retrieval" wrap>
            {pack.llmsFullTxt}
          </CodeBlock>
        </div>
      </AssetCard>

      <AssetCard title="Comparison table" icon={Target} copy={comparisonMarkdown(pack)} filename="comparison.md" content={comparisonMarkdown(pack)}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-body-sm">
            <thead>
              <tr>
                {pack.comparison.headers.map((h) => (
                  <th key={h} className="border-b border-outline-variant px-2 py-1.5 text-left text-label-md text-on-surface-variant">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pack.comparison.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={cn("border-b border-outline-variant/60 px-2 py-1.5 align-top", j === 1 && "font-medium")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AssetCard>

      <AssetCard title="Launch copy pack" icon={Megaphone} copy={Object.values(pack.social).join("\n\n---\n\n")} filename="launch-copy.md" content={Object.values(pack.social).join("\n\n---\n\n")}>
        <div className="flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
          <CopyRow label="X / Twitter thread" text={pack.social.x} />
          <CopyRow label="LinkedIn post" text={pack.social.linkedin} />
          <CopyRow label="Hacker News" text={pack.social.hn} />
          <CopyRow label="Reddit" text={pack.social.reddit} />
          <CopyRow label="Product Hunt" text={pack.social.productHunt} />
          <CopyRow label="dev.to outline" text={pack.social.devto} />
        </div>
      </AssetCard>
    </div>
  );
}
