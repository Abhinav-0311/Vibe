import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChecklistResult } from "@/lib/checklist/types";
import type { GeneratedReport } from "@/lib/report/types";
import { enhanceReportWithOpenAI } from "@/lib/report/openai-report-enhancer";
import type { ScannerFacts } from "@/lib/scanner/types";

const originalEnvironment = {
  enabled: process.env.OPENAI_REPORT_ENABLED,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_REPORT_MODEL,
};

afterEach(() => {
  vi.restoreAllMocks();
  if (originalEnvironment.enabled === undefined) delete process.env.OPENAI_REPORT_ENABLED;
  else process.env.OPENAI_REPORT_ENABLED = originalEnvironment.enabled;
  if (originalEnvironment.apiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalEnvironment.apiKey;
  if (originalEnvironment.model === undefined) delete process.env.OPENAI_REPORT_MODEL;
  else process.env.OPENAI_REPORT_MODEL = originalEnvironment.model;
});

const facts = {
  projectRoot: "E:\\private\\workspace\\Vibe",
  packageManager: "npm",
  framework: { name: "Next.js", confidence: "high" },
  scripts: { build: "next build --secret inline-value", test: "vitest run" },
  dependencies: [{ name: "next", version: "15.5.19", kind: "dependency" }],
  detectedFiles: [],
  apiRoutes: [{ route: "/api/login", file: "app/api/login/route.ts", signals: ["auth"] }],
  signals: {
    hasPackageJson: true,
    hasNextConfig: true,
    hasAppRouter: true,
  },
} as ScannerFacts;

const checklist: ChecklistResult = {
  score: 64,
  context: {
    appType: "saas",
    stage: "launch-prep",
    hasPayments: false,
    hasUserAccounts: true,
    storesUserData: true,
  },
  findings: [
    {
      id: "auth-rate-limit",
      title: "Auth route has no rate limiting",
      category: "Security",
      severity: "critical",
      status: "open",
      evidence: "Found app/api/login/route.ts without limiter evidence.",
      impact: "Repeated attempts are not throttled.",
      fix: "Add rate limiting.",
      prompt: "Add a tested rate limiter to the login route.",
    },
  ],
  summary: { critical: 1, high: 0, medium: 0, low: 0 },
};

const report: GeneratedReport = {
  generatedAt: "2026-06-18T00:00:00.000Z",
  readinessLabel: "Launch blocked",
  executiveSummary: "The deterministic summary explains the readiness evidence.",
  interpretation: "Resolve the critical finding before launch.",
  topRisks: [],
  nextActions: ["Add rate limiting."],
  promptQueueSummary: "One prompt queued.",
  generation: { mode: "deterministic" },
};

function enableOpenAI() {
  process.env.OPENAI_REPORT_ENABLED = "true";
  process.env.OPENAI_API_KEY = "sk-test-only";
  process.env.OPENAI_REPORT_MODEL = "gpt-test-model";
}

describe("enhanceReportWithOpenAI", () => {
  it("merges validated narrative and prompts without changing deterministic findings", async () => {
    enableOpenAI();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    executiveSummary:
                      "This launch-prep SaaS has one evidence-backed critical security blocker in its login flow.",
                    interpretation:
                      "Keep the current score and resolve the detected login throttling gap before onboarding users.",
                    findingPrompts: [
                      {
                        id: "auth-rate-limit",
                        implementationPrompt:
                          "Inspect app/api/login/route.ts and add a tested rate limiter using existing project patterns. Cover repeated failures and recovery behavior.",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
          usage: { input_tokens: 400, output_tokens: 120 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await enhanceReportWithOpenAI({ projectName: "Vibe", facts, checklist, report }, fetchMock);

    expect(result.report.generation).toMatchObject({
      mode: "openai",
      model: "gpt-test-model",
      usage: { inputTokens: 400, outputTokens: 120 },
    });
    expect(result.checklist.score).toBe(64);
    expect(result.checklist.findings[0]).toMatchObject({
      id: "auth-rate-limit",
      severity: "critical",
      evidence: checklist.findings[0].evidence,
    });
    expect(result.checklist.findings[0].prompt).toContain("tested rate limiter");

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      store: boolean;
      input: string;
      text: { format: { type: string; strict: boolean } };
    };
    expect(request.store).toBe(false);
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.input).not.toContain(facts.projectRoot);
    expect(request.input).not.toContain("inline-value");
  });

  it("rejects outputs that do not preserve the exact finding IDs", async () => {
    enableOpenAI();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    executiveSummary: "A sufficiently long but invalid model-generated summary for this report.",
                    interpretation: "A sufficiently long interpretation that must still be rejected.",
                    findingPrompts: [{ id: "invented-finding", implementationPrompt: "This prompt is long enough but belongs to an invented finding ID." }],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await enhanceReportWithOpenAI({ projectName: "Vibe", facts, checklist, report }, fetchMock);

    expect(result.report.generation).toMatchObject({ mode: "deterministic", fallbackReason: "invalid_output" });
    expect(result.checklist).toEqual(checklist);
  });

  it("does not call OpenAI when enhancement is disabled", async () => {
    process.env.OPENAI_REPORT_ENABLED = "false";
    process.env.OPENAI_API_KEY = "sk-test-only";
    const fetchMock = vi.fn();

    const result = await enhanceReportWithOpenAI({ projectName: "Vibe", facts, checklist, report }, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.report.generation).toEqual({ mode: "deterministic", fallbackReason: "disabled" });
  });

  it("preserves the deterministic report when the API rejects the request", async () => {
    enableOpenAI();
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));

    const result = await enhanceReportWithOpenAI({ projectName: "Vibe", facts, checklist, report }, fetchMock);

    expect(result.report.generation).toMatchObject({
      mode: "deterministic",
      fallbackReason: "api_error",
      model: "gpt-test-model",
    });
    expect(result.report.executiveSummary).toBe(report.executiveSummary);
  });

  it("treats the documented placeholder as a missing key", async () => {
    process.env.OPENAI_REPORT_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-placeholder";
    const fetchMock = vi.fn();

    const result = await enhanceReportWithOpenAI({ projectName: "Vibe", facts, checklist, report }, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.report.generation).toEqual({ mode: "deterministic", fallbackReason: "missing_api_key" });
  });
});
