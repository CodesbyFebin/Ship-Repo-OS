"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  GitBranch,
  Gavel,
  History,
  Star,
} from "@/ui/symbols";
import { Badge, Button, ButtonLink, Card, Icon, TabPanel, Tabs, toast } from "@/ui";
import type { TabItem } from "@/ui";
import type { ProjectResponse } from "@/lib/shipos/types";
import { getPreset } from "@/lib/shipos/presets";
import { ScoreRow } from "@/components/shipos/score-cards";
import {
  Chip,
  CopyButton,
  DeckTab,
  DemoTab,
  ExportTab,
  HealthTab,
  LedgerTab,
  ReadmeTab,
  ReportTab,
  SeoTab,
} from "@/components/shipos/dashboard-tabs";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — mission control for one forged submission package
// ─────────────────────────────────────────────────────────────────────────────

const TAB_ITEMS: TabItem<string>[] = [
  { value: "readme", label: "README" },
  { value: "ledger", label: "Claim Ledger" },
  { value: "demo", label: "Demo Script" },
  { value: "deck", label: "Pitch Deck" },
  { value: "report", label: "Report" },
  { value: "seo", label: "SEO Report" },
  { value: "health", label: "Repo Health" },
  { value: "export", label: "Export /dist" },
];

export function Dashboard({ project, onBack }: { project: ProjectResponse; onBack: () => void }) {
  const data = project.data;
  const [tab, setTab] = useState("readme");
  if (!data) return null;
  const { repo } = data;
  const preset = getPreset(project.preset);
  const commitCount = repo.commitCount ?? repo.commits.length;

  const downloadZip = () => {
    window.location.href = `/api/projects/${project.id}/export`;
    toast({ title: "Export started", description: "Downloading /dist as .zip", tone: "success" });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outlined" size="xs" icon={ArrowLeft} onClick={onBack} className="shrink-0">
              New ship
            </Button>
            <h1 className="truncate font-mono text-title-lg text-on-surface sm:text-display-sm">
              {repo.owner}/{repo.repo}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" icon={Download} onClick={downloadZip}>
              Export /dist (.zip)
            </Button>
            <CopyButton text={data.artifacts.readme} label="Copy README" />
            <ButtonLink href={repo.url} external variant="outlined" size="xs" icon={ExternalLink}>
              View on GitHub
            </ButtonLink>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip className="text-premium">
            <Icon icon={Star} size="sm" />
            {repo.stars} stars
          </Chip>
          <Chip>
            <Icon icon={GitBranch} size="sm" />
            {repo.forks} forks
          </Chip>
          <Chip>
            <Icon icon={History} size="sm" />
            {commitCount} commits
          </Chip>
          {repo.license && (
            <Chip>
              <Icon icon={Gavel} size="sm" />
              {repo.license.spdx}
            </Chip>
          )}
          <Chip className={repo.source === "web-scrape" ? "text-positive" : undefined}>
            {repo.source === "web-scrape" ? "live-scrape" : repo.source}
          </Chip>
          <Chip>
            <span aria-hidden="true">{preset.emoji}</span>
            {preset.label}
          </Chip>
          <Badge variant="outlined" className="font-mono text-positive">
            {project.status}
          </Badge>
        </div>
      </Card>

      {/* ── Scores ──────────────────────────────────────────────────────────── */}
      <ScoreRow data={data} />

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Tabs
          items={TAB_ITEMS}
          value={tab}
          onChange={setTab}
          label="Submission package sections"
          className="w-full pb-1 sm:w-fit"
        />

        {tab === "readme" && (
          <TabPanel>
            <ReadmeTab project={project} />
          </TabPanel>
        )}
        {tab === "ledger" && (
          <TabPanel>
            <LedgerTab project={project} />
          </TabPanel>
        )}
        {tab === "demo" && (
          <TabPanel>
            <DemoTab project={project} />
          </TabPanel>
        )}
        {tab === "deck" && (
          <TabPanel>
            <DeckTab project={project} />
          </TabPanel>
        )}
        {tab === "report" && (
          <TabPanel>
            <ReportTab project={project} />
          </TabPanel>
        )}
        {tab === "seo" && (
          <TabPanel>
            <SeoTab project={project} />
          </TabPanel>
        )}
        {tab === "health" && (
          <TabPanel>
            <HealthTab project={project} />
          </TabPanel>
        )}
        {tab === "export" && (
          <TabPanel>
            <ExportTab project={project} />
          </TabPanel>
        )}
      </div>
    </div>
  );
}
