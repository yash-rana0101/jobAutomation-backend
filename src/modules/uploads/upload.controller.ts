import { Router, Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import { parseExcel, parseCSVStream } from "./excel.parser";
import * as companyService from "../companies/company.service";

const upload = multer({
  dest: path.join(process.cwd(), "uploads", "temp"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".xlsx", ".csv", ".xls"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx, .xls, and .csv files allowed"));
    }
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/excel",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const ext = path.extname(req.file.originalname).toLowerCase();
      const queueCrawl = req.body?.queueCrawl !== "false"; // default true

      // Use streaming parser for CSV, sync for xlsx
      const companies = ext === ".csv"
        ? await parseCSVStream(req.file.path)
        : parseExcel(req.file.path);

      if (companies.length === 0) {
        return res.status(400).json({
          error: "No valid companies found. Check that your file has columns like: company_name, website, email",
        });
      }

      const created = await companyService.createManyCompanies(companies, { queueCrawl });

      res.json({
        message: `Imported ${created.length} companies`,
        total: companies.length,
        imported: created.length,
        skipped: companies.length - created.length,
        queued: queueCrawl ? created.length : 0,
        companies: created,
      });
    } catch (error: any) {
      console.error("[upload] Error:", error.message);
      res.status(400).json({ error: error.message });
    }
  },
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum allowed size is 50MB." });
    }
    res.status(400).json({ error: err?.message ?? "Upload failed" });
  }
);
