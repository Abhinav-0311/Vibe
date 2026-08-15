import { afterEach, describe, expect, it } from "vitest";
import { decryptGitHubToken, encryptGitHubToken } from "@/lib/github/github-oauth";

const originalKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  else process.env.GITHUB_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("GitHub token encryption", () => {
  it("round-trips a token without storing plaintext", () => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "test-key-with-at-least-thirty-two-characters";
    const encrypted = encryptGitHubToken("github-secret-token");

    expect(encrypted).not.toContain("github-secret-token");
    expect(decryptGitHubToken(encrypted)).toBe("github-secret-token");
  });

  it("binds a GitHub connection to the beta user who authorized it", () => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "test-key-with-at-least-thirty-two-characters";
    const encrypted = encryptGitHubToken("github-secret-token", "beta-user-a");

    expect(decryptGitHubToken(encrypted, "beta-user-a")).toBe("github-secret-token");
    expect(decryptGitHubToken(encrypted, "beta-user-b")).toBeNull();
  });

  it("rejects a modified encrypted token", () => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "test-key-with-at-least-thirty-two-characters";
    const encrypted = encryptGitHubToken("github-secret-token");
    const [iv, tag, ciphertext] = encrypted.split(".");
    const modifiedCiphertext = Buffer.from(ciphertext, "base64url");
    modifiedCiphertext[0] ^= 1;
    const modified = [iv, tag, modifiedCiphertext.toString("base64url")].join(".");

    expect(decryptGitHubToken(modified)).toBeNull();
  });
});
