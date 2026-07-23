import { redactValue } from "./redaction";

export type LogLevel = "debug" | "info" | "warning" | "error";

type LogEntry = {
  timestamp: number;
  level: LogLevel;
  event: string;
  data?: unknown;
};

const priority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

const MAX_ENTRIES = 200;

export class StructuredLogger {
  private readonly entries: LogEntry[] = [];
  private level: LogLevel;

  constructor(level: LogLevel = import.meta.env.PROD ? "warning" : "debug") {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  log(level: LogLevel, event: string, data?: unknown) {
    if (priority[level] < priority[this.level]) return;
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      event: redactValue(event) as string,
      ...(data === undefined ? {} : { data: redactValue(data) }),
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    const method = level === "warning" ? "warn" : level;
    console[method](entry.event, entry.data ?? "");
  }

  debug(event: string, data?: unknown) {
    this.log("debug", event, data);
  }

  info(event: string, data?: unknown) {
    this.log("info", event, data);
  }

  warning(event: string, data?: unknown) {
    this.log("warning", event, data);
  }

  error(event: string, data?: unknown) {
    this.log("error", event, data);
  }

  export(): readonly LogEntry[] {
    return structuredClone(this.entries);
  }
}

export const logger = new StructuredLogger();
