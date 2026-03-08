import { Router } from "express";
import * as companyService from "./company.service";

export const companyRouter = Router();

companyRouter.get("/", async (_req, res) => {
  try {
    const companies = await companyService.getAllCompanies();
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

companyRouter.get("/:id", async (req, res) => {
  try {
    const company = await companyService.getCompanyById(req.params.id as string);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

companyRouter.post("/", async (req, res) => {
  try {
    const company = await companyService.createCompany(req.body);
    res.status(201).json(company);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

companyRouter.delete("/:id", async (req, res) => {
  try {
    await companyService.deleteCompany(req.params.id as string);
    res.json({ message: "Company deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
