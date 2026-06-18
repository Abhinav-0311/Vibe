import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/setup-pack/export/route";

describe("setup pack export", () => {
  it("returns a ZIP with the requested safe artifact paths", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup-pack/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupPack: {
            version: 1,
            projectName: "Vibe",
            summary: "Test pack",
            artifacts: [
              {
                id: "rules",
                path: "AGENTS.md",
                title: "Rules",
                description: "Rules",
                kind: "rules",
                content: "# Rules",
              },
              {
                id: "memory",
                path: "memory/product.md",
                title: "Memory",
                description: "Memory",
                kind: "memory",
                content: "# Product",
              },
            ],
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()));
    expect(zip.getEntries().map((entry) => entry.entryName)).toEqual(["AGENTS.md", "memory/product.md"]);
  });

  it("rejects path traversal attempts", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup-pack/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupPack: {
            version: 1,
            projectName: "Vibe",
            artifacts: [{ path: "../secret.md", content: "unsafe" }],
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
