import { describe, expect, it, vi } from "vitest";

import {
  detectColumnMapping,
  exportCsv,
  parseCsv,
  parseJson,
  sanitizeCsvCell,
  validateImportRows,
} from "@/services/imports/import-service";
import {
  containsCredential,
  redactText,
  redactValue,
  stableAlias,
} from "@/services/security/redaction";
import {
  safeOpenExternal,
  validateExternalHttpsUrl,
} from "@/services/security/url";

describe("data import safety", () => {
  it("parses and normalizes CSV columns", () => {
    const rows = parseCsv("Player Name,Overall Rank,ADP\nMalik Nabers,4,8");
    expect(rows[0]).toMatchObject({
      player_name: "Malik Nabers",
      overall_rank: "4",
      adp: "8",
    });
    expect(detectColumnMapping(["name", "overall_rank", "adp"])).toEqual({
      name: "name",
      overall_rank: "overall_rank",
      adp: "adp",
    });
  });

  it("parses array and wrapped JSON and rejects invalid structures", () => {
    expect(parseJson('[{"name":"A","rank":1}]')).toHaveLength(1);
    expect(parseJson('{"rows":[{"name":"B"}]}')[0]?.name).toBe("B");
    expect(() => parseJson("{")).toThrow(
      expect.objectContaining({
        safeDetail: expect.stringContaining("valid JSON"),
      }),
    );
    expect(() => parseJson('{"name":"not rows"}')).toThrow(
      expect.objectContaining({
        safeDetail: expect.stringContaining("rows array"),
      }),
    );
    expect(() => parseJson('[["not an object"]]')).toThrow(
      expect.objectContaining({
        safeDetail: expect.stringContaining("not an object"),
      }),
    );
  });

  it("reports missing identities and validates safe rows", () => {
    const validation = validateImportRows([
      { name: "Player A", rank: 1 },
      { rank: 2 },
    ]);
    expect(validation.validRows).toHaveLength(1);
    expect(validation.errors[0]?.column).toBe("name");
  });

  it("enforces row, column, depth, and field limits", () => {
    expect(() =>
      validateImportRows(
        Array.from({ length: 20_001 }, (_, index) => ({
          name: `Player ${index}`,
        })),
      ),
    ).toThrow();
    expect(() =>
      validateImportRows([
        Object.fromEntries([
          ["name", "Player"],
          ...Array.from({ length: 81 }, (_, index) => [
            `column_${index}`,
            index,
          ]),
        ]),
      ]),
    ).toThrow();
    expect(() =>
      parseJson(
        JSON.stringify([
          { name: "Player", value: [[[[[[[[["too deep"]]]]]]]]] },
        ]),
      ),
    ).toThrow();
    expect(
      validateImportRows([{ name: "Player", notes: "x".repeat(2_001) }]).errors,
    ).toHaveLength(1);
  });

  it("protects spreadsheet exports from formula injection", () => {
    expect(sanitizeCsvCell('=WEBSERVICE("bad")')).toContain("'=");
    expect(sanitizeCsvCell("hello, world")).toBe('"hello, world"');
    expect(exportCsv([{ name: "@SUM(A1)", rank: 1 }])).toContain("'@SUM(A1)");
    expect(sanitizeCsvCell("+1")).toBe("'+1");
    expect(sanitizeCsvCell("-1")).toBe("'-1");
    expect(sanitizeCsvCell({ unsafe: true })).toBe("");
  });
});

describe("redaction and safe URLs", () => {
  it("redacts keys, authorization, identifiers, and deep values", () => {
    const key = "sk-abcdefghijklmnop";
    expect(redactText(`Authorization: Bearer token ${key}`)).not.toContain(key);
    const redacted = redactValue({
      userId: "123",
      nested: { apiKey: key, safe: "ok" },
      list: [key],
    }) as Record<string, unknown>;
    expect(redacted.userId).toBe("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain(key);
  });

  it("detects credential-like data consistently", () => {
    const payload = { value: "sk-abcdefghijklmnop" };
    expect(containsCredential(payload)).toBe(true);
    expect(containsCredential(payload)).toBe(true);
    expect(containsCredential({ authorization: "anything" })).toBe(true);
    expect(containsCredential({ harmless: "hello" })).toBe(false);
  });

  it("creates stable, namespace-scoped aliases", async () => {
    const first = await stableAlias("user", "123");
    expect(await stableAlias("user", "123")).toBe(first);
    expect(await stableAlias("league", "123")).not.toBe(first);
  });

  it.each([
    ["https://example.com/path", true],
    ["http://example.com/path", false],
    ["https://localhost/path", false],
    ["https://user:pass@example.com/path", false],
    ["not a url", false],
  ])("validates external URL %s", (url, valid) => {
    expect(validateExternalHttpsUrl(url) !== null).toBe(valid);
  });

  it("opens only validated URLs with isolation flags", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(safeOpenExternal("javascript:alert(1)")).toBe(false);
    expect(safeOpenExternal("https://example.com/source")).toBe(true);
    expect(open).toHaveBeenCalledWith(
      "https://example.com/source",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
