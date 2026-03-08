import { Router } from "express";
import multer from "multer";
import path from "path";
import { parseExcel } from "./excel.parser";
import * as companyService from "../companies/company.service";

const upload = multer({
  dest: path.join(process.cwd(), "uploads", "temp"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const companies = parseExcel(req.file.path);
      const created = await companyService.createManyCompanies(companies);

      res.json({
        message: `Imported ${created.length} companies`,
        total: companies.length,
        imported: created.length,
        skipped: companies.length - created.length,
        companies: created,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);
