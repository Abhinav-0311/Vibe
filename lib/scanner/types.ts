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
  workspace?: {
    /** The selected Node.js app lives inside a larger repository. */
    isMonorepo: boolean;
    appPath: string;
    sharedEvidenceFiles: string[];
  };
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
    /** Route files with direct, static rate-limit evidence. */
    rateLimitedRouteFiles?: string[];
  };
  deploymentEvidence?: {
    ignoredTypeScriptBuildFiles: string[];
    ignoredEslintBuildFiles: string[];
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
    portfolioContactFiles: string[];
    portfolioResumeFiles: string[];
    portfolioSocialLinkFiles: string[];
    portfolioProjectDetailFiles: string[];
    /** Login or signup UI is intent evidence only; it does not prove durable authentication exists. */
    authLikeUiFiles?: string[];
    /** Multiple static client-auth signals were found; server-side security still needs verification. */
    customAuthEvidenceFiles?: string[];
  };
  signals: {
    hasPackageJson: boolean;
    hasNextConfig: boolean;
    hasAppRouter: boolean;
    hasPagesRouter: boolean;
    hasEnvExample: boolean;
    hasEnvironmentVariableUsage?: boolean;
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
