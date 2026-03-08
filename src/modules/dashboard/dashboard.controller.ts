import { Router } from "express";
import prisma from "../../config/database";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", async (_req, res) => {
  try {
    const [
      totalCompanies,
      pending,
      readyForReview,
      approved,
      sent,
      failed,
      replied,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.outreach.count({ where: { status: "pending" } }),
      prisma.outreach.count({ where: { status: "ready_for_review" } }),
      prisma.outreach.count({ where: { status: "approved" } }),
      prisma.outreach.count({ where: { status: "sent" } }),
      prisma.outreach.count({ where: { status: "failed" } }),
      prisma.outreach.count({ where: { status: "replied" } }),
    ]);

    const avgAtsScore = await prisma.outreach.aggregate({
      _avg: { atsScore: true },
      where: { atsScore: { not: null } },
    });

    res.json({
      totalCompanies,
      pending,
      readyForReview,
      approved,
      sent,
      failed,
      replied,
      avgAtsScore: Math.round(avgAtsScore._avg.atsScore || 0),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
