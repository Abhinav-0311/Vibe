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

    await project.cleanup();
    expect(await exists(project.projectRoot)).toBe(false);
  });

  it("rejects archives without a package manifest", async () => {
    const zip = new AdmZip();
    zip.addFile("README.md", Buffer.from("No project here"));

    await expect(extractProjectZipBuffer(zip.toBuffer())).rejects.toThrow(
      "This repository does not contain package.json. Vibe currently supports Node.js projects only.",
    );
  });
});
