const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const connectDB = require("./src/config/db.js");
const setupApp = require("./src/app.js");
const initSocket = require("./src/sockets/index.js");

// Load env vars
dotenv.config();

const start = async () => {
  await connectDB();

  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const app = setupApp(io);
  httpServer.on("request", app);

  initSocket(io);

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Mangaka API Server`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`========================================\n`);
  });
};

start();