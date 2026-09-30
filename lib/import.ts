import ExcelJS from "exceljs";
import type { DB } from "./db";
import { CITIES, SOURCE_TYPES } from "./constants";
import {
  createDoctor, createHospital, findDoctorByName, findHospital, insertReview, linkDoctorHospital,
  reviewExists, validateReview,
} from "./repo";
import { slugify } from "./normalize";

export const TEMPLATE_COLUMNS = [
  "doctor_name", "specialty", "hospital_name", "city", "hospital_address", "doctor_description", "procedures",
  "review_text", "reviewer_name", "review_date", "source_type", "source_link", "source_title", "tags",
] as const;
const REQUIRED = ["doctor_name", "hospital_name", "city", "review_text", "source_type"];

export type RawRow = { _row: number } & Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>>;
export type RowResult = {
  row: number;
  status: "new" | "matched" | "error";
  doctor: "new" | "matched" | "";
  hospital: "new" | "matched" | "";
  doctorName: string;
  hospitalName: string;
  error?: string;
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("result" in v && v.result != null) return cellText(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v) return String(v.hyperlink);
    return "";
  }
  return String(v).trim();
}

export function normalizeDate(s: string): string {
  const t = s.trim();
  const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return t;
}

export async function parseWorkbook(buffer: Buffer | ArrayBuffer): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.getWorksheet("Reviews") ?? wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets");
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col] = cellText(cell.value).toLowerCase().replace(/\s+/g, "_"); });
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}. Download the template for the correct layout.`);
  const rows: RawRow[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const r: RawRow = { _row: n };
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = cellText(row.getCell(col).value);
      if (v) any = true;
      (r as Record<string, string | number>)[h] = v;
    });
    if (any) rows.push(r);
  });
  if (rows.length === 0) throw new Error("No data rows found");
  if (rows.length > 5000) throw new Error("Too many rows (max 5000 per import)");
  return rows;
}

function parseCity(s: string): string | null {
  const t = s.trim().toLowerCase();
  if (t === "kl" || t === "kuala lumpur") return "KL";
  if (t === "melaka" || t === "malacca") return "Melaka";
  return null;
}

/** Processes one row against the DB (creating missing doctors/hospitals). Throws on any error. */
function processRow(db: DB, r: RawRow): Pick<RowResult, "doctor" | "hospital"> {
  const s = (k: keyof RawRow) => String(r[k] ?? "").trim();
  if (!s("doctor_name")) throw new Error("doctor_name is required");
  if (!s("hospital_name")) throw new Error("hospital_name is required");
  const city = parseCity(s("city"));
  if (!city) throw new Error(`city must be one of ${CITIES.join(", ")}`);
  const date = normalizeDate(s("review_date"));
  const invalid = validateReview({
    text: s("review_text"), date, sourceType: s("source_type"), sourceLink: s("source_link"),
  });
  if (invalid) throw new Error(invalid);

  let doctor = findDoctorByName(db, s("doctor_name"));
  const doctorState = doctor ? "matched" : "new";
  let specialtyId = doctor?.specialty_id;
  if (!doctor) {
    if (!s("specialty")) throw new Error("specialty is required for a doctor not yet in the database");
    const sp = db.prepare("SELECT id FROM specialties WHERE name = ? COLLATE NOCASE").get(s("specialty")) as { id: number } | undefined;
    if (!sp) throw new Error(`Unknown specialty "${s("specialty")}"`);
    specialtyId = sp.id;
  }
  const procIds: number[] = [];
  for (const name of s("procedures").split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
    const p = db.prepare("SELECT id FROM procedures WHERE specialty_id = ? AND slug = ?").get(specialtyId, slugify(name)) as { id: number } | undefined;
    if (!p) throw new Error(`Unknown procedure "${name}" for this specialty`);
    procIds.push(p.id);
  }
  if (doctor && reviewExists(db, doctor.id, s("review_text"))) throw new Error("Duplicate review (same doctor and text already exist)");

  const hospital = findHospital(db, s("hospital_name"), city);
  const hospitalId = hospital?.id ?? createHospital(db, { name: s("hospital_name"), city, address: s("hospital_address") });
  const doctorId = doctor?.id ?? createDoctor(db, { name: s("doctor_name"), specialtyId: specialtyId!, description: s("doctor_description") });
  linkDoctorHospital(db, doctorId, hospitalId);
  for (const pid of procIds) db.prepare("INSERT OR IGNORE INTO doctor_procedures VALUES (?,?)").run(doctorId, pid);
  insertReview(db, {
    doctorId, hospitalId, text: s("review_text"), reviewerName: s("reviewer_name"), date,
    sourceType: s("source_type"), sourceLink: s("source_link"), sourceTitle: s("source_title"), tags: s("tags"),
  });
  return { doctor: doctorState, hospital: hospital ? "matched" : "new" };
}

class Rollback extends Error {}

/**
 * Runs every row independently: a failing row is reported and skipped, the rest continue.
 * commit=false performs the identical work inside a transaction that is rolled back (preview).
 */
export function runImport(db: DB, rows: RawRow[], commit: boolean): RowResult[] {
  const results: RowResult[] = [];
  const run = db.transaction(() => {
    for (const r of rows) {
      const base = { row: r._row, doctorName: r.doctor_name ?? "", hospitalName: r.hospital_name ?? "" };
      try {
        const out = db.transaction(() => processRow(db, r))();
        results.push({ ...base, ...out, status: out.doctor === "new" || out.hospital === "new" ? "new" : "matched" });
      } catch (e) {
        results.push({ ...base, doctor: "", hospital: "", status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!commit) throw new Rollback();
  });
  try { run(); } catch (e) { if (!(e instanceof Rollback)) throw e; }
  return results;
}

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reviews");
  ws.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c, key: c, width: Math.max(16, c.length + 4) }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.addRow({
    doctor_name: "Dr Example Name", specialty: "Orthopedics", hospital_name: "Example Specialist Hospital", city: "KL",
    hospital_address: "(optional)", doctor_description: "(optional, used only for new doctors)",
    procedures: "Knee replacement; Knee ligament surgery", review_text: "Full review text…", reviewer_name: "(optional)",
    review_date: "2025-01-31", source_type: "Google review", source_link: "https://example.com/review",
    source_title: "Google review", tags: "ACL, MCL",
  });
  const col = (name: string) => TEMPLATE_COLUMNS.indexOf(name as never) + 1;
  for (let r = 2; r <= 1000; r++) {
    ws.getCell(r, col("city")).dataValidation = { type: "list", allowBlank: true, formulae: [`"${CITIES.join(",")}"`] };
    ws.getCell(r, col("source_type")).dataValidation = { type: "list", allowBlank: true, formulae: [`"${SOURCE_TYPES.join(",")}"`] };
  }
  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 24 }, { width: 100 }];
  [
    ["Required", "doctor_name, hospital_name, city, review_text, source_type"],
    ["city", "KL or Melaka"],
    ["specialty", "Required only when the doctor is not already in the database; must match an existing specialty"],
    ["procedures", "Optional. Separate with ; and use existing procedure names for that specialty"],
    ["review_date", "YYYY-MM-DD (DD/MM/YYYY also accepted). Optional"],
    ["source_type", SOURCE_TYPES.join(" / ")],
    ["source_link", "Required (http/https) for every source type except Patient submission"],
    ["Matching", "Doctors are matched by name (ignoring Dr/Dr., case and extra spaces). Hospitals by name + city. Missing ones are created."],
    ["Delete row 2", "Row 2 is an example; remove it before uploading."],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
