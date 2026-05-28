import express from "express";
import { getSeriesRanks, submitRank } from "../controllers/rank.controller.js";

const router = express.Router();

router.post("/", submitRank);
router.get("/:seriesId", getSeriesRanks);

export default router;