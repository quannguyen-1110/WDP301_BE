import express from "express";
import cors from "cors";
import taskRoutes from "./routes/task.routes.js";
import chapterRoutes from "./routes/chapter.routes.js";
import ratingRoutes from "./routes/rating.route.js";
import rankRoutes from "./routes/rank.route.js";

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
  app.use("/ratings", ratingRoutes);
  app.use("/ranks", rankRoutes);

  return app;
};