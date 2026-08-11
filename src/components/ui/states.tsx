import { AlertTriangle, Database, LoaderCircle } from "lucide-react";
import { useId } from "react";

import { Button } from "./button";
import "./states.css";

export function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  const titleId = useId();
  return (
    <section className="empty-state" aria-labelledby={titleId}>
      <Database aria-hidden="true" />
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && onAction ? (
        <Button size="small" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </section>
  );
}

export function InlineError({
  title,
  detail,
  action = "Retry",
  onRetry,
}: {
  title: string;
  detail: string;
  action?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="inline-error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {onRetry ? (
        <Button size="small" onClick={onRetry}>
          {action}
        </Button>
      ) : null}
    </section>
  );
}

export function SkeletonRow() {
  return (
    <div className="skeleton-row" role="status" aria-label="Loading">
      <span />
      <span />
      <span />
    </div>
  );
}

export function ResearchProgress({ step }: { step: string }) {
  return (
    <div className="research-progress" role="status" aria-live="polite">
      <LoaderCircle aria-hidden="true" />
      <span>{step}</span>
    </div>
  );
}
