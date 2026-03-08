import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { companyRouter } from "./modules/companies/company.controller";
import { outreachRouter } from "./modules/outreach/outreach.controller";
import { uploadRouter } from "./modules/uploads/upload.controller";
import { dashboardRouter } from "./modules/dashboard/dashboard.controller";
import { testRouter } from "./modules/test/test.controller";
import { profileRouter } from "./modules/profile/profile.controller";
import { startWorkers } from "./queues/workers";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static("uploads"));

app.use("/api/companies", companyRouter);
app.use("/api/outreach", outreachRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/test", testRouter);
app.use("/api/profile", profileRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  // startWorkers(); // disabled for pipeline testing
});

export default app;
