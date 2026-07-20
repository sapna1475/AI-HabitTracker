import express from "express";
import {protect } from "../middleware/auth.js";
import { aiRateLimit } from "../middleware/aiRateLimit.js";
import {
    weeklyReport,
    suggestHabits,
    recoveryPlan, 
    chatAnalysis,
    morningMotivation,

} from "../controllers/aiController.js";


const router = express.Router();
// auth runs first (need req.user.id for the limiter), then rate limit, then the route logic
router.use(protect);
router.use(aiRateLimit);

router.post("/weekly-report", weeklyReport);

router.post("/suggest-habits", suggestHabits);

router.post("/recovery-plan", recoveryPlan);

router.post("/chat-analysis", chatAnalysis);

router.get("/morning-motivation", morningMotivation);

export default router;

