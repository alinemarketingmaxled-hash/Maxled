export type ImportSummary = { created: number; updated: number; skipped: number };

export const CONTACT_CSV_COLUMNS = [
  "ownerEmail",
  "personType",
  "firstName",
  "lastName",
  "accountName",
  "cnpj",
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
  "birthday",
  "commercialPotential",
  "crmStatus",
  "nextContactAt",
  "notes",
] as const;

/** Parses dd/mm/yyyy (common in BR spreadsheets) or ISO yyyy-mm-dd; returns
 * null for anything else rather than guessing. */
export function parseBrDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(v);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

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

/** Friendly Portuguese template for bulk-adding clients — downloadable from
 * Clientes, and readable back by the same fuzzy importer below. */
export function buildImportTemplate(): string {
  const headers = [
    "Proprietário (e-mail)", "Tipo de Pessoa", "Nome", "Sobrenome", "Empresa", "CNPJ", "E-mail",
    "Telefone", "Celular", "Telefone residencial", "Telefone do assistente",
    "Origem do lead", "Fornecedor", "Cargo", "Departamento",
    "Rua", "Número", "Cidade", "Estado", "CEP",
    "Data Aniversário", "Potencial Comercial", "Status CRM", "Próximo Contato", "Observações",
  ];
  const example = [
    "", "Jurídica", "João", "Silva", "Distribuidora ABC", "12.345.678/0001-90", "joao@abc.com.br",
    "1133334444", "11988887777", "", "",
    "Indicação", "", "Comprador", "Compras",
    "Rua das Flores", "123", "São Paulo", "SP", "01310-100",
    "15/03/1980", "Alto", "Ativo", "20/07/2026", "Prefere contato pela manhã.",
  ];
  return [headers, example].map((r) => r.map(escapeCsvField).join(",")).join("\r\n");
}

/** Raw RFC4180 tokenizer: handles quoted fields, escaped quotes, commas/newlines inside quotes. */
function tokenizeCsv(text: string): string[][] {
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
  return rows;
}

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "fullName" is a virtual target — matched columns get split into
 * firstName/lastName after mapping, never stored directly. */
type TargetField = (typeof CONTACT_CSV_COLUMNS)[number] | "fullName";

const FIELD_ALIASES: Record<TargetField, string[]> = {
  ownerEmail: ["ownerEmail", "proprietario", "proprietarioemail", "vendedor", "owner"],
  personType: ["personType", "tipodepessoa", "tipopessoa"],
  firstName: ["firstName", "nome", "primeironome"],
  lastName: ["lastName", "sobrenome", "ultimonome"],
  fullName: ["fullName", "nomecompleto", "nomeesobrenome", "name", "comprador", "compradorcontato"],
  accountName: ["accountName", "empresa", "conta", "razaosocial", "company", "clienterazaosocial"],
  cnpj: ["cnpj", "cnpjdaempresa"],
  email: ["email", "emailcorreio", "correio"],
  phone: ["phone", "telefone", "fone", "tel"],
  mobile: ["mobile", "celular", "whatsapp", "whats", "cel", "telefonewhatsapp"],
  residentialPhone: ["residentialPhone", "telefoneresidencial", "residencial"],
  assistantPhone: ["assistantPhone", "telefonedoassistente", "telefoneassistente", "assistente"],
  leadSource: ["leadSource", "origemdolead", "origem", "fonte"],
  supplierName: ["supplierName", "fornecedor", "nomefornecedor"],
  jobTitle: ["jobTitle", "cargo", "titulo"],
  department: ["department", "departamento", "setor"],
  street: ["street", "rua", "endereco", "logradouro"],
  number: ["number", "numero", "num"],
  city: ["city", "cidade"],
  state: ["state", "estado", "uf"],
  postalCode: ["postalCode", "cep", "zip", "zipcode"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "long"],
  birthday: ["birthday", "dataaniversario", "aniversario", "datadeaniversario", "dataaniversariocomprador"],
  commercialPotential: ["commercialPotential", "potencialcomercial", "potencial"],
  crmStatus: ["crmStatus", "statuscrm", "status"],
  nextContactAt: ["nextContactAt", "proximocontato", "proximocontatoem"],
  notes: ["notes", "observacoes", "obs", "observacao"],
};

/** Splits into individually-normalized words — "Fone Contato" -> ["fone", "contato"]. */
function headerWords(s: string): string[] {
  return s
    .split(/[\s_/-]+/)
    .map(normalizeHeader)
    .filter(Boolean);
}

const ALIAS_ENTRIES: Array<{ field: TargetField; blob: string; words: string[] }> = Object.entries(
  FIELD_ALIASES,
).flatMap(([field, aliases]) =>
  aliases.map((alias) => ({
    field: field as TargetField,
    blob: normalizeHeader(alias),
    words: headerWords(alias),
  })),
);

/** Is `needle` a contiguous run of whole words inside `haystack`? Whole-word
 * only (never a raw substring) — e.g. "conta" must never match inside
 * "contato", which a plain substring check would wrongly allow. */
function containsWordSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return true;
  }
  return false;
}

/**
 * Assigns each header to at most one field, and each field to at most one
 * header. Exact (whole-header) matches are resolved first, across all
 * columns, before any column falls back to whole-word matching — so a
 * strong match elsewhere can't get stolen by a weaker one, and short
 * aliases never match as a mere substring of an unrelated word.
 */
