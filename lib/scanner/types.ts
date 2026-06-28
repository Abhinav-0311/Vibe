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

export type DetectedApiRoute = {
  route: string;
  file: string;
  signals: Array<
    "auth" | "credential-auth" | "recovery" | "session" | "payments" | "webhook" | "health"
  >;
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
  apiRoutes: DetectedApiRoute[];
  securityEvidence?: {
    wildcardCorsFiles: string[];
    insecureSessionCookieFiles: string[];
  };
  deploymentEvidence?: {
    ignoredTypeScriptBuildFiles: string[];
    ignoredEslintBuildFiles: string[];
    startCommand?: string;
  };
  uiEvidence?: {
    filesScanned: string[];
    hasLoadingState: boolean;
    hasErrorState: boolean;
    hasNotFoundState: boolean;
    placeholderCopyFiles: string[];
    imageWithoutAltFiles: string[];
    unlabeledControlFiles: string[];
    responsiveClassFiles: string[];
  };
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
    hasAuthRoute: boolean;
    hasCredentialAuthRoute: boolean;
    hasPasswordRecoveryRoute: boolean;
    hasSessionManagementRoute: boolean;
    hasPaymentRoute: boolean;
    hasWebhookRoute: boolean;
    hasWebhookSignatureVerification: boolean;
    hasHealthRoute: boolean;
    hasLocalEnvFile: boolean;
    hasEnvGitignoreRule: boolean;
    hasRateLimitImplementation: boolean;
    hasWildcardCors: boolean;
    hasInsecureSessionCookie: boolean;
    hasLockfile: boolean;
    hasBuildScript: boolean;
    hasStartScript: boolean;
    hasDevelopmentStartScript: boolean;
    ignoresTypeScriptBuildErrors: boolean;
    ignoresEslintBuildErrors: boolean;
  };
};
