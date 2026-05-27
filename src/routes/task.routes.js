import express from "express";
import {
  createTask,
  submitTask,
  getMyTasks
} from "../controllers/task.controller.js";

const router = express.Router();

router.post("/", createTask);
router.put("/:id/submit", submitTask);
router.get("/", getMyTasks);

export default router;