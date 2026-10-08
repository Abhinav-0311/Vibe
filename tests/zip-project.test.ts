import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import { access } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { extractProjectZipBuffer, extractUploadedProject, selectProjectRoot, UploadValidationError } from "@/lib/upload/zip-project";

async function exists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

describe("ZIP project extraction", () => {
  it("extracts a package root and removes it through the cleanup contract", async () => {
    const zip = new AdmZip();
    zip.addFile("sample/package.json", Buffer.from('{"name":"sample"}'));
    zip.addFile("sample/app/page.tsx", Buffer.from("export default function Page() { return null; }"));

    const project = await extractProjectZipBuffer(zip.toBuffer());
    expect(await exists(project.projectRoot)).toBe(true);
    expect(project.relativeProjectRoot).toBe("sample");

    await project.cleanup();
    expect(await exists(project.projectRoot)).toBe(false);
  });

  it("detects a Node app nested below the repository wrapper", async () => {
    const zip = new AdmZip();
    zip.addFile("repo-main/docs/README.md", Buffer.from("Documentation"));
    zip.addFile("repo-main/client/package.json", Buffer.from('{"name":"client"}'));
    zip.addFile("repo-main/client/app/page.tsx", Buffer.from("export default function Page() { return null; }"));

    const project = await extractProjectZipBuffer(zip.toBuffer());
    expect(project.relativeProjectRoot).toBe("repo-main/client");

    await project.cleanup();
  });

  it("prefers a common app folder when multiple nested package manifests exist at the same depth", async () => {
    const zip = new AdmZip();
    zip.addFile("repo-main/examples/package.json", Buffer.from('{"name":"example"}'));
    zip.addFile("repo-main/frontend/package.json", Buffer.from('{"name":"frontend"}'));

    const project = await extractProjectZipBuffer(zip.toBuffer());
    expect(project.relativeProjectRoot).toBe("repo-main/frontend");

    await project.cleanup();
  });

  it("selects an explicit monorepo app path without leaving the extracted repository", async () => {
    const zip = new AdmZip();
    zip.addFile("repo-main/package.json", Buffer.from('{"name":"workspace"}'));
    zip.addFile("repo-main/apps/web/package.json", Buffer.from('{"name":"web"}'));
    zip.addFile("repo-main/apps/web/app/page.tsx", Buffer.from("export default function Page() { return null; }"));

    const project = await extractProjectZipBuffer(zip.toBuffer());
    const selected = await selectProjectRoot(project, "apps/web");
    expect(selected.relativeProjectRoot).toBe("repo-main/apps/web");
    expect(selected.projectRoot).not.toBe(project.projectRoot);

    await expect(selectProjectRoot(project, "../outside")).rejects.toThrow("Project path must stay inside the repository.");
    await expect(selectProjectRoot(project, "apps/missing")).rejects.toThrow('Project path "apps/missing" must contain a package.json file.');

    await project.cleanup();
  });

  it("rejects archives without a package manifest", async () => {
    const zip = new AdmZip();
    zip.addFile("README.md", Buffer.from("No project here"));

    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow(
      "No supported Node.js app was found. Vibe currently scans projects with a package.json file.",
    );
  });

  it("describes likely unsupported stacks when no package manifest exists", async () => {
    const zip = new AdmZip();
    zip.addFile("api/requirements.txt", Buffer.from("fastapi"));
    zip.addFile("api/main.py", Buffer.from("print('hello')"));
    zip.addFile("public/index.html", Buffer.from("<main>Hello</main>"));

    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow(
      "No supported Node.js app was found. Detected possible Python, static HTML files. Vibe currently scans projects with a package.json file.",
    );
  });

  it("rejects highly compressed archive entries before extraction", async () => {
    const zip = new AdmZip();
    zip.addFile("sample/package.json", Buffer.from('{"name":"sample"}'));
    zip.addFile("sample/repeated.txt", Buffer.alloc(2 * 1024 * 1024));

    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow(
      "Archive exceeds Vibe's safe compression limit.",
    );
  });

  it("rejects oversized uploads before parsing or extraction", async () => {
    await expect(extractProjectZipBuffer(Buffer.alloc(25 * 1024 * 1024 + 1))).rejects.toThrow("Upload must be 25MB or smaller.");
  });

  it("rejects an upload with a non-ZIP filename", async () => {
    await expect(extractUploadedProject(new File(["not a ZIP"], "project.txt"))).rejects.toThrow("Upload must be a .zip archive.");
  });

  it("classifies corrupt ZIP contents as a user validation error", async () => {
    await expect(extractProjectZipBuffer(Buffer.from("not a ZIP"))).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects a truncated central directory and cleans up its temporary directory", async () => {
    const zip = new AdmZip();
    zip.addFile("package.json", Buffer.from('{"name":"sample"}'));
    const buffer = zip.toBuffer();
    const endHeader = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    buffer.writeUInt32LE(buffer.length - 1, endHeader + 16);
    const remove = vi.spyOn(fs, "rm");
    try {
      await expect(extractProjectZipBuffer(buffer)).rejects.toBeInstanceOf(UploadValidationError);
      expect(remove).toHaveBeenCalledWith(expect.any(String), { recursive: true, force: true });
      expect(await exists(String(remove.mock.calls[0][0]))).toBe(false);
    } finally {
      remove.mockRestore();
    }
  });

  it("classifies checksum failures during extraction as a user validation error", async () => {
    const zip = new AdmZip();
    zip.addFile("package.json", Buffer.from('{"name":"sample"}'));
    const buffer = zip.toBuffer();
    // Change the local checksum, leaving the compressed payload readable.
    buffer.writeUInt32LE((buffer.readUInt32LE(14) ^ 1) >>> 0, 14);
    await expect(extractProjectZipBuffer(buffer)).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("preserves filesystem failures as server errors", async () => {
    const failure = Object.assign(new Error("Storage unavailable"), { code: "ENOSPC" });
    const mkdir = vi.spyOn(fs, "mkdir").mockRejectedValueOnce(failure);
    const temp = vi.spyOn(fs, "mkdtemp");
    try {
      await expect(extractProjectZipBuffer(Buffer.from("not a ZIP"))).rejects.toBe(failure);
    } finally {
      mkdir.mockRestore();
      const tempRoot = await temp.mock.results[0].value;
      temp.mockRestore();
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it.each(["../escape.txt", "..\\escape.txt", "/escape.txt"])("rejects unsafe archive path %s", async (entryName) => {
    const zip = new AdmZip();
    zip.addFile("sample/package.json", Buffer.from('{"name":"sample"}'));
    zip.addFile("hostile.txt", Buffer.from("Harmless test content"));
    // Rename after creation: addFile otherwise normalizes away hostile paths.
    zip.getEntry("hostile.txt")!.entryName = entryName;
    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow("Archive contains unsafe file paths.");
  });

  it("rejects an oversized declared entry without inflating its contents", async () => {
    const zip = new AdmZip();
    zip.addFile("package.json", Buffer.from('{"name":"sample"}'));
    const buffer = zip.toBuffer();
    const header = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(header).toBeGreaterThanOrEqual(0);
    buffer.writeUInt32LE(20 * 1024 * 1024 + 1, header + 24);
    await expect(extractProjectZipBuffer(buffer)).rejects.toThrow("20 MB per-file limit");
  });

  it("rejects excessive total declared size without extracting large files", async () => {
    const zip = new AdmZip();
    for (let index = 0; index < 6; index++) zip.addFile(`file-${index}.txt`, Buffer.from("Small fixture"));
    const buffer = zip.toBuffer();
    const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    let header = buffer.indexOf(signature);
    let patched = 0;
    while (header !== -1) {
      buffer.writeUInt32LE(1024 * 1024, header + 20);
      buffer.writeUInt32LE(20 * 1024 * 1024, header + 24);
      patched++;
      header = buffer.indexOf(signature, header + 46);
    }
    expect(patched).toBe(6);
    await expect(extractProjectZipBuffer(buffer)).rejects.toThrow("100 MB extraction limit");
  });
});
