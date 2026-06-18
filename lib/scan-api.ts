import type { ChecklistResult } from "@/lib/checklist/types";
import type { SavedScanDetail, SavedScanRecord, ScanPersistenceResult } from "@/lib/db/scan-records";
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
  facts: ScannerFacts;
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
  error?: "database_error";
};

export type SavedScanDetailApiResponse = {
  databaseConfigured: boolean;
  record: SavedScanDetail | null;
  error?: "database_error" | "not_found";
};

export type WorkspaceProject = {
  name: string;
  path: string;
  hasPackageJson: boolean;
};

export type WorkspaceProjectsApiResponse = {
  workspaceRoot: string;
  projects: WorkspaceProject[];
};
