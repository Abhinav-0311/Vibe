import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { WorkspaceProject, WorkspaceProjectsApiResponse } from "@/lib/scan-api";
import { allowedWorkspaceRoot } from "@/lib/workspace-paths";

export const dynamic = "force-dynamic";

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const entries = await fs.readdir(allowedWorkspaceRoot, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<WorkspaceProject> => {
        const projectPath = path.join(allowedWorkspaceRoot, entry.name);

        return {
          name: entry.name,
          path: projectPath,
          hasPackageJson: await pathExists(path.join(projectPath, "package.json")),
        };
      }),
  );

  const response: WorkspaceProjectsApiResponse = {
    workspaceRoot: allowedWorkspaceRoot,
    projects: projects
      .filter((project) => project.hasPackageJson)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };

  return NextResponse.json(response);
}
