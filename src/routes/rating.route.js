import express from "express";
import { getSeriesRatings, submitRating } from "../controllers/rating.controller.js";

const router = express.Router();

router.post("/", submitRating);
router.get("/:seriesId", getSeriesRatings);

export default router;