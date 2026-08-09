import {
  observeSleeperNavigation,
  parseSleeperRoute,
} from "@/services/context/route-detection";
import { observeSignedInSleeperUsername } from "@/services/context/sleeper-identity";
import { sendRuntimeMessage } from "@/services/messaging/protocol";

const LAUNCHER_ID = "not-sleeping-launcher";

export default defineContentScript({
  matches: ["https://sleeper.com/*", "https://*.sleeper.com/*"],
  runAt: "document_idle",
  async main(ctx) {
    let launcher: HTMLButtonElement | null = null;
    let invalidated = false;
    const discoveryTimers = new Set<number>();

    const sendContext = async () => {
      const route = parseSleeperRoute(location.href);
      await sendRuntimeMessage({
        type: "CONTEXT_UPDATE",
        payload: {
          url: route.sanitizedUrl,
          supported: route.supported,
          ...(route.leagueId ? { leagueId: route.leagueId } : {}),
          ...(route.draftId ? { draftId: route.draftId } : {}),
        },
      });
    };

    const launcherResponse = await sendRuntimeMessage({
      type: "GET_LAUNCHER_SETTINGS",
      payload: {},
    });
    const settings = extractData(launcherResponse);
    if (settings["enabled"] !== false) {
      launcher = createLauncher(
        settings["position"] === "bottom_left" ? "bottom_left" : "bottom_right",
      );
      document.documentElement.append(launcher);
    }

    await sendContext();
    const stop = observeSleeperNavigation(() => void sendContext());
    const stopIdentityDetection = observeSignedInSleeperUsername((username) => {
      void detectSleeperAccount(username);
    });

    async function detectSleeperAccount(username: string, attempt = 0) {
      try {
        const response = await sendRuntimeMessage({
          type: "DETECT_SLEEPER_ACCOUNT",
          payload: { username },
        });
        if (isSuccessfulResponse(response) || attempt >= 2 || invalidated)
          return;
      } catch {
        if (attempt >= 2 || invalidated) return;
      }
      const timer = window.setTimeout(
        () => {
          discoveryTimers.delete(timer);
          void detectSleeperAccount(username, attempt + 1);
        },
        1_500 * 2 ** attempt,
      );
      discoveryTimers.add(timer);
    }

    ctx.onInvalidated(() => {
      invalidated = true;
      stop();
      stopIdentityDetection();
      for (const timer of discoveryTimers) window.clearTimeout(timer);
      discoveryTimers.clear();
      launcher?.remove();
    });
  },
});

function createLauncher(
  position: "bottom_left" | "bottom_right",
): HTMLButtonElement {
  document.getElementById(LAUNCHER_ID)?.remove();
  const button = document.createElement("button");
  button.id = LAUNCHER_ID;
  button.type = "button";
  button.textContent = "Open Not Sleeping";
  button.setAttribute("aria-label", "Open Not Sleeping side panel");
  Object.assign(button.style, {
    position: "fixed",
    bottom: "18px",
    [position === "bottom_left" ? "left" : "right"]: "18px",
    zIndex: "2147483646",
    minHeight: "38px",
    border: "1px solid rgba(34,230,195,.65)",
    borderRadius: "8px",
    background: "#0b101c",
    boxShadow: "0 8px 24px rgba(0,0,0,.34)",
    color: "#f7f9fc",
    cursor: "pointer",
    font: "650 12px/1.2 Inter, ui-sans-serif, system-ui, sans-serif",
    padding: "0 13px",
  });
  button.addEventListener("click", () => {
    void sendRuntimeMessage({ type: "OPEN_SIDE_PANEL", payload: {} });
  });
  return button;
}

function extractData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const data = (value as Record<string, unknown>)["data"];
  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : {};
}

function isSuccessfulResponse(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>)["ok"] === true
  );
}
