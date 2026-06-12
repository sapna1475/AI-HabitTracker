import express from "express";
import {
    weeklyReport,
    suggestHabits,
    recoveryPlan, 
    chatAnalysis,
    morningMotivation,

} from "../controllers/aiController.js";
import {protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

router.post("/weekly-report", weeklyReport);

router.post("/suggest-habits", suggestHabits);

router.post("/recovery-plan", recoveryPlan);

router.post("/chat-analysis", chatAnalysis);

router.get("/morning-motivation", morningMotivation);
export default router;

