"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Card, TabPanel, Tabs } from "@/ui";
import { auditWorkbench } from "@/lib/shipos/workbench/checks.mjs";
import { makeSnapshot, parseIdentity, readmePath } from "@/lib/shipos/workbench/evidence.mjs";
import { buildPack } from "@/lib/shipos/workbench/pack.mjs";
import { runTool, TOOLS } from "@/lib/shipos/workbench/tools.mjs";

const tabs = [
  { value: "audit", label: "Audit" },
  { value: "pack", label: "Launch kit" },
  { value: "tools", label: "Utilities" },
  { value: "media", label: "Media" },
] as const;

const control = "w-full rounded-medium border border-outline-variant bg-surface-container-low p-2 text-body-sm text-on-surface";
const label = "flex flex-col gap-1.5 text-label-md text-on-surface";
type Audit = ReturnType<typeof auditWorkbench>;
type Pack = ReturnType<typeof buildPack>;

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(name: string, text: string, type = "text/plain") {
  download(name, new Blob([text], { type }));
}

function parseObject(source: string, title: string) {
  if (!source.trim()) return {};
  const parsed: unknown = JSON.parse(source);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${title} must be a JSON object.`);
  }
  return parsed;
}

export function Workbench({ onOpenVideo }: { onOpenVideo: () => void }) {
  const tabId = useId();
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("audit");
  const [inventory, setInventory] = useState("");
  const [readme, setReadme] = useState("");
  const [fileJson, setFileJson] = useState("");
  const [metaJson, setMetaJson] = useState("");
  const [complete, setComplete] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [filter, setFilter] = useState("all");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [pack, setPack] = useState<Pack>([]);
  const [asset, setAsset] = useState("");
  const [tool, setTool] = useState(TOOLS[0].id);
  const [toolInput, setToolInput] = useState("");
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeTool = TOOLS.find(({ id }) => id === tool) ?? TOOLS[0];
  const activeAsset = pack.find(({ id }) => id === asset);
  const banner = pack.find(({ id }) => id === "banner");

  function action(event: FormEvent, run: () => void) {
    event.preventDefault();
    setError("");
    try {
      run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operation failed.");
    }
  }

  function auditInput() {
    const files = parseObject(fileJson, "Files");
    if (Object.values(files).some((text) => typeof text !== "string")) throw new Error("Each file value must be a text string.");
    const metadata = parseObject(metaJson, "Metadata");
    const initial = makeSnapshot({ paths: inventory.split(/\r?\n/), files, complete, metadata });
    if (!readme.trim()) return initial;
    const name = readmePath(initial.inventory) || "README.md";
    return makeSnapshot({ paths: initial.inventory, files: { ...files, [name]: readme }, complete, metadata });
  }

  async function downloadPack() {
    setBusy(true);
    setError("");
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const file of pack) zip.file(file.path, file.content);
      zip.file("SHIPOS-MANIFEST.json", JSON.stringify(pack.map(({ content: _content, ...file }) => file), null, 2));
      download("shipos-repository-pack.zip", await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The ZIP could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPng() {
    if (!banner) return;
    setError("");
    const url = URL.createObjectURL(new Blob([banner.content], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 640;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas export is unavailable in this browser.");
      context.drawImage(image, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png || png.size >= 1_000_000) throw new Error("PNG export exceeded the GitHub social preview budget.");
      download("social-preview.png", png);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PNG could not be created.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="space-y-2 py-4">
        <p className="font-mono text-label-md uppercase tracking-widest text-primary">Repository operations</p>
        <h1 className="text-display-sm sm:text-display-md">GitHub Workbench</h1>
        <p className="max-w-2xl text-body-md text-on-surface-variant">
          Audit 40 repository signals, assemble a launch kit with 30 assets, and run 30 developer utilities.
          Workbench inputs are processed in this tab.
        </p>
      </header>
      <Tabs items={[...tabs]} value={tab} onChange={(next) => { setError(""); setTab(next); }} label="Workbench sections" idPrefix={tabId} />
      {error && <p role="alert" className="rounded-medium border border-error p-3 text-error">{error}</p>}

      <TabPanel hidden={tab !== "audit"} id={`${tabId}-audit-panel`} labelledBy={`${tabId}-audit`}>
        <Card padding="lg" className="flex flex-col gap-5">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => action(event, () => {
            setAudit(null);
            setAudit(auditWorkbench(auditInput()));
          })}>
            <label className={label}>File inventory, one path per line
              <textarea className={control} rows={7} maxLength={300000} value={inventory} onChange={(event) => setInventory(event.target.value)} placeholder={".github/workflows/ci.yml\nREADME.md\nLICENSE"} />
            </label>
            <label className={label}>Displayed README contents
              <textarea className={control} rows={7} maxLength={300000} value={readme} onChange={(event) => setReadme(event.target.value)} placeholder="# Project" />
            </label>
            <label className={label}>Optional file contents as JSON
              <textarea className={control} rows={4} maxLength={500000} value={fileJson} onChange={(event) => setFileJson(event.target.value)} placeholder={'{".github/workflows/ci.yml":"permissions: {}"}'} />
            </label>
            <label className={label}>Optional GitHub settings as JSON
              <textarea className={control} rows={4} maxLength={10000} value={metaJson} onChange={(event) => setMetaJson(event.target.value)} placeholder={'{"description":"…","topics":[],"homepage":"","protectedBranch":false,"releaseCount":0,"profileReadme":false,"socialPreview":false}'} />
            </label>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} />
              This is the complete repository file inventory
            </label>
            <div className="md:justify-self-end"><Button type="submit">Run audit</Button></div>
          </form>
          {audit && <div className="flex flex-col gap-3 border-t border-outline-variant pt-4">
            <p aria-live="polite" className="text-title-lg">{audit.score ?? "—"}/100 readiness · {audit.coverage ?? "—"}% evidence coverage</p>
            <p className="text-body-sm text-on-surface-variant">{audit.passed} passed · {audit.failed} failed · {audit.unverified} unknown · {audit.excluded} not applicable</p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className={label}>Filter findings
                <select className={control} value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">All findings</option><option value="fail">Failed</option><option value="unknown">Unknown</option><option value="pass">Passed</option><option value="n/a">Not applicable</option>
                </select>
              </label>
              <Button variant="outlined" onClick={() => downloadText("shipos-audit.json", JSON.stringify(audit, null, 2), "application/json")}>Download audit JSON</Button>
            </div>
            <ul className="divide-y divide-outline-variant">
              {audit.findings.filter((finding) => filter === "all" || finding.status === filter).map((finding) => (
                <li key={finding.id} className="grid gap-1 py-3 sm:grid-cols-[6rem_1fr]">
                  <span className={`font-mono text-label-md uppercase ${finding.status === "fail" ? "text-error" : finding.status === "pass" ? "text-positive" : "text-on-surface-variant"}`}>{finding.status}</span>
                  <div><h2 className="text-title-sm">{finding.title}</h2><p className="break-words text-body-sm text-on-surface-variant">{finding.detail}</p>
                    {["unknown", "fail"].includes(finding.status) && <p className="text-body-sm">{finding.fix}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>}
        </Card>
      </TabPanel>

      <TabPanel hidden={tab !== "pack"} id={`${tabId}-pack-panel`} labelledBy={`${tabId}-pack`}>
        <Card padding="lg" className="flex flex-col gap-5">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => action(event, () => {
            setPack([]);
            const files = buildPack(parseIdentity(slug), description, makeSnapshot({ paths: inventory.split(/\r?\n/) }).inventory);
            setPack(files);
            setAsset(files[0].id);
          })}>
            <label className={label}>GitHub repository
              <input required maxLength={160} className={control} value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="owner/repo" />
            </label>
            <label className={label}>Verified project description
              <input maxLength={300} className={control} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does the project do?" />
            </label>
            <div><Button type="submit">Build launch kit</Button></div>
          </form>
          {activeAsset && <div className="flex flex-col gap-3 border-t border-outline-variant pt-4">
            <p className="text-body-sm text-on-surface-variant">Review generated drafts and merge files with any existing repository content. Conflicts use the inventory on the audit tab.</p>
            <label className={label}>Preview an asset
              <select className={control} value={asset} onChange={(event) => setAsset(event.target.value)}>
                {pack.map((file) => <option key={file.id} value={file.id}>{file.title}{file.conflict ? " (existing path)" : ""}</option>)}
              </select>
            </label>
            <p className="font-mono text-label-md">{activeAsset.path}</p>
            {activeAsset.setup && <p className="text-body-sm">{activeAsset.setup}</p>}
            <pre className="max-h-80 overflow-auto rounded-medium bg-surface-container-low p-3 text-body-sm">{activeAsset.content}</pre>
            <div className="flex flex-wrap gap-2">
              <Button variant="outlined" onClick={() => downloadText(activeAsset.path.split("/").at(-1) ?? "artifact.txt", activeAsset.content, activeAsset.id === "banner" ? "image/svg+xml" : "text/plain")}>Download asset</Button>
              <Button onClick={() => void downloadPack()} disabled={busy}>{busy ? "Building ZIP…" : "Download all assets"}</Button>
            </div>
          </div>}
        </Card>
      </TabPanel>

      <TabPanel hidden={tab !== "tools"} id={`${tabId}-tools-panel`} labelledBy={`${tabId}-tools`}>
        <Card padding="lg">
          <form className="flex flex-col gap-4" onSubmit={(event) => action(event, () => {
            setToolOutput(null);
            setToolOutput(runTool(tool, toolInput));
          })}>
            <label className={label}>Choose a utility
              <select className={control} value={tool} onChange={(event) => {
                setTool(event.target.value); setToolInput(""); setToolOutput(null); setError("");
              }}>
                {Array.from(new Set(TOOLS.map((entry) => entry.group))).map((group) => (
                  <optgroup key={group} label={group}>
                    {TOOLS.filter((entry) => entry.group === group).map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className={label}>Tool input
              <textarea className={control} rows={7} maxLength={150000} value={toolInput} onChange={(event) => setToolInput(event.target.value)} placeholder={activeTool.example} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Run utility</Button>
              <Button type="button" variant="outlined" onClick={() => setToolInput(activeTool.example)}>Load example</Button>
            </div>
            {toolOutput !== null && <>
              <label className={label}>Tool output
                <textarea className={control} rows={7} value={toolOutput} readOnly />
              </label>
              <div><Button type="button" variant="outlined" onClick={() => downloadText(`shipos-${tool}.txt`, toolOutput)}>Download output</Button></div>
            </>}
          </form>
        </Card>
      </TabPanel>

      <TabPanel hidden={tab !== "media"} id={`${tabId}-media-panel`} labelledBy={`${tabId}-media`}>
        <Card padding="lg" className="flex flex-col gap-4">
          <h2 className="text-title-lg">Profile, banner, GIF, and video</h2>
          <p className="text-body-md">The launch kit includes a profile README and a responsive SVG banner. Generate a launch kit to export a 1280 × 640 social preview PNG here.</p>
          {banner && <img alt="Generated repository banner preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(banner.content)}`} width="1280" height="640" className="w-full max-w-xl rounded-medium" />}
          <div className="flex flex-wrap gap-2">
            {banner && <Button onClick={() => void downloadPng()}>Download social preview PNG</Button>}
            <Button variant="outlined" onClick={() => setTab("pack")}>Open launch kit</Button>
            <Button variant="outlined" onClick={onOpenVideo}>Open Video Studio</Button>
          </div>
          <p className="text-body-sm text-on-surface-variant">The local Workbench CLI uses FFmpeg to produce a looping GIF, a short MP4 title-card teaser, and WebVTT captions. Video Studio creates a separate editable demo.</p>
          <pre className="overflow-auto rounded-medium bg-surface-container-low p-3 text-body-sm">node scripts/workbench.mjs media --repo owner/repo --out ./repo-media</pre>
        </Card>
      </TabPanel>
    </section>
  );
}
