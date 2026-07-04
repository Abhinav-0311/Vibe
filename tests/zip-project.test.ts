import AdmZip from "adm-zip";
import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractProjectZipBuffer } from "@/lib/upload/zip-project";

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

  it("rejects archives without a package manifest", async () => {
    const zip = new AdmZip();
    zip.addFile("README.md", Buffer.from("No project here"));

    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow(
      "This repository does not contain package.json. Vibe currently supports Node.js projects only.",
    );
  });
});
