import express from "express";
import { submitVote, getMyVotes } from "../controllers/vote.controller.js";

const router = express.Router();

router.post("/", submitVote);
router.get("/", getMyVotes);

export default router;