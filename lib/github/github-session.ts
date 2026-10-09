import { cookies } from "next/headers";
import { decryptGitHubToken, githubTokenCookie } from "@/lib/github/github-oauth";
import { getAuthenticatedUser } from "@/lib/auth";

export async function getGitHubAccessToken() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return null;
  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get(githubTokenCookie)?.value;
  return encryptedToken ? decryptGitHubToken(encryptedToken, authenticatedUser.id) : null;
}
