import {
  Accessibility,
  Bot,
  Check,
  CircleHelp,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  Info,
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
  TriangleAlert,
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
  getAllProviderKeyStatuses,
  removeProviderKeyFromTrustedOptions,
  saveProviderKeyFromTrustedOptions,
} from "@/services/storage/key-vault";
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from "@/services/storage/settings";
import type {
  AiFeatureConfig,
  AiFeature,
  AiProviderId,
  AppSettings,
  KeyMode,
  KeyStatus,
  ModelCapability,
  Theme,
} from "@/types/domain";
import "@/styles/globals.css";
import "./options.css";

type SettingsTab =
  | "onboarding"
  | "account"
  | "providers"
  | "general"
  | "models"
  | "data"
  | "transfer"
  | "appearance"
  | "accessibility"
  | "diagnostics"
  | "privacy"
  | "about";

/**
 * Seven broad tabs meant "Advanced" collected the cache controls, the log
 * level and the launcher position purely because none of them fit elsewhere.
 * Each section now names one subject, so a control can be found by guessing.
 */
const tabs: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { id: "onboarding", label: "Getting started", icon: CircleHelp },
  { id: "account", label: "Sleeper account", icon: UserRound },
  // The handoff calls this "OpenAI key"; the page also ships an Anthropic
  // provider, so naming it for one of the two would mislabel the other.
  { id: "providers", label: "AI provider key", icon: KeyRound },
  { id: "general", label: "Draft defaults", icon: SlidersHorizontal },
  { id: "models", label: "Analysis", icon: Bot },
  { id: "data", label: "Data & cache", icon: Database },
  { id: "transfer", label: "Import & export", icon: Download },
  { id: "appearance", label: "Appearance", icon: Moon },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "diagnostics", label: "Diagnostics", icon: Gauge },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "about", label: "About", icon: Info },
];

const AI_FEATURES: Array<{ id: AiFeature; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "start_sit", label: "Start / Sit" },
  { id: "matchup", label: "Matchup" },
  { id: "waiver", label: "Waiver / FAAB" },
  { id: "trade", label: "Trades" },
  { id: "dynasty", label: "Dynasty" },
  { id: "rookie", label: "Rookie" },
  { id: "taxi", label: "Taxi" },
  { id: "idp", label: "IDP" },
  { id: "auction", label: "Auction" },
  { id: "best_ball", label: "Best Ball" },
  { id: "chopped", label: "Chopped" },
  { id: "keeper", label: "Keeper" },
  { id: "research", label: "Research" },
];

const HAS_EXTENSION_API = hasExtensionApi();

function hasExtensionApi(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const permissions: unknown = Reflect.get(chromeValue, "permissions");
  return Boolean(permissions && typeof permissions === "object");
}

