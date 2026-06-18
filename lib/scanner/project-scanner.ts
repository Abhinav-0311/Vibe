import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DependencySignal,
  DetectedApiRoute,
  DetectedFile,
  PackageManager,
  ScannerFacts,
} from "./types";

const authPackages = [
  "@clerk/nextjs",
  "next-auth",
  "@supabase/auth-helpers-nextjs",
  "@supabase/ssr",
  "lucia",
];

const analyticsPackages = ["posthog-js", "@vercel/analytics", "mixpanel-browser", "analytics"];
const errorTrackingPackages = ["@sentry/nextjs", "@highlight-run/next", "@bugsnag/js"];
const rateLimitPackages = ["@upstash/ratelimit", "rate-limiter-flexible", "express-rate-limit"];
const routeFilePattern = /^route\.(?:ts|js|mjs|cjs)$/i;
const pagesApiFilePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const ignoredRouteDirectories = new Set(["node_modules", ".next", ".git"]);
const maxRouteFiles = 500;
const maxSecuritySampleBytes = 256 * 1024;

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

async function readTextFile(targetPath: string): Promise<string | null> {
  try {
    return await fs.readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function readSecuritySample(targetPath: string): Promise<string | null> {
  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isFile() || stats.size > maxSecuritySampleBytes) return null;
    return await fs.readFile(targetPath, "utf8");
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
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".gitignore",
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

function normalizeRoutePath(value: string) {
  return value.split(path.sep).join("/");
}

function classifyRoute(route: string): DetectedApiRoute["signals"] {
  const normalized = route.toLowerCase();
  const signals: DetectedApiRoute["signals"] = [];

  if (/(?:auth|login|signin|signup|register|password|session)/.test(normalized)) signals.push("auth");
  if (/(?:login|signin|signup|register|password)/.test(normalized)) signals.push("credential-auth");
  if (/(?:forgot|recover|reset)[-_\/]?(?:password)?|password[-_\/]?(?:forgot|recover|reset)/.test(normalized)) {
    signals.push("recovery");
  }
  if (/(?:logout|signout|session)/.test(normalized)) signals.push("session");
  if (/(?:payment|checkout|billing|stripe|subscription)/.test(normalized)) signals.push("payments");
  if (/webhooks?/.test(normalized)) signals.push("webhook");
  if (/(?:health|status)/.test(normalized)) signals.push("health");

  return signals;
}

async function collectRouteFiles(root: string, matcher: RegExp) {
  if (!(await pathExists(root))) return [];

  const files: string[] = [];

  async function visit(directory: string, depth: number) {
    if (depth > 12 || files.length >= maxRouteFiles) return;

    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxRouteFiles) break;

      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory() && !ignoredRouteDirectories.has(entry.name)) {
        await visit(entryPath, depth + 1);
      } else if (entry.isFile() && matcher.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  await visit(root, 0);
  return files;
}

function createDetectedRoute(projectRoot: string, file: string, route: string): DetectedApiRoute {
  return {
    route,
    file: normalizeRoutePath(path.relative(projectRoot, file)),
    signals: classifyRoute(route),
  };
}

async function detectApiRoutes(projectRoot: string): Promise<DetectedApiRoute[]> {
  const appRoot = path.join(projectRoot, "app");
  const pagesApiRoot = path.join(projectRoot, "pages", "api");
  const [appRouteFiles, pagesApiFiles] = await Promise.all([
    collectRouteFiles(appRoot, routeFilePattern),
    collectRouteFiles(pagesApiRoot, pagesApiFilePattern),
  ]);

  const appRoutes = appRouteFiles
    .filter((file) => normalizeRoutePath(path.relative(appRoot, file)).includes("api/"))
    .map((file) => {
      const routeDirectory = path.dirname(path.relative(appRoot, file));
      return createDetectedRoute(projectRoot, file, `/${normalizeRoutePath(routeDirectory)}`);
    });
  const pagesRoutes = pagesApiFiles
    .filter((file) => !file.endsWith(".d.ts"))
    .map((file) => {
      const relativeFile = normalizeRoutePath(path.relative(pagesApiRoot, file));
      const withoutExtension = relativeFile.replace(pagesApiFilePattern, "");
      const routeSuffix = withoutExtension.endsWith("/index")
        ? withoutExtension.slice(0, -"/index".length)
        : withoutExtension;
      return createDetectedRoute(projectRoot, file, `/api/${routeSuffix}`.replace(/\/$/, ""));
    });

  return [...appRoutes, ...pagesRoutes].sort((a, b) => a.route.localeCompare(b.route));
}

function ignoresEnvironmentFiles(gitignore: string | null, environmentFiles: string[]) {
  if (!gitignore || environmentFiles.length === 0) return false;

  const patterns = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    .map((line) => line.replace(/^\//, ""));

  return environmentFiles.every((file) =>
    patterns.some((pattern) => {
      if (pattern === ".env*") return file.startsWith(".env");
      if (pattern === ".env.*") return file.startsWith(".env.");
      if (pattern === ".env*.local") return file.startsWith(".env") && file.endsWith(".local");
      return pattern === file;
    }),
  );
}

async function detectRateLimitImplementation(
  projectRoot: string,
  apiRoutes: DetectedApiRoute[],
  dependencies: DependencySignal[],
) {
  if (hasAnyDependency(dependencies, rateLimitPackages)) return true;

  const sourceFiles = [
    ...apiRoutes.map((route) => path.join(projectRoot, route.file)),
    path.join(projectRoot, "middleware.ts"),
    path.join(projectRoot, "middleware.js"),
  ];
  const samples = await Promise.all(sourceFiles.map(readSecuritySample));
  const rateLimitPattern = /(?:rate[-_ ]?limit|ratelimit|slidingWindow|fixedWindow|status\s*[:(]\s*429|too many requests)/i;

  return samples.some((sample) => sample && rateLimitPattern.test(sample));
}

async function detectWebhookSignatureVerification(projectRoot: string, apiRoutes: DetectedApiRoute[]) {
  const webhookRoutes = apiRoutes.filter((route) => route.signals.includes("webhook"));
  if (webhookRoutes.length === 0) return false;

  const samples = await Promise.all(
    webhookRoutes.map((route) => readSecuritySample(path.join(projectRoot, route.file))),
  );
  const stripeVerificationPattern = /\.webhooks\.constructEvent(?:Async)?\s*\(/;

  return samples.some((sample) => sample && stripeVerificationPattern.test(sample));
}

async function detectWildcardCors(
  projectRoot: string,
  apiRoutes: DetectedApiRoute[],
  detectedFiles: DetectedFile[],
) {
  const configFiles = detectedFiles
    .filter((file) => file.exists && file.path.startsWith("next.config"))
    .map((file) => file.path);
  const relativeFiles = Array.from(
    new Set([
      ...apiRoutes.map((route) => route.file),
      ...configFiles,
      "middleware.ts",
      "middleware.js",
    ]),
  );
  const samples = await Promise.all(
    relativeFiles.map(async (relativeFile) => ({
      relativeFile,
      sample: await readSecuritySample(path.join(projectRoot, relativeFile)),
    })),
  );
  const wildcardHeaderPattern = /Access-Control-Allow-Origin[\s\S]{0,160}(?:value\s*:\s*)?["'`]\*["'`]/i;
  const wildcardOriginOptionPattern = /\borigin\s*:\s*["'`]\*["'`]/i;

  return samples
    .filter(
      ({ sample }) =>
        sample && (wildcardHeaderPattern.test(sample) || wildcardOriginOptionPattern.test(sample)),
    )
    .map(({ relativeFile }) => normalizeRoutePath(relativeFile));
}

async function detectInsecureSessionCookies(projectRoot: string, apiRoutes: DetectedApiRoute[]) {
  const authFiles = apiRoutes
    .filter((route) => route.signals.includes("auth"))
    .map((route) => route.file);
  const relativeFiles = Array.from(new Set([...authFiles, "middleware.ts", "middleware.js"]));
  const samples = await Promise.all(
    relativeFiles.map(async (relativeFile) => ({
      relativeFile,
      sample: await readSecuritySample(path.join(projectRoot, relativeFile)),
    })),
  );
  const insecureCookiePattern = /(?:httpOnly|secure)\s*:\s*false/i;

  return samples
    .filter(({ sample }) => sample && insecureCookiePattern.test(sample))
    .map(({ relativeFile }) => normalizeRoutePath(relativeFile));
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
  const apiRoutes = await detectApiRoutes(projectRoot);
  const gitignore = await readTextFile(path.join(projectRoot, ".gitignore"));
  const localEnvFiles = [".env", ".env.local", ".env.development", ".env.production"].filter((file) =>
    detectedFiles.some((detectedFile) => detectedFile.path === file && detectedFile.exists),
  );
  const hasLocalEnvFile = localEnvFiles.length > 0;
  const hasRateLimitImplementation = await detectRateLimitImplementation(projectRoot, apiRoutes, dependencies);
  const hasWebhookSignatureVerification = await detectWebhookSignatureVerification(projectRoot, apiRoutes);
  const wildcardCorsFiles = await detectWildcardCors(projectRoot, apiRoutes, detectedFiles);
  const insecureSessionCookieFiles = await detectInsecureSessionCookies(projectRoot, apiRoutes);
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
    apiRoutes,
    securityEvidence: {
      wildcardCorsFiles,
      insecureSessionCookieFiles,
    },
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
      hasAuthRoute: apiRoutes.some((route) => route.signals.includes("auth")),
      hasCredentialAuthRoute: apiRoutes.some((route) => route.signals.includes("credential-auth")),
      hasPasswordRecoveryRoute: apiRoutes.some((route) => route.signals.includes("recovery")),
      hasSessionManagementRoute: apiRoutes.some((route) => route.signals.includes("session")),
      hasPaymentRoute: apiRoutes.some((route) => route.signals.includes("payments")),
      hasWebhookRoute: apiRoutes.some((route) => route.signals.includes("webhook")),
      hasWebhookSignatureVerification,
      hasHealthRoute: apiRoutes.some((route) => route.signals.includes("health")),
      hasLocalEnvFile,
      hasEnvGitignoreRule: ignoresEnvironmentFiles(gitignore, localEnvFiles),
      hasRateLimitImplementation,
      hasWildcardCors: wildcardCorsFiles.length > 0,
      hasInsecureSessionCookie: insecureSessionCookieFiles.length > 0,
    },
  };
}
