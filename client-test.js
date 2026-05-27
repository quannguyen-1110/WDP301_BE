import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import { setupApp } from "./app.js";
import { initSocket } from "./sockets/index.js";

const start = async () => {
  await connectDB();

  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const app = setupApp(io);
  httpServer.on("request", app);

  initSocket(io);

  httpServer.listen(3000, () => {
    console.log("Server running on port 3000");
  });
};

start();