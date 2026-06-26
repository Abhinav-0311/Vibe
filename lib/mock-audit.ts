export type Severity = "critical" | "high" | "medium" | "low";

export type AuditFinding = {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  status: "open" | "planned" | "ignored";
  evidence: string;
  severityReason?: string;
  impact: string;
  fix: string;
  verification?: string[];
  prompt: string;
};

export type AuditReport = {
  projectName: string;
  stack: string;
  appScore: number;
  aiWorkspaceScore: number;
  scannedAt: string;
  summary: string;
  findings: AuditFinding[];
};

export const auditReport: AuditReport = {
  projectName: "Northstar SaaS",
  stack: "Next.js, Supabase, Stripe, Vercel",
  appScore: 46,
  aiWorkspaceScore: 18,
  scannedAt: "Today, 03:20",
  summary:
    "The app has a working product surface, but it is missing launch-critical systems around auth recovery, payment safety, rate limiting, observability, and durable AI operating context.",
  findings: [
    {
      id: "auth-rate-limit",
      title: "Auth routes have no rate limiting",
      category: "Security",
      severity: "critical",
      status: "open",
      evidence:
        "Found /app/api/login/route.ts and /app/api/signup/route.ts, but no middleware or limiter utility was detected.",
      impact:
        "Attackers can brute-force login, signup, and password recovery flows before real users ever report a problem.",
      fix: "Add IP-based and account-based throttling to auth endpoints.",
      prompt:
        "Inspect the existing Next.js auth routes at /app/api/login/route.ts and /app/api/signup/route.ts. Add IP-based and email-based rate limiting for repeated attempts. Use the existing project style, avoid changing unrelated auth behavior, and include tests for repeated failed attempts.",
    },
    {
      id: "stripe-webhook",
      title: "Stripe webhook signature verification is missing",
      category: "Payments",
      severity: "critical",
      status: "open",
      evidence:
        "Stripe is installed and a webhook route exists, but no constructEvent or signature verification signal was found.",
      impact:
        "A forged webhook could grant access, cancel accounts, or corrupt subscription state.",
      fix: "Verify Stripe webhook signatures before processing payment events.",
      prompt:
        "Review the Stripe webhook route and add signature verification using Stripe's constructEvent flow. Keep raw request body handling compatible with Next.js route handlers, reject invalid signatures, and add a test or documented manual verification path.",
    },
    {
      id: "ai-rules",
      title: "No durable AI rules file detected",
      category: "AI Workspace",
      severity: "high",
      status: "planned",
      evidence:
        "No AGENTS.md, .cursor/rules, or project-level AI operating instructions were detected in the scanned workspace.",
      impact:
        "AI coding tools will repeatedly lose product context, brand constraints, boundaries, and architectural preferences.",
      fix: "Create a rules file that defines product voice, engineering standards, safe boundaries, and current priorities.",
      prompt:
        "Create a concise AGENTS.md for this project. Include product purpose, target users, engineering standards, design constraints, security boundaries, and instructions for explaining changes before implementation. Keep it specific to this product, not generic.",
    },
    {
      id: "observability",
      title: "No error tracking detected",
      category: "Reliability",
      severity: "high",
      status: "open",
      evidence:
        "No Sentry, Highlight, Logtail, or equivalent error monitoring dependency was found in package.json.",
      impact:
        "Production failures can happen silently, especially in auth and payment flows.",
      fix: "Add error tracking and capture failures in critical server routes.",
      prompt:
        "Add production error tracking to this Next.js app. Instrument server route failures, client rendering errors, and payment webhook errors. Keep the setup minimal and include environment variable documentation in .env.example.",
    },
    {
      id: "legal-pages",
      title: "Privacy and terms pages are missing",
      category: "Launch Basics",
      severity: "medium",
      status: "open",
      evidence:
        "No /privacy or /terms route was detected, while the questionnaire says the app stores user data.",
      impact:
        "The product is not ready for public signup or paid users without basic policy surfaces.",
      fix: "Add basic privacy and terms routes before launch.",
      prompt:
        "Add minimal /privacy and /terms pages to this Next.js app. Use plain language placeholders, explain what user data is collected, and mark sections that require legal review before production launch.",
    },
  ],
};

export const emptyReport = {
  title: "No scan selected",
  body: "Create a project or run a scan to see launch-readiness findings here.",
};
