import type { ReactNode } from "react";

import {
  safeOpenExternal,
  validateExternalHttpsUrl,
} from "@/services/security/url";

export function SafeExternalLink({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const validated = validateExternalHttpsUrl(url);
  if (!validated) return null;
  const hostname = new URL(validated).hostname;
  return (
    <button
      type="button"
      className={
        className ? `safe-external-link ${className}` : "safe-external-link"
      }
      title={`Open ${hostname} in a separate tab`}
      onClick={() => {
        const confirmed = window.confirm(
          `Open ${hostname} in a separate tab? The destination is external and may redirect after it opens.`,
        );
        if (confirmed) safeOpenExternal(validated);
      }}
    >
      {children}
    </button>
  );
}
