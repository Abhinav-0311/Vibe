import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const githubTokenCookie = "vibe_github_token";
export const githubOauthStateCookie = "vibe_github_oauth_state";
export const githubOauthVerifierCookie = "vibe_github_oauth_verifier";

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function encryptionKey() {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

export function githubOAuthConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

export function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl || !githubOAuthConfigured()) {
    throw new Error("GitHub OAuth is not configured on this server.");
  }

  return {
    clientId,
    clientSecret,
    callbackUrl: `${appUrl.replace(/\/$/, "")}/api/github/oauth/callback`,
  };
}

export function createOAuthChallenge() {
  const state = base64Url(randomBytes(24));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { state, verifier, challenge };
}

export function encryptGitHubToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [base64Url(iv), base64Url(tag), base64Url(encrypted)].join(".");
}

export function decryptGitHubToken(value: string) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
