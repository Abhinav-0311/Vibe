"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  Code2,
  FileSearch,
  Github,
  History,
  Loader2,
  RefreshCw,
  Server,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AuditContext } from "@/lib/checklist/types";
import { auditReport, emptyReport, type AuditFinding, type AuditReport, type Severity } from "@/lib/mock-audit";
import { formatMarkdownReport } from "@/lib/report/markdown-export";
import type {
  SavedScanDetailApiResponse,
  SavedScansApiResponse,
  ScanApiResponse,
  WorkspaceProjectsApiResponse,
} from "@/lib/scan-api";
import { addScanToHistory, parseScanHistory, scanHistoryStorageKey, type ScanHistoryItem } from "@/lib/scan-history";

type ViewState = "report" | "loading" | "empty" | "error";
type SeverityFilter = "all" | Severity;
type CategoryFilter = "all" | string;
type FindingStatus = AuditFinding["status"];
type SavedScansState = "loading" | "ready" | "error";
type ProjectDiscoveryState = "loading" | "ready" | "error";

const defaultAuditContext: AuditContext = {
  appType: "saas",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

const triageStorageKey = "vibe:finding-status-overrides";
const defaultProjectPath = "E:\\College\\Project\\Vibe";

const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const severityClass: Record<Severity, string> = {
  critical: "text-[#ff5a5f]",
  high: "text-[#ffd166]",
  medium: "text-[#d9d9d9]",
  low: "text-[#a7f35b]",
};

function scoreLabel(score: number) {
  if (score >= 80) return "Launchable";
  if (score >= 60) return "Needs work";
  return "Not ready";
}

function formatScannedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function createReportFromScan(scan: ScanApiResponse | null): AuditReport {
  if (!scan) return auditReport;

  return {
    projectName: scan.scannedProject,
    stack: `${scan.facts.framework.name}, ${scan.facts.packageManager}`,
    appScore: scan.checklist.score,
    aiWorkspaceScore: scan.facts.signals.hasAiRules ? 82 : 18,
    scannedAt: formatScannedAt(scan.scannedAt),
    summary: scan.report.executiveSummary,
    findings: scan.checklist.findings,
  };
}

export function AuditDashboard() {
  const [viewState, setViewState] = useState<ViewState>("report");
  const [scanData, setScanData] = useState<ScanApiResponse | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [savedScans, setSavedScans] = useState<SavedScansApiResponse | null>(null);
  const [savedScansState, setSavedScansState] = useState<SavedScansState>("loading");
  const [restoringRecordId, setRestoringRecordId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [auditContext, setAuditContext] = useState<AuditContext>(defaultAuditContext);
  const [projectPath, setProjectPath] = useState(defaultProjectPath);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProjectsApiResponse | null>(null);
  const [projectDiscoveryState, setProjectDiscoveryState] = useState<ProjectDiscoveryState>("loading");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, FindingStatus>>({});

  const report = useMemo(() => createReportFromScan(scanData), [scanData]);
  const reportWithStatuses = useMemo(
    () => ({
      ...report,
      findings: report.findings.map((finding) => ({
        ...finding,
        status: statusOverrides[finding.id] ?? finding.status,
      })),
    }),
    [report, statusOverrides],
  );
  const [selectedId, setSelectedId] = useState(report.findings[0]?.id);

  const selectedFinding = useMemo(
    () => reportWithStatuses.findings.find((finding) => finding.id === selectedId),
    [reportWithStatuses.findings, selectedId],
  );

  function applyCompletedScan(scan: ScanApiResponse) {
    setScanData(scan);
    setSelectedId(scan.checklist.findings[0]?.id);
    saveScanToHistory(scan);
    void refreshSavedScans();
    setViewState("report");
  }

  function updateFindingStatus(findingId: string, status: FindingStatus) {
    setStatusOverrides((current) => ({ ...current, [findingId]: status }));
  }

  function resetTriage() {
    setStatusOverrides({});
    window.localStorage.removeItem(triageStorageKey);
  }

  function saveScanToHistory(scan: ScanApiResponse) {
    setScanHistory((current) => addScanToHistory(current, scan));
  }

  function selectHistoryItem(item: ScanHistoryItem) {
    setScanData(item.scan);
    setAuditContext(item.scan.checklist.context);
    setProjectPath(item.scan.facts.projectRoot);
    setSelectedId(item.scan.checklist.findings[0]?.id);
    setViewState("report");
  }

  function clearScanHistory() {
    setScanHistory([]);
    window.localStorage.removeItem(scanHistoryStorageKey);
  }

  async function refreshSavedScans() {
    setSavedScansState("loading");
    setRestoreError(null);

    try {
      const response = await fetch("/api/scans");

      if (!response.ok) {
        throw new Error(`Saved scans failed with status ${response.status}`);
      }

      const data = (await response.json()) as SavedScansApiResponse;
      setSavedScans(data);
      setSavedScansState("ready");
    } catch {
      setSavedScansState("error");
    }
  }

  async function refreshWorkspaceProjects() {
    setProjectDiscoveryState("loading");

    try {
      const response = await fetch("/api/projects");

      if (!response.ok) {
        throw new Error(`Project discovery failed with status ${response.status}`);
      }

      const data = (await response.json()) as WorkspaceProjectsApiResponse;
      setWorkspaceProjects(data);
      setProjectDiscoveryState("ready");
    } catch {
      setProjectDiscoveryState("error");
    }
  }

  async function restoreSavedScan(recordId: string) {
    setRestoringRecordId(recordId);
    setRestoreError(null);

    try {
      const response = await fetch(`/api/scans/${recordId}`);

      if (!response.ok) {
        throw new Error(`Saved scan restore failed with status ${response.status}`);
      }

      const data = (await response.json()) as SavedScanDetailApiResponse;

      if (!data.record) {
        throw new Error("Saved scan record was not found");
      }

      setScanData(data.record.scan);
      setAuditContext(data.record.scan.checklist.context);
      setProjectPath(data.record.scan.facts.projectRoot);
      setSelectedId(data.record.scan.checklist.findings[0]?.id);
      saveScanToHistory(data.record.scan);
      setViewState("report");
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Unable to restore saved scan");
    } finally {
      setRestoringRecordId(null);
    }
  }

  async function runScan(context = auditContext, targetPath = projectPath) {
    setScanError(null);
    setGithubError(null);
    setViewState("loading");

    try {
      const params = new URLSearchParams({
        appType: context.appType,
        stage: context.stage,
        hasPayments: String(context.hasPayments),
        hasUserAccounts: String(context.hasUserAccounts),
        storesUserData: String(context.storesUserData),
        projectPath: targetPath,
      });
      const response = await fetch(`/api/scan?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Scan failed with status ${response.status}`);
      }

      const data = (await response.json()) as ScanApiResponse;
      applyCompletedScan(data);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unknown scan failure");
      setViewState("error");
    }
  }

  async function runUploadScan(file: File, context = auditContext) {
    setScanError(null);
    setUploadError(null);
    setGithubError(null);
    setViewState("loading");

    try {
      const formData = new FormData();
      formData.set("project", file);
      formData.set("appType", context.appType);
      formData.set("stage", context.stage);
      formData.set("hasPayments", String(context.hasPayments));
      formData.set("hasUserAccounts", String(context.hasUserAccounts));
      formData.set("storesUserData", String(context.storesUserData));

      const response = await fetch("/api/upload-scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Upload scan failed with status ${response.status}`);
      }

      const data = (await response.json()) as ScanApiResponse;
      applyCompletedScan(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload scan failed";
      setUploadError(message);
      setScanError(message);
      setViewState("error");
    }
  }

  async function runGitHubScan(repoUrl: string, context = auditContext) {
    setScanError(null);
    setUploadError(null);
    setGithubError(null);
    setViewState("loading");

    try {
      const response = await fetch("/api/github-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoUrl,
          appType: context.appType,
          stage: context.stage,
          hasPayments: context.hasPayments,
          hasUserAccounts: context.hasUserAccounts,
          storesUserData: context.storesUserData,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `GitHub scan failed with status ${response.status}`);
      }

      const data = (await response.json()) as ScanApiResponse;
      applyCompletedScan(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub scan failed";
      setGithubError(message);
      setScanError(message);
      setViewState("error");
    }
  }

  useEffect(() => {
    const savedStatuses = window.localStorage.getItem(triageStorageKey);
    const savedHistory = window.localStorage.getItem(scanHistoryStorageKey);

    if (savedStatuses) {
      try {
        setStatusOverrides(JSON.parse(savedStatuses) as Record<string, FindingStatus>);
      } catch {
        window.localStorage.removeItem(triageStorageKey);
      }
    }

    setScanHistory(parseScanHistory(savedHistory));
    void refreshWorkspaceProjects();
    void refreshSavedScans();
    void runScan(defaultAuditContext);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(triageStorageKey, JSON.stringify(statusOverrides));
  }, [statusOverrides]);

  useEffect(() => {
    window.localStorage.setItem(scanHistoryStorageKey, JSON.stringify(scanHistory));
  }, [scanHistory]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-5 py-5 sm:px-8 lg:px-10">
        <TopBar onNewScan={runScan} />
        <Hero />
        <ContextControls
          context={auditContext}
          projectPath={projectPath}
          workspaceProjects={workspaceProjects}
          projectDiscoveryState={projectDiscoveryState}
          onChange={setAuditContext}
          onProjectPathChange={setProjectPath}
          onRefreshProjects={() => void refreshWorkspaceProjects()}
          onRunScan={(context) => void runScan(context, projectPath)}
          uploadError={uploadError}
          githubError={githubError}
          onUploadScan={(file, context) => void runUploadScan(file, context)}
          onGitHubScan={(repoUrl, context) => void runGitHubScan(repoUrl, context)}
        />
        <StateSwitch active={viewState} onChange={setViewState} />

        {viewState === "loading" && <LoadingState />}
        {viewState === "empty" && <EmptyState />}
        {viewState === "error" && <ErrorState message={scanError} onRetry={runScan} />}
        {viewState === "report" && (
          <>
            <ScannerFactsPreview scan={scanData} />
            <ScanHistory
              activeScan={scanData}
              history={scanHistory}
              onSelect={selectHistoryItem}
              onClear={clearScanHistory}
            />
            <DatabaseArchive
              savedScans={savedScans}
              state={savedScansState}
              onRefresh={() => void refreshSavedScans()}
              restoringRecordId={restoringRecordId}
              restoreError={restoreError}
              onRestore={(recordId) => void restoreSavedScan(recordId)}
            />
            {scanData && <ReportNarrative scan={scanData} />}
            <ReportView
              report={reportWithStatuses}
              selectedFinding={selectedFinding}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStatusChange={updateFindingStatus}
              onResetTriage={resetTriage}
            />
          </>
        )}
      </div>
    </main>
  );
}

function TopBar({ onNewScan }: { onNewScan: () => void }) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#1d1a1a] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="mono text-[11px] text-[#d9d9d9]">Launch readiness, before launch damage &gt;</div>
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#ff4c33]" />
        <span className="mono text-[11px] text-white">Live audit draft</span>
      </div>
      <button
        onClick={onNewScan}
        className="mono rounded-full border border-[#3d3d3d] px-5 py-3 text-[11px] text-white transition hover:border-white hover:bg-white hover:text-black"
      >
        New scan
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-5xl text-center">
        <p className="mono mb-5 text-[11px] text-[#fc74dd]">Vibe audit console</p>
        <h1 className="text-[64px] font-semibold leading-[0.9] tracking-[-0.05em] text-white sm:text-[100px] lg:text-[140px]">
          Vibe
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[42px]">
          A launch-readiness auditor for AI-built apps.
        </p>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-[#d9d9d9] sm:text-[19px] sm:leading-8">
          Vibe helps new coders, indie builders, and vibe coders understand whether a project is actually ready for real users. It turns codebase signals into production risks, clear evidence, and exact prompts you can hand to Codex, Cursor, or Claude Code.
        </p>
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        <IntroCard
          label="What we do"
          title="Find the missing launch systems."
          body="We inspect the project shape, framework signals, auth flows, payment setup, tests, deployment files, analytics, error tracking, and AI workspace context. The goal is to reveal what is missing before customers, attackers, or payment failures reveal it for you."
          points={[
            "Detects production gaps like missing password recovery, rate limiting, payment safety, policy pages, and observability.",
            "Checks AI workspace context such as rules files, memory notes, boundaries, and setup instructions.",
            "Turns scattered codebase signals into one readable readiness report.",
          ]}
        />
        <IntroCard
          label="How it works"
          title="Scanner facts become prioritized findings."
          body="The scanner collects evidence first. The checklist engine converts that evidence into severity-ranked findings. Then the report explains why each issue matters and gives a focused implementation prompt for your coding agent."
          points={[
            "Step one: scan the repo without executing unsafe project code.",
            "Step two: compare detected signals against launch-readiness rules.",
            "Step three: generate evidence-backed findings with exact prompts for Codex, Cursor, or Claude Code.",
          ]}
        />
        <IntroCard
          label="Why it matters"
          title="Working locally is not production-ready."
          body="AI tools make it easy to build screens quickly, but production requires boring systems: rate limits, password recovery, webhook safety, observability, legal pages, feedback loops, and durable project rules for your AI workspace."
          points={[
            "A product can look complete while still failing under real users, payments, abuse, or deployment pressure.",
            "New builders often do not know what to ask their AI agent next, so Vibe gives them the next production prompt.",
            "The final goal is not just a score. It is a practical path from prototype to safer launch.",
          ]}
        />
      </div>
    </section>
  );
}

function IntroCard({
  label,
  title,
  body,
  points,
}: {
  label: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <article className="flex min-h-[420px] flex-col rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8">
      <div>
        <p className="mono text-[10px] text-[#fc74dd]">{label}</p>
        <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">
          {title}
        </h2>
      </div>
      <div className="mt-7 flex flex-1 flex-col">
        <p className="text-sm leading-6 text-[#d9d9d9]">{body}</p>
        <div className="mt-7 space-y-3">
          {points.map((point) => (
            <div
              key={point}
              className="flex gap-4 border-t border-[#3d3d3d] pt-3 text-sm leading-6 text-white"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fc74dd]" />
              <p>{point}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function StateSwitch({
  active,
  onChange,
}: {
  active: ViewState;
  onChange: (state: ViewState) => void;
}) {
  const states: ViewState[] = ["report", "loading", "empty", "error"];

  return (
    <div className="flex flex-wrap gap-2" aria-label="Preview UI states">
      {states.map((state) => (
        <button
          key={state}
          onClick={() => onChange(state)}
          aria-pressed={active === state}
          className={`mono rounded-full border px-4 py-2 text-[10px] transition ${
            active === state
              ? "border-[#fc74dd] bg-[#fc74dd] text-[#111212]"
              : "border-[#3d3d3d] text-[#d9d9d9] hover:border-white hover:text-white"
          }`}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

function ContextControls({
  context,
  projectPath,
  workspaceProjects,
  projectDiscoveryState,
  onChange,
  onProjectPathChange,
  onRefreshProjects,
  onRunScan,
  uploadError,
  githubError,
  onUploadScan,
  onGitHubScan,
}: {
  context: AuditContext;
  projectPath: string;
  workspaceProjects: WorkspaceProjectsApiResponse | null;
  projectDiscoveryState: ProjectDiscoveryState;
  onChange: (context: AuditContext) => void;
  onProjectPathChange: (projectPath: string) => void;
  onRefreshProjects: () => void;
  onRunScan: (context: AuditContext) => void;
  uploadError: string | null;
  githubError: string | null;
  onUploadScan: (file: File, context: AuditContext) => void;
  onGitHubScan: (repoUrl: string, context: AuditContext) => void;
}) {
  const stages: AuditContext["stage"][] = ["prototype", "launch-prep", "production"];
  const appTypes: AuditContext["appType"][] = ["saas", "internal-tool", "content-site", "api"];

  function update(next: Partial<AuditContext>) {
    onChange({ ...context, ...next });
  }

  return (
    <section className="rounded-[30px] bg-[#1d1a1a] p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono text-[11px] text-[#fc74dd]">Audit context</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Tell Vibe what this project is trying to become.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            The same missing system can be harmless in a prototype and critical before launch. These controls change how the checklist scores the scan.
          </p>
        </div>
        <button
          onClick={() => onRunScan(context)}
          className="mono rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-[#111212] transition hover:brightness-95"
        >
          Run with context
        </button>
      </div>

      <div className="mt-6">
        <label className="block">
          <span className="mono text-[10px] text-[#d9d9d9]">Project path</span>
          <input
            value={projectPath}
            onChange={(event) => onProjectPathChange(event.target.value)}
            className="mt-3 w-full rounded-[18px] border border-[#3d3d3d] bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5f5858] focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30"
            placeholder="E:\College\Project\Vibe"
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-[#9b9696]">
          Paths are limited to `E:\College\Project` so the scanner cannot read arbitrary system folders.
        </p>

        <div className="mt-5 rounded-[22px] bg-black p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mono text-[10px] text-[#d9d9d9]">Workspace projects</p>
              <p className="mt-2 text-xs leading-5 text-[#9b9696]">
                Select a detected project or keep typing a path manually.
              </p>
            </div>
            <button
              onClick={onRefreshProjects}
              disabled={projectDiscoveryState === "loading"}
              className="mono inline-flex items-center justify-center rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              {projectDiscoveryState === "loading" ? "Scanning" : "Refresh"}
            </button>
          </div>

          {projectDiscoveryState === "error" && (
            <p className="mt-4 text-sm leading-6 text-[#ff8f8f]">Could not discover workspace projects.</p>
          )}

          {projectDiscoveryState === "ready" && (workspaceProjects?.projects.length ?? 0) === 0 && (
            <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">No package.json projects found under the workspace root.</p>
          )}

          {workspaceProjects && workspaceProjects.projects.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {workspaceProjects.projects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => onProjectPathChange(project.path)}
                  aria-pressed={projectPath === project.path}
                  className={`mono rounded-full border px-4 py-2 text-[10px] transition ${
                    projectPath === project.path
                      ? "border-[#fc74dd] bg-[#fc74dd] text-black"
                      : "border-[#3d3d3d] text-[#d9d9d9] hover:border-white hover:text-white"
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <GitHubScanPanel context={context} githubError={githubError} onGitHubScan={onGitHubScan} />
      <ProjectUploadPanel context={context} uploadError={uploadError} onUploadScan={onUploadScan} />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SegmentedControl
          label="Project stage"
          options={stages}
          value={context.stage}
          onChange={(stage) => update({ stage })}
        />
        <SegmentedControl
          label="App type"
          options={appTypes}
          value={context.appType}
          onChange={(appType) => update({ appType })}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ToggleRow
          label="Users log in"
          checked={context.hasUserAccounts}
          onChange={(hasUserAccounts) => update({ hasUserAccounts })}
        />
        <ToggleRow
          label="Users pay"
          checked={context.hasPayments}
          onChange={(hasPayments) => update({ hasPayments })}
        />
        <ToggleRow
          label="Stores user data"
          checked={context.storesUserData}
          onChange={(storesUserData) => update({ storesUserData })}
        />
      </div>
    </section>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mono mb-3 text-[10px] text-[#d9d9d9]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`mono rounded-full border px-4 py-2 text-[10px] transition ${
              value === option
                ? "border-[#fc74dd] bg-[#fc74dd] text-[#111212]"
                : "border-[#3d3d3d] text-[#d9d9d9] hover:border-white hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function GitHubScanPanel({
  context,
  githubError,
  onGitHubScan,
}: {
  context: AuditContext;
  githubError: string | null;
  onGitHubScan: (repoUrl: string, context: AuditContext) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");

  function submitGitHubScan() {
    const trimmedUrl = repoUrl.trim();

    if (!trimmedUrl) {
      return;
    }

    onGitHubScan(trimmedUrl, context);
  }

  return (
    <div className="mt-5 rounded-[22px] border border-[#3d3d3d] bg-black p-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <label className="block min-w-0 flex-1">
          <span className="mono text-[10px] text-[#fc74dd]">GitHub repository</span>
          <span className="mt-2 block max-w-2xl text-sm leading-6 text-[#d9d9d9]">
            Paste a public repository URL when the project is already on GitHub.
          </span>
          <input
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitGitHubScan();
              }
            }}
            className="mt-4 w-full rounded-[18px] border border-[#3d3d3d] bg-[#111212] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5f5858] focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30"
            placeholder="https://github.com/owner/repo"
          />
        </label>

        <button
          onClick={submitGitHubScan}
          disabled={repoUrl.trim().length === 0}
          className="mono inline-flex items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#9b9696]"
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          Scan GitHub
        </button>
      </div>

      {githubError && (
        <p className="mt-4 border-t border-[#3d3d3d] pt-4 text-sm leading-6 text-[#ff8f8f]">
          {githubError}
        </p>
      )}
    </div>
  );
}

function ProjectUploadPanel({
  context,
  uploadError,
  onUploadScan,
}: {
  context: AuditContext;
  uploadError: string | null;
  onUploadScan: (file: File, context: AuditContext) => void;
}) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  return (
    <div className="mt-5 rounded-[22px] border border-[#3d3d3d] bg-black p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono text-[10px] text-[#fc74dd]">Upload project</p>
          <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
            Upload a ZIP archive when the project is not inside the local workspace picker.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#9b9696]">
            The archive is extracted to a temporary folder, scanned without executing code, then removed.
          </p>
        </div>

        <label className="mono inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-black transition hover:brightness-95">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload ZIP
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (!file) return;

              setSelectedFileName(file.name);
              onUploadScan(file, context);
            }}
          />
        </label>
      </div>

      {(selectedFileName || uploadError) && (
        <div className="mt-4 border-t border-[#3d3d3d] pt-4">
          {selectedFileName && (
            <p className="mono text-[10px] text-[#d9d9d9]">Selected: {selectedFileName}</p>
          )}
          {uploadError && <p className="mt-2 text-sm leading-6 text-[#ff8f8f]">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex items-center justify-between gap-4 rounded-[22px] border p-4 text-left transition ${
        checked
          ? "border-[#fc74dd] bg-[#111212]"
          : "border-[#3d3d3d] bg-transparent hover:border-white"
      }`}
    >
      <span className="mono text-[10px] text-white">{label}</span>
      <span className={`h-3 w-3 rounded-full ${checked ? "bg-[#fc74dd]" : "bg-[#3d3d3d]"}`} />
    </button>
  );
}

function ScannerFactsPreview({ scan }: { scan: ScanApiResponse | null }) {
  const facts = [
    { label: "Framework", value: scan?.facts.framework.name ?? "Scanning..." },
    { label: "Package manager", value: scan?.facts.packageManager ?? "Scanning..." },
    { label: "Project", value: scan?.scannedProject ?? "Scanning..." },
    { label: "Context", value: scan ? scan.checklist.context.stage : "Scanning..." },
    { label: "Findings", value: scan ? `${scan.checklist.findings.length} open` : "Scanning..." },
    { label: "Report", value: scan ? scan.report.readinessLabel : "Scanning..." },
  ];
  const evidence = scan
    ? [
        {
          label: "Package manifest",
          detail: "package.json",
          detected: scan.facts.signals.hasPackageJson,
        },
        {
          label: "Next.js config",
          detail: "next.config.*",
          detected: scan.facts.signals.hasNextConfig,
        },
        {
          label: "App router",
          detail: "app directory",
          detected: scan.facts.signals.hasAppRouter,
        },
        {
          label: "Environment example",
          detail: ".env.example",
          detected: scan.facts.signals.hasEnvExample,
        },
        {
          label: "Tests",
          detail: "tests, test, or config",
          detected: scan.facts.signals.hasTests,
        },
        {
          label: "Middleware",
          detail: "middleware.ts/js",
          detected: scan.facts.signals.hasMiddleware,
        },
        {
          label: "Auth dependency",
          detail: "Clerk, NextAuth, Supabase, Lucia",
          detected: scan.facts.signals.hasAuthDependency,
        },
        {
          label: "Payments dependency",
          detail: "Stripe packages",
          detected: scan.facts.signals.hasStripeDependency,
        },
        {
          label: "Analytics plan",
          detail: "lib/analytics/events.ts or package",
          detected: scan.facts.signals.hasAnalyticsPlan || scan.facts.signals.hasAnalyticsDependency,
        },
        {
          label: "Observability plan",
          detail: "plan file or error tracking package",
          detected: scan.facts.signals.hasObservabilityPlan || scan.facts.signals.hasErrorTrackingDependency,
        },
        {
          label: "AI rules",
          detail: "AGENTS.md or cursor rules",
          detected: scan.facts.signals.hasAiRules,
        },
      ]
    : [];
  const detectedCount = evidence.filter((item) => item.detected).length;

  return (
    <section className="rounded-[30px] border border-[#1d1a1a] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Scanner layer</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Scanner facts now become checklist findings.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            The `/api/scan` endpoint now returns raw project facts and rule-based findings. This is the bridge between file detection and the future AI report layer.
          </p>
        </div>
        <Code2 className="h-7 w-7 text-[#fc74dd]" aria-hidden="true" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-[22px] bg-[#111212] p-4">
            <p className="mono text-[10px] text-[#d9d9d9]">{fact.label}</p>
            <p className="mt-3 text-sm leading-5 text-white">{fact.value}</p>
          </div>
        ))}
      </div>

      {scan ? (
        <div className="mt-6 rounded-[24px] bg-[#111212] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono text-[10px] text-[#fc74dd]">Evidence ledger</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {detectedCount} of {evidence.length} key signals detected.
              </h3>
            </div>
            <p className="mono text-[10px] text-[#d9d9d9]">{scan.facts.projectRoot}</p>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {evidence.map((item) => (
              <div
                key={item.label}
                className={`rounded-[18px] border p-4 ${
                  item.detected ? "border-[#315f46] bg-[#07130d]" : "border-[#3d3d3d] bg-black"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold leading-5 text-white">{item.label}</p>
                    <p className="mt-2 text-xs leading-5 text-[#9b9696]">{item.detail}</p>
                  </div>
                  <span
                    className={`mono rounded-full px-3 py-1 text-[9px] ${
                      item.detected ? "bg-[#a7f35b] text-black" : "bg-[#1d1a1a] text-[#d9d9d9]"
                    }`}
                  >
                    {item.detected ? "Detected" : "Missing"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] bg-[#111212] p-6 text-center">
          <p className="mono text-[10px] text-[#fc74dd]">Evidence pending</p>
          <p className="mt-3 text-sm leading-6 text-[#d9d9d9]">Run a scan to see detected and missing project signals.</p>
        </div>
      )}
    </section>
  );
}

function ScanHistory({
  activeScan,
  history,
  onSelect,
  onClear,
}: {
  activeScan: ScanApiResponse | null;
  history: ScanHistoryItem[];
  onSelect: (item: ScanHistoryItem) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-[30px] bg-[#111212] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Scan history</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Keep the last six readiness snapshots.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            Local history lets you revisit previous contexts without rescanning. This is the prototype version of the saved reports we will later move into PostgreSQL.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-[#fc74dd]" aria-hidden="true" />
          <button
            onClick={onClear}
            disabled={history.length === 0}
            className="mono inline-flex items-center gap-2 rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-[#3d3d3d] p-6 text-center">
          <p className="mono text-[10px] text-[#fc74dd]">No saved scans yet</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#d9d9d9]">
            Run a scan and it will be saved here automatically on this browser.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {history.map((item) => {
            const isActive = activeScan?.scannedAt === item.scan.scannedAt;

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                aria-pressed={isActive}
                className={`rounded-[24px] border p-4 text-left transition ${
                  isActive
                    ? "border-[#fc74dd] bg-[#1d1a1a]"
                    : "border-[#242424] bg-black hover:border-[#3d3d3d]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-[10px] text-[#d9d9d9]">{formatScannedAt(item.scan.scannedAt)}</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">
                      {item.scan.report.readinessLabel}
                    </p>
                  </div>
                  <span className="mono rounded-full bg-[#fc74dd] px-3 py-1 text-[10px] text-black">
                    {item.scan.checklist.score}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="border-t border-[#3d3d3d] pt-3">
                    <p className="mono text-[9px] text-[#d9d9d9]">Context</p>
                    <p className="mt-1 text-sm text-white">{item.scan.checklist.context.stage}</p>
                  </div>
                  <div className="border-t border-[#3d3d3d] pt-3">
                    <p className="mono text-[9px] text-[#d9d9d9]">Findings</p>
                    <p className="mt-1 text-sm text-white">{item.scan.checklist.findings.length}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DatabaseArchive({
  savedScans,
  state,
  onRefresh,
  restoringRecordId,
  restoreError,
  onRestore,
}: {
  savedScans: SavedScansApiResponse | null;
  state: SavedScansState;
  onRefresh: () => void;
  restoringRecordId: string | null;
  restoreError: string | null;
  onRestore: (recordId: string) => void;
}) {
  const isLoading = state === "loading";
  const isError = state === "error";
  const isConfigured = savedScans?.databaseConfigured ?? false;
  const records = savedScans?.records ?? [];

  return (
    <section className="rounded-[30px] border border-[#1d1a1a] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Database archive</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Server-saved scan records.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            This reads from PostgreSQL through `/api/scans`. When the database is not configured, the app still works with local scan history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-[#fc74dd]" aria-hidden="true" />
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="mono inline-flex items-center gap-2 rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading && (
          <div className="rounded-[24px] bg-[#111212] p-6">
            <p className="mono text-[10px] text-[#fc74dd]">Checking database</p>
            <p className="mt-3 text-sm leading-6 text-[#d9d9d9]">Looking for saved scan records.</p>
          </div>
        )}

        {isError && (
          <div className="rounded-[24px] border border-[#3d3d3d] p-6">
            <p className="mono text-[10px] text-[#ff5a5f]">Archive unavailable</p>
            <p className="mt-3 text-sm leading-6 text-[#d9d9d9]">
              The saved-scans endpoint returned an error. Local scan history is still available.
            </p>
          </div>
        )}

        {!isLoading && !isError && restoreError && (
          <div className="mb-3 rounded-[20px] border border-[#3d3d3d] p-4">
            <p className="mono text-[10px] text-[#ff5a5f]">Restore failed</p>
            <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">{restoreError}</p>
          </div>
        )}

        {!isLoading && !isError && !isConfigured && (
          <div className="rounded-[24px] bg-[#111212] p-6">
            <p className="mono text-[10px] text-[#fc74dd]">Database not connected</p>
            <p className="mt-3 text-sm leading-6 text-[#d9d9d9]">
              Add `DATABASE_URL`, run the Prisma migration, and scans will be saved to PostgreSQL automatically.
            </p>
          </div>
        )}

        {!isLoading && !isError && isConfigured && records.length === 0 && (
          <div className="rounded-[24px] bg-[#111212] p-6">
            <p className="mono text-[10px] text-[#fc74dd]">No server records yet</p>
            <p className="mt-3 text-sm leading-6 text-[#d9d9d9]">
              Run a scan with PostgreSQL connected to create the first durable scan record.
            </p>
          </div>
        )}

        {!isLoading && !isError && records.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-3">
            {records.map((record) => (
              <button
                key={record.id}
                onClick={() => onRestore(record.id)}
                disabled={Boolean(restoringRecordId)}
                className="rounded-[24px] bg-[#111212] p-4 text-left transition hover:bg-[#1d1a1a] focus:outline-none focus:ring-2 focus:ring-[#fc74dd] focus:ring-offset-2 focus:ring-offset-black disabled:cursor-wait disabled:opacity-70"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mono text-[10px] text-[#d9d9d9]">{formatScannedAt(record.scannedAt)}</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">
                      {restoringRecordId === record.id ? "Restoring scan" : record.readinessLabel}
                    </p>
                  </div>
                  <span className="mono rounded-full bg-white px-3 py-1 text-[10px] text-black">{record.score}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="border-t border-[#3d3d3d] pt-3">
                    <p className="mono text-[9px] text-[#d9d9d9]">Stage</p>
                    <p className="mt-1 text-sm text-white">{record.stage}</p>
                  </div>
                  <div className="border-t border-[#3d3d3d] pt-3">
                    <p className="mono text-[9px] text-[#d9d9d9]">Findings</p>
                    <p className="mt-1 text-sm text-white">{record.findingCount}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ReportNarrative({ scan }: { scan: ScanApiResponse }) {
  const [copied, setCopied] = useState(false);
  const markdownReport = useMemo(
    () =>
      formatMarkdownReport({
        projectName: scan.scannedProject,
        facts: scan.facts,
        checklist: scan.checklist,
        report: scan.report,
      }),
    [scan],
  );

  async function copyReport() {
    await navigator.clipboard?.writeText(markdownReport);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="rounded-[30px] bg-[#f4f2ee] p-6 text-black sm:p-8 lg:p-10">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <p className="mono text-[11px] text-[#5f5858]">Generated report</p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            {scan.report.readinessLabel}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#333030]">{scan.report.interpretation}</p>
          <button
            onClick={copyReport}
            className="mono mt-7 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-[10px] text-white transition hover:bg-[#333030] focus:outline-none focus:ring-2 focus:ring-[#fc4fcd] focus:ring-offset-2 focus:ring-offset-[#f4f2ee]"
          >
            <Clipboard className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied report" : "Copy report"}
          </button>
        </div>

        <div className="grid gap-6">
          <div>
            <p className="mono text-[10px] text-[#5f5858]">Executive summary</p>
            <p className="mt-3 text-lg leading-8 text-black">{scan.report.executiveSummary}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[24px] bg-white p-5">
              <p className="mono text-[10px] text-[#5f5858]">Top risks</p>
              <div className="mt-4 grid gap-3">
                {scan.report.topRisks.length > 0 ? (
                  scan.report.topRisks.map((risk) => (
                    <div key={risk.title} className="border-t border-[#dedbd4] pt-3 first:border-t-0 first:pt-0">
                      <p className="mono text-[10px] uppercase text-[#fc4fcd]">{risk.severity}</p>
                      <p className="mt-1 text-sm font-semibold leading-5">{risk.title}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[#333030]">No high-priority risks were found for this scan context.</p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5">
              <p className="mono text-[10px] text-[#5f5858]">Next actions</p>
              <div className="mt-4 grid gap-3">
                {scan.report.nextActions.slice(0, 3).map((action) => (
                  <div key={action} className="flex gap-3 border-t border-[#dedbd4] pt-3 first:border-t-0 first:pt-0">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#fc4fcd]" aria-hidden="true" />
                    <p className="text-sm leading-6 text-[#333030]">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mono text-[10px] text-[#5f5858]">{scan.report.promptQueueSummary}</p>
        </div>
      </div>
    </section>
  );
}

function ReportView({
  report,
  selectedFinding,
  selectedId,
  onSelect,
  onStatusChange,
  onResetTriage,
}: {
  report: AuditReport;
  selectedFinding?: AuditFinding;
  selectedId?: string;
  onSelect: (id: string) => void;
  onStatusChange: (findingId: string, status: FindingStatus) => void;
  onResetTriage: () => void;
}) {
  const criticalCount = report.findings.filter((finding) => finding.severity === "critical").length;

  return (
    <section className="grid gap-6">
      <ScorePanel report={report} criticalCount={criticalCount} />
      <FindingsList findings={report.findings} selectedId={selectedId} onSelect={onSelect} />
      <PromptQueue findings={report.findings} onResetTriage={onResetTriage} />
      <FindingDetail finding={selectedFinding} onStatusChange={onStatusChange} />
    </section>
  );
}

function ScorePanel({ report, criticalCount }: { report: AuditReport; criticalCount: number }) {
  return (
    <aside className="rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mono text-[11px] text-[#d9d9d9]">Project</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{report.projectName}</h2>
        </div>
        <FileSearch className="h-6 w-6 text-[#fc74dd]" aria-hidden="true" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreRow label="App readiness" score={report.appScore} />
        <ScoreRow label="AI workspace" score={report.aiWorkspaceScore} />
      </div>

      <div className="my-8 h-[2px] w-full heartbeat" />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Critical blockers" value={criticalCount.toString()} />
        <Metric label="Findings" value={report.findings.length.toString()} />
        <Metric label="Stack" value={report.stack} />
        <Metric label="Scanned" value={report.scannedAt} />
      </div>

      <p className="mt-8 max-w-4xl text-base leading-7 text-[#d9d9d9]">{report.summary}</p>
    </aside>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-[24px] bg-[#111212] p-4">
      <div className="mb-3 flex flex-col gap-1">
        <span className="mono text-[10px] text-[#d9d9d9]">{label}</span>
        <span className="mono text-[10px] text-white">{scoreLabel(score)}</span>
      </div>
      <div className="h-2 rounded-full bg-black">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          aria-label={`${label}: ${score} out of 100`}
          className="h-full rounded-full bg-[#fc74dd]"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
        {score}<span className="text-base text-[#d9d9d9]">/100</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[#3d3d3d] pt-4">
      <p className="mono text-[10px] text-[#d9d9d9]">{label}</p>
      <p className="mt-2 text-sm leading-5 text-white">{value}</p>
    </div>
  );
}

function FindingsList({
  findings,
  selectedId,
  onSelect,
}: {
  findings: AuditFinding[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const categories = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.category))).sort(),
    [findings],
  );
  const visibleFindings = useMemo(
    () =>
      findings.filter((finding) => {
        const matchesSeverity = severityFilter === "all" || finding.severity === severityFilter;
        const matchesCategory = categoryFilter === "all" || finding.category === categoryFilter;
        return matchesSeverity && matchesCategory;
      }),
    [categoryFilter, findings, severityFilter],
  );

  useEffect(() => {
    if (visibleFindings.length === 0) return;
    if (selectedId && visibleFindings.some((finding) => finding.id === selectedId)) return;
    onSelect(visibleFindings[0].id);
  }, [onSelect, selectedId, visibleFindings]);

  return (
    <section className="rounded-[30px] border border-[#1d1a1a] p-3 sm:p-4">
      <div className="flex flex-col gap-4 px-3 py-5 sm:px-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mono text-[11px] text-[#fc74dd]">Prioritized findings</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {findings.length > 0 ? "Fix these before users arrive" : "No findings for this scan"}
          </h2>
        </div>
        <div className="flex max-w-xl items-center gap-3 text-sm leading-6 text-[#d9d9d9]">
          <ShieldAlert className="h-5 w-5 shrink-0 text-[#d9d9d9]" aria-hidden="true" />
          <p>Each finding is ranked by launch risk and tied to evidence, impact, and a usable fix prompt.</p>
        </div>
      </div>

      <div className="grid gap-4 px-3 pb-5 sm:px-4 lg:grid-cols-[0.9fr_1.1fr]">
        <FilterGroup
          label="Severity"
          options={["all", "critical", "high", "medium", "low"]}
          value={severityFilter}
          onChange={setSeverityFilter}
          formatLabel={(value) => (value === "all" ? "All severity" : severityLabel[value])}
        />
        <FilterGroup
          label="Category"
          options={["all", ...categories]}
          value={categoryFilter}
          onChange={setCategoryFilter}
          formatLabel={(value) => (value === "all" ? "All categories" : value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleFindings.length === 0 && (
          <div className="col-span-full rounded-[24px] border border-[#3d3d3d] p-8 text-center">
            <p className="mono text-[10px] text-[#fc74dd]">
              {findings.length > 0 ? "No matching findings" : "Scan clean"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#d9d9d9]">
              {findings.length > 0
                ? "Try a broader severity or category filter. The scan data is still available; this view is only filtered."
                : "The selected context passed the current launch-readiness checklist. Re-run this scan whenever the product scope changes."}
            </p>
          </div>
        )}

        {visibleFindings.map((finding) => (
          <button
            key={finding.id}
            onClick={() => onSelect(finding.id)}
            className={`w-full rounded-[24px] border p-5 text-left transition ${
              selectedId === finding.id
                ? "border-[#fc74dd] bg-[#1d1a1a]"
                : "border-transparent bg-[#111212] hover:border-[#3d3d3d] hover:bg-[#1d1a1a]"
            }`}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={`mono text-[10px] ${severityClass[finding.severity]}`}>
                {severityLabel[finding.severity]}
              </span>
              <span className="mono rounded-full border border-[#3d3d3d] px-3 py-1 text-[9px] text-[#d9d9d9]">
                {finding.category}
              </span>
              <span className="mono rounded-full border border-[#3d3d3d] px-3 py-1 text-[9px] text-[#d9d9d9]">
                {finding.status}
              </span>
            </div>
            <h3 className="text-xl font-semibold tracking-[-0.02em]">{finding.title}</h3>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#d9d9d9]">{finding.impact}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel: (value: T) => string;
}) {
  return (
    <div>
      <p className="mono mb-3 text-[10px] text-[#d9d9d9]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`mono rounded-full border px-4 py-2 text-[10px] transition ${
              value === option
                ? "border-[#fc74dd] bg-[#fc74dd] text-[#111212]"
                : "border-[#3d3d3d] text-[#d9d9d9] hover:border-white hover:text-white"
            }`}
          >
            {formatLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildPromptBundle(findings: AuditFinding[]) {
  return findings
    .map(
      (finding, index) => `${index + 1}. ${finding.title}
Severity: ${severityLabel[finding.severity]}
Category: ${finding.category}
Status: ${finding.status}
Evidence: ${finding.evidence}
Fix: ${finding.fix}
Prompt:
${finding.prompt}`,
    )
    .join("\n\n---\n\n");
}

function PromptQueue({
  findings,
  onResetTriage,
}: {
  findings: AuditFinding[];
  onResetTriage: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const queuedFindings = findings.filter((finding) => finding.status !== "ignored");
  const plannedCount = findings.filter((finding) => finding.status === "planned").length;
  const openCount = findings.filter((finding) => finding.status === "open").length;
  const ignoredCount = findings.filter((finding) => finding.status === "ignored").length;
  const promptBundle = buildPromptBundle(queuedFindings);

  async function copyPromptBundle() {
    await navigator.clipboard?.writeText(promptBundle);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Prompt queue</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Turn triaged findings into an implementation queue.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            Open and planned findings are bundled into a copyable prompt pack. Ignored findings stay in the report but are excluded from the queue.
          </p>
        </div>
        <button
          onClick={copyPromptBundle}
          disabled={queuedFindings.length === 0}
          className="mono inline-flex items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-[#111212] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#d9d9d9]"
        >
          <Clipboard className="h-4 w-4" aria-hidden="true" />
          {copied ? "Copied queue" : "Copy queue"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="Queued prompts" value={queuedFindings.length.toString()} />
        <Metric label="Open" value={openCount.toString()} />
        <Metric label="Planned" value={plannedCount.toString()} />
        <Metric label="Ignored" value={ignoredCount.toString()} />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onResetTriage}
          className="mono rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white"
        >
          Reset triage
        </button>
      </div>

      {queuedFindings.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-[#3d3d3d] p-6 text-center">
          <p className="mono text-[10px] text-[#fc74dd]">Queue empty</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#d9d9d9]">
            Mark at least one finding as open or planned to generate a copyable implementation queue.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] bg-[#111212] p-5">
          <p className="mono text-[10px] text-[#d9d9d9]">Next prompt</p>
          <p className="mt-3 text-base font-semibold tracking-[-0.02em] text-white">
            {queuedFindings[0].title}
          </p>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#d9d9d9]">
            {queuedFindings[0].prompt}
          </p>
        </div>
      )}
    </section>
  );
}

function FindingDetail({
  finding,
  onStatusChange,
}: {
  finding?: AuditFinding;
  onStatusChange: (findingId: string, status: FindingStatus) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!finding) {
    return <EmptyState compact />;
  }

  return (
    <aside className="rounded-[30px] bg-white p-6 text-[#111212] sm:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#3d3d3d]">Finding detail</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-5xl">{finding.title}</h2>
        </div>
        <ArrowUpRight className="h-6 w-6 shrink-0" aria-hidden="true" />
      </div>

      <div className="mb-8 rounded-[24px] bg-[#f3f3ef] p-4">
        <p className="mono mb-3 text-[10px] text-[#3d3d3d]">Triage status</p>
        <div className="flex flex-wrap gap-2">
          {(["open", "planned", "ignored"] satisfies FindingStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(finding.id, status)}
              aria-pressed={finding.status === status}
              className={`mono rounded-full border px-4 py-2 text-[10px] transition ${
                finding.status === status
                  ? "border-[#111212] bg-[#111212] text-white"
                  : "border-[#d9d9d9] text-[#3d3d3d] hover:border-[#111212] hover:text-[#111212]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DetailBlock title="Evidence" body={finding.evidence} />
        <DetailBlock title="Impact" body={finding.impact} />
        <DetailBlock title="Suggested fix" body={finding.fix} />
      </div>

      <div className="mt-8 rounded-[24px] bg-[#f3f3ef] p-5">
        <p className="mono mb-4 text-[10px] text-[#3d3d3d]">Copy prompt</p>
        <p className="text-sm leading-6">{finding.prompt}</p>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(finding.prompt);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="mono mt-6 inline-flex items-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-[#111212] transition hover:brightness-95"
        >
          <Clipboard className="h-4 w-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
    </aside>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-[#d9d9d9] py-5">
      <p className="mono text-[10px] text-[#3d3d3d]">{title}</p>
      <p className="mt-3 text-sm leading-6">{body}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-[30px] bg-[#1d1a1a] p-8 text-center">
      <div className="max-w-md">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#fc74dd]" aria-hidden="true" />
        <p className="mono mt-8 text-[11px] text-[#fc74dd]">Scanning project</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Reading structure, routes, and launch signals.</h2>
        <p className="mt-5 text-sm leading-6 text-[#d9d9d9]">
          In the real scanner, this is where Vibe detects framework, auth, payments, tests, policy pages, and AI workspace context.
        </p>
      </div>
    </section>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`grid place-items-center rounded-[30px] border border-[#1d1a1a] p-8 text-center ${
        compact ? "min-h-[260px] bg-white text-[#111212]" : "min-h-[420px] bg-black text-white"
      }`}
    >
      <div className="max-w-md">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#fc74dd]" aria-hidden="true" />
        <p className={`mono mt-8 text-[11px] ${compact ? "text-[#3d3d3d]" : "text-[#fc74dd]"}`}>
          Empty state
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">{emptyReport.title}</h2>
        <p className={`mt-5 text-sm leading-6 ${compact ? "text-[#3d3d3d]" : "text-[#d9d9d9]"}`}>
          {emptyReport.body}
        </p>
      </div>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-[30px] bg-[#1d1a1a] p-8 text-center">
      <div className="max-w-md">
        <AlertTriangle className="mx-auto h-8 w-8 text-[#ff5a5f]" aria-hidden="true" />
        <p className="mono mt-8 text-[11px] text-[#ff5a5f]">Scan failed</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">The workspace could not be read.</h2>
        <p className="mt-5 text-sm leading-6 text-[#d9d9d9]">
          {message ?? "Vibe should explain what failed, preserve the user's context, and offer a clear retry path instead of dropping them into a dead end."}
        </p>
        <button
          onClick={onRetry}
          className="mono mt-8 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-[#111212] transition hover:brightness-95"
        >
          Retry scan
        </button>
      </div>
    </section>
  );
}
