"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  FileSearch,
  FileText,
  FolderOpen,
  Github,
  GitBranch,
  GitPullRequest,
  History,
  Loader2,
  RefreshCw,
  Server,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuditContext } from "@/lib/checklist/types";
import { auditReport, emptyReport, type AuditFinding, type AuditReport, type Severity } from "@/lib/mock-audit";
import { formatMarkdownReport } from "@/lib/report/markdown-export";
import { generateFixPlan } from "@/lib/fix-assistant/fix-plan";
import { compareScans } from "@/lib/fix-assistant/scan-comparison";
import type { ScanComparison } from "@/lib/fix-assistant/types";
import type {
  SavedScanDetailApiResponse,
  SavedScansApiResponse,
  GitHubBranchesApiResponse,
  GitHubRepositoriesApiResponse,
  GitHubRepository,
  GitHubStatusApiResponse,
  ScanApiResponse,
  WorkspaceProjectsApiResponse,
} from "@/lib/scan-api";
import { addScanToHistory, parseScanHistory, scanHistoryStorageKey, type ScanHistoryItem } from "@/lib/scan-history";
import type { SetupArtifact, SetupPack } from "@/lib/setup-pack/types";

type ViewState = "report" | "loading" | "empty" | "error";
type SeverityFilter = "all" | Severity;
type CategoryFilter = "all" | string;
type FindingStatus = AuditFinding["status"];
type SavedScansState = "loading" | "ready" | "error";
type ProjectDiscoveryState = "loading" | "ready" | "error";
type ProjectSourceMode = "local" | "github" | "upload";

const defaultAuditContext: AuditContext = {
  appType: "saas",
  stage: "launch-prep",
  hasPayments: false,
  hasUserAccounts: true,
  storesUserData: true,
};

const triageStorageKey = "vibe:finding-status-overrides";
const defaultProjectPath = "";

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

function formatScanSource(scan: ScanApiResponse | null | undefined) {
  return scan?.scanSource?.label ?? "Local workspace";
}

function formatScanSourceDetail(scan: ScanApiResponse | null | undefined) {
  return scan?.scanSource?.detail ?? scan?.facts.projectRoot ?? "Project source";
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
  const [scanComparison, setScanComparison] = useState<ScanComparison | null>(null);

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
    setScanComparison(compareScans(scanData, scan));
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
    setScanComparison(null);
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
      setScanComparison(null);
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
      setViewState(scanData ? "report" : "empty");
    }
  }

  async function runGitHubScan(repoUrl: string, branch: string, context = auditContext) {
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
          branch,
          appType: context.appType,
          stage: context.stage,
          hasPayments: context.hasPayments,
          hasUserAccounts: context.hasUserAccounts,
          storesUserData: context.storesUserData,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; retryAt?: string } | null;
        const retryMessage = body?.retryAt
          ? ` Retry after ${new Date(body.retryAt).toLocaleString()}.`
          : "";
        throw new Error(`${body?.error ?? `GitHub scan failed with status ${response.status}`}${retryMessage}`);
      }

      const data = (await response.json()) as ScanApiResponse;
      applyCompletedScan(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub scan failed";
      setGithubError(message);
      setViewState(scanData ? "report" : "empty");
    }
  }

  function rerunActiveScan() {
    if (!scanData) return;
    const repository = scanData.scanSource?.repository;
    if (repository) {
      void runGitHubScan(
        `https://github.com/${repository.owner}/${repository.repo}`,
        repository.branch,
        scanData.checklist.context,
      );
      return;
    }

    if (scanData.scanSource?.type === "upload") return;
    void runScan(scanData.checklist.context, scanData.facts.projectRoot);
  }

  function scanGitHubFixBranch(branch: string) {
    const repository = scanData?.scanSource?.repository;
    if (!scanData || !repository) return;
    void runGitHubScan(
      `https://github.com/${repository.owner}/${repository.repo}`,
      branch,
      scanData.checklist.context,
    );
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate and run the initial scan once.

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
          isScanning={viewState === "loading"}
          onUploadScan={(file, context) => void runUploadScan(file, context)}
          onGitHubScan={(repoUrl, branch, context) => void runGitHubScan(repoUrl, branch, context)}
        />
        {viewState === "loading" && <LoadingState />}
        {viewState === "empty" && <EmptyState />}
        {viewState === "error" && <ErrorState message={scanError} onRetry={runScan} />}
        {viewState === "report" && (
          <>
            <ResultSection
              eyebrow="Fix this first"
              title="Start with the highest-risk misses."
              description="This is the main product surface: score, prioritized findings, evidence, and the next prompt to give your coding agent."
            >
              <ReportView
                report={reportWithStatuses}
                selectedFinding={selectedFinding}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onStatusChange={updateFindingStatus}
                repository={scanData?.scanSource?.repository}
              />
            </ResultSection>

            <ResultSection
              eyebrow="Implementation handoff"
              title="Turn the scan into work."
              description="Use this section after you understand the first findings. It exports the report, setup pack, and implementation queue."
            >
              {scanData && <ReportNarrative scan={scanData} />}
              {scanData && <SetupPackWorkspace setupPack={scanData.setupPack} />}
              <FixAssistant
                projectName={reportWithStatuses.projectName}
                findings={reportWithStatuses.findings}
                scan={scanData}
                repository={scanData?.scanSource?.repository}
                comparison={scanComparison}
                onResetTriage={resetTriage}
                onRescan={rerunActiveScan}
                onScanGitHubBranch={scanGitHubFixBranch}
              />
            </ResultSection>

            <EvidenceDisclosure>
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
              <ScannerFactsPreview scan={scanData} />
              <ArchitectureStressPanel scan={scanData} />
            </EvidenceDisclosure>
          </>
        )}
      </div>
    </main>
  );
}

function ResultSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 border-t border-[#1d1a1a] pt-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[#b8b3b3]">{description}</p>
      </div>
      <div className="grid gap-6">{children}</div>
    </section>
  );
}

