import * as XLSX from "xlsx";
import fs from "fs";
import { Readable } from "stream";

export interface CompanyRow {
  name: string;
  website: string;
  email: string;
  description?: string;
  linkedin?: string;
  twitter?: string;
  phone?: string;
}

// ─── Normalisation helpers ───────────────────────────────────────────

/** Collapse a header to a single lowercase token (strip spaces/underscores/dashes) */
function norm(s: string): string {
  return s.toString().trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

/** Pick the first non-empty value whose normalised key matches any pattern */
function pick(row: Record<string, any>, patterns: string[]): any {
  for (const p of patterns) {
    if (row[p] !== undefined && row[p] !== null && String(row[p]).trim() !== "") {
      return row[p];
    }
  }
  return undefined;
}

// Mapping: field → accepted normalised header names
const FIELD_MAP: Record<string, string[]> = {
  name: [
    "companyname", "company", "name", "organisation", "organization",
    "org", "firm", "businessname", "business",
  ],
  website: [
    "website", "url", "site", "web", "companywebsite", "companyurl",
    "homepage", "domain", "link", "websiteurl",
  ],
  email: [
    "email", "emailaddress", "companyemail", "contactemail",
    "mail", "emailid", "contactemail",
  ],
  description: [
    "description", "shortdescription", "about", "desc", "summary",
    "bio", "companydesc", "companydescription",
  ],
  linkedin: ["linkedin", "linkedinurl", "linkedinprofile"],
  twitter: ["twitter", "twitterurl", "x", "twitterhandle"],
  phone: [
    "phone", "phonenumber", "telephone", "tel", "mobile",
    "contactphone", "companyphone",
  ],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── URL normalisation ──────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

/** Extract the root domain from a URL for deduplication */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

// ─── Row → CompanyRow ───────────────────────────────────────────────

function rowToCompany(rawRow: Record<string, any>): CompanyRow | null {
  // Build normalised-key version of the row
  const n: Record<string, any> = {};
  for (const [key, val] of Object.entries(rawRow)) {
    n[norm(key)] = val;
  }

  const name = pick(n, FIELD_MAP.name);
  const website = pick(n, FIELD_MAP.website);
  const email = pick(n, FIELD_MAP.email);

  if (!name || !website || !email) return null;

  const emailStr = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(emailStr)) return null;

  const websiteStr = normalizeUrl(String(website));

  return {
    name: String(name).trim(),
    website: websiteStr,
    email: emailStr,
    description: pick(n, FIELD_MAP.description) ? String(pick(n, FIELD_MAP.description)).trim() : undefined,
    linkedin: pick(n, FIELD_MAP.linkedin) ? String(pick(n, FIELD_MAP.linkedin)).trim() : undefined,
    twitter: pick(n, FIELD_MAP.twitter) ? String(pick(n, FIELD_MAP.twitter)).trim() : undefined,
    phone: pick(n, FIELD_MAP.phone) ? String(pick(n, FIELD_MAP.phone)).trim() : undefined,
  };
}

// ─── Domain deduplication ───────────────────────────────────────────

function deduplicateByDomain(companies: CompanyRow[]): CompanyRow[] {
  const seen = new Map<string, CompanyRow>();
  for (const c of companies) {
    const domain = extractDomain(c.website);
    if (!seen.has(domain)) {
      seen.set(domain, c);
    }
  }
  return Array.from(seen.values());
}

// ─── Public: parse Excel/CSV file ───────────────────────────────────

export function parseExcel(filePath: string): CompanyRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  if (rows.length === 0) {
    console.log("[parser] Sheet is empty or headers couldn't be detected");
    return [];
  }

  const headers = Object.keys(rows[0]);
  console.log(`[parser] Detected ${rows.length} rows with headers:`, headers);

  const companies: CompanyRow[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const c = rowToCompany(row);
    if (c) companies.push(c);
    else skippedRows++;
  }

  const deduped = deduplicateByDomain(companies);

  console.log(
    `[parser] Parsed ${companies.length} valid / ${skippedRows} skipped / ` +
    `${companies.length - deduped.length} domain duplicates removed → ${deduped.length} unique companies`
  );
  return deduped;
}

// ─── Public: streaming CSV parse for large files (7000+ rows) ───────

export async function parseCSVStream(filePath: string): Promise<CompanyRow[]> {
  // Use XLSX streaming reader — works for both .xlsx and .csv
  return new Promise((resolve, reject) => {
    const companies: CompanyRow[] = [];
    let headers: string[] = [];
    let rowCount = 0;
    let skippedRows = 0;

    const bufferSize = 65536;
    const stream = fs.createReadStream(filePath, { highWaterMark: bufferSize });

    // Detect if this is a CSV or Excel file by extension or content
    const ext = filePath.toLowerCase();
    if (ext.endsWith(".csv") || ext.endsWith(".txt")) {
      // CSV streaming with manual line parsing (no extra dep)
      let leftover = "";

      stream.on("data", (chunk: Buffer) => {
        const text = leftover + chunk.toString("utf-8");
        const lines = text.split(/\r?\n/);
        leftover = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          if (headers.length === 0) {
            headers = parseCSVLine(line);
            console.log(`[csv-stream] Headers:`, headers);
            continue;
          }

          rowCount++;
          const values = parseCSVLine(line);
          const row: Record<string, any> = {};
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = values[i] || "";
          }
          const c = rowToCompany(row);
          if (c) companies.push(c);
          else skippedRows++;
        }
      });

      stream.on("end", () => {
        // Process leftover
        if (leftover.trim() && headers.length > 0) {
          rowCount++;
          const values = parseCSVLine(leftover);
          const row: Record<string, any> = {};
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = values[i] || "";
          }
          const c = rowToCompany(row);
          if (c) companies.push(c);
          else skippedRows++;
        }

        const deduped = deduplicateByDomain(companies);
        console.log(
          `[csv-stream] Parsed ${companies.length} valid / ${skippedRows} skipped / ` +
          `${companies.length - deduped.length} duplicates → ${deduped.length} unique`
        );
        resolve(deduped);
      });

      stream.on("error", reject);
    } else {
      // For .xlsx/.xls, fall back to the synchronous XLSX reader
      stream.destroy();
      resolve(parseExcel(filePath));
    }
  });
}

/** Parse a single CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
