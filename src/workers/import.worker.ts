import {
  parseCsv,
  parseJson,
  validateImportRows,
} from "@/services/imports/import-service";

self.addEventListener(
  "message",
  (
    event: MessageEvent<{
      type: "csv" | "json";
      text: string;
    }>,
  ) => {
    try {
      const rows =
        event.data.type === "csv"
          ? parseCsv(event.data.text)
          : parseJson(event.data.text);
      self.postMessage({ ok: true, result: validateImportRows(rows) });
    } catch (error) {
      self.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  },
);
