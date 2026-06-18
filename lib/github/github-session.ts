import { cookies } from "next/headers";
import { decryptGitHubToken, githubTokenCookie } from "@/lib/github/github-oauth";

export async function getGitHubAccessToken() {
  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get(githubTokenCookie)?.value;
  return encryptedToken ? decryptGitHubToken(encryptedToken) : null;
}
