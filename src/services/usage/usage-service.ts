import { db } from "@/services/cache/database";
import type { UsageEvent } from "@/types/domain";

export type UsageSummary = {
  requests: number;
  successes: number;
  failures: number;
  cacheHits: number;
  cacheMisses: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  byModel: Record<string, number>;
  byFeature: Record<string, number>;
};

export async function recordUsage(
  event: Omit<UsageEvent, "id" | "timestamp">,
): Promise<void> {
  await db.usage.put({
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
}

export async function summarizeUsage(
  since = 0,
  until = Number.MAX_SAFE_INTEGER,
): Promise<UsageSummary> {
  const events = await db.usage
    .where("timestamp")
    .between(since, until, true, true)
    .toArray();
  return events.reduce<UsageSummary>(
    (summary, event) => {
      summary.requests +=
        event.status === "success" || event.status === "failure" ? 1 : 0;
      summary.successes += event.status === "success" ? 1 : 0;
      summary.failures += event.status === "failure" ? 1 : 0;
      summary.cacheHits += event.status === "cache_hit" ? 1 : 0;
      summary.cacheMisses += event.status === "cache_miss" ? 1 : 0;
      summary.inputTokens += event.inputTokens;
      summary.outputTokens += event.outputTokens;
      summary.totalTokens += event.totalTokens;
      if (event.model) {
        summary.byModel[event.model] = (summary.byModel[event.model] ?? 0) + 1;
      }
      summary.byFeature[event.feature] =
        (summary.byFeature[event.feature] ?? 0) + 1;
      return summary;
    },
    {
      requests: 0,
      successes: 0,
      failures: 0,
      cacheHits: 0,
      cacheMisses: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      byModel: {},
      byFeature: {},
    },
  );
}

export async function clearUsage(): Promise<void> {
  await db.usage.clear();
}
