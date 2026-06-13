export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export type DetectedFile = {
  path: string;
  exists: boolean;
};

export type DependencySignal = {
  name: string;
  version: string;
  kind: "dependency" | "devDependency";
};

export type ScannerFacts = {
  projectRoot: string;
  packageManager: PackageManager;
  framework: {
    name: string;
    confidence: "high" | "medium" | "low";
  };
  scripts: Record<string, string>;
  dependencies: DependencySignal[];
  detectedFiles: DetectedFile[];
  signals: {
    hasPackageJson: boolean;
    hasNextConfig: boolean;
    hasAppRouter: boolean;
    hasPagesRouter: boolean;
    hasEnvExample: boolean;
    hasTests: boolean;
    hasMiddleware: boolean;
    hasAuthDependency: boolean;
    hasStripeDependency: boolean;
    hasAnalyticsPlan: boolean;
    hasAnalyticsDependency: boolean;
    hasObservabilityPlan: boolean;
    hasErrorTrackingDependency: boolean;
    hasAiRules: boolean;
  };
};
