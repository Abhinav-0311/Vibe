import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";

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
});