function EvidenceDisclosure({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-[30px] border border-[#1d1a1a] p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none flex-col gap-4 rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">More evidence</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Inspect the scan details.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#b8b3b3]">
            Open this when you want history, database records, route evidence, or architecture stress details.
          </p>
        </div>
        <span className="mono w-fit rounded-full border border-[#3d3d3d] px-5 py-3 text-[10px] text-white transition group-open:bg-white group-open:text-black">
          View evidence
        </span>
      </summary>
      <div className="mt-6 grid gap-6">{children}</div>
    </details>
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
    <section className="py-9 sm:py-12">
      <div className="mx-auto max-w-4xl text-center">
        <p className="mono mb-5 text-[11px] text-[#fc74dd]">Vibe audit console</p>
        <h1 className="text-[64px] font-semibold leading-[0.9] tracking-[-0.05em] text-white sm:text-[96px] lg:text-[128px]">
          Vibe
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-[26px] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[40px]">
          Find the obvious things your AI-built app still missed.
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#d9d9d9] sm:text-lg sm:leading-8">
          Scan a Node.js project, see the launch gaps, and copy focused fix prompts for Codex, Cursor, or Claude Code.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-3">
        <SignalPill icon={Code2} label="For vibe coders" value="Plain-English risks" />
        <SignalPill icon={AlertTriangle} label="For builders" value="Missed launch basics" />
        <SignalPill icon={Clipboard} label="For agents" value="Copyable fix prompts" />
      </div>
    </section>
  );
}

function SignalPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Code2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-[#242020] bg-[#111212] px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[#fc74dd]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="mono truncate text-[9px] text-[#8f8888]">{label}</p>
        <p className="truncate text-sm font-medium text-white">{value}</p>
      </div>
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
  isScanning,
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
  isScanning: boolean;
  onUploadScan: (file: File, context: AuditContext) => void;
  onGitHubScan: (repoUrl: string, branch: string, context: AuditContext) => void;
}) {
  const [sourceMode, setSourceMode] = useState<ProjectSourceMode>("local");
  const stages: AuditContext["stage"][] = ["prototype", "launch-prep", "production"];
  const appTypes: AuditContext["appType"][] = ["saas", "internal-tool", "content-site", "api"];

  function update(next: Partial<AuditContext>) {
    onChange({ ...context, ...next });
  }

  return (
    <section className="rounded-[24px] bg-[#1d1a1a] p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono text-[11px] text-[#fc74dd]">Audit context</p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            Scan a project.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#b8b3b3]">
            Vibe reads repository structure, never executes project code, and turns missed launch basics into fix prompts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="mono w-fit rounded-full border border-[#4a4444] px-3 py-2 text-[9px] text-[#b8b3b3]">
            Node.js projects
          </span>
          <span className="mono w-fit rounded-full border border-[#4a4444] px-3 py-2 text-[9px] text-[#b8b3b3]">
            No code execution
          </span>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-3 gap-2 border-b border-[#3d3838] pb-5 sm:flex sm:w-fit">
        {([
          { value: "local", label: "Local", icon: FolderOpen },
          { value: "github", label: "GitHub", icon: Github },
          { value: "upload", label: "ZIP", icon: Upload },
        ] as const).map((source) => {
          const Icon = source.icon;
          const selected = sourceMode === source.value;

          return (
            <button
              key={source.value}
              type="button"
              onClick={() => setSourceMode(source.value)}
              aria-pressed={selected}
              className={`mono inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] ${
                selected
                  ? "border-[#fc74dd] bg-[#fc74dd] text-black"
                  : "border-[#4a4444] text-[#d9d9d9] hover:border-[#8f8888] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {source.label}
            </button>
          );
        })}
      </div>

      {sourceMode === "local" && <div className="mt-6">
        <label className="block">
          <span className="mono text-[10px] text-[#d9d9d9]">Project path</span>
          <input
            value={projectPath}
            onChange={(event) => onProjectPathChange(event.target.value)}
            className="mt-3 w-full rounded-[18px] border border-[#3d3d3d] bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5f5858] focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30"
            placeholder={workspaceProjects?.workspaceRoot ?? "Use the current server workspace"}
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-[#9b9696]">
          Select a Node.js project containing package.json inside {workspaceProjects?.workspaceRoot ?? "the configured server workspace"}. Other stacks are not supported yet.
        </p>

        <div className="mt-5 border-t border-[#3d3838] pt-5">
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
        <button
          type="button"
          onClick={() => onRunScan(context)}
          disabled={isScanning}
          className="mono mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 text-[10px] text-black transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:bg-[#4a4444] disabled:text-[#9b9696]"
        >
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSearch className="h-4 w-4" aria-hidden="true" />}
          {isScanning ? "Scanning project" : "Scan local project"}
        </button>
      </div>}

      {sourceMode === "github" && <GitHubScanPanel context={context} githubError={githubError} isScanning={isScanning} onGitHubScan={onGitHubScan} />}
      {sourceMode === "upload" && <ProjectUploadPanel context={context} uploadError={uploadError} isScanning={isScanning} onUploadScan={onUploadScan} />}

      <details className="group mt-7 border-t border-[#3d3838] pt-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]">
          <div>
            <p className="mono text-[10px] text-[#fc74dd]">Readiness profile</p>
            <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
              {context.stage} / {context.appType} / users {context.hasUserAccounts ? "yes" : "no"} / payments {context.hasPayments ? "yes" : "no"}
            </p>
          </div>
          <span className="mono rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-white transition group-open:bg-white group-open:text-black">
            Edit
          </span>
        </summary>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
      </details>
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
  isScanning,
  onGitHubScan,
}: {
  context: AuditContext;
  githubError: string | null;
  isScanning: boolean;
  onGitHubScan: (repoUrl: string, branch: string, context: AuditContext) => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [manualBranch, setManualBranch] = useState("");
  const [status, setStatus] = useState<GitHubStatusApiResponse | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState("");
  const [branches, setBranches] = useState<GitHubBranchesApiResponse["branches"]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [connectionState, setConnectionState] = useState<"loading" | "ready" | "error">("loading");
  const [repositoryState, setRepositoryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [branchState, setBranchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [panelError, setPanelError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string) {
    const body = (await response.json().catch(() => null)) as { error?: string; retryAt?: string } | null;
    const retry = body?.retryAt ? ` Retry after ${new Date(body.retryAt).toLocaleString()}.` : "";
    return `${body?.error ?? fallback}${retry}`;
  }

  async function loadRepositories() {
    setRepositoryState("loading");
    setPanelError(null);
    try {
      const response = await fetch("/api/github/repos");
      if (!response.ok) throw new Error(await readError(response, "Could not load GitHub repositories."));
      const data = (await response.json()) as GitHubRepositoriesApiResponse;
      setRepositories(data.repositories);
      setRepositoryState("ready");

      if (data.repositories.length > 0) {
        const first = data.repositories[0];
        setSelectedRepository(first.fullName);
        setSelectedBranch(first.defaultBranch);
      }
    } catch (error) {
      setRepositoryState("error");
      setPanelError(error instanceof Error ? error.message : "Could not load GitHub repositories.");
    }
  }

  async function loadConnection() {
    setConnectionState("loading");
    setPanelError(null);
    try {
      const response = await fetch("/api/github/status");
      if (!response.ok) throw new Error("Could not read the GitHub connection.");
      const data = (await response.json()) as GitHubStatusApiResponse;
      setStatus(data);
      setConnectionState("ready");
      if (data.connected) void loadRepositories();
    } catch (error) {
      setConnectionState("error");
      setPanelError(error instanceof Error ? error.message : "Could not read the GitHub connection.");
    }
  }

  useEffect(() => {
    void loadConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load the connection once when the panel mounts.

  useEffect(() => {
    if (!selectedRepository || !status?.connected) {
      setBranches([]);
      setBranchState("idle");
      return;
    }

    let cancelled = false;
    async function loadBranches() {
      setBranchState("loading");
      setPanelError(null);
      try {
        const response = await fetch(`/api/github/branches?repository=${encodeURIComponent(selectedRepository)}`);
        if (!response.ok) throw new Error(await readError(response, "Could not load repository branches."));
        const data = (await response.json()) as GitHubBranchesApiResponse;
        if (cancelled) return;
        setBranches(data.branches);
        setBranchState("ready");
        const repository = repositories.find((item) => item.fullName === selectedRepository);
        const preferredBranch = repository?.defaultBranch ?? data.branches[0]?.name ?? "";
        setSelectedBranch((current) =>
          data.branches.some((branch) => branch.name === current) ? current : preferredBranch,
        );
      } catch (error) {
        if (cancelled) return;
        setBranchState("error");
        setPanelError(error instanceof Error ? error.message : "Could not load repository branches.");
      }
    }

    void loadBranches();
    return () => {
      cancelled = true;
    };
  }, [repositories, selectedRepository, status?.connected]);

  async function disconnect() {
    await fetch("/api/github/disconnect", { method: "POST" });
    setStatus((current) => ({ configured: current?.configured ?? true, connected: false }));
    setRepositories([]);
    setBranches([]);
    setSelectedRepository("");
    setSelectedBranch("");
    setRepositoryState("idle");
    setBranchState("idle");
  }

  function submitGitHubScan() {
    const trimmedUrl = repoUrl.trim();

    if (!trimmedUrl) {
      return;
    }

    onGitHubScan(trimmedUrl, manualBranch.trim(), context);
  }

  function scanSelectedRepository() {
    const repository = repositories.find((item) => item.fullName === selectedRepository);
    if (!repository || !selectedBranch) return;
    onGitHubScan(repository.url, selectedBranch, context);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="mono text-[10px] text-[#fc74dd]">GitHub repository</p>
          <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
            Scan a Node.js repository containing package.json. Connect GitHub for private repositories and branch selection, or use a public URL.
          </p>
        </div>
        {connectionState === "loading" ? (
          <span className="mono inline-flex items-center gap-2 text-[10px] text-[#9b9696]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking connection
          </span>
        ) : status?.connected ? (
          <button
            onClick={() => void disconnect()}
            className="mono rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
          >
            Disconnect
          </button>
        ) : status?.configured ? (
          <a
            href="/api/github/oauth/start"
            className="mono inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] text-black transition hover:bg-[#d9d9d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
          >
            <Github className="h-4 w-4" aria-hidden="true" /> Connect GitHub
          </a>
        ) : null}
      </div>

      {connectionState === "ready" && status?.connected && (
        <div className="mt-5 border-t border-[#3d3d3d] pt-5">
          {repositoryState === "loading" && (
            <p className="inline-flex items-center gap-2 text-sm text-[#d9d9d9]">
              <Loader2 className="h-4 w-4 animate-spin text-[#fc74dd]" aria-hidden="true" /> Loading repositories
            </p>
          )}

          {repositoryState === "ready" && repositories.length === 0 && (
            <p className="text-sm leading-6 text-[#d9d9d9]">No accessible repositories were returned by GitHub.</p>
          )}

          {repositories.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto] lg:items-end">
              <label className="block min-w-0">
                <span className="mono text-[10px] text-[#d9d9d9]">Repository</span>
                <select
                  value={selectedRepository}
                  onChange={(event) => setSelectedRepository(event.target.value)}
                  className="mt-3 w-full rounded-[18px] border border-[#3d3d3d] bg-[#111212] px-4 py-3 text-sm text-white outline-none transition focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30"
                >
                  {repositories.map((repository) => (
                    <option key={repository.fullName} value={repository.fullName} disabled={repository.archived}>
                      {repository.fullName} ({repository.private ? "private" : "public"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mono text-[10px] text-[#d9d9d9]">Branch</span>
                <select
                  value={selectedBranch}
                  onChange={(event) => setSelectedBranch(event.target.value)}
                  disabled={branchState !== "ready" || branches.length === 0}
                  className="mt-3 w-full rounded-[18px] border border-[#3d3d3d] bg-[#111212] px-4 py-3 text-sm text-white outline-none transition focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30 disabled:cursor-wait disabled:text-[#9b9696]"
                >
                  {branchState === "loading" && <option>Loading branches</option>}
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>{branch.name}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={scanSelectedRepository}
                disabled={isScanning || !selectedRepository || !selectedBranch || branchState !== "ready"}
                className="mono inline-flex items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-black transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#9b9696]"
              >
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSearch className="h-4 w-4" aria-hidden="true" />}
                {isScanning ? "Scanning" : "Scan branch"}
              </button>
            </div>
          )}
        </div>
      )}

      {connectionState === "ready" && !status?.connected && status?.configured && (
        <p className="mt-4 text-xs leading-5 text-[#9b9696]">
          GitHub requests repository access so Vibe can read private code and create issues only when you ask it to.
        </p>
      )}

      {connectionState === "ready" && !status?.configured && (
        <p className="mt-4 text-sm leading-6 text-[#ffd166]">
          GitHub OAuth is not configured. Public URL scanning still works; add the GitHub environment variables to enable private repositories.
        </p>
      )}

      <div className="mt-5 grid gap-4 border-t border-[#3d3d3d] pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mono text-[10px] text-[#d9d9d9]">Public repository URL</span>
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
        <label className="block min-w-0">
          <span className="mono text-[10px] text-[#d9d9d9]">Branch (optional)</span>
          <input
            value={manualBranch}
            onChange={(event) => setManualBranch(event.target.value)}
            className="mt-4 w-full rounded-[18px] border border-[#3d3d3d] bg-[#111212] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#5f5858] focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30"
            placeholder="default branch"
          />
        </label>
        <button
          onClick={submitGitHubScan}
          disabled={isScanning || repoUrl.trim().length === 0}
          className="mono inline-flex items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#9b9696]"
        >
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Github className="h-4 w-4" aria-hidden="true" />}
          {isScanning ? "Scanning repository" : "Scan public repo"}
        </button>
      </div>

      {(panelError || githubError || connectionState === "error") && (
        <p className="mt-4 border-t border-[#3d3d3d] pt-4 text-sm leading-6 text-[#ff8f8f]">
          {panelError ?? githubError ?? "Could not read the GitHub connection."}
        </p>
      )}
    </div>
  );
}

function ProjectUploadPanel({
  context,
  uploadError,
  isScanning,
  onUploadScan,
}: {
  context: AuditContext;
  uploadError: string | null;
  isScanning: boolean;
  onUploadScan: (file: File, context: AuditContext) => void;
}) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="mono text-[10px] text-[#fc74dd]">Upload project</p>
          <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
            Upload a Node.js project ZIP containing package.json when it is not inside the local workspace picker.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#9b9696]">
            The archive is extracted to a temporary folder, scanned without executing code, then removed.
          </p>
        </div>

        <label className={`mono inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] transition ${isScanning ? "cursor-wait bg-[#4a4444] text-[#9b9696]" : "cursor-pointer bg-[#fc74dd] text-black hover:brightness-95"}`}>
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {isScanning ? "Scanning archive" : "Choose ZIP"}
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={isScanning}
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
  const apiRoutes = scan?.facts.apiRoutes ?? [];
  const facts = [
    { label: "Framework", value: scan?.facts.framework.name ?? "Scanning..." },
    { label: "Package manager", value: scan?.facts.packageManager ?? "Scanning..." },
    { label: "Project", value: scan?.scannedProject ?? "Scanning..." },
    { label: "Context", value: scan ? scan.checklist.context.stage : "Scanning..." },
    { label: "API routes", value: scan ? apiRoutes.length.toString() : "Scanning..." },
    { label: "Source", value: scan ? formatScanSource(scan) : "Scanning..." },
  ];
  const evidence = scan
    ? [
        {
          label: "Package manifest",
          detail: "package.json",
          detected: scan.facts.signals.hasPackageJson,
        },
        ...(typeof scan.facts.signals.hasLockfile === "boolean"
          ? [
              {
                label: "Release inputs",
                detail: "Dependency lockfile and production build script",
                detected: scan.facts.signals.hasLockfile && scan.facts.signals.hasBuildScript,
              },
            ]
          : []),
        ...(typeof scan.facts.signals.ignoresTypeScriptBuildErrors === "boolean"
          ? [
              {
                label: "Build validation",
                detail: "TypeScript and ESLint checks remain enabled",
                detected:
                  !scan.facts.signals.ignoresTypeScriptBuildErrors &&
                  !scan.facts.signals.ignoresEslintBuildErrors,
              },
            ]
          : []),
        ...(scan.facts.signals.hasStartScript &&
        typeof scan.facts.signals.hasDevelopmentStartScript === "boolean"
          ? [
              {
                label: "Production start",
                detail: "Start script does not launch a dev server",
                detected: !scan.facts.signals.hasDevelopmentStartScript,
              },
            ]
          : []),
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
        ...(scan.facts.uiEvidence
          ? [
              {
                label: "Loading states",
                detail: "loading boundary, skeleton, loader, or isLoading state",
                detected: scan.facts.uiEvidence.hasLoadingState,
              },
              {
                label: "Error states",
                detail: "error boundary, alert role, or visible error copy",
                detected: scan.facts.uiEvidence.hasErrorState,
              },
              {
                label: "Accessible images",
                detail: "Image usage has alt text or presentation semantics",
                detected: scan.facts.uiEvidence.imageWithoutAltFiles.length === 0,
              },
              {
                label: "Labeled controls",
                detail: "Input, textarea, and select controls have accessible names",
                detected: scan.facts.uiEvidence.unlabeledControlFiles.length === 0,
              },
              {
                label: "Responsive UI code",
                detail: "Responsive class usage was detected in UI files",
                detected: scan.facts.uiEvidence.responsiveClassFiles.length > 0,
              },
            ]
          : []),
        {
          label: "Middleware",
          detail: "middleware.ts/js",
          detected: scan.facts.signals.hasMiddleware,
        },
        {
          label: "Rate limiting",
          detail: "package, middleware, or HTTP 429 handling",
          detected: scan.facts.signals.hasRateLimitImplementation,
        },
        ...(typeof scan.facts.signals.hasWildcardCors === "boolean"
          ? [
              {
                label: "Restricted CORS",
                detail: "No wildcard origin configuration detected",
                detected: !scan.facts.signals.hasWildcardCors,
              },
            ]
          : []),
        {
          label: "Auth dependency",
          detail: "Clerk, NextAuth, Supabase, Lucia",
          detected: scan.facts.signals.hasAuthDependency,
        },
        ...(scan.facts.signals.hasCredentialAuthRoute &&
        typeof scan.facts.signals.hasPasswordRecoveryRoute === "boolean"
          ? [
              {
                label: "Account recovery",
                detail: "Forgot-password or reset route",
                detected: scan.facts.signals.hasPasswordRecoveryRoute,
              },
              {
                label: "Session termination",
                detail: "Logout, signout, or session route",
                detected: scan.facts.signals.hasSessionManagementRoute,
              },
            ]
          : []),
        ...(scan.facts.signals.hasAuthRoute &&
        typeof scan.facts.signals.hasInsecureSessionCookie === "boolean"
          ? [
              {
                label: "Session cookie safety",
                detail: "No explicitly disabled httpOnly or secure option",
                detected: !scan.facts.signals.hasInsecureSessionCookie,
              },
            ]
          : []),
        {
          label: "Payments dependency",
          detail: "Stripe packages",
          detected: scan.facts.signals.hasStripeDependency,
        },
        ...(scan.facts.signals.hasWebhookRoute &&
        typeof scan.facts.signals.hasWebhookSignatureVerification === "boolean"
          ? [
              {
                label: "Webhook verification",
                detail: "Stripe constructEvent in webhook route",
                detected: scan.facts.signals.hasWebhookSignatureVerification,
              },
            ]
          : []),
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
        ...(scan.facts.signals.hasLocalEnvFile
          ? [
              {
                label: "Local env files ignored",
                detail: ".gitignore covers detected environment files",
                detected: scan.facts.signals.hasEnvGitignoreRule,
              },
            ]
          : []),
      ]
    : [];
  const detectedCount = evidence.filter((item) => item.detected).length;

  return (
    <section className="rounded-[30px] border border-[#1d1a1a] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Technical evidence</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            What Vibe saw in the repository.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            These facts explain why the findings appeared. They are useful for debugging the scan, but the fix list above is the main workflow.
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

      {scan && apiRoutes.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-[#242424] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono text-[10px] text-[#fc74dd]">Route inventory</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                Detected API entry points
              </h3>
            </div>
            <p className="text-xs leading-5 text-[#9b9696]">Paths only. Project code is never executed.</p>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {apiRoutes.slice(0, 8).map((route) => (
              <div
                key={route.file}
                className="flex min-w-0 items-center justify-between gap-4 rounded-[16px] bg-[#111212] px-4 py-3"
              >
                <p className="mono min-w-0 truncate text-[10px] text-white" title={route.route}>
                  {route.route}
                </p>
                <span className="mono shrink-0 text-[9px] text-[#9b9696]">
                  {route.signals.join(" · ") || "api"}
                </span>
              </div>
            ))}
          </div>
          {apiRoutes.length > 8 && (
            <p className="mono mt-3 text-[9px] text-[#9b9696]">
              +{apiRoutes.length - 8} more routes detected
            </p>
          )}
        </div>
      )}

      {scan ? (
        <div className="mt-6 rounded-[24px] bg-[#111212] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono text-[10px] text-[#fc74dd]">Evidence ledger</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {detectedCount} of {evidence.length} key signals detected.
              </h3>
            </div>
            <p className="mono text-[10px] text-[#d9d9d9]">{formatScanSourceDetail(scan)}</p>
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

function ArchitectureStressPanel({ scan }: { scan: ScanApiResponse | null }) {
  const stress = scan?.architectureStress;
  if (!stress) return null;

  const statusStyle = {
    resilient: "border-[#315c45] bg-[#0c2116] text-[#a7f35b]",
    watch: "border-[#5a4d2b] bg-[#211d10] text-[#ffd166]",
    "at-risk": "border-[#653238] bg-[#241113] text-[#ff8f8f]",
  } as const;

  return (
    <section className="rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8">
      <div className="grid gap-6 border-b border-[#3d3d3d] pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Architecture stress test</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Test what happens after the happy path.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            Six deterministic lenses examine data evolution, security, provider dependence, metered cost, failure recovery, and release stability. Every verdict comes from repository evidence, never invented infrastructure assumptions.
          </p>
        </div>
        <div className="flex items-end gap-3 lg:text-right">
          <span className="text-5xl font-semibold tracking-[-0.05em] text-white">{stress.score}</span>
          <span className="pb-1 text-sm leading-5 text-[#d9d9d9]">/100<br />{stress.label}</span>
        </div>
      </div>

      <div className="divide-y divide-[#3d3d3d]">
        {stress.assessments.map((assessment, index) => (
          <article key={assessment.id} className="grid gap-5 py-6 lg:grid-cols-[48px_minmax(180px,0.45fr)_minmax(0,1fr)] lg:items-start">
            <p className="mono pt-1 text-[10px] text-[#777]">0{index + 1}</p>
            <div>
              <span className={`mono inline-flex rounded-full border px-3 py-1 text-[9px] ${statusStyle[assessment.status]}`}>
                {assessment.status}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-white">{assessment.title}</h3>
            </div>
            <div>
              <p className="text-sm leading-6 text-white">{assessment.summary}</p>
              <p className="mt-3 text-sm leading-6 text-[#9b9696]">{assessment.evidence.join(" ")}</p>
              <p className="mt-3 text-sm leading-6 text-[#d9d9d9]"><span className="text-[#fc74dd]">Next:</span> {assessment.actions[0]}</p>
            </div>
          </article>
        ))}
      </div>

      <p className="border-t border-[#3d3d3d] pt-5 text-xs leading-5 text-[#777]">{stress.disclaimer}</p>
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
                    <p className="mono mt-2 text-[9px] text-[#9b9696]">{formatScanSource(item.scan)}</p>
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
  const isError = state === "error" || savedScans?.error === "database_error";
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
              PostgreSQL is configured, but Vibe could not read saved scans. Local scan history and new scans still work.
            </p>
            <p className="mono mt-4 inline-flex rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-white">
              docker compose up -d
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
                    <p className="mono mt-2 text-[9px] text-[#9b9696]">{record.sourceLabel}</p>
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

  const generation = scan.report.generation;
  const isAiEnhanced = generation?.mode === "openai";
  const fallbackMessage =
    generation?.fallbackReason && !["disabled", "missing_api_key"].includes(generation.fallbackReason)
      ? generation.fallbackReason === "timeout"
        ? "AI enhancement timed out. The evidence-generated report was preserved."
        : generation.fallbackReason === "api_error"
          ? "The AI service was unavailable. The evidence-generated report was preserved."
          : "The AI response did not pass validation. The evidence-generated report was preserved."
      : null;

  return (
    <section className="rounded-[30px] bg-[#f4f2ee] p-6 text-black sm:p-8 lg:p-10">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="mono text-[11px] text-[#5f5858]">Generated report</p>
            <span className={`mono rounded-full px-3 py-1 text-[9px] ${isAiEnhanced ? "bg-black text-white" : "bg-white text-[#333030]"}`}>
              {isAiEnhanced ? `AI enhanced / ${generation?.model}` : "Evidence generated"}
            </span>
          </div>
          {isAiEnhanced && generation && (
            <p className="mono mt-3 text-[9px] text-[#5f5858]">
              {generation.latencyMs !== undefined ? `${(generation.latencyMs / 1000).toFixed(1)}s` : "Completed"}
              {generation.usage
                ? ` / ${generation.usage.inputTokens} input tokens / ${generation.usage.outputTokens} output tokens`
                : ""}
            </p>
          )}
          {fallbackMessage && <p className="mt-3 text-xs leading-5 text-[#8a3d2f]">{fallbackMessage}</p>}
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

function SetupPackWorkspace({ setupPack }: { setupPack?: SetupPack }) {
  const [selectedArtifactId, setSelectedArtifactId] = useState(setupPack?.artifacts[0]?.id ?? "");
  const [copiedArtifactId, setCopiedArtifactId] = useState<string | null>(null);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedArtifactId(setupPack?.artifacts[0]?.id ?? "");
    setCopiedArtifactId(null);
    setExportState("idle");
    setExportError(null);
  }, [setupPack]);

  const selectedArtifact = setupPack?.artifacts.find((artifact) => artifact.id === selectedArtifactId);

  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadArtifact(artifact: SetupArtifact) {
    downloadBlob(new Blob([artifact.content], { type: "text/markdown;charset=utf-8" }), artifact.path.split("/").pop() ?? "artifact.md");
  }

  async function copyArtifact(artifact: SetupArtifact) {
    await navigator.clipboard?.writeText(artifact.content);
    setCopiedArtifactId(artifact.id);
    window.setTimeout(() => setCopiedArtifactId(null), 1600);
  }

  async function exportPack() {
    if (!setupPack) return;
    setExportState("exporting");
    setExportError(null);

    try {
      const response = await fetch("/api/setup-pack/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupPack }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The setup pack could not be exported.");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "ai-workspace-setup-pack.zip";
      downloadBlob(await response.blob(), fileName);
      setExportState("idle");
    } catch (error) {
      setExportState("error");
      setExportError(error instanceof Error ? error.message : "The setup pack could not be exported.");
    }
  }

  if (!setupPack || setupPack.artifacts.length === 0) {
    return (
      <section className="rounded-[30px] border border-[#3d3d3d] p-6 text-center sm:p-8">
        <FileText className="mx-auto h-7 w-7 text-[#fc74dd]" aria-hidden="true" />
        <p className="mono mt-5 text-[10px] text-[#fc74dd]">AI workspace setup pack</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">This saved scan predates setup packs.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#d9d9d9]">
          Re-run the project scan to generate evidence-backed rules, memory, session, and integration files.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8 lg:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">AI workspace setup pack</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Give coding agents durable project context.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">{setupPack.summary}</p>
          <p className="mt-2 text-xs leading-5 text-[#9b9696]">
            Review every TODO before use. Exporting downloads files locally and never modifies the scanned repository.
          </p>
        </div>
        <button
          onClick={() => void exportPack()}
          disabled={exportState === "exporting"}
          className="mono inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-black transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:bg-[#3d3d3d] disabled:text-[#9b9696]"
        >
          {exportState === "exporting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {exportState === "exporting" ? "Preparing ZIP" : "Export setup pack"}
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div aria-label="Setup pack files" className="grid grid-cols-2 content-start gap-2 lg:grid-cols-1">
          {setupPack.artifacts.map((artifact) => (
            <button
              key={artifact.id}
              aria-pressed={artifact.id === selectedArtifactId}
              onClick={() => setSelectedArtifactId(artifact.id)}
              className={`w-full rounded-[18px] px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] ${
                artifact.id === selectedArtifactId
                  ? "bg-white text-black"
                  : "bg-[#111212] text-white hover:bg-[#292525]"
              }`}
            >
              <span className="mono block text-[9px] opacity-70">{artifact.kind}</span>
              <span className="mt-2 block text-sm font-semibold">{artifact.path}</span>
              <span className="mt-2 hidden text-xs leading-5 opacity-70 lg:block">{artifact.description}</span>
            </button>
          ))}
        </div>

        {selectedArtifact && (
          <div className="min-w-0 overflow-hidden rounded-[24px] bg-[#111212]">
            <div className="flex flex-col gap-4 border-b border-[#3d3d3d] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mono text-[9px] text-[#9b9696]">Preview</p>
                <p className="mt-2 text-sm font-semibold text-white">{selectedArtifact.path}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void copyArtifact(selectedArtifact)}
                  className="mono inline-flex items-center gap-2 rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
                >
                  <Clipboard className="h-4 w-4" aria-hidden="true" />
                  {copiedArtifactId === selectedArtifact.id ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => downloadArtifact(selectedArtifact)}
                  className="mono inline-flex items-center gap-2 rounded-full border border-[#3d3d3d] px-4 py-2 text-[10px] text-[#d9d9d9] transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" /> Download file
                </button>
              </div>
            </div>
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-[#d9d9d9] sm:p-6">
              {selectedArtifact.content}
            </pre>
          </div>
        )}
      </div>

      {exportState === "error" && exportError && (
        <p role="alert" className="mt-5 text-sm leading-6 text-[#ff8f8f]">{exportError}</p>
      )}
    </section>
  );
}

function ReportView({
  report,
  selectedFinding,
  selectedId,
  onSelect,
  onStatusChange,
  repository,
}: {
  report: AuditReport;
  selectedFinding?: AuditFinding;
  selectedId?: string;
  onSelect: (id: string) => void;
  onStatusChange: (findingId: string, status: FindingStatus) => void;
  repository?: NonNullable<ScanApiResponse["scanSource"]>["repository"];
}) {
  const criticalCount = report.findings.filter((finding) => finding.severity === "critical").length;

  return (
    <section className="grid gap-6">
      <ScorePanel report={report} criticalCount={criticalCount} />
      <FindingsList findings={report.findings} selectedId={selectedId} onSelect={onSelect} />
      <FindingDetail finding={selectedFinding} onStatusChange={onStatusChange} repository={repository} />
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

function downloadMarkdown(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function FixAssistant({
  projectName,
  findings,
  scan,
  repository,
  comparison,
  onResetTriage,
  onRescan,
  onScanGitHubBranch,
}: {
  projectName: string;
  findings: AuditFinding[];
  scan: ScanApiResponse | null;
  repository?: NonNullable<ScanApiResponse["scanSource"]>["repository"];
  comparison: ScanComparison | null;
  onResetTriage: () => void;
  onRescan: () => void;
  onScanGitHubBranch: (branch: string) => void;
}) {
  const plan = useMemo(
    () => generateFixPlan({ projectName, findings, facts: scan?.facts }),
    [findings, projectName, scan?.facts],
  );
  const [copied, setCopied] = useState(false);
  const [branchName, setBranchName] = useState(plan.branchName);
  const [branchState, setBranchState] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [branchError, setBranchError] = useState<string | null>(null);
  const [branchUrl, setBranchUrl] = useState<string | null>(null);
  const [pullRequestState, setPullRequestState] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [pullRequestError, setPullRequestError] = useState<string | null>(null);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);
  const queuedFindings = findings.filter((finding) => finding.status !== "ignored");
  const plannedCount = findings.filter((finding) => finding.status === "planned").length;
  const openCount = findings.filter((finding) => finding.status === "open").length;
  const ignoredCount = findings.filter((finding) => finding.status === "ignored").length;
  const promptBundle = buildPromptBundle(queuedFindings);
  const sourceType = scan?.scanSource?.type ?? "local";

  useEffect(() => {
    setBranchName(plan.branchName);
    setBranchState("idle");
    setBranchError(null);
    setBranchUrl(null);
    setPullRequestState("idle");
    setPullRequestError(null);
    setPullRequestUrl(null);
  }, [plan.branchName, repository?.branch, repository?.owner, repository?.repo]);

  async function copyPromptBundle() {
    await navigator.clipboard?.writeText(promptBundle);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function createFixBranch() {
    if (!repository || !branchName.trim()) return;
    setBranchState("creating");
    setBranchError(null);

    try {
      const response = await fetch("/api/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: `${repository.owner}/${repository.repo}`,
          baseBranch: repository.branch,
          branchName: branchName.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.error ?? "GitHub branch creation failed.");
      setBranchUrl(body.url);
      setBranchState("created");
    } catch (error) {
      setBranchState("error");
      setBranchError(error instanceof Error ? error.message : "GitHub branch creation failed.");
    }
  }

  async function createDraftPullRequest() {
    if (!repository || branchState !== "created") return;
    setPullRequestState("creating");
    setPullRequestError(null);

    try {
      const response = await fetch("/api/github/pull-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: `${repository.owner}/${repository.repo}`,
          baseBranch: repository.branch,
          headBranch: branchName.trim(),
          title: plan.pullRequestTitle,
          body: plan.pullRequestBody,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.error ?? "Draft pull request creation failed.");
      setPullRequestUrl(body.url);
      setPullRequestState("created");
    } catch (error) {
      setPullRequestState("error");
      setPullRequestError(error instanceof Error ? error.message : "Draft pull request creation failed.");
    }
  }

  return (
    <section className="rounded-[30px] bg-[#1d1a1a] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="mono text-[11px] text-[#fc74dd]">Fix assistant</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Turn findings into a verified implementation handoff.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d9d9d9]">
            Export the evidence-backed work plan, implement it in your coding agent, then re-scan the same project to measure what changed. Vibe never edits repository code or claims a fix without new scan evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyPromptBundle}
            disabled={queuedFindings.length === 0}
            className="mono inline-flex items-center justify-center gap-2 rounded-full bg-[#fc74dd] px-5 py-3 text-[10px] text-[#111212] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#d9d9d9]"
          >
            <Clipboard className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied queue" : "Copy queue"}
          </button>
          <button
            onClick={() => downloadMarkdown(plan.markdown, `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "vibe"}-implementation-plan.md`)}
            disabled={plan.items.length === 0}
            className="mono inline-flex items-center justify-center gap-2 rounded-full border border-[#525050] px-5 py-3 text-[10px] text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download plan
          </button>
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        <Metric label="Queued prompts" value={queuedFindings.length.toString()} />
        <Metric label="Open" value={openCount.toString()} />
        <Metric label="Planned" value={plannedCount.toString()} />
        <Metric label="Ignored" value={ignoredCount.toString()} />
      </div>

      <div className="mt-7 border-t border-[#3d3d3d] pt-7">
        {queuedFindings.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mono text-[10px] text-[#fc74dd]">Queue empty</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#d9d9d9]">
              Mark at least one finding as open or planned to generate an implementation handoff.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mono text-[10px] text-[#d9d9d9]">First task</p>
              <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white">{queuedFindings[0].title}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#d9d9d9]">{queuedFindings[0].prompt}</p>
            </div>
            <div className="border-t border-[#3d3d3d] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="mono text-[10px] text-[#d9d9d9]">Delivery sequence</p>
              <ol className="mt-4 grid gap-3 text-sm leading-6 text-[#d9d9d9]">
                <li><span className="text-white">01.</span> Export the plan and implement findings in severity order.</li>
                <li><span className="text-white">02.</span> Run the project tests and production build listed in the plan.</li>
                <li><span className="text-white">03.</span> Re-scan the fixed source and review resolved, remaining, and introduced findings.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {repository && queuedFindings.length > 0 && (
        <div className="mt-7 border-t border-[#3d3d3d] pt-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mono text-[10px] text-[#fc74dd]">GitHub handoff</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Prepare a dedicated fix branch.</h3>
              <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
                The branch starts from <span className="text-white">{repository.branch}</span>. Vibe creates no commits; push your implementation before opening the draft pull request.
              </p>
            </div>
            <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="fix-branch-name">Fix branch name</label>
              <input
                id="fix-branch-name"
                value={branchName}
                onChange={(event) => {
                  setBranchName(event.target.value);
                  setBranchState("idle");
                  setBranchError(null);
                  setBranchUrl(null);
                  setPullRequestState("idle");
                  setPullRequestUrl(null);
                }}
                disabled={branchState === "creating"}
                className="mono min-w-0 flex-1 rounded-full border border-[#525050] bg-[#111212] px-4 py-3 text-[10px] text-white outline-none transition placeholder:text-[#777] focus:border-[#fc74dd] focus:ring-2 focus:ring-[#fc74dd]/30 disabled:opacity-60"
              />
              <button
                onClick={() => void createFixBranch()}
                disabled={!branchName.trim() || branchState === "creating" || branchState === "created"}
                className="mono inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#525050] px-5 py-3 text-[10px] text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {branchState === "creating" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitBranch className="h-4 w-4" aria-hidden="true" />}
                {branchState === "creating" ? "Creating" : branchState === "created" ? "Branch ready" : "Create branch"}
              </button>
            </div>
          </div>

          {branchState === "error" && <p role="alert" className="mt-4 text-sm leading-6 text-[#ff8f8f]">{branchError}</p>}
          {branchState === "created" && (
            <div className="mt-5 flex flex-col gap-4 border-t border-[#3d3d3d] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <a href={branchUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-white underline decoration-[#525050] underline-offset-4 hover:decoration-white">
                Open fix branch <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onScanGitHubBranch(branchName.trim())}
                  className="mono inline-flex items-center gap-2 rounded-full border border-[#525050] px-4 py-2 text-[10px] text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Scan fix branch
                </button>
                {pullRequestState === "created" ? (
                  <a href={pullRequestUrl ?? "#"} target="_blank" rel="noreferrer" className="mono inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] text-black transition hover:bg-[#e8e8e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]">
                    Open draft PR <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    onClick={() => void createDraftPullRequest()}
                    disabled={pullRequestState === "creating"}
                    className="mono inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] text-black transition hover:bg-[#e8e8e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pullRequestState === "creating" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitPullRequest className="h-4 w-4" aria-hidden="true" />}
                    {pullRequestState === "creating" ? "Creating" : "Create draft PR"}
                  </button>
                )}
              </div>
            </div>
          )}
          {pullRequestState === "error" && (
            <p role="alert" className="mt-4 text-sm leading-6 text-[#ff8f8f]">
              {pullRequestError} GitHub requires the fix branch to contain commits that differ from the base branch.
            </p>
          )}
        </div>
      )}

      {!repository && (
        <div className="mt-7 flex flex-col gap-4 border-t border-[#3d3d3d] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mono text-[10px] text-[#fc74dd]">Verification</p>
            <p className="mt-2 text-sm leading-6 text-[#d9d9d9]">
              {sourceType === "upload"
                ? "Upload a fresh ZIP after implementing the plan to compare new evidence with this scan."
                : "Re-scan the same local project after implementing and verifying the plan."}
            </p>
          </div>
          <button
            onClick={onRescan}
            disabled={sourceType === "upload"}
            className="mono inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#525050] px-5 py-3 text-[10px] text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Re-scan project
          </button>
        </div>
      )}

      {comparison && (
        <div className="mt-7 border-t border-[#3d3d3d] pt-7" aria-live="polite">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono text-[10px] text-[#fc74dd]">Re-scan comparison</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Evidence changed by {comparison.scoreDelta >= 0 ? "+" : ""}{comparison.scoreDelta} points.</h3>
            </div>
            <p className="mono text-[10px] text-[#d9d9d9]">{comparison.baselineScore}/100 to {comparison.currentScore}/100</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric label="Resolved" value={comparison.resolved.length.toString()} />
            <Metric label="Remaining" value={comparison.remaining.length.toString()} />
            <Metric label="Introduced" value={comparison.introduced.length.toString()} />
          </div>
          {(comparison.resolved.length > 0 || comparison.introduced.length > 0) && (
            <div className="mt-5 grid gap-5 border-t border-[#3d3d3d] pt-5 md:grid-cols-2">
              <ComparisonList label="Resolved findings" items={comparison.resolved} empty="No findings resolved yet." />
              <ComparisonList label="New findings" items={comparison.introduced} empty="No new findings introduced." />
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={onResetTriage} className="mono rounded-full px-3 py-2 text-[10px] text-[#9b9696] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]">
          Reset triage
        </button>
      </div>
    </section>
  );
}

function ComparisonList({
  label,
  items,
  empty,
}: {
  label: string;
  items: Array<{ id: string; title: string }>;
  empty: string;
}) {
  return (
    <div>
      <p className="mono text-[10px] text-[#d9d9d9]">{label}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[#9b9696]">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-white">
          {items.slice(0, 4).map((item) => <li key={item.id}>{item.title}</li>)}
        </ul>
      )}
    </div>
  );
}

function FindingDetail({
  finding,
  onStatusChange,
  repository,
}: {
  finding?: AuditFinding;
  onStatusChange: (findingId: string, status: FindingStatus) => void;
  repository?: NonNullable<ScanApiResponse["scanSource"]>["repository"];
}) {
  const [copied, setCopied] = useState(false);
  const [issueState, setIssueState] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  useEffect(() => {
    setIssueState("idle");
    setIssueError(null);
    setIssueUrl(null);
  }, [finding?.id]);

  async function createGitHubIssue() {
    if (!finding || !repository) return;
    setIssueState("creating");
    setIssueError(null);

    try {
      const response = await fetch("/api/github/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: `${repository.owner}/${repository.repo}`,
          finding,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        retryAt?: string;
        url?: string;
      } | null;
      if (!response.ok || !body?.url) {
        const retry = body?.retryAt ? ` Retry after ${new Date(body.retryAt).toLocaleString()}.` : "";
        throw new Error(`${body?.error ?? "GitHub issue creation failed."}${retry}`);
      }
      setIssueUrl(body.url);
      setIssueState("created");
    } catch (error) {
      setIssueState("error");
      setIssueError(error instanceof Error ? error.message : "GitHub issue creation failed.");
    }
  }

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

      {finding.learning && (
        <div className="mt-8 rounded-[24px] bg-[#f3f3ef] p-5">
          <p className="mono text-[10px] text-[#3d3d3d]">Learn the mistake</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <DetailBlock compact title="What it means" body={finding.learning.explanation} />
            <DetailBlock compact title="Why builders miss it" body={finding.learning.commonMistake} />
            <DetailBlock compact title="Good fix" body={finding.learning.goodFix} />
          </div>
        </div>
      )}

      {(finding.severityReason || finding.verification?.length) && (
        <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {finding.severityReason && (
            <div className="rounded-[24px] bg-[#f3f3ef] p-5">
              <p className="mono text-[10px] text-[#3d3d3d]">Why this rank</p>
              <p className="mt-3 text-sm leading-6">{finding.severityReason}</p>
            </div>
          )}
          {finding.verification?.length ? (
            <div className="rounded-[24px] bg-[#f3f3ef] p-5">
              <p className="mono text-[10px] text-[#3d3d3d]">Verification</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6">
                {finding.verification.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fc74dd]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-8 rounded-[24px] bg-[#f3f3ef] p-5">
        <p className="mono mb-4 text-[10px] text-[#3d3d3d]">Copy prompt</p>
        <p className="whitespace-pre-line text-sm leading-6">{finding.prompt}</p>
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

        {repository && (
          <div className="mt-6 border-t border-[#d9d9d9] pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mono text-[10px] text-[#3d3d3d]">GitHub issue</p>
                <p className="mt-2 text-sm leading-6">
                  Create this finding in {repository.owner}/{repository.repo} from the scanned {repository.branch} branch.
                </p>
              </div>
              {issueState === "created" && issueUrl ? (
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mono inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111212] px-5 py-3 text-[10px] text-white transition hover:bg-[#3d3d3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd]"
                >
                  View issue <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <button
                  onClick={() => void createGitHubIssue()}
                  disabled={issueState === "creating"}
                  className="mono inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111212] px-5 py-3 text-[10px] text-white transition hover:bg-[#3d3d3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fc74dd] disabled:cursor-wait disabled:bg-[#9b9696]"
                >
                  {issueState === "creating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Github className="h-4 w-4" aria-hidden="true" />
                  )}
                  {issueState === "creating" ? "Creating issue" : "Create GitHub issue"}
                </button>
              )}
            </div>
            {issueState === "error" && issueError && (
              <p className="mt-4 text-sm leading-6 text-[#a42126]">{issueError}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function DetailBlock({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`border-t border-[#d9d9d9] ${compact ? "py-4" : "py-5"}`}>
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
