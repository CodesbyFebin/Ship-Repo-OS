"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StoryEngine — one tab, five storytellers. Everything derives from the SAME
// deterministic audit that produced the score:
//   Real Picture · Project Report · 50 Slides · Landing Page · Narrative Video
// "The Audit scores the code. The Story Engine sells the vision."
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { FileText, Film, Image, LayoutTemplate, Video } from "@/ui/symbols";
import { Alert, Icon, TabPanel, Tabs, type TabItem } from "@/ui";
import type { AuditJobResponse } from "@/lib/shipos/audit-types";
import { RealPictureTab } from "./real-picture-tab";
import { StoryReportTab } from "./report-tab";
import { SlidesTab } from "./slides-tab";
import { LandingTab } from "./landing-tab";
import { VideoTab } from "./video-tab";

const SUB_TABS: TabItem<string>[] = [
  {
    value: "picture",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Image} size="sm" />
        Real Picture
      </span>
    ),
  },
  {
    value: "report",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={FileText} size="sm" />
        Project Report
      </span>
    ),
  },
  {
    value: "slides",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={LayoutTemplate} size="sm" />
        50 Slides
      </span>
    ),
  },
  {
    value: "landing",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Film} size="sm" />
        Landing Page
      </span>
    ),
  },
  {
    value: "video",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Video} size="sm" />
        Narrative Video
      </span>
    ),
  },
];

export function StoryEngineTab({
  job,
  isProUser,
  onUpgrade,
}: {
  job: AuditJobResponse;
  isProUser: boolean;
  onUpgrade: () => void;
}) {
  const [sub, setSub] = useState<string>("picture");

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" title="Story Engine">
        It reads what the repo solves from the same audit, then writes the Report, Slides, Landing Page and Video
        Narrative. Every artifact below is editable, copyable and downloadable.
      </Alert>

      <Tabs items={SUB_TABS} value={sub} onChange={setSub} label="Story Engine sections" className="w-full" />

      {sub === "picture" && (
        <TabPanel className="mt-2">
          <RealPictureTab job={job} />
        </TabPanel>
      )}
      {sub === "report" && (
        <TabPanel className="mt-2">
          <StoryReportTab job={job} />
        </TabPanel>
      )}
      {sub === "slides" && (
        <TabPanel className="mt-2">
          <SlidesTab job={job} />
        </TabPanel>
      )}
      {sub === "landing" && (
        <TabPanel className="mt-2">
          <LandingTab job={job} />
        </TabPanel>
      )}
      {sub === "video" && (
        <TabPanel className="mt-2">
          <VideoTab job={job} isProUser={isProUser} onUpgrade={onUpgrade} />
        </TabPanel>
      )}
    </div>
  );
}