function assignColumns(headers: string[]): (TargetField | null)[] {
  const blobs = headers.map(normalizeHeader);
  const wordLists = headers.map(headerWords);
  const result: (TargetField | null)[] = new Array(headers.length).fill(null);
  const claimed = new Set<TargetField>();

  blobs.forEach((blob, idx) => {
    if (!blob) return;
    const exact = ALIAS_ENTRIES.find((a) => a.blob === blob && !claimed.has(a.field));
    if (exact) {
      result[idx] = exact.field;
      claimed.add(exact.field);
    }
  });

  const byLongestAliasFirst = [...ALIAS_ENTRIES].sort((a, b) => b.words.length - a.words.length);
  wordLists.forEach((words, idx) => {
    if (result[idx] || words.length === 0) return;
    const match = byLongestAliasFirst.find(
      (a) => !claimed.has(a.field) && containsWordSequence(words, a.words),
    );
    if (match) {
      result[idx] = match.field;
      claimed.add(match.field);
    }
  });

  return result;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[a-zA-ZÀ-ÿ'.\s-]+$/;
const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{4}-\d{1,2}-\d{1,2}$/;
const PHONE_SLOTS: TargetField[] = ["phone", "mobile", "residentialPhone", "assistantPhone"];

/** For columns a header couldn't identify, guess the field by sniffing a
 * few sample values — handles genuinely unlabeled/"bagunçada" sheets. */
function guessFieldFromValues(values: string[], assigned: Set<TargetField>): TargetField | null {
  const sample = values.filter((v) => v.trim()).slice(0, 5);
  if (sample.length === 0) return null;

  if (!assigned.has("email") && sample.every((v) => EMAIL_RE.test(v.trim()))) return "email";

  // Dates like "10/06/2026" strip down to 8 digits, which would otherwise
  // collide with the phone-number digit-count check below.
  if (sample.some((v) => DATE_RE.test(v.trim()))) return null;

  const digitCounts = sample.map((v) => v.replace(/\D/g, "").length);
  if (digitCounts.every((n) => n >= 8 && n <= 13)) {
    const slot = PHONE_SLOTS.find((f) => !assigned.has(f));
    if (slot) return slot;
  }

  if (
    !assigned.has("fullName") &&
    !assigned.has("firstName") &&
    sample.every((v) => NAME_RE.test(v.trim()) && v.trim().includes(" "))
  ) {
    return "fullName";
  }

  return null;
}

/**
 * Smart tabular import: maps whatever headers a spreadsheet has (Portuguese,
 * English, reordered, or missing entirely) onto the real Contact fields —
 * by header name first, falling back to sniffing cell contents for columns
 * a header alone can't identify. Always returns the canonical
 * CONTACT_CSV_COLUMNS keys so callers don't need to know about aliases.
 * Shared by the CSV and Excel importers — both just tokenize their own
 * format into a plain string[][] and hand it here.
 */
export function mapRows(rawHeaders: string[], dataRows: string[][]): Record<string, string>[] {
  const columnField = assignColumns(rawHeaders);

  const assigned = new Set(columnField.filter((f): f is TargetField => f !== null));
  columnField.forEach((field, idx) => {
    if (field !== null) return;
    const values = dataRows.map((r) => r[idx] ?? "");
    const guessed = guessFieldFromValues(values, assigned);
    if (guessed) {
      columnField[idx] = guessed;
      assigned.add(guessed);
    }
  });

  return dataRows.map((r) => {
    const obj: Record<string, string> = {};
    let fullName = "";
    columnField.forEach((field, idx) => {
      const value = (r[idx] ?? "").trim();
      if (!field || !value) return;
      if (field === "fullName") {
        fullName = value;
      } else {
        obj[field] = value;
      }
    });
    if (fullName && !obj.firstName) {
      const spaceIdx = fullName.indexOf(" ");
      if (spaceIdx === -1) {
        obj.firstName = fullName;
      } else {
        obj.firstName = fullName.slice(0, spaceIdx);
        obj.lastName = fullName.slice(spaceIdx + 1).trim();
      }
    }
    return obj;
  });
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = tokenizeCsv(text);
  if (rows.length === 0) return [];
  const [rawHeaders, ...dataRows] = rows;
  return mapRows(rawHeaders, dataRows);
}

/** Same smart import as parseCsv, for an uploaded .xlsx/.xls file — reads
 * the first worksheet and feeds it through the identical header-matching
 * logic, so a client's own Excel export works without reformatting. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const allRows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v === null || v === undefined) {
        cells.push("");
      } else if (v instanceof Date) {
        cells.push(v.toLocaleDateString("pt-BR"));
      } else if (typeof v === "object" && "text" in v) {
        cells.push(String((v as { text: unknown }).text ?? ""));
      } else if (typeof v === "object" && "result" in v) {
        cells.push(String((v as { result: unknown }).result ?? ""));
      } else {
        cells.push(String(v));
      }
    });
    if (cells.some((c) => c !== "")) allRows.push(cells);
  });
  if (allRows.length === 0) return [];

  const [rawHeaders, ...dataRows] = allRows;
  return mapRows(rawHeaders, dataRows);
}
