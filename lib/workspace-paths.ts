import { existsSync } from "node:fs";
import path from "node:path";

export const allowedWorkspaceRoot = path.resolve(process.cwd(), "..");

export function isLocalWorkspaceScanEnabled() {
  if (process.env.VIBE_ENABLE_LOCAL_SCAN === "true") return true;
  if (process.env.VIBE_ENABLE_LOCAL_SCAN === "false") return false;
  return process.env.VERCEL !== "1";
}

export type ProjectPathResult =
  | {
      projectPath: string;
    }
  | {
      error: string;
    };

export function resolveWorkspaceProjectPath(value: string | null): ProjectPathResult {
  if (!isLocalWorkspaceScanEnabled()) {
    return {
      error: "Local workspace scanning is disabled in this deployment. Use GitHub scanning or ZIP upload instead.",
    };
  }

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

  if (!existsSync(path.join(resolvedPath, "package.json"))) {
    return {
      error: "Select a Node.js project folder containing package.json. Other stacks are not supported yet.",
    };
  }

  return {
    projectPath: resolvedPath,
  };
}
