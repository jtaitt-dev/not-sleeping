import {
  Bot,
  Check,
  CircleHelp,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Laptop,
  LockKeyhole,
  Moon,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import {
  requestRuntime,
  safeRuntimeError,
} from "@/services/messaging/runtime-client";
import {
  getKeyStatus,
  removeKeyFromTrustedOptions,
  saveKeyFromTrustedOptions,
} from "@/services/storage/key-vault";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from "@/services/storage/settings";
import type { AppSettings, KeyMode, Theme } from "@/types/domain";
import "@/styles/globals.css";
import "./options.css";

type SettingsTab =
  | "general"
  | "account"
  | "openai"
  | "models"
  | "privacy"
  | "appearance"
  | "advanced";
type KeyStatus = Awaited<ReturnType<typeof getKeyStatus>>;

const tabs: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "account", label: "Sleeper account", icon: UserRound },
  { id: "openai", label: "OpenAI key", icon: KeyRound },
  { id: "models", label: "Models & limits", icon: Bot },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Moon },
  { id: "advanced", label: "Advanced", icon: Gauge },
];

const HAS_EXTENSION_API = hasExtensionApi();

function hasExtensionApi(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const permissions: unknown = Reflect.get(chromeValue, "permissions");
  return Boolean(permissions && typeof permissions === "object");
}

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    available: false,
    mode: null,
    masked: null,
  });
  const [apiKey, setApiKey] = useState("");
  const [keyMode, setKeyMode] = useState<KeyMode>("session");
  const [rememberConfirmed, setRememberConfirmed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelCount, setModelCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getSettings(), getKeyStatus()]).then(([stored, key]) => {
      if (!active) return;
      setSettings(stored);
      setKeyStatus(key);
      if (key.mode) setKeyMode(key.mode);
    });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  async function persistSettings() {
    setBusy(true);
    setError("");
    try {
      const saved = await saveSettings({
        ...settings,
        onboardingComplete: true,
      });
      setSettings(saved);
      setNotice("Settings saved in this browser profile.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Settings could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    if (keyMode === "remembered" && !rememberConfirmed) {
      setError(
        "Confirm that remembered storage is appropriate for this browser profile.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const masked = await saveKeyFromTrustedOptions(apiKey, keyMode);
      setApiKey("");
      setKeyStatus({ available: true, mode: keyMode, masked });
      setNotice(
        keyMode === "session"
          ? "Key saved for this browser session."
          : "Key remembered in trusted extension storage.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The key could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    await removeKeyFromTrustedOptions();
    setApiKey("");
    setKeyStatus({ available: false, mode: null, masked: null });
    setNotice("The OpenAI key was removed.");
  }

  async function testKey() {
    setBusy(true);
    setError("");
    try {
      const response = await requestRuntime<{
        ok: true;
        modelCount: number;
      }>({
        type: "TEST_OPENAI",
        payload: {},
      });
      setNotice(
        `Connection succeeded · ${response.modelCount} models visible.`,
      );
    } catch (caught) {
      const safe = safeRuntimeError(caught);
      setError(
        `${safe.message} ${safe.safeDetail} ${safe.suggestedAction} (${safe.diagnosticCode})`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshModels() {
    setBusy(true);
    setError("");
    try {
      const response = await requestRuntime<unknown[]>({
        type: "LIST_MODELS",
        payload: { force: true },
      });
      setModelCount(response.length);
      setNotice(
        `Loaded ${response.length} compatible model records from OpenAI.`,
      );
    } catch (caught) {
      const safe = safeRuntimeError(caught);
      setError(
        `${safe.message} ${safe.safeDetail} ${safe.suggestedAction} (${safe.diagnosticCode})`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublicData(enabled: boolean) {
    if (!HAS_EXTENSION_API) {
      update("enablePublicData", enabled);
      return;
    }
    const origins = ["https://github.com/nflverse/nflverse-data/*"];
    if (enabled) {
      const granted = await chrome.permissions.request({ origins });
      if (!granted) {
        setError("Public-data host access was not granted.");
        return;
      }
    } else {
      await chrome.permissions.remove({ origins });
    }
    update("enablePublicData", enabled);
  }

  return (
    <main
      className="options-app"
      data-theme={settings.theme}
      data-reduced-motion={settings.reducedMotion}
    >
      <aside className="options-sidebar">
        <header>
          <img src="/icons/icon-48.png" alt="" width="38" height="38" />
          <div>
            <strong>Not Sleeping</strong>
            <span>Settings · v0.1.0</span>
          </div>
        </header>
        <nav aria-label="Settings sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? "active" : ""}
              onClick={() => setActiveTab(id)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <footer>
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Local-first</strong>Keys are restricted to trusted extension
            contexts.
          </p>
        </footer>
      </aside>

      <section className="options-content">
        <header className="options-topbar">
          <div>
            <span className="section-label">Not Sleeping / Settings</span>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <Button
            variant="primary"
            icon={<Save />}
            onClick={() => void persistSettings()}
            disabled={busy}
          >
            {busy ? "Working…" : "Save settings"}
          </Button>
        </header>

        {notice ? (
          <div className="options-notice" role="status">
            <Check />
            {notice}
          </div>
        ) : null}
        {error ? <InlineError title="Action failed" detail={error} /> : null}

        <div className="options-panel">
          {activeTab === "general" ? (
            <>
              <SectionHeader
                title="Draft defaults"
                detail="Used when league metadata is incomplete or ambiguous."
              />
              <div className="form-grid">
                <Field
                  label="Default draft mode"
                  detail="Automatic detection takes precedence when confidence is high."
                >
                  <select
                    value={settings.defaultMode}
                    onChange={(event) =>
                      update(
                        "defaultMode",
                        event.target.value as AppSettings["defaultMode"],
                      )
                    }
                  >
                    <option value="unknown">Detect automatically</option>
                    <option value="redraft">Redraft</option>
                    <option value="keeper">Keeper</option>
                    <option value="dynasty_startup">Dynasty startup</option>
                    <option value="dynasty_rookie">Dynasty rookie</option>
                    <option value="best_ball">Best ball</option>
                  </select>
                </Field>
                <Field
                  label="Default strategy"
                  detail="Changes age-curve and team-direction weighting."
                >
                  <select
                    value={settings.defaultStrategy}
                    onChange={(event) =>
                      update(
                        "defaultStrategy",
                        event.target.value as AppSettings["defaultStrategy"],
                      )
                    }
                  >
                    <option value="balanced">Balanced</option>
                    <option value="contender">Contender</option>
                    <option value="productive_struggle">
                      Productive struggle
                    </option>
                    <option value="rebuild">Rebuild</option>
                  </select>
                </Field>
                <Field
                  label={`Risk tolerance · ${Math.round(settings.riskTolerance * 100)}%`}
                  detail="Higher values reduce injury and uncertainty penalties."
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.riskTolerance}
                    onChange={(event) =>
                      update("riskTolerance", Number(event.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Research depth"
                  detail="Applies to manually requested player research."
                >
                  <select
                    value={settings.researchDepth}
                    onChange={(event) =>
                      update(
                        "researchDepth",
                        event.target.value as AppSettings["researchDepth"],
                      )
                    }
                  >
                    <option value="quick">Quick</option>
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </select>
                </Field>
              </div>
              <SettingsToggle
                label="Automatic analysis"
                detail="Analyze supported context changes when a key is available."
                checked={settings.automaticAnalysis}
                onChange={(value) => update("automaticAnalysis", value)}
              />
              <SettingsToggle
                label="In-page launcher"
                detail="Show a small Not Sleeping launcher on supported Sleeper pages."
                checked={settings.launcherEnabled}
                onChange={(value) => update("launcherEnabled", value)}
              />
            </>
          ) : null}

          {activeTab === "account" ? (
            <>
              <SectionHeader
                title="Sleeper account"
                detail="The public username resolves to a Sleeper user ID. No password or Sleeper token is needed."
              />
              <div className="form-grid">
                <Field
                  label="Sleeper username"
                  detail="Used to find leagues, rosters, and owned draft picks."
                >
                  <input
                    type="text"
                    value={settings.sleeperUsername}
                    maxLength={64}
                    placeholder="Your Sleeper username"
                    onChange={(event) =>
                      update("sleeperUsername", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Resolved user ID"
                  detail="Populated after the public username is resolved."
                >
                  <input
                    type="text"
                    value={settings.sleeperUserId}
                    readOnly
                    placeholder="Not resolved"
                  />
                </Field>
              </div>
              <div className="security-callout">
                <Database />
                <div>
                  <strong>Read-only provider</strong>
                  <p>
                    Not Sleeping uses Sleeper's public read-only API. It cannot
                    draft, trade, edit a roster, or access private credentials.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "openai" ? (
            <>
              <SectionHeader
                title="Bring your own OpenAI key"
                detail="Optional. Deterministic ranking, Sleeper sync, imports, and trade evaluation work without it."
                badge={
                  keyStatus.available ? (
                    <StatusBadge tone="success">{keyStatus.masked}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Not configured</StatusBadge>
                  )
                }
              />
              <div className="key-panel">
                <div className="key-field">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="sk-…"
                    aria-label="OpenAI API key"
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                <div
                  className="storage-choice"
                  role="radiogroup"
                  aria-label="Key storage"
                >
                  <label className={keyMode === "session" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="key-mode"
                      value="session"
                      checked={keyMode === "session"}
                      onChange={() => setKeyMode("session")}
                    />
                    <span>
                      <strong>Session only</strong>
                      <small>
                        Recommended · cleared when the browser session ends
                      </small>
                    </span>
                  </label>
                  <label className={keyMode === "remembered" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="key-mode"
                      value="remembered"
                      checked={keyMode === "remembered"}
                      onChange={() => setKeyMode("remembered")}
                    />
                    <span>
                      <strong>Remember on this browser</strong>
                      <small>
                        Stored locally and restricted to trusted extension
                        contexts
                      </small>
                    </span>
                  </label>
                </div>
                {keyMode === "remembered" ? (
                  <label className="remember-confirm">
                    <input
                      type="checkbox"
                      checked={rememberConfirmed}
                      onChange={(event) =>
                        setRememberConfirmed(event.target.checked)
                      }
                    />
                    <span>
                      I understand that anyone with access to this browser
                      profile may be able to use the saved key.
                    </span>
                  </label>
                ) : null}
                <div className="key-actions">
                  <Button
                    variant="primary"
                    icon={<KeyRound />}
                    onClick={() => void saveKey()}
                    disabled={busy || apiKey.length === 0}
                  >
                    Save key securely
                  </Button>
                  <Button
                    icon={<RefreshCw />}
                    onClick={() => void testKey()}
                    disabled={busy || !keyStatus.available}
                  >
                    Test connection
                  </Button>
                  {keyStatus.available ? (
                    <Button
                      variant="danger"
                      icon={<Trash2 />}
                      onClick={() => void removeKey()}
                    >
                      Remove key
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="security-callout">
                <ShieldCheck />
                <div>
                  <strong>Secret boundary</strong>
                  <p>
                    The options page writes directly to Chrome storage. The
                    background worker is the only context that reads and uses
                    the key; it is never sent through runtime messages, logs,
                    exports, or diagnostics.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "models" ? (
            <>
              <SectionHeader
                title="Dynamic model selection"
                detail="Compatible IDs are loaded from OpenAI when requested; manual IDs remain available for new models."
                badge={
                  modelCount === null ? undefined : (
                    <StatusBadge tone="info">{modelCount} loaded</StatusBadge>
                  )
                }
              />
              <div className="form-grid">
                <Field
                  label="Routine model"
                  detail="Structured adjustments and compact summaries."
                >
                  <input
                    value={settings.routineModel}
                    onChange={(event) =>
                      update("routineModel", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Research model"
                  detail="Current, citation-bearing player research."
                >
                  <input
                    value={settings.researchModel}
                    onChange={(event) =>
                      update("researchModel", event.target.value)
                    }
                  />
                </Field>
                <Field
                  label="Requests per minute"
                  detail="Local queue cap; maximum 12."
                >
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={settings.maxRequestsPerMinute}
                    onChange={(event) =>
                      update("maxRequestsPerMinute", Number(event.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Maximum output tokens"
                  detail="Budget cap per response."
                >
                  <input
                    type="number"
                    min="256"
                    max="16384"
                    step="256"
                    value={settings.maxOutputTokens}
                    onChange={(event) =>
                      update("maxOutputTokens", Number(event.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Request timeout"
                  detail="Seconds before local cancellation."
                >
                  <input
                    type="number"
                    min="10"
                    max="180"
                    value={settings.requestTimeoutMs / 1000}
                    onChange={(event) =>
                      update(
                        "requestTimeoutMs",
                        Number(event.target.value) * 1000,
                      )
                    }
                  />
                </Field>
                <Field
                  label="Maximum concurrency"
                  detail="One is the privacy- and rate-limit-friendly default."
                >
                  <select
                    value={settings.maxConcurrency}
                    onChange={(event) =>
                      update("maxConcurrency", Number(event.target.value))
                    }
                  >
                    <option value="1">1 request</option>
                    <option value="2">2 requests</option>
                  </select>
                </Field>
              </div>
              <Button
                icon={<RefreshCw />}
                onClick={() => void refreshModels()}
                disabled={!keyStatus.available || busy}
              >
                Refresh models from OpenAI
              </Button>
              <div className="security-callout">
                <CircleHelp />
                <div>
                  <strong>Current defaults</strong>
                  <p>
                    Routine work uses gpt-5.6-terra; deeper current research
                    uses gpt-5.6-sol. Capability checks determine whether
                    structured output and web search can be used.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "privacy" ? (
            <>
              <SectionHeader
                title="Privacy and data flow"
                detail="Controls are designed to keep league data and secrets scoped to the feature that needs them."
              />
              <div className="privacy-grid">
                <PrivacyCard
                  icon={<Laptop />}
                  title="This browser"
                  items={[
                    "Settings and watchlist",
                    "Player and research cache",
                    "Imported rankings",
                    "Redacted diagnostics",
                  ]}
                />
                <PrivacyCard
                  icon={<Database />}
                  title="Sleeper"
                  items={[
                    "Public read-only requests",
                    "User, league, roster, and draft IDs",
                    "No Sleeper credentials",
                    "No write endpoints",
                  ]}
                />
                <PrivacyCard
                  icon={<Bot />}
                  title="OpenAI, opt in"
                  items={[
                    "Only requested analysis context",
                    "API key in Authorization header",
                    "Responses request uses store: false",
                    "Current web search for research",
                  ]}
                />
              </div>
              <SettingsToggle
                label="Enable public data enrichment"
                detail="Allow verified nflverse roster metadata downloads. Off by default."
                checked={settings.enablePublicData}
                onChange={(value) => void togglePublicData(value)}
              />
              <a
                className="docs-link"
                href="https://github.com/jtaitt-dev/not-sleeping/blob/main/SECURITY.md"
                target="_blank"
                rel="noreferrer"
              >
                Read the security policy <ExternalLink />
              </a>
            </>
          ) : null}

          {activeTab === "appearance" ? (
            <>
              <SectionHeader
                title="Appearance"
                detail="Theme choices apply to the side panel and settings surfaces."
              />
              <div className="theme-grid">
                {(
                  [
                    ["dark", "Dark", <Moon key="dark" />],
                    ["light", "Light", <Sun key="light" />],
                    ["system", "System", <Laptop key="system" />],
                    [
                      "high_contrast",
                      "High contrast",
                      <ShieldCheck key="contrast" />,
                    ],
                  ] as Array<[Theme, string, React.ReactNode]>
                ).map(([value, label, icon]) => (
                  <button
                    type="button"
                    key={value}
                    className={settings.theme === value ? "selected" : ""}
                    onClick={() => update("theme", value)}
                  >
                    {icon}
                    <strong>{label}</strong>
                    {settings.theme === value ? <Check /> : null}
                  </button>
                ))}
              </div>
              <SettingsToggle
                label="Reduce motion"
                detail="Minimize non-essential animation and transitions."
                checked={settings.reducedMotion}
                onChange={(value) => update("reducedMotion", value)}
              />
              <SettingsToggle
                label="High-contrast controls"
                detail="Increase borders and control contrast independent of theme."
                checked={settings.highContrast}
                onChange={(value) => update("highContrast", value)}
              />
            </>
          ) : null}

          {activeTab === "advanced" ? (
            <>
              <SectionHeader
                title="Advanced controls"
                detail="Operational limits, launcher placement, and safe maintenance actions."
              />
              <div className="form-grid">
                <Field
                  label="Launcher position"
                  detail="Location on supported Sleeper pages."
                >
                  <select
                    value={settings.launcherPosition}
                    onChange={(event) =>
                      update(
                        "launcherPosition",
                        event.target.value as AppSettings["launcherPosition"],
                      )
                    }
                  >
                    <option value="bottom_right">Bottom right</option>
                    <option value="bottom_left">Bottom left</option>
                  </select>
                </Field>
                <Field
                  label="Diagnostic log level"
                  detail="Production defaults to warnings and errors."
                >
                  <select
                    value={settings.logLevel}
                    onChange={(event) =>
                      update(
                        "logLevel",
                        event.target.value as AppSettings["logLevel"],
                      )
                    }
                  >
                    <option value="error">Errors only</option>
                    <option value="warning">Warnings and errors</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </Field>
              </div>
              <div className="maintenance-grid">
                <article>
                  <Database />
                  <div>
                    <strong>Cached public data</strong>
                    <p>
                      Clear player, league, draft, and research cache without
                      affecting settings.
                    </p>
                  </div>
                  <Button size="small">Clear cache</Button>
                </article>
                <article>
                  <RefreshCw />
                  <div>
                    <strong>Reset preferences</strong>
                    <p>
                      Restore defaults. Saved keys require a separate explicit
                      removal.
                    </p>
                  </div>
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                  >
                    Reset settings
                  </Button>
                </article>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  title,
  detail,
  badge,
}: {
  title: string;
  detail: string;
  badge?: React.ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {badge}
    </header>
  );
}

function Field({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {children}
    </label>
  );
}

function SettingsToggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function PrivacyCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <article className="privacy-card">
      {icon}
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <Check />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Options root element was not found.");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
