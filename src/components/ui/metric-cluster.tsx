import type { ReactNode } from "react";

import "./metric-cluster.css";

export type Metric = {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
  detail?: string;
};

export function MetricCluster({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="metric-cluster">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd
            className={`metric-value metric-value--${metric.tone ?? "default"}`}
          >
            {metric.value}
          </dd>
          {metric.detail ? <small>{metric.detail}</small> : null}
        </div>
      ))}
    </dl>
  );
}
