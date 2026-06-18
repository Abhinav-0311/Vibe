import { existsSync } from "node:fs";
import path from "node:path";

export const allowedWorkspaceRoot = path.resolve(process.cwd(), "..");

export type ProjectPathResult =
  | {
      projectPath: string;
    }
  | {
      error: string;
    };

export function resolveWorkspaceProjectPath(value: string | null): ProjectPathResult {
  const requestedPath = value?.trim() || process.cwd();
  const resolvedPath = path.resolve(requestedPath);
  const relativePath = path.relative(allowedWorkspaceRoot, resolvedPath);
  const isInsideWorkspace =
    relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

  if (!isInsideWorkspace) {
    return {
      error: `Project path must stay inside the configured workspace: ${allowedWorkspaceRoot}.`,
    };
  }

  if (!existsSync(resolvedPath)) {
    return {
      error: "Project path does not exist.",
    };
  }

  return {
    projectPath: resolvedPath,
  };
}
