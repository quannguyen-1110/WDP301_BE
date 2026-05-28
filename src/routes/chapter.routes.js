import express from "express";
import { createChapter, getChapter, publishChapter } from "../controllers/chapter.controller.js";

const router = express.Router();

router.post("/", createChapter);
router.get("/:id", getChapter);
router.post("/publish/:id", publishChapter);

export default router;