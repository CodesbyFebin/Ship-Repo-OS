"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LandingTab — landingPagePro: single-file HTML/CSS landing generated from the
// audit. Hero 62→100 gauge, Problem/Solution/Proof/Scoring/FAQ/CTA, SEO meta +
// OG + canonical + JSON-LD (SoftwareApplication, FAQPage, HowTo, Speakable).
// Live preview (sandboxed iframe) + full code view + copy + download.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { Check, Code2, Copy, Download, ExternalLink, Eye, Globe } from "@/ui/symbols";
import { Badge, Button, Card, CodeBlock, Icon, SegmentedButton } from "@/ui";
import type { AuditJobResponse } from "@/lib/shipos/audit-types";
import { buildLandingHtml } from "@/lib/shipos/story-engine";
import { copyText, downloadText } from "./story-utils";

export function LandingTab({ job }: { job: AuditJobResponse }) {
  const html = useMemo(() => (job.audit ? buildLandingHtml(job) : ""), [job]);
  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const jsonLd = (html.match(/"@type":\s*"/g) ?? []).length;
    const sizeKb = Math.max(1, Math.round(new Blob([html]).size / 1024));
    return { schemas: jsonLd, sizeKb };
  }, [html]);

  const copyHtml = async () => {
    await copyText(html, "Landing page HTML");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!html) return null;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <span className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={Globe} size="sm" className="text-tertiary" />
          landingPagePro — one file, zero dependencies
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outlined" className="font-mono text-tertiary">SEO meta + OG + canonical</Badge>
          <Badge variant="outlined" className="font-mono text-primary">AEO: Speakable</Badge>
          <Badge variant="outlined" numeric className="font-mono text-positive">GEO: JSON-LD ×{stats.schemas}</Badge>
          <Badge variant="outlined" numeric className="font-mono">{stats.sizeKb} KB</Badge>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <SegmentedButton
            label="Landing page view"
            options={[
              { value: "preview", label: "Live preview", icon: Eye },
              { value: "code", label: "HTML code", icon: Code2 },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Button size="xs" variant="outlined" icon={copied ? Check : Copy} onClick={() => void copyHtml()} className="font-mono">
            Copy HTML
          </Button>
          <Button
            size="xs"
            variant="outlined"
            icon={Download}
            onClick={() => downloadText(`${job.repo}-landing.html`, html, "text/html;charset=utf-8")}
            className="font-mono"
          >
            Download .html
          </Button>
        </div>
      </Card>

      {mode === "preview" ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2">
            <span className="size-2 rounded-full bg-error/70" />
            <span className="size-2 rounded-full bg-premium/70" />
            <span className="size-2 rounded-full bg-positive/70" />
            <span className="ml-2 truncate rounded-extra-small bg-surface-container px-2 py-0.5 font-mono text-label-sm text-on-surface-variant">
              {job.repoUrl.replace(/^https?:\/\//, "")} — landing preview
            </span>
            <Icon icon={ExternalLink} size="sm" className="ml-auto text-on-surface-variant" />
          </div>
          <iframe
            title={`${job.repo} landing page preview`}
            srcDoc={html}
            sandbox="allow-scripts"
            className="h-[640px] w-full bg-surface-container-lowest"
          />
        </Card>
      ) : (
        <CodeBlock lang="markup" className="max-h-[640px] overflow-y-auto" title={`${job.repo}-landing.html · ${html.split("\n").length} lines`}>
          {html}
        </CodeBlock>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { t: "SEO", d: "title, description, keywords, Open Graph, Twitter card, canonical URL, robots directives" },
            { t: "AEO (answer engines)", d: "FAQPage + SpeakableSpecification — ready for voice assistants and AI answer snippets" },
            { t: "GEO (AI search)", d: "SoftwareApplication + HowTo JSON-LD with machine-readable facts, ratings and steps" },
          ] as const
        ).map((x) => (
          <Card key={x.t} className="flex flex-col gap-1 bg-surface-container-low">
            <p className="font-mono text-label-md font-bold uppercase tracking-widest text-tertiary">{x.t}</p>
            <p className="text-body-sm leading-relaxed text-on-surface-variant">{x.d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
