import express from "express";
import { saveSubscription } from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/subscribe", protect, saveSubscription);

export default router;