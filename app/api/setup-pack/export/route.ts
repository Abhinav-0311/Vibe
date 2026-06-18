import AdmZip from "adm-zip";
import { NextResponse } from "next/server";
import type { SetupPack } from "@/lib/setup-pack/types";

export const dynamic = "force-dynamic";

const maxArtifacts = 10;
const maxArtifactBytes = 100 * 1024;
const safeArtifactPath = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md$/;

function safeFileName(value: string) {
  const normalized = value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function isValidPack(value: unknown): value is SetupPack {
  if (!value || typeof value !== "object") return false;
  const pack = value as Partial<SetupPack>;

  return Boolean(
    pack.version === 1 &&
      typeof pack.projectName === "string" &&
      pack.projectName.length <= 200 &&
      Array.isArray(pack.artifacts) &&
      pack.artifacts.length > 0 &&
      pack.artifacts.length <= maxArtifacts &&
      pack.artifacts.every(
        (artifact) =>
          artifact &&
          typeof artifact.path === "string" &&
          safeArtifactPath.test(artifact.path) &&
          !artifact.path.includes("..") &&
          typeof artifact.content === "string" &&
          Buffer.byteLength(artifact.content, "utf8") <= maxArtifactBytes,
      ),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { setupPack?: unknown };
    if (!isValidPack(body.setupPack)) {
      return NextResponse.json({ error: "The setup pack is missing or invalid." }, { status: 400 });
    }

    const zip = new AdmZip();
    for (const artifact of body.setupPack.artifacts) {
      zip.addFile(artifact.path, Buffer.from(artifact.content, "utf8"));
    }

    const archive = zip.toBuffer();
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFileName(body.setupPack.projectName)}-ai-workspace.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "The setup pack could not be exported." }, { status: 400 });
  }
}
