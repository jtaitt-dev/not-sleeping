const PROFILE_USERNAME_SELECTORS = [
  ".nav-profile-item .profile-wrapper .name-container .name",
  ".nav-profile-item .name-container .name",
  ".nav-profile-item .name",
] as const;

/**
 * Sleeper repeats account names in rosters and draft history. Only the signed-in
 * navigation profile is an identity signal; never fall back to a generic
 * `.name` lookup.
 */
export function findSignedInSleeperUsername(
  root: ParentNode = document,
): string | null {
  for (const selector of PROFILE_USERNAME_SELECTORS) {
    const username = normalizeSleeperUsername(
      root.querySelector(selector)?.textContent,
    );
    if (username) return username;
  }
  return null;
}

export function normalizeSleeperUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  if (
    username.length === 0 ||
    username.length > 64 ||
    /[\s\p{C}]/u.test(username)
  ) {
    return null;
  }
  return username;
}

export function observeSignedInSleeperUsername(
  onUsername: (username: string) => void,
  root: Document = document,
): () => void {
  let disposed = false;
  let scheduled = false;
  let lastUsername: string | null = null;

  const scan = () => {
    scheduled = false;
    if (disposed) return;
    const username = findSignedInSleeperUsername(root);
    if (!username || username === lastUsername) return;
    lastUsername = username;
    onUsername(username);
  };
  const schedule = () => {
    if (disposed || scheduled) return;
    scheduled = true;
    queueMicrotask(scan);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  scan();

  return () => {
    disposed = true;
    observer.disconnect();
  };
}
