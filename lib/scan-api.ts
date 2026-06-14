import type { ChecklistResult } from "@/lib/checklist/types";
import type { SavedScanDetail, SavedScanRecord, ScanPersistenceResult } from "@/lib/db/scan-records";
import type { GeneratedReport } from "@/lib/report/types";
import type { ScannerFacts } from "@/lib/scanner/types";

export type ScanApiResponse = {
  scannedProject: string;
  scanSource?: {
    type: "local" | "upload" | "github";
    label: string;
    detail?: string;
  };
  scannedAt: string;
  facts: ScannerFacts;
  checklist: ChecklistResult;
  report: GeneratedReport;
  persistence?: ScanPersistenceResult;
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
