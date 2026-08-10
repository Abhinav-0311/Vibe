import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const maxUploadBytes = 25 * 1024 * 1024;
const maxExtractedBytes = 100 * 1024 * 1024;
const maxArchiveEntries = 20_000;
const maxArchiveEntryBytes = 20 * 1024 * 1024;
const maxCompressionRatio = 100;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

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

function normalizeArchivePath(archivePath: string) {
  return archivePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

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

function describeUnsupportedArchive(entryNames: string[]) {
  const normalizedEntries = entryNames.map(normalizeArchivePath).map((entry) => entry.toLowerCase());
  const fileNames = new Set(normalizedEntries.map((entry) => entry.split("/").at(-1) ?? entry));
  const hasExtension = (extension: string) => normalizedEntries.some((entry) => entry.endsWith(extension));
  const hasFile = (fileName: string) => fileNames.has(fileName);
  const detectedStacks: string[] = [];

  if (hasFile("requirements.txt") || hasFile("pyproject.toml") || hasFile("manage.py") || hasExtension(".py")) {
    detectedStacks.push("Python");
  }

  if (hasFile("pom.xml") || hasFile("build.gradle") || hasFile("settings.gradle") || hasExtension(".java")) {
    detectedStacks.push("Java");
  }

  if (hasFile("composer.json") || hasExtension(".php")) {
    detectedStacks.push("PHP");
  }

  if (hasFile("go.mod") || hasExtension(".go")) {
    detectedStacks.push("Go");
  }

  if (hasFile("cargo.toml") || hasExtension(".rs")) {
    detectedStacks.push("Rust");
  }

  if (hasFile("index.html") || hasExtension(".html")) {
    detectedStacks.push("static HTML");
  }

  const stackSummary = detectedStacks.length > 0
    ? ` Detected possible ${Array.from(new Set(detectedStacks)).join(", ")} files.`
    : "";

  return `No supported Node.js app was found.${stackSummary} Vibe currently scans projects with a package.json file.`;
}

async function extractZipBuffer(buffer: Buffer): Promise<UploadedProject> {
  if (buffer.byteLength > maxUploadBytes) {
    throw new UploadValidationError("Upload must be 25MB or smaller.");
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
      throw new UploadValidationError(`Archive contains more than ${maxArchiveEntries.toLocaleString()} entries.`);
    }

    let extractedBytes = 0;
    for (const entry of entries) {
      if (entry.header.size > maxArchiveEntryBytes) {
        throw new UploadValidationError("Archive contains a file larger than Vibe's 20 MB per-file limit.");
      }
      if (entry.header.size > 0 && (entry.header.compressedSize === 0 || entry.header.size / entry.header.compressedSize > maxCompressionRatio)) {
        throw new UploadValidationError("Archive exceeds Vibe's safe compression limit.");
      }
      extractedBytes += entry.header.size;
      if (extractedBytes > maxExtractedBytes) {
        throw new UploadValidationError("Archive expands beyond Vibe's 100 MB extraction limit.");
      }

      const targetPath = path.resolve(extractRoot, entry.entryName);
      const relativePath = path.relative(extractRoot, targetPath);
      const isInsideExtractRoot =
        relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

      if (!isInsideExtractRoot) {
        throw new UploadValidationError("Archive contains unsafe file paths.");
      }
    }

    zip.extractAllTo(extractRoot, true);
    const packageRoot = await findPackageRoot(extractRoot);

    if (!packageRoot) {
      throw new UploadValidationError(
        describeUnsupportedArchive(entries.map((entry) => entry.entryName)),
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
    throw new UploadValidationError("Upload must be a .zip archive.");
  }

  return extractZipBuffer(Buffer.from(await file.arrayBuffer()));
}

export async function extractProjectZipBuffer(buffer: Buffer): Promise<UploadedProject> {
  return extractZipBuffer(buffer);
}
