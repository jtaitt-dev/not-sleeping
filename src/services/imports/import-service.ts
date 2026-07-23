import Papa from "papaparse";
import { z } from "zod";

import { AppError } from "@/services/errors/app-error";

export const IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRows: 20_000,
  maxFieldLength: 2_000,
  maxJsonDepth: 8,
  maxColumns: 80,
} as const;

export const RECOGNIZED_COLUMNS = [
  "player_id",
  "sleeper_id",
  "name",
  "first_name",
  "last_name",
  "team",
  "position",
  "rank",
  "overall_rank",
  "positional_rank",
  "tier",
  "adp",
  "projected_points",
  "redraft_value",
  "dynasty_value",
  "rookie_value",
  "contender_value",
  "rebuilder_value",
  "age",
  "draft_year",
  "draft_round",
  "draft_pick",
  "source",
  "updated_at",
] as const;

export type RecognizedColumn = (typeof RECOGNIZED_COLUMNS)[number];
export type ImportRow = Record<string, string | number | boolean | null>;

export type ImportValidation = {
  validRows: ImportRow[];
  errors: Array<{ row: number; column: string; message: string }>;
  detectedColumns: string[];
  mapping: Partial<Record<RecognizedColumn, string>>;
};

const safeScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export function parseCsv(input: string): ImportRow[] {
  const result = Papa.parse<Record<string, unknown>>(input, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeColumn,
  });
  if (result.errors.length > 0) {
    const error = result.errors[0];
    throw invalidImport(
      `CSV row ${(error?.row ?? 0) + 1}: ${error?.message ?? "Parse error"}`,
    );
  }
  return result.data.map(normalizeRecord);
}

export function parseJson(input: string): ImportRow[] {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw invalidImport("The JSON file is not valid JSON.");
  }
  if (jsonDepth(value) > IMPORT_LIMITS.maxJsonDepth) {
    throw invalidImport("The JSON file exceeds the maximum nesting depth.");
  }
  const rows = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as Record<string, unknown>)["rows"])
      ? ((value as Record<string, unknown>)["rows"] as unknown[])
      : null;
  if (!rows)
    throw invalidImport(
      "JSON must be an array or an object with a rows array.",
    );
  return rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw invalidImport(`JSON row ${index + 1} is not an object.`);
    }
    return normalizeRecord(row as Record<string, unknown>);
  });
}

export function validateImportRows(rows: ImportRow[]): ImportValidation {
  if (rows.length > IMPORT_LIMITS.maxRows) {
    throw invalidImport(
      `The file contains more than ${IMPORT_LIMITS.maxRows} rows.`,
    );
  }
  const detectedColumns = [
    ...new Set(rows.slice(0, 100).flatMap((row) => Object.keys(row))),
  ];
  if (detectedColumns.length > IMPORT_LIMITS.maxColumns) {
    throw invalidImport("The file contains too many columns.");
  }
  const mapping = detectColumnMapping(detectedColumns);
  const errors: ImportValidation["errors"] = [];
  const validRows = rows.filter((row, rowIndex) => {
    let valid = true;
    for (const [column, value] of Object.entries(row)) {
      const parsed = safeScalar.safeParse(value);
      if (
        !parsed.success ||
        String(value ?? "").length > IMPORT_LIMITS.maxFieldLength
      ) {
        errors.push({
          row: rowIndex + 2,
          column,
          message: "Field is invalid or exceeds the maximum length.",
        });
        valid = false;
      }
    }
    const hasIdentity =
      Boolean(row[mapping.sleeper_id ?? ""]) ||
      Boolean(row[mapping.player_id ?? ""]) ||
      Boolean(row[mapping.name ?? ""]) ||
      Boolean(row[mapping.first_name ?? ""]);
    if (!hasIdentity) {
      errors.push({
        row: rowIndex + 2,
        column: "name",
        message: "A player ID or name is required.",
      });
      valid = false;
    }
    return valid;
  });
  return { validRows, errors, detectedColumns, mapping };
}

export function detectColumnMapping(
  columns: string[],
): Partial<Record<RecognizedColumn, string>> {
  const normalized = new Map(
    columns.map((column) => [normalizeColumn(column), column]),
  );
  return Object.fromEntries(
    RECOGNIZED_COLUMNS.flatMap((column) => {
      const source = normalized.get(column);
      return source ? [[column, source]] : [];
    }),
  );
}

export function sanitizeCsvCell(value: unknown): string {
  const text = scalarToString(value);
  const protectedValue = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

export function exportCsv(rows: ImportRow[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns.map(sanitizeCsvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => sanitizeCsvCell(row[column])).join(","),
    ),
  ].join("\r\n");
}

export async function readImportFile(file: File): Promise<ImportValidation> {
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    throw invalidImport("The selected file exceeds the 5 MB limit.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "json") {
    throw invalidImport("Only CSV and JSON imports are supported.");
  }
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (isExecutableHeader(bytes)) {
    throw invalidImport("Executable files are not accepted.");
  }
  const text = await file.text();
  const rows = extension === "csv" ? parseCsv(text) : parseJson(text);
  return validateImportRows(rows);
}

function normalizeRecord(record: Record<string, unknown>): ImportRow {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value === undefined) return [normalizeColumn(key), null];
      const parsed = safeScalar.safeParse(value);
      return [normalizeColumn(key), parsed.success ? parsed.data : null];
    }),
  );
}

function normalizeColumn(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s./-]+/g, "_")
    .replaceAll(/[^a-z0-9_]/g, "");
}

function jsonDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return depth;
  const children: unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : Object.values(value as Record<string, unknown>);
  return children.reduce<number>(
    (maximum, child) => Math.max(maximum, jsonDepth(child, depth + 1)),
    depth,
  );
}

function scalarToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function isExecutableHeader(bytes: Uint8Array): boolean {
  const signature = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return (
    signature.startsWith("4d5a") ||
    signature.startsWith("7f454c46") ||
    signature.startsWith("cafebabe") ||
    signature.startsWith("504b0304")
  );
}

function invalidImport(detail: string): AppError {
  return new AppError({
    code: "INVALID_IMPORT",
    message: "The data file could not be imported.",
    safeDetail: detail,
    suggestedAction: "Correct the reported row or mapping and try again.",
    retryable: false,
  });
}
