import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const maxUploadBytes = 25 * 1024 * 1024;

export type UploadedProject = {
  projectRoot: string;
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

async function findPackageRoot(root: string): Promise<string | null> {
  if (await pathExists(path.join(root, "package.json"))) {
    return root;
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());

  for (const directory of directories) {
    const candidate = path.join(root, directory.name);

    if (await pathExists(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }

  return null;
}

async function extractZipBuffer(buffer: Buffer): Promise<UploadedProject> {
  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("Upload must be 25MB or smaller.");
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-upload-"));
  const zipPath = path.join(tempRoot, "project.zip");
  const extractRoot = path.join(tempRoot, "project");
  await fs.mkdir(extractRoot, { recursive: true });
  await fs.writeFile(zipPath, buffer);

  const zip = new AdmZip(zipPath);

  for (const entry of zip.getEntries()) {
    const targetPath = path.resolve(extractRoot, entry.entryName);
    const relativePath = path.relative(extractRoot, targetPath);
    const isInsideExtractRoot =
      relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

    if (!isInsideExtractRoot) {
      throw new Error("Archive contains unsafe file paths.");
    }
  }

  zip.extractAllTo(extractRoot, true);
  const projectRoot = await findPackageRoot(extractRoot);

  if (!projectRoot) {
    throw new Error("No package.json was found in the uploaded archive.");
  }

  return {
    projectRoot,
    cleanup: () => fs.rm(tempRoot, { recursive: true, force: true }),
  };
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
