import { describe, expect, it } from "vitest";

import { AiBudgetGuard } from "@/services/intelligence/budget-guard";
import type { AiBudgetSettings } from "@/types/domain";

const LIMITS = {
  maxRequestsPerMinute: 30,
  maxConcurrency: 2,
  dailyRequestLimit: 1,
  dailyInputTokenLimit: 100_000,
  dailyOutputTokenLimit: 100_000,
  dailyCostCeilingUsd: 10,
} satisfies AiBudgetSettings;

describe("AI budget guard", () => {
  it("serializes concurrent reservations against the request limit", async () => {
    await withChromeStorage(async () => {
      const guard = new AiBudgetGuard(() => Date.parse("2026-08-02T12:00:00Z"));
      const reservations = await Promise.allSettled([
        guard.reserve(LIMITS),
        guard.reserve(LIMITS),
      ]);

      expect(
        reservations.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        reservations.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      await expect(guard.snapshot()).resolves.toMatchObject({ requests: 1 });
    });
  });

  it("does not lose concurrent usage records", async () => {
    await withoutChromeStorage(async () => {
      const guard = new AiBudgetGuard(() => Date.parse("2026-08-02T12:00:00Z"));
      await Promise.all([
        guard.record(LIMITS, "openai", "gpt-5", {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }),
        guard.record(LIMITS, "openai", "gpt-5", {
          inputTokens: 200,
          outputTokens: 25,
          totalTokens: 225,
        }),
      ]);

      await expect(guard.snapshot()).resolves.toMatchObject({
        inputTokens: 300,
        outputTokens: 75,
        estimatedCostUsd: 0.00135,
      });
    });
  });
});

async function withoutChromeStorage(operation: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: undefined,
  });
  try {
    await operation();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "chrome", descriptor);
  }
}

async function withChromeStorage(operation: () => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  let stored: unknown;
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      storage: {
        local: {
          get: async () =>
            stored === undefined
              ? {}
              : { aiDailyUsageLedger: structuredClone(stored) },
          set: async (value: Record<string, unknown>) => {
            stored = structuredClone(value["aiDailyUsageLedger"]);
          },
        },
      },
    },
  });
  try {
    await operation();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "chrome", descriptor);
  }
}
