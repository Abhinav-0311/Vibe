import { NextResponse } from "next/server";
import { githubErrorPayload, githubFetch } from "@/lib/github/github-api";
import { getGitHubAccessToken } from "@/lib/github/github-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getGitHubAccessToken();
  if (!token) return NextResponse.json({ error: "Connect GitHub to list repositories." }, { status: 401 });

  try {
    const response = await githubFetch(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      { token },
    );
    const repositories = (await response.json()) as Array<{
      full_name: string;
      html_url: string;
      private: boolean;
      default_branch: string;
      archived: boolean;
    }>;

    return NextResponse.json({
      repositories: repositories.map((repository) => ({
        fullName: repository.full_name,
        url: repository.html_url,
        private: repository.private,
        defaultBranch: repository.default_branch,
        archived: repository.archived,
      })),
    });
  } catch (error) {
    const payload = githubErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  }
}
