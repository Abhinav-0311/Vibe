import type { Severity } from "@/lib/mock-audit";

export type FixPlanItem = {
  id: string;
  order: number;
  title: string;
  category: string;
  severity: Severity;
  evidence: string;
  severityReason?: string;
  fix: string;
  verification?: string[];
  prompt: string;
};

export type FixPlan = {
  projectName: string;
  branchName: string;
  pullRequestTitle: string;
  pullRequestBody: string;
  markdown: string;
  items: FixPlanItem[];
};

export type ScanComparison = {
  baselineScore: number;
  currentScore: number;
  scoreDelta: number;
  resolved: Array<{ id: string; title: string }>;
  remaining: Array<{ id: string; title: string }>;
  introduced: Array<{ id: string; title: string }>;
};
