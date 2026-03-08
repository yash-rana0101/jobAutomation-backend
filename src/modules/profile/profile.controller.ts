import { Router } from "express";
import { getProfile, updateProfile } from "./profile.service";

export const profileRouter = Router();

profileRouter.get("/", async (_req, res) => {
  try {
    const profile = await getProfile();
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

profileRouter.put("/", async (req, res) => {
  try {
    const profile = await updateProfile(req.body);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
