export type HealthCheckResult = {
  status: "ok" | "degraded";
  checks: {
    application: "ok";
    database: "ok" | "not_configured" | "error";
  };
};

export async function checkHealth({
  databaseConfigured,
  checkDatabase,
}: {
  databaseConfigured: boolean;
  checkDatabase: () => Promise<void>;
}): Promise<HealthCheckResult> {
  if (!databaseConfigured) {
    return {
      status: "degraded",
      checks: { application: "ok", database: "not_configured" },
    };
  }

  try {
    await checkDatabase();
    return {
      status: "ok",
      checks: { application: "ok", database: "ok" },
    };
  } catch {
    return {
      status: "degraded",
      checks: { application: "ok", database: "error" },
    };
  }
}
