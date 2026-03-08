import PDFDocument from "pdfkit";

export interface SkillSet {
  languages?: string[];
  frontend?: string[];
  backend?: string[];
  databases?: string[];
  devops?: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ProjectEntry {
  name: string;
  role: string;
  url?: string;
  description: string;
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  startYear: string;
  endYear: string;
}

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  website?: string | null;
  linkedin?: string | null;
  summary: string;
  skills: SkillSet;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: { name: string }[];
}

export function buildResumePdf(data: ResumeData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 42, right: 42 },
      info: { Title: `${data.name} – Resume`, Author: data.name },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 84; // usable width

    // ── helpers ─────────────────────────────────────────────────────────────

    function rule() {
      doc
        .moveTo(42, doc.y)
        .lineTo(42 + W, doc.y)
        .lineWidth(0.75)
        .stroke("#222222");
    }

    function sectionTitle(title: string) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000000").text(title.toUpperCase());
      rule();
      doc.moveDown(0.25);
    }

    function rowLR(left: string, leftFont: string, right: string, fontSize: number) {
      const rW = doc.font("Helvetica").fontSize(fontSize).widthOfString(right) + 4;
      doc.font(leftFont).fontSize(fontSize).fillColor("#000000").text(left, {
        continued: true,
        width: W - rW,
        lineGap: 0,
      });
      doc.font("Helvetica").fontSize(fontSize).fillColor("#444444").text(right, {
        align: "right",
        width: rW,
        lineGap: 0,
      });
    }

    function bulletList(items: string[]) {
      doc.font("Helvetica").fontSize(8.75).fillColor("#1a1a1a");
      for (const item of items) {
        doc.text(`•  ${item}`, { indent: 8, lineGap: 1.5, width: W });
      }
    }

    // ── Header ───────────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#000000")
      .text(data.name, { align: "center", characterSpacing: 1.5 });

    doc.moveDown(0.2);

    const contactLine = [data.phone, data.location].join("   |   ");
    doc.font("Helvetica").fontSize(8.5).fillColor("#444444").text(contactLine, { align: "center" });

    doc.moveDown(0.1);
    const links = [
      data.email,
      data.linkedin?.replace("https://", ""),
      data.website?.replace("https://", ""),
    ]
      .filter(Boolean)
      .join("   |   ");
    doc.font("Helvetica").fontSize(8.5).fillColor("#333333").text(links, { align: "center" });

    // ── Summary ──────────────────────────────────────────────────────────────
    sectionTitle("Professional Summary");
    doc.font("Helvetica").fontSize(9).fillColor("#1a1a1a").text(data.summary, { lineGap: 2, width: W });

    // ── Skills ───────────────────────────────────────────────────────────────
    sectionTitle("Skills");
    const skillGroups = [
      { label: "Languages", values: data.skills.languages },
      { label: "Frontend", values: data.skills.frontend },
      { label: "Backend", values: data.skills.backend },
      { label: "Databases", values: data.skills.databases },
      { label: "DevOps & Cloud", values: data.skills.devops },
    ].filter((g) => g.values && g.values.length > 0);

    for (const g of skillGroups) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000").text(`${g.label}: `, {
        continued: true,
        lineGap: 1.5,
      });
      doc.font("Helvetica").fillColor("#1a1a1a").text(g.values!.join(", "), { lineGap: 1.5 });
    }

    // ── Experience ────────────────────────────────────────────────────────────
    sectionTitle("Experience");
    for (const exp of data.experience) {
      rowLR(`${exp.title}  ·  ${exp.company}`, "Helvetica-Bold", `${exp.startDate} – ${exp.endDate}`, 9);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#555555").text(exp.location, { lineGap: 1.5 });
      doc.moveDown(0.15);
      bulletList(exp.bullets);
      doc.moveDown(0.35);
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    sectionTitle("Projects");
    for (const proj of data.projects) {
      const rightLabel = proj.url?.replace("https://", "") || "";
      rowLR(`${proj.name}  —  ${proj.role}`, "Helvetica-Bold", rightLabel, 9);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#555555").text(proj.description, { lineGap: 1.5 });
      doc.moveDown(0.15);
      bulletList(proj.bullets);
      doc.moveDown(0.35);
    }

    // ── Education ────────────────────────────────────────────────────────────
    sectionTitle("Education");
    for (const edu of data.education) {
      rowLR(edu.degree, "Helvetica-Bold", `${edu.startYear} – ${edu.endYear}`, 9);
      doc.font("Helvetica").fontSize(9).fillColor("#444444").text(edu.institution, { lineGap: 1.5 });
      doc.moveDown(0.3);
    }

    // ── Certifications ───────────────────────────────────────────────────────
    if (data.certifications?.length > 0) {
      sectionTitle("Certifications");
      bulletList(data.certifications.map((c) => c.name));
    }

    doc.end();
  });
}

/** Build plain-text version for ATS analysis */
export function buildResumeText(data: ResumeData): string {
  const lines: string[] = [];
  lines.push(data.name);
  lines.push([data.phone, data.location, data.email].join(" | "));
  if (data.linkedin) lines.push(data.linkedin);
  if (data.website) lines.push(data.website);
  lines.push("\nSUMMARY\n" + data.summary);

  lines.push("\nSKILLS");
  const sg = data.skills;
  if (sg.languages?.length) lines.push("Languages: " + sg.languages.join(", "));
  if (sg.frontend?.length) lines.push("Frontend: " + sg.frontend.join(", "));
  if (sg.backend?.length) lines.push("Backend: " + sg.backend.join(", "));
  if (sg.databases?.length) lines.push("Databases: " + sg.databases.join(", "));
  if (sg.devops?.length) lines.push("DevOps & Cloud: " + sg.devops.join(", "));

  lines.push("\nEXPERIENCE");
  for (const exp of data.experience) {
    lines.push(`${exp.title} | ${exp.company} | ${exp.startDate} – ${exp.endDate}`);
    exp.bullets.forEach((b) => lines.push(`- ${b}`));
  }

  lines.push("\nPROJECTS");
  for (const proj of data.projects) {
    lines.push(`${proj.name} — ${proj.role}`);
    proj.bullets.forEach((b) => lines.push(`- ${b}`));
  }

  lines.push("\nEDUCATION");
  for (const edu of data.education) {
    lines.push(`${edu.degree}, ${edu.institution} (${edu.startYear}–${edu.endYear})`);
  }

  if (data.certifications?.length) {
    lines.push("\nCERTIFICATIONS");
    data.certifications.forEach((c) => lines.push(`- ${c.name}`));
  }

  return lines.join("\n");
}
