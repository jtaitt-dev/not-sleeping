import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { SafeExternalLink } from "@/components/ui/safe-external-link";
import { evaluateDeterministicDecision } from "@/services/intelligence/deterministic-engine";
import type {
  DecisionCandidate,
  RealtimeDecision,
} from "@/services/intelligence/types";
import {
  requestRuntime,
  safeRuntimeError,
} from "@/services/messaging/runtime-client";
import { getSettings } from "@/services/storage/settings";
import { resolveFeatureConfig } from "@/services/intelligence/feature-config";
import type { AiFeature, Strategy } from "@/types/domain";

import "./realtime-intelligence-card.css";

export function RealtimeIntelligenceCard({
  feature,
  subject,
  contextSummary,
  candidates,
  strategy,
  riskTolerance,
  currentPick,
  picksUntilNext,
}: {
  feature: AiFeature;
  subject: string;
  contextSummary: string;
  candidates: DecisionCandidate[];
  strategy: Strategy;
  riskTolerance: number;
  currentPick?: number;
  picksUntilNext?: number;
}) {
  const input = useMemo(
    () => ({
      feature,
      subject,
      contextSummary,
      candidates,
      strategy,
      riskTolerance,
      ...(currentPick !== undefined ? { currentPick } : {}),
      ...(picksUntilNext !== undefined ? { picksUntilNext } : {}),
    }),
    [
      candidates,
      contextSummary,
      currentPick,
      feature,
      picksUntilNext,
      riskTolerance,
      strategy,
      subject,
    ],
  );
  const baseline = useMemo(() => evaluateDeterministicDecision(input), [input]);
  const [decision, setDecision] = useState<RealtimeDecision | null>(null);
  const [error, setError] = useState<{
    stateHash: string;
    message: string;
  } | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const [activeModel, setActiveModel] = useState("gpt-5.6-luna");
  const [routingOff, setRoutingOff] = useState(false);
  const lastAutomaticHash = useRef("");

  const run = useCallback(async () => {
    setError(null);
    try {
      const started = await requestRuntime<RealtimeDecision>({
        type: "START_REALTIME_DECISION",
        payload: input,
      });
      setDecision(started);
    } catch (caught) {
      const safe = safeRuntimeError(caught);
      setError({
        stateHash: baseline.stateHash,
        message: `${safe.message} ${safe.suggestedAction}`,
      });
    }
  }, [baseline.stateHash, input]);

  useEffect(() => {
    let active = true;
    void getSettings().then((settings) => {
      if (!active) return;
      const config = resolveFeatureConfig(settings, feature);
      setAutomatic(settings.automaticAnalysis);
      setActiveModel(config.model);
      setRoutingOff(config.routingMode === "off");
    });
    return () => {
      active = false;
    };
  }, [feature]);

  useEffect(() => {
    if (
      automatic &&
      candidates.length > 0 &&
      lastAutomaticHash.current !== baseline.stateHash
    ) {
      lastAutomaticHash.current = baseline.stateHash;
      void run();
    }
  }, [automatic, baseline.stateHash, candidates.length, run]);

  const activeDecision =
    decision?.baseline.stateHash === baseline.stateHash ? decision : null;
  const visibleError =
    error?.stateHash === baseline.stateHash ? error.message : "";

  useEffect(() => {
    if (activeDecision?.aiStatus !== "queued") return;
    let active = true;
    const timer = window.setInterval(() => {
      void requestRuntime<RealtimeDecision | null>({
        type: "GET_REALTIME_DECISION",
        payload: { jobId: activeDecision.jobId },
      })
        .then((next) => {
          if (!active || !next) return;
          setDecision(next);
          if (next.aiStatus !== "queued") window.clearInterval(timer);
        })
        .catch(() => window.clearInterval(timer));
    }, 350);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeDecision]);

  const visibleBaseline = activeDecision?.baseline ?? baseline;
  const top = visibleBaseline.ranked[0];
  const overlay = activeDecision?.overlay;
  return (
    <article className="realtime-intelligence" data-feature={feature}>
      <details>
        <summary>
          <span className="realtime-summary__identity">
            <Sparkles aria-hidden="true" />
            <span>
              <small>Realtime intelligence</small>
              <strong>{top?.label ?? "No valid option"}</strong>
            </span>
          </span>
          <span className="realtime-summary__score tabular">
            {Math.round(visibleBaseline.confidence * 100)}%
          </span>
          <span className="realtime-statuses">
            <StatusBadge tone="info">
              {routingOff ? "AI off" : modelDisplayName(activeModel)}
            </StatusBadge>
            <StatusBadge tone={statusTone(activeDecision?.aiStatus)}>
              {statusLabel(activeDecision?.aiStatus)}
            </StatusBadge>
          </span>
          <ChevronDown
            className="realtime-summary__chevron"
            aria-hidden="true"
          />
        </summary>
        <div className="realtime-intelligence__body">
          <div className="realtime-primary">
            <span>
              <small>Valid local recommendation</small>
              <strong>{top?.label ?? "No valid option"}</strong>
            </span>
            <Button
              icon={<RefreshCw />}
              onClick={() => void run()}
              disabled={
                routingOff ||
                candidates.length === 0 ||
                activeDecision?.aiStatus === "queued"
              }
            >
              {routingOff
                ? "AI off in Settings"
                : activeDecision
                  ? "Refresh AI analysis"
                  : `Run ${modelDisplayName(activeModel)} analysis`}
            </Button>
          </div>
          {top ? (
            <div className="realtime-rationale">
              {top.reasons.slice(0, 3).map((reason) => (
                <span key={reason}>
                  <ChevronRight aria-hidden="true" />
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
          {overlay ? (
            <section className="realtime-overlay">
              <header>
                <strong>
                  {overlay.provider === "consensus"
                    ? "OpenAI + Anthropic"
                    : overlay.provider === "openai"
                      ? "OpenAI"
                      : "Anthropic"}{" "}
                  · {overlay.model}
                </strong>
                <span>
                  Bounded adjustment {overlay.adjustment >= 0 ? "+" : ""}
                  {overlay.adjustment.toFixed(1)}
                </span>
              </header>
              <p>{overlay.summary}</p>
              {overlay.risks.length > 0 ? (
                <span className="realtime-risk">
                  <AlertTriangle aria-hidden="true" />
                  {overlay.risks[0]}
                </span>
              ) : null}
              <details>
                <summary>
                  Sources & explainability · {overlay.evidenceUrls.length}{" "}
                  source
                  {overlay.evidenceUrls.length === 1 ? "" : "s"}
                </summary>
                <ul>
                  {overlay.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                  {overlay.evidenceUrls.map((url) => (
                    <li key={url}>
                      <SafeExternalLink url={url}>
                        {new URL(url).hostname}
                      </SafeExternalLink>
                    </li>
                  ))}
                  {overlay.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            </section>
          ) : null}
          {activeDecision?.aiStatus === "error" || visibleError ? (
            <p className="realtime-error">
              {activeDecision?.error ?? visibleError} The deterministic
              recommendation remains available.
            </p>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function modelDisplayName(model: string): string {
  return model === "gpt-5.6-luna" ? "Luna" : model;
}

function statusTone(
  status: RealtimeDecision["aiStatus"] | undefined,
): "success" | "warning" | "info" | "neutral" {
  if (status === "ready") return "success";
  if (status === "error" || status === "stale") return "warning";
  if (status === "queued") return "info";
  return "neutral";
}

function statusLabel(status: RealtimeDecision["aiStatus"] | undefined): string {
  switch (status) {
    case "queued":
      return "AI queued";
    case "ready":
      return "AI ready";
    case "error":
      return "Local fallback";
    case "stale":
      return "State changed";
    case "off":
      return "AI off";
    default:
      return "Local ready";
  }
}
