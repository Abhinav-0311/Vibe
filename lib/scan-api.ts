import type { ChecklistResult } from "@/lib/checklist/types";
import type { AuditProfileInference } from "@/lib/checklist/context-inference";
import type { ReadinessTrendPoint, SavedScanDetail, SavedScanRecord, ScanPersistenceResult } from "@/lib/db/scan-records";
import type { GeneratedReport } from "@/lib/report/types";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { SetupPack } from "@/lib/setup-pack/types";
import type { ArchitectureStressResult } from "@/lib/architecture-stress/types";

export type ScanApiResponse = {
  scannedProject: string;
  scanSource?: {
    type: "local" | "upload" | "github";
    label: string;
    detail?: string;
    repository?: {
      owner: string;
      repo: string;
      branch: string;
    };
  };
  scannedAt: string;
  timing?: {
    /** Scan processing only; persistence happens after this response is assembled. */
    processingMs: number;
  };
  facts: ScannerFacts;
  profileInference?: AuditProfileInference;
  checklist: ChecklistResult;
  report: GeneratedReport;
  setupPack?: SetupPack;
  architectureStress?: ArchitectureStressResult;
  persistence?: ScanPersistenceResult;
};

export type GitHubStatusApiResponse = {
  configured: boolean;
  connected: boolean;
};

export type GitHubRepository = {
  fullName: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  archived: boolean;
};

export type GitHubRepositoriesApiResponse = {
  repositories: GitHubRepository[];
};

export type GitHubBranchesApiResponse = {
  branches: Array<{ name: string; protected: boolean }>;
};

export type SavedScansApiResponse = {
  databaseConfigured: boolean;
  records: SavedScanRecord[];
  trend?: ReadinessTrendPoint[];
  error?: "database_error";
};

export type SavedScanDetailApiResponse = {
  databaseConfigured: boolean;
  record: SavedScanDetail | null;
  error?: "database_error" | "not_found";
};

export type HealthApiResponse = {
  service: "vibe";
  timestamp: string;
  status: "ok" | "degraded";
  checks: {
    application: "ok";
    database: "ok" | "not_configured" | "error";
  };
};

export type WorkspaceProject = {
  name: string;
  path: string;
  hasPackageJson: boolean;
};

export type WorkspaceProjectsApiResponse = {
  workspaceRoot: string;
  localScanEnabled: boolean;
  projects: WorkspaceProject[];
};
