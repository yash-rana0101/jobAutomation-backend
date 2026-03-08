import * as XLSX from "xlsx";

interface CompanyRow {
  name: string;
  website: string;
  email: string;
  description?: string;
  linkedin?: string;
  twitter?: string;
}

export function parseExcel(filePath: string): CompanyRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  const companies: CompanyRow[] = [];

  for (const row of rows) {
    const name =
      row.company_name || row.name || row.Company || row["Company Name"];
    const website = row.website || row.Website || row.url || row.URL;
    const email = row.email || row.Email || row["Email Address"];

    if (!name || !website || !email) continue;

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) continue;

    companies.push({
      name: String(name).trim(),
      website: String(website).trim(),
      email: String(email).trim().toLowerCase(),
      description: row.description || row.Description || undefined,
      linkedin: row.linkedin || row.LinkedIn || undefined,
      twitter: row.twitter || row.Twitter || undefined,
    });
  }

  return companies;
}
