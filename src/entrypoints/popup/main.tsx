import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Moon,
  PanelRightOpen,
  Settings,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { sendRuntimeMessage } from "@/services/messaging/protocol";
import "@/styles/globals.css";
import "./popup.css";

type ExtensionStatus = {
  extensionVersion: string;
  keyStatus: {
    available: boolean;
    mode: "session" | "remembered" | null;
    masked: string | null;
  };
  players: number;
  context: { supported?: boolean; draftId?: string } | null;
};

const HAS_EXTENSION_RUNTIME = hasExtensionRuntime();
const PREVIEW_STATUS: ExtensionStatus = {
  extensionVersion: "0.1.0",
  keyStatus: { available: false, mode: null, masked: null },
  players: 24,
  context: null,
};

function hasExtensionRuntime(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const runtime: unknown = Reflect.get(chromeValue, "runtime");
  if (!runtime || typeof runtime !== "object") return false;
  return typeof Reflect.get(runtime, "id") === "string";
}

function PopupApp() {
  const [status, setStatus] = useState<ExtensionStatus | null>(
    HAS_EXTENSION_RUNTIME ? null : PREVIEW_STATUS,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!HAS_EXTENSION_RUNTIME) {
      return () => {
        active = false;
      };
    }
    void sendRuntimeMessage({ type: "GET_STATUS", payload: {} })
      .then((response) => {
        if (!active) return;
        const envelope = response as { ok?: boolean; data?: ExtensionStatus };
        if (envelope.ok && envelope.data) setStatus(envelope.data);
        else setError(true);
      })
      .catch(() => setError(true));
    return () => {
      active = false;
    };
  }, []);

  async function openPanel() {
    const current = await chrome.windows.getCurrent();
    if (current.id !== undefined)
      await chrome.sidePanel.open({ windowId: current.id });
    window.close();
  }

  return (
    <main className="popup">
      <header>
        <div className="popup-brand">
          <img src="/icons/icon-48.png" alt="" width="36" height="36" />
          <div>
            <strong>Not Sleeping</strong>
            <span>Fantasy intelligence for Sleeper</span>
          </div>
        </div>
        <Moon aria-hidden="true" />
      </header>

      <section className="popup-context">
        <div>
          <span className="live-dot" />
          <span>
            {status?.context?.supported
              ? "Sleeper context detected"
              : "Ready for Sleeper"}
          </span>
        </div>
        <StatusBadge tone={status?.context?.draftId ? "success" : "neutral"}>
          {status?.context?.draftId ? "Draft live" : "No live draft"}
        </StatusBadge>
      </section>

      <Button
        variant="primary"
        icon={<PanelRightOpen />}
        onClick={() => void openPanel()}
      >
        Open side panel
      </Button>

      <section className="popup-status">
        <div>
          {status?.keyStatus.available ? <CheckCircle2 /> : <KeyRound />}
          <span>
            <strong>OpenAI</strong>
            <small>
              {status?.keyStatus.available
                ? `${status.keyStatus.masked} · ${status.keyStatus.mode}`
                : "Optional key not configured"}
            </small>
          </span>
          <button
            type="button"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Configure
          </button>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>Privacy</strong>
            <small>Local-first · read-only Sleeper access</small>
          </span>
          <StatusBadge tone="success">Protected</StatusBadge>
        </div>
      </section>

      {error ? (
        <p className="popup-error">
          The service worker is waking up. Reopen the popup if status does not
          refresh.
        </p>
      ) : null}

      <footer>
        <span>
          v{status?.extensionVersion ?? "0.1.0"} · {status?.players ?? 0} cached
          players
        </span>
        <button
          type="button"
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          <Settings />
          Settings
        </button>
        <a
          href="https://github.com/jtaitt-dev/not-sleeping"
          target="_blank"
          rel="noreferrer"
          aria-label="Open source repository"
        >
          <ExternalLink />
        </a>
      </footer>
    </main>
  );
}

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Popup root element was not found.");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
