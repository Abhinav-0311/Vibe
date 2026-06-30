import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalWorkspaceScanEnabled, resolveWorkspaceProjectPath } from "@/lib/workspace-paths";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("workspace project paths", () => {
  it("accepts the current Node.js project", () => {
    expect(resolveWorkspaceProjectPath(process.cwd())).toEqual({
      projectPath: path.resolve(process.cwd()),
    });
  });

  it("rejects a workspace folder that is not a Node.js project root", () => {
    expect(resolveWorkspaceProjectPath(path.resolve(process.cwd(), ".."))).toEqual({
      error: "Select a Node.js project folder containing package.json. Other stacks are not supported yet.",
    });
  });

  it("disables local workspace scanning by default on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VIBE_ENABLE_LOCAL_SCAN", "");

    expect(isLocalWorkspaceScanEnabled()).toBe(false);
    expect(resolveWorkspaceProjectPath(process.cwd())).toEqual({
      error: "Local workspace scanning is disabled in this deployment. Use GitHub scanning or ZIP upload instead.",
    });
  });

  it("allows an explicit self-hosted override for local workspace scanning", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VIBE_ENABLE_LOCAL_SCAN", "true");

    expect(isLocalWorkspaceScanEnabled()).toBe(true);
    expect(resolveWorkspaceProjectPath(process.cwd())).toEqual({
      projectPath: path.resolve(process.cwd()),
    });
  });
});
