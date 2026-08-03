import { AppError } from "@/services/errors/app-error";
import type { AiUsage } from "@/providers/ai/types";
import type { AiBudgetSettings, AiProviderId } from "@/types/domain";

const STORAGE_KEY = "aiDailyUsageLedger";

type UsageLedger = {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export class AiBudgetGuard {
  private memory: UsageLedger | null = null;
  private operationTail = Promise.resolve();

  constructor(private readonly now: () => number = Date.now) {}

  async reserve(limits: AiBudgetSettings): Promise<void> {
    return this.runExclusive(async () => {
      const ledger = await this.read();
      if (ledger.requests >= limits.dailyRequestLimit) {
        throw budgetError("The daily AI request limit has been reached.");
      }
      if (ledger.inputTokens >= limits.dailyInputTokenLimit) {
        throw budgetError("The daily AI input-token limit has been reached.");
      }
      if (ledger.outputTokens >= limits.dailyOutputTokenLimit) {
        throw budgetError("The daily AI output-token limit has been reached.");
      }
      if (ledger.estimatedCostUsd >= limits.dailyCostCeilingUsd) {
        throw budgetError(
          "The configured daily AI cost ceiling has been reached.",
        );
      }
      await this.write({ ...ledger, requests: ledger.requests + 1 });
    });
  }

  async record(
    limits: AiBudgetSettings,
    provider: AiProviderId,
    model: string,
    usage: AiUsage,
  ): Promise<void> {
    return this.runExclusive(async () => {
      const ledger = await this.read();
      await this.write({
        ...ledger,
        inputTokens: Math.min(
          limits.dailyInputTokenLimit,
          ledger.inputTokens + usage.inputTokens,
        ),
        outputTokens: Math.min(
          limits.dailyOutputTokenLimit,
          ledger.outputTokens + usage.outputTokens,
        ),
        estimatedCostUsd: roundMoney(
          ledger.estimatedCostUsd + estimateCost(provider, model, usage),
        ),
      });
    });
  }

  async snapshot(): Promise<UsageLedger> {
    return this.runExclusive(() => this.read());
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release: () => void = () => undefined;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async read(): Promise<UsageLedger> {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (!hasChromeStorage()) {
      if (this.memory?.day !== day) this.memory = emptyLedger(day);
      return { ...this.memory };
    }
    const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    if (!isUsageLedger(stored) || stored.day !== day) return emptyLedger(day);
    return stored;
  }

  private async write(ledger: UsageLedger): Promise<void> {
    this.memory = { ...ledger };
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEY]: ledger });
    }
  }
}

function estimateCost(
  provider: AiProviderId,
  model: string,
  usage: AiUsage,
): number {
  const premium = /(?:sol|opus)/i.test(model);
  const economy = /(?:luna|haiku)/i.test(model);
  const inputPerMillion = economy
    ? 1
    : premium
      ? 15
      : provider === "anthropic"
        ? 3
        : 2;
  const outputPerMillion = economy
    ? 5
    : premium
      ? 75
      : provider === "anthropic"
        ? 15
        : 10;
  return (
    (usage.inputTokens / 1_000_000) * inputPerMillion +
    (usage.outputTokens / 1_000_000) * outputPerMillion
  );
}

function emptyLedger(day: string): UsageLedger {
  return {
    day,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  };
}

function isUsageLedger(value: unknown): value is UsageLedger {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["day"] === "string" &&
    typeof record["requests"] === "number" &&
    typeof record["inputTokens"] === "number" &&
    typeof record["outputTokens"] === "number" &&
    typeof record["estimatedCostUsd"] === "number"
  );
}

function hasChromeStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  return Boolean(Reflect.get(chromeValue, "storage"));
}

function budgetError(message: string): AppError {
  return new AppError({
    code: "QUOTA_EXHAUSTED",
    message,
    safeDetail: "A local user-configured AI budget guard stopped the request.",
    suggestedAction:
      "Use the deterministic result or adjust AI limits in Settings.",
    retryable: false,
  });
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
