import { AppError } from "@/services/errors/app-error";

type QueueOptions = {
  requestsPerMinute: number;
  concurrency: number;
  hardConcurrencyCeiling?: number;
  now?: () => number;
};

type QueueItem<T> = {
  key: string;
  run: (signal: AbortSignal) => Promise<T>;
  controller: AbortController;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export class RequestQueue {
  private readonly queue: Array<QueueItem<unknown>> = [];
  private readonly active = new Map<
    string,
    { promise: Promise<unknown>; controller: AbortController }
  >();
  private readonly starts: number[] = [];
  private readonly now: () => number;
  private requestsPerMinute: number;
  private concurrency: number;
  private readonly hardConcurrencyCeiling: number;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: QueueOptions) {
    this.requestsPerMinute = clamp(options.requestsPerMinute, 1, 12);
    this.hardConcurrencyCeiling = clamp(
      options.hardConcurrencyCeiling ?? 2,
      1,
      2,
    );
    this.concurrency = clamp(
      options.concurrency,
      1,
      this.hardConcurrencyCeiling,
    );
    this.now = options.now ?? Date.now;
  }

  configure(options: Pick<QueueOptions, "requestsPerMinute" | "concurrency">) {
    this.requestsPerMinute = clamp(options.requestsPerMinute, 1, 12);
    this.concurrency = clamp(
      options.concurrency,
      1,
      this.hardConcurrencyCeiling,
    );
    this.pump();
  }

  enqueue<T>(
    key: string,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const existing = this.active.get(key);
    if (existing) return existing.promise as Promise<T>;
    const queued = this.queue.find((item) => item.key === key);
    if (queued) {
      return new Promise<T>((resolve, reject) => {
        const priorResolve = queued.resolve;
        const priorReject = queued.reject;
        queued.resolve = (value) => {
          priorResolve(value);
          resolve(value as T);
        };
        queued.reject = (reason) => {
          priorReject(reason);
          reject(
            reason instanceof Error
              ? reason
              : new Error("The queued request failed."),
          );
        };
      });
    }

    const controller = new AbortController();
    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        key,
        run,
        controller,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
    return promise;
  }

  cancel(key: string): boolean {
    const queueIndex = this.queue.findIndex((item) => item.key === key);
    if (queueIndex >= 0) {
      const item = this.queue.splice(queueIndex, 1)[0];
      item?.controller.abort();
      item?.reject(cancelledError());
      return true;
    }
    const active = this.active.get(key);
    if (!active) return false;
    active.controller.abort();
    return true;
  }

  cancelAll() {
    for (const item of this.queue.splice(0)) {
      item.controller.abort();
      item.reject(cancelledError());
    }
    for (const active of this.active.values()) active.controller.abort();
  }

  get size(): number {
    return this.queue.length + this.active.size;
  }

  private pump() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pruneStarts();
    while (
      this.active.size < this.concurrency &&
      this.queue.length > 0 &&
      this.starts.length < this.requestsPerMinute
    ) {
      const item = this.queue.shift();
      if (!item) break;
      this.start(item);
    }
    if (this.queue.length > 0 && this.starts.length >= this.requestsPerMinute) {
      const delay = Math.max(1, 60_000 - (this.now() - (this.starts[0] ?? 0)));
      this.timer = setTimeout(() => this.pump(), delay);
    }
  }

  private start(item: QueueItem<unknown>) {
    this.starts.push(this.now());
    const promise = item.run(item.controller.signal);
    this.active.set(item.key, { promise, controller: item.controller });
    void promise.then(item.resolve, item.reject).finally(() => {
      this.active.delete(item.key);
      this.pump();
    });
  }

  private pruneStarts() {
    const cutoff = this.now() - 60_000;
    while ((this.starts[0] ?? Number.POSITIVE_INFINITY) <= cutoff) {
      this.starts.shift();
    }
  }
}

export function stableContentHash(value: unknown): string {
  const serialized = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function cancelledError(): AppError {
  return new AppError({
    code: "CANCELLED",
    message: "The request was cancelled.",
    safeDetail: "The queued operation was stopped before completion.",
    suggestedAction: "Retry when ready.",
    retryable: true,
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}
