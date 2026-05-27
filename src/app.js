import express from "express";
import cors from "cors";
import taskRoutes from "./routes/task.routes.js";
import chapterRoutes from "./routes/chapter.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// inject io
export const setupApp = (io) => {
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  app.use("/tasks", taskRoutes);
  app.use("/chapters", chapterRoutes);

  return app;
};