type DeletionActions = {
  requestDeletion: () => Promise<{ ok: boolean }>;
  onDeleted: () => void;
  clearBrowserData: () => void;
  signOut: () => Promise<unknown>;
};

/** Keep a completed deletion distinct from local cleanup or sign-out failures. */
export async function completeAccountDeletion(actions: DeletionActions) {
  try {
    const response = await actions.requestDeletion();
    if (!response.ok) throw new Error("Deletion failed.");
  } catch {
    // A lost response can leave the server outcome unknown: do not claim that
    // nothing was deleted, and do not erase local data on an unconfirmed result.
    return { deleted: false, warning: "Account deletion could not be confirmed. Refresh the page before retrying." };
  }

  actions.onDeleted();
  let warning: string | null = null;
  try {
    actions.clearBrowserData();
  } catch {
    warning = "Your account was deleted, but browser data could not be fully cleared. Clear this site's browser data.";
  }
  // Keep a local-cleanup warning visible instead of redirecting past it.
  if (warning) return { deleted: true, warning };
  try {
    await actions.signOut();
  } catch {
    warning = "Your account was deleted and browser data cleared, but sign-out failed. Use Sign out to retry.";
  }
  return { deleted: true, warning };
}
