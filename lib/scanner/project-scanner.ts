import { promises as fs } from "node:fs";
import path from "node:path";
import type { DependencySignal, DetectedFile, PackageManager, ScannerFacts } from "./types";

const authPackages = [
  "@clerk/nextjs",
  "next-auth",
  "@supabase/auth-helpers-nextjs",
  "@supabase/ssr",
  "lucia",
];

const analyticsPackages = ["posthog-js", "@vercel/analytics", "mixpanel-browser", "analytics"];
const errorTrackingPackages = ["@sentry/nextjs", "@highlight-run/next", "@bugsnag/js"];

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  try {
    const file = await fs.readFile(targetPath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    return null;
  }
}

function detectPackageManager(projectRoot: string, files: string[]): PackageManager {
  const fileSet = new Set(files);

  if (fileSet.has(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fileSet.has(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fileSet.has(path.join(projectRoot, "bun.lockb")) || fileSet.has(path.join(projectRoot, "bun.lock"))) {
    return "bun";
  }
  if (fileSet.has(path.join(projectRoot, "package-lock.json"))) return "npm";

  return "unknown";
}

function flattenDependencies(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null): DependencySignal[] {
  if (!packageJson) return [];

  const dependencies = Object.entries(packageJson.dependencies ?? {}).map(([name, version]) => ({
    name,
    version,
    kind: "dependency" as const,
  }));

  const devDependencies = Object.entries(packageJson.devDependencies ?? {}).map(([name, version]) => ({
    name,
    version,
    kind: "devDependency" as const,
  }));

  return [...dependencies, ...devDependencies].sort((a, b) => a.name.localeCompare(b.name));
}

function hasAnyDependency(dependencies: DependencySignal[], packageNames: string[]) {
  const dependencyNames = new Set(dependencies.map((dependency) => dependency.name));
  return packageNames.some((packageName) => dependencyNames.has(packageName));
}

function detectFramework(dependencies: DependencySignal[], hasNextConfig: boolean) {
  const hasNext = dependencies.some((dependency) => dependency.name === "next");

  if (hasNext && hasNextConfig) {
    return { name: "Next.js", confidence: "high" as const };
  }

  if (hasNext) {
    return { name: "Next.js", confidence: "medium" as const };
  }

  return { name: "Unknown", confidence: "low" as const };
}

async function detectFiles(projectRoot: string): Promise<DetectedFile[]> {
  const relativePaths = [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "app",
    "pages",
    "middleware.ts",
    "middleware.js",
    ".env.example",
    "AGENTS.md",
    ".cursor/rules",
    ".cursorrules",
    "lib/analytics/events.ts",
    "lib/observability/plan.ts",
  ];

  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      exists: await pathExists(path.join(projectRoot, relativePath)),
    })),
  );
}

async function detectTests(projectRoot: string) {
  const likelyTestPaths = [
    "__tests__",
    "tests",
    "test",
    "app.test.ts",
    "app.test.tsx",
    "vitest.config.ts",
    "jest.config.ts",
    "playwright.config.ts",
  ];

  const results = await Promise.all(likelyTestPaths.map((testPath) => pathExists(path.join(projectRoot, testPath))));
  return results.some(Boolean);
}

export async function scanProject(projectRoot: string): Promise<ScannerFacts> {
  const detectedFiles = await detectFiles(projectRoot);
  const absoluteDetectedFiles = detectedFiles
    .filter((file) => file.exists)
    .map((file) => path.join(projectRoot, file.path));
  const packageJson = await readJsonFile<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(path.join(projectRoot, "package.json"));

  const dependencies = flattenDependencies(packageJson);
  const hasNextConfig = detectedFiles.some((file) => file.exists && file.path.startsWith("next.config"));
  const hasAppRouter = detectedFiles.some((file) => file.path === "app" && file.exists);
  const hasPagesRouter = detectedFiles.some((file) => file.path === "pages" && file.exists);
  const hasMiddleware = detectedFiles.some(
    (file) => file.exists && (file.path === "middleware.ts" || file.path === "middleware.js"),
  );
  const hasAiRules = detectedFiles.some(
    (file) => file.exists && ["AGENTS.md", ".cursor/rules", ".cursorrules"].includes(file.path),
  );

  return {
    projectRoot,
    packageManager: detectPackageManager(projectRoot, absoluteDetectedFiles),
    framework: detectFramework(dependencies, hasNextConfig),
    scripts: packageJson?.scripts ?? {},
    dependencies,
    detectedFiles,
    signals: {
      hasPackageJson: detectedFiles.some((file) => file.path === "package.json" && file.exists),
      hasNextConfig,
      hasAppRouter,
      hasPagesRouter,
      hasEnvExample: detectedFiles.some((file) => file.path === ".env.example" && file.exists),
      hasTests: await detectTests(projectRoot),
      hasMiddleware,
      hasAuthDependency: hasAnyDependency(dependencies, authPackages),
      hasStripeDependency: hasAnyDependency(dependencies, ["stripe", "@stripe/stripe-js"]),
      hasAnalyticsPlan: detectedFiles.some((file) => file.path === "lib/analytics/events.ts" && file.exists),
      hasAnalyticsDependency: hasAnyDependency(dependencies, analyticsPackages),
      hasObservabilityPlan: detectedFiles.some((file) => file.path === "lib/observability/plan.ts" && file.exists),
      hasErrorTrackingDependency: hasAnyDependency(dependencies, errorTrackingPackages),
      hasAiRules,
    },
  };
}
