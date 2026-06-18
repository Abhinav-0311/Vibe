export const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isValidGitHubBranch(value: string) {
  const segments = value.split("/");
  return Boolean(
    value &&
      value.length <= 200 &&
      value !== "@" &&
      !value.startsWith("-") &&
      !value.startsWith("/") &&
      !value.endsWith("/") &&
      !value.endsWith(".") &&
      !value.endsWith(".lock") &&
      !value.includes("..") &&
      !value.includes("//") &&
      !value.includes("@{") &&
      !/[\s~^:?*\[\\]/.test(value) &&
      /^[A-Za-z0-9._/-]+$/.test(value) &&
      segments.every((segment) => segment && !segment.startsWith(".") && !segment.endsWith(".lock")),
  );
}
