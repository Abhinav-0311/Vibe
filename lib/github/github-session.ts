import { cookies } from "next/headers";
import { decryptGitHubToken, githubTokenCookie } from "@/lib/github/github-oauth";
import { getBetaUser } from "@/lib/auth";

export async function getGitHubAccessToken() {
  const betaUser = await getBetaUser();
  if (!betaUser) return null;
  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get(githubTokenCookie)?.value;
  return encryptedToken ? decryptGitHubToken(encryptedToken, betaUser.id) : null;
}
