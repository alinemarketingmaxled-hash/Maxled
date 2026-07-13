export type ImportSummary = { created: number; updated: number; skipped: number };

export const CONTACT_CSV_COLUMNS = [
  "ownerEmail",
  "firstName",
  "lastName",
  "accountName",
  "email",
  "phone",
  "mobile",
  "residentialPhone",
  "assistantPhone",
  "leadSource",
  "supplierName",
  "jobTitle",
  "department",
  "street",
  "number",
  "city",
  "state",
  "postalCode",
  "latitude",
  "longitude",
] as const;

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const header = CONTACT_CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CONTACT_CSV_COLUMNS.map((col) => escapeCsvField(row[col])).join(","),
  );
  return [header, ...lines].join("\r\n");
}

/** Minimal RFC4180 parser: handles quoted fields, escaped quotes, commas/newlines inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = r[idx] ?? "";
    });
    return obj;
  });
}
