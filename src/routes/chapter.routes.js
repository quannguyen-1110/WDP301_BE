import express from "express";
import { createChapter } from "../controllers/chapter.controller.js";

const router = express.Router();

router.post("/", createChapter);

export default router;