import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const maxUploadBytes = 25 * 1024 * 1024;
const maxExtractedBytes = 100 * 1024 * 1024;
const maxArchiveEntries = 20_000;

export type UploadedProject = {
  projectRoot: string;
  relativeProjectRoot: string;
  cleanup: () => Promise<void>;
};

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const ignoredProjectRootDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
]);

const preferredProjectRootNames = [
  "app",
  "apps",
  "client",
  "frontend",
  "front-end",
  "site",
  "web",
  "website",
  "ui",
  "server",
  "backend",
];

type PackageRootCandidate = {
  path: string;
  relativePath: string;
  depth: number;
  preference: number;
};

function scorePackageRootCandidate(candidate: PackageRootCandidate) {
  return candidate.depth * 100 + candidate.preference;
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).filter(Boolean).join("/");
}

async function findPackageRoot(root: string): Promise<PackageRootCandidate | null> {
  const candidates: PackageRootCandidate[] = [];

  async function visit(directoryPath: string, depth: number) {
    if (depth > 6) return;

    if (await pathExists(path.join(directoryPath, "package.json"))) {
      const relativePath = path.relative(root, directoryPath);
      const segments = relativePath.split(path.sep).filter(Boolean);
      const name = segments.at(-1)?.toLowerCase() ?? "";
      const preference = preferredProjectRootNames.includes(name)
        ? preferredProjectRootNames.indexOf(name)
        : preferredProjectRootNames.length;
      candidates.push({
        path: directoryPath,
        relativePath: normalizeRelativePath(relativePath),
        depth,
        preference,
      });
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !ignoredProjectRootDirectories.has(entry.name.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const directory of directories) {
      await visit(path.join(directoryPath, directory.name), depth + 1);
    }
  }

  await visit(root, 0);

  candidates.sort((left, right) => {
    const scoreDelta = scorePackageRootCandidate(left) - scorePackageRootCandidate(right);
    if (scoreDelta !== 0) return scoreDelta;
    return left.relativePath.localeCompare(right.relativePath);
  });

  return candidates[0] ?? null;
}

async function extractZipBuffer(buffer: Buffer): Promise<UploadedProject> {
  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("Upload must be 25MB or smaller.");
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-upload-"));
  const zipPath = path.join(tempRoot, "project.zip");
  const extractRoot = path.join(tempRoot, "project");
  await fs.mkdir(extractRoot, { recursive: true });
  try {
    await fs.writeFile(zipPath, buffer);

    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    if (entries.length > maxArchiveEntries) {
      throw new Error(`Archive contains more than ${maxArchiveEntries.toLocaleString()} entries.`);
    }

    let extractedBytes = 0;
    for (const entry of entries) {
      extractedBytes += entry.header.size;
      if (extractedBytes > maxExtractedBytes) {
        throw new Error("Archive expands beyond Vibe's 100 MB extraction limit.");
      }

      const targetPath = path.resolve(extractRoot, entry.entryName);
      const relativePath = path.relative(extractRoot, targetPath);
      const isInsideExtractRoot =
        relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

      if (!isInsideExtractRoot) {
        throw new Error("Archive contains unsafe file paths.");
      }
    }

    zip.extractAllTo(extractRoot, true);
    const packageRoot = await findPackageRoot(extractRoot);

    if (!packageRoot) {
      throw new Error(
        "This repository does not contain package.json. Vibe currently supports Node.js projects only.",
      );
    }

    return {
      projectRoot: packageRoot.path,
      relativeProjectRoot: packageRoot.relativePath,
      cleanup: () => fs.rm(tempRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function extractUploadedProject(file: File): Promise<UploadedProject> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Upload must be a .zip archive.");
  }

  return extractZipBuffer(Buffer.from(await file.arrayBuffer()));
}

export async function extractProjectZipBuffer(buffer: Buffer): Promise<UploadedProject> {
  return extractZipBuffer(buffer);
}