function OptionsApp() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("onboarding");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const emptyKeyStatus: KeyStatus = {
    available: false,
    mode: null,
    masked: null,
  };
  const [selectedProvider, setSelectedProvider] =
    useState<AiProviderId>("openai");
  const [keyStatuses, setKeyStatuses] = useState<
    Record<AiProviderId, KeyStatus>
  >({ openai: emptyKeyStatus, anthropic: emptyKeyStatus });
  const keyStatus = keyStatuses[selectedProvider];
  const [apiKey, setApiKey] = useState("");
  const [keyMode, setKeyMode] = useState<KeyMode>("session");
  const [rememberConfirmed, setRememberConfirmed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [modelRecords, setModelRecords] = useState<ModelCapability[]>([]);
  const defaultCapability = findModelCapability(
    modelRecords,
    settings.aiDefaults.provider,
    settings.aiDefaults.model,
  );

  useEffect(() => {
    let active = true;
    void Promise.all([getSettings(), getAllProviderKeyStatuses()]).then(
      ([stored, keys]) => {
        if (!active) return;
        setSettings(stored);
        setKeyStatuses(keys);
        if (keys.openai.mode) setKeyMode(keys.openai.mode);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function changeProvider(provider: AiProviderId) {
    setSelectedProvider(provider);
    const mode = keyStatuses[provider].mode;
    if (mode) setKeyMode(mode);
    setApiKey("");
    setRememberConfirmed(false);
  }

  function updateAiDefaults(patch: Partial<AiFeatureConfig>) {
    setSettings((current) => ({
      ...current,
      aiPreset: "custom",
      aiDefaults: { ...current.aiDefaults, ...patch },
    }));
    setNotice("");
  }

  function updateAiBudgets(patch: Partial<AppSettings["aiBudgets"]>) {
    setSettings((current) => ({
      ...current,
      aiBudgets: { ...current.aiBudgets, ...patch },
      ...(patch.maxRequestsPerMinute !== undefined
        ? { maxRequestsPerMinute: Math.min(12, patch.maxRequestsPerMinute) }
        : {}),
      ...(patch.maxConcurrency !== undefined
        ? { maxConcurrency: Math.min(2, patch.maxConcurrency) }
        : {}),
    }));
    setNotice("");
  }

  function updateFeatureConfig(
    feature: AiFeature,
    patch: Partial<AiFeatureConfig>,
  ) {
    setSettings((current) => {
      const existing =
        current.aiFeatureOverrides[feature] ?? current.aiDefaults;
      return {
        ...current,
        aiPreset: "custom",
        aiFeatureOverrides: {
          ...current.aiFeatureOverrides,
          [feature]: { ...existing, ...patch },
        },
      };
    });
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
      const masked = await saveProviderKeyFromTrustedOptions(
        selectedProvider,
        apiKey,
        keyMode,
      );
      setApiKey("");
      setKeyStatuses((current) => ({
        ...current,
        [selectedProvider]: { available: true, mode: keyMode, masked },
      }));
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
    await removeProviderKeyFromTrustedOptions(selectedProvider);
    setApiKey("");
    setKeyStatuses((current) => ({
      ...current,
      [selectedProvider]: emptyKeyStatus,
    }));
    setNotice(
      `The ${selectedProvider === "openai" ? "OpenAI" : "Anthropic"} key was removed.`,
    );
  }

  async function testKey() {
    setBusy(true);
    setError("");
    try {
      const response = await requestRuntime<{
        ok: true;
        modelCount: number;
      }>({
        type: "TEST_AI_PROVIDER",
        payload: { provider: selectedProvider },
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

  async function connectSleeperAccount() {
    const username = settings.sleeperUsername.trim();
    if (username.length === 0) {
      setError("Enter your Sleeper username first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const user = await requestRuntime<{
        user_id: string;
        username?: string | null;
      }>({ type: "RESOLVE_USER", payload: { username } });
      // The worker persists the resolved id. Mirror only the two account
      // fields so any other unsaved edit on this page survives.
      const stored = await getSettings();
      setSettings((current) => ({
        ...current,
        sleeperUsername: stored.sleeperUsername,
        sleeperUserId: stored.sleeperUserId,
      }));
      // Populate the catalog immediately — a resolved id with an empty league
      // list still looks broken to the user.
      const catalog = await requestRuntime<unknown[]>({
        type: "SYNC_LEAGUES",
        payload: { userId: user.user_id },
      });
      setNotice(
        `Connected as ${user.username ?? username} · ${catalog.length} ${
          catalog.length === 1 ? "league" : "leagues"
        } found across all seasons.`,
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
      const provider = settings.aiDefaults.provider;
      const response = await requestRuntime<ModelCapability[]>({
        type: "LIST_AI_MODELS",
        payload: { provider, force: true },
      });
      setModelCount(response.length);
      setModelRecords((current) => [
        ...current.filter((model) => model.provider !== provider),
        ...response,
      ]);
      setNotice(
        `Loaded ${response.length} model records from ${provider === "openai" ? "OpenAI" : "Anthropic"}.`,
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

  /** The control existed with no handler attached, so it silently did nothing. */
  async function clearCache() {
    setBusy(true);
    setError("");
    try {
      await requestRuntime({
        type: "CLEAR_CACHE",
        payload: { scope: "all" },
      });
      setNotice("Cleared cached player, league, draft, and research data.");
    } catch (caught) {
      const safe = safeRuntimeError(caught);
      setError(
        `${safe.message} ${safe.safeDetail} ${safe.suggestedAction} (${safe.diagnosticCode})`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportDiagnostics() {
    setBusy(true);
    setError("");
    try {
      const bundle = await requestRuntime<unknown>({
        type: "EXPORT_DIAGNOSTICS",
        payload: {},
      });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `not-sleeping-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Exported a redacted diagnostics bundle.");
    } catch (caught) {
      const safe = safeRuntimeError(caught);
      setError(
        `${safe.message} ${safe.safeDetail} ${safe.suggestedAction} (${safe.diagnosticCode})`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function openSidePanelDataCenter() {
    if (!HAS_EXTENSION_API) return;
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.windowId === undefined) return;
    await chrome.sidePanel.open({ windowId: tab.windowId });
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
            <span>Settings · v{chrome.runtime.getManifest().version}</span>
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
          {activeTab === "onboarding" ? (
            <>
              <SectionHeader
                title="Getting started"
                detail="Two steps, and only the first is required."
              />
              <ol className="onboarding-steps">
                <li data-done={settings.sleeperUserId.length > 0}>
                  <span className="step-mark" aria-hidden="true">
                    {settings.sleeperUserId ? <Check /> : 1}
                  </span>
                  <div>
                    <strong>Connect your Sleeper account</strong>
                    <p>
                      {settings.sleeperUserId
                        ? "Connected. Every league across all seasons is loaded."
                        : "Enter your public Sleeper username. No password is involved. Until this is done, every workspace shows demo data."}
                    </p>
                    <Button
                      size="small"
                      variant={settings.sleeperUserId ? "ghost" : "primary"}
                      onClick={() => setActiveTab("account")}
                    >
                      {settings.sleeperUserId
                        ? "Manage account"
                        : "Connect account"}
                    </Button>
                  </div>
                </li>
                <li data-done={keyStatus.available}>
                  <span className="step-mark" aria-hidden="true">
                    {keyStatus.available ? <Check /> : 2}
                  </span>
                  <div>
                    <strong>Add an OpenAI key — optional</strong>
                    <p>
                      Ranking, sync, imports and trade evaluation all work
                      without one. A key only adds written research on top.
                    </p>
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => setActiveTab("providers")}
                    >
                      {keyStatus.available ? "Manage key" : "Add a key"}
                    </Button>
                  </div>
                </li>
              </ol>
              <div className="security-callout">
                <Database />
                <div>
                  <strong>Nothing is ever submitted for you</strong>
                  <p>
                    Not Sleeping reads Sleeper's public API. It cannot draft,
                    trade, or set a lineup — every recommendation is something
                    you carry out yourself in Sleeper.
                  </p>
                </div>
              </div>
            </>
          ) : null}

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
              </div>
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
              <div className="key-actions">
                <Button
                  variant="primary"
                  icon={<UserRound />}
                  onClick={() => void connectSleeperAccount()}
                  disabled={
                    busy || settings.sleeperUsername.trim().length === 0
                  }
                >
                  {settings.sleeperUserId
                    ? "Reconnect and resync leagues"
                    : "Connect account and load leagues"}
                </Button>
              </div>
              {settings.sleeperUserId ? null : (
                <div className="security-callout">
                  <UserRound />
                  <div>
                    <strong>No Sleeper account connected</strong>
                    <p>
                      League workspaces fall back to demo data until an account
                      is connected. Enter the public username above and connect
                      to load every league across all seasons.
                    </p>
                  </div>
                </div>
              )}
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

          {activeTab === "providers" ? (
            <>
              <SectionHeader
                title="Bring your own AI provider key"
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
                <Field
                  label="Provider"
                  detail="Keys are isolated and never reused across providers."
                >
                  <select
                    value={selectedProvider}
                    onChange={(event) =>
                      changeProvider(event.target.value as AiProviderId)
                    }
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </Field>
                <div className="key-field">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      selectedProvider === "anthropic" ? "sk-ant-…" : "sk-…"
                    }
                    aria-label={`${selectedProvider === "openai" ? "OpenAI" : "Anthropic"} API key`}
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
                  <>
                    <div className="risk-callout" role="note">
                      <TriangleAlert aria-hidden="true" />
                      <div>
                        <strong>Remembering a key carries real risk</strong>
                        <p>
                          Client-side secrets can be extracted by sufficiently
                          privileged software. A remembered key persists on this
                          device until you remove it. Prefer session-only
                          storage, and use a dedicated key with the minimum
                          permissions and budget the features need.
                        </p>
                      </div>
                    </div>
                    <label className="remember-confirm">
                      <input
                        type="checkbox"
                        checked={rememberConfirmed}
                        onChange={(event) =>
                          setRememberConfirmed(event.target.checked)
                        }
                      />
                      <span>
                        I understand the risks — anyone with access to this
                        browser profile may be able to use the saved key.
                      </span>
                    </label>
                  </>
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
                title="How much analysis to run"
                detail="Every feature answers deterministically first; these control the optional layer on top."
              />
              <div className="form-grid">
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
              <SectionHeader
                title="Dynamic model selection"
                detail="Models and capability controls are loaded from the selected provider; unknown controls stay disabled instead of being guessed."
                badge={
                  modelCount === null ? undefined : (
                    <StatusBadge tone="info">{modelCount} loaded</StatusBadge>
                  )
                }
              />
              <div className="form-grid">
                <Field
                  label="Routing preset"
                  detail="Economy, balanced, quality, or fully custom controls."
                >
                  <select
                    value={settings.aiPreset}
                    onChange={(event) =>
                      update(
                        "aiPreset",
                        event.target.value as AppSettings["aiPreset"],
                      )
                    }
                  >
                    <option value="economy">Economy</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>
                <Field
                  label="Default provider"
                  detail="Can be overridden per feature."
                >
                  <select
                    value={settings.aiDefaults.provider}
                    onChange={(event) =>
                      updateAiDefaults({
                        provider: event.target.value as AiProviderId,
                      })
                    }
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </Field>
                <Field
                  label="Default routing mode"
                  detail="Consensus uses the two exact models configured below."
                >
                  <select
                    value={settings.aiDefaults.routingMode}
                    onChange={(event) =>
                      updateAiDefaults({
                        routingMode: event.target
                          .value as AiFeatureConfig["routingMode"],
                      })
                    }
                  >
                    <option value="off">AI off</option>
                    <option value="manual">Manual only</option>
                    <option value="balanced">Balanced</option>
                    <option value="quality">Quality</option>
                    <option value="consensus">OpenAI + Anthropic</option>
                  </select>
                </Field>
                <Field
                  label="Default model"
                  detail="Used unless a feature override selects another model."
                >
                  <input
                    list={`provider-models-${settings.aiDefaults.provider}`}
                    value={settings.aiDefaults.model}
                    onChange={(event) =>
                      updateAiDefaults({ model: event.target.value })
                    }
                  />
                </Field>
                {settings.aiDefaults.routingMode === "consensus" ? (
                  <>
                    <Field
                      label="Consensus OpenAI model"
                      detail="Exact model; never substituted automatically."
                    >
                      <input
                        list="provider-models-openai"
                        value={settings.aiDefaults.consensusModels.openai}
                        onChange={(event) =>
                          updateAiDefaults({
                            consensusModels: {
                              ...settings.aiDefaults.consensusModels,
                              openai: event.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Consensus Anthropic model"
                      detail="Exact model; never substituted automatically."
                    >
                      <input
                        list="provider-models-anthropic"
                        value={settings.aiDefaults.consensusModels.anthropic}
                        onChange={(event) =>
                          updateAiDefaults({
                            consensusModels: {
                              ...settings.aiDefaults.consensusModels,
                              anthropic: event.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  </>
                ) : null}
                <Field
                  label="Reasoning effort"
                  detail="Only values reported for the selected model are shown."
                >
                  <ReasoningEffortSelect
                    ariaLabel="Reasoning effort"
                    value={settings.aiDefaults.reasoningEffort}
                    capability={defaultCapability}
                    onChange={(reasoningEffort) =>
                      updateAiDefaults({
                        reasoningEffort,
                      })
                    }
                  />
                </Field>
                <Field
                  label="Thinking mode"
                  detail="Only modes reported for the selected model are shown."
                >
                  <ThinkingModeSelect
                    ariaLabel="Thinking mode"
                    value={settings.aiDefaults.thinkingMode}
                    capability={defaultCapability}
                    onChange={(thinkingMode) =>
                      updateAiDefaults({
                        thinkingMode,
                      })
                    }
                  />
                </Field>
                <Field
                  label="Native web search"
                  detail="Available only when the loaded model capability explicitly supports it."
                >
                  <input
                    type="checkbox"
                    aria-label="Native web search"
                    disabled={defaultCapability?.webSearch !== true}
                    checked={
                      defaultCapability?.webSearch === true &&
                      settings.aiDefaults.webSearch
                    }
                    onChange={(event) =>
                      updateAiDefaults({ webSearch: event.target.checked })
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
                    value={settings.aiBudgets.maxRequestsPerMinute}
                    onChange={(event) =>
                      updateAiBudgets({
                        maxRequestsPerMinute: Number(event.target.value),
                      })
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
                    value={settings.aiDefaults.maxOutputTokens}
                    onChange={(event) =>
                      updateAiDefaults({
                        maxOutputTokens: Number(event.target.value),
                      })
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
                    value={settings.aiDefaults.timeoutMs / 1000}
                    onChange={(event) =>
                      updateAiDefaults({
                        timeoutMs: Number(event.target.value) * 1000,
                      })
                    }
                  />
                </Field>
                <Field
                  label="Maximum concurrency"
                  detail="One is the privacy- and rate-limit-friendly default."
                >
                  <select
                    value={settings.aiBudgets.maxConcurrency}
                    onChange={(event) =>
                      updateAiBudgets({
                        maxConcurrency: Number(event.target.value),
                      })
                    }
                  >
                    <option value="1">1 request</option>
                    <option value="2">2 requests</option>
                    <option value="3">3 requests</option>
                    <option value="4">4 requests</option>
                  </select>
                </Field>
              </div>
              <section
                className="feature-routing"
                aria-labelledby="feature-routing-title"
              >
                <div>
                  <h3 id="feature-routing-title">Per-feature routing</h3>
                  <p>
                    Override provider, model, routing, and effort without
                    changing deterministic analysis.
                  </p>
                </div>
                <div className="feature-routing-grid">
                  {AI_FEATURES.map((feature) => {
                    const config =
                      settings.aiFeatureOverrides[feature.id] ??
                      settings.aiDefaults;
                    const capability = findModelCapability(
                      modelRecords,
                      config.provider,
                      config.model,
                    );
                    return (
                      <article key={feature.id}>
                        <strong>{feature.label}</strong>
                        <select
                          aria-label={`${feature.label} provider`}
                          value={config.provider}
                          onChange={(event) =>
                            updateFeatureConfig(feature.id, {
                              provider: event.target.value as AiProviderId,
                            })
                          }
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                        </select>
                        <input
                          list={`provider-models-${config.provider}`}
                          aria-label={`${feature.label} model`}
                          value={config.model}
                          onChange={(event) =>
                            updateFeatureConfig(feature.id, {
                              model: event.target.value,
                            })
                          }
                        />
                        <select
                          aria-label={`${feature.label} routing mode`}
                          value={config.routingMode}
                          onChange={(event) =>
                            updateFeatureConfig(feature.id, {
                              routingMode: event.target
                                .value as AiFeatureConfig["routingMode"],
                            })
                          }
                        >
                          <option value="off">AI off</option>
                          <option value="manual">Manual</option>
                          <option value="balanced">Balanced</option>
                          <option value="quality">Quality</option>
                          <option value="consensus">OpenAI + Anthropic</option>
                        </select>
                        {config.routingMode === "consensus" ? (
                          <>
                            <input
                              list="provider-models-openai"
                              aria-label={`${feature.label} consensus OpenAI model`}
                              value={config.consensusModels.openai}
                              onChange={(event) =>
                                updateFeatureConfig(feature.id, {
                                  consensusModels: {
                                    ...config.consensusModels,
                                    openai: event.target.value,
                                  },
                                })
                              }
                            />
                            <input
                              list="provider-models-anthropic"
                              aria-label={`${feature.label} consensus Anthropic model`}
                              value={config.consensusModels.anthropic}
                              onChange={(event) =>
                                updateFeatureConfig(feature.id, {
                                  consensusModels: {
                                    ...config.consensusModels,
                                    anthropic: event.target.value,
                                  },
                                })
                              }
                            />
                          </>
                        ) : null}
                        <ReasoningEffortSelect
                          ariaLabel={`${feature.label} reasoning effort`}
                          value={config.reasoningEffort}
                          capability={capability}
                          onChange={(reasoningEffort) =>
                            updateFeatureConfig(feature.id, {
                              reasoningEffort,
                            })
                          }
                        />
                        <ThinkingModeSelect
                          ariaLabel={`${feature.label} thinking mode`}
                          value={config.thinkingMode}
                          capability={capability}
                          onChange={(thinkingMode) =>
                            updateFeatureConfig(feature.id, { thinkingMode })
                          }
                        />
                        <label className="feature-capability-toggle">
                          <input
                            type="checkbox"
                            aria-label={`${feature.label} native web search`}
                            disabled={capability?.webSearch !== true}
                            checked={
                              capability?.webSearch === true && config.webSearch
                            }
                            onChange={(event) =>
                              updateFeatureConfig(feature.id, {
                                webSearch: event.target.checked,
                              })
                            }
                          />
                          Native web search
                        </label>
                      </article>
                    );
                  })}
                </div>
              </section>
              {(["openai", "anthropic"] as const).map((provider) => (
                <datalist key={provider} id={`provider-models-${provider}`}>
                  {modelRecords
                    .filter((model) => model.provider === provider)
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {[
                          model.structuredOutput === true ? "structured" : null,
                          model.webSearch === true ? "web" : null,
                          model.thinking === true ? "thinking" : null,
                          model.priceClass !== "unknown"
                            ? model.priceClass
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </option>
                    ))}
                </datalist>
              ))}
              <Button
                icon={<RefreshCw />}
                onClick={() => void refreshModels()}
                disabled={
                  !keyStatuses[settings.aiDefaults.provider].available || busy
                }
              >
                Refresh provider models
              </Button>
              <div className="security-callout">
                <CircleHelp />
                <div>
                  <strong>Current defaults</strong>
                  <p>
                    Every feature returns a deterministic answer first. AI is an
                    optional, bounded overlay with per-feature provider, model,
                    effort, thinking, timeout, and token controls.
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
                  title="AI providers, opt in"
                  items={[
                    "Only requested analysis context",
                    "Provider-specific API key header",
                    "Strict structured response contracts",
                    "OpenAI web search only when enabled",
                  ]}
                />
              </div>
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
                label="In-page launcher"
                detail="Show a small Not Sleeping launcher on supported Sleeper pages."
                checked={settings.launcherEnabled}
                onChange={(value) => update("launcherEnabled", value)}
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
              </div>
            </>
          ) : null}

          {activeTab === "accessibility" ? (
            <>
              <SectionHeader
                title="Accessibility"
                detail="These apply everywhere, independent of the theme you picked."
              />
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

          {activeTab === "data" ? (
            <>
              <SectionHeader
                title="Data & cache"
                detail="What Not Sleeping keeps on this device, and how to clear it."
              />
              <SettingsToggle
                label="Enable public data enrichment"
                detail="Allow verified nflverse roster metadata downloads. Off by default."
                checked={settings.enablePublicData}
                onChange={(value) => void togglePublicData(value)}
              />
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
                  <Button
                    size="small"
                    onClick={() => void clearCache()}
                    disabled={busy}
                  >
                    Clear cache
                  </Button>
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

          {activeTab === "transfer" ? (
            <>
              <SectionHeader
                title="Import & export"
                detail="Move rankings in, and take a redacted copy of your setup out."
              />
              <div className="maintenance-grid">
                <article>
                  <Download />
                  <div>
                    <strong>Export redacted diagnostics</strong>
                    <p>
                      A support bundle with keys, usernames and league IDs
                      stripped out before it leaves the device.
                    </p>
                  </div>
                  <Button
                    size="small"
                    onClick={() => void exportDiagnostics()}
                    disabled={busy}
                  >
                    Export
                  </Button>
                </article>
                <article>
                  <SlidersHorizontal />
                  <div>
                    <strong>Import rankings</strong>
                    <p>
                      Custom rankings are imported from the side panel's Data
                      Center, where the parsed result can be previewed first.
                    </p>
                  </div>
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => void openSidePanelDataCenter()}
                  >
                    Open Data Center
                  </Button>
                </article>
              </div>
            </>
          ) : null}

          {activeTab === "diagnostics" ? (
            <>
              <SectionHeader
                title="Diagnostics"
                detail="Logging detail for troubleshooting. Production defaults are deliberately quiet."
              />
              <div className="form-grid">
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
              <div className="security-callout">
                <CircleHelp />
                <div>
                  <strong>Logs stay on this device</strong>
                  <p>
                    Nothing is transmitted anywhere. Use Import &amp; export to
                    produce a redacted bundle if you need to share one.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "about" ? (
            <>
              <SectionHeader
                title="About Not Sleeping"
                detail={`Version ${chrome.runtime.getManifest().version} · an independent companion, not affiliated with Sleeper.`}
              />
              <div className="security-callout">
                <ShieldCheck />
                <div>
                  <strong>Read-only by design</strong>
                  <p>
                    Not Sleeping never submits a draft pick, trade, waiver claim
                    or lineup. It reads Sleeper's public API and tells you what
                    it would do; carrying that out stays your decision.
                  </p>
                </div>
              </div>
              <a
                className="docs-link"
                href="https://github.com/jtaitt-dev/not-sleeping"
                target="_blank"
                rel="noreferrer"
              >
                Source and issue tracker <ExternalLink />
              </a>
              <a
                className="docs-link"
                href="https://github.com/jtaitt-dev/not-sleeping/blob/main/CHANGELOG.md"
                target="_blank"
                rel="noreferrer"
              >
                What changed in this version <ExternalLink />
              </a>
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

function ReasoningEffortSelect({
  ariaLabel,
  value,
  capability,
  onChange,
}: {
  ariaLabel: string;
  value: AiFeatureConfig["reasoningEffort"];
  capability: ModelCapability | null;
  onChange: (value: AiFeatureConfig["reasoningEffort"]) => void;
}) {
  const options = capability?.reasoningEfforts ?? [];
  const selected = options.includes(value) ? value : "";
  return (
    <select
      aria-label={ariaLabel}
      value={selected}
      disabled={options.length === 0}
      onChange={(event) =>
        onChange(event.target.value as AiFeatureConfig["reasoningEffort"])
      }
    >
      <option value="" disabled>
        {capability ? "Not supported" : "Load model capabilities"}
      </option>
      {options.map((effort) => (
        <option key={effort} value={effort}>
          {reasoningEffortLabel(effort)}
        </option>
      ))}
    </select>
  );
}

function ThinkingModeSelect({
  ariaLabel,
  value,
  capability,
  onChange,
}: {
  ariaLabel: string;
  value: AiFeatureConfig["thinkingMode"];
  capability: ModelCapability | null;
  onChange: (value: AiFeatureConfig["thinkingMode"]) => void;
}) {
  const options = capability?.thinkingModes ?? [];
  const selected = options.includes(value) ? value : "";
  return (
    <select
      aria-label={ariaLabel}
      value={selected}
      disabled={options.length === 0}
      onChange={(event) =>
        onChange(event.target.value as AiFeatureConfig["thinkingMode"])
      }
    >
      <option value="" disabled>
        {capability ? "Not supported" : "Load model capabilities"}
      </option>
      {options.map((mode) => (
        <option key={mode} value={mode}>
          {thinkingModeLabel(mode)}
        </option>
      ))}
    </select>
  );
}

function findModelCapability(
  models: ModelCapability[],
  provider: AiProviderId,
  modelId: string,
): ModelCapability | null {
  return (
    models.find(
      (model) => model.provider === provider && model.id === modelId,
    ) ?? null
  );
}

function reasoningEffortLabel(
  effort: AiFeatureConfig["reasoningEffort"],
): string {
  if (effort === "none") return "None";
  if (effort === "xhigh") return "Extra high";
  if (effort === "max") return "Maximum";
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

function thinkingModeLabel(mode: AiFeatureConfig["thinkingMode"]): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
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
