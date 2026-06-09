const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(` User connected: ${socket.id}`);

    // Join room theo userId
    socket.on("join", (userId) => {
      socket.join(userId);

      console.log(
        ` User ${userId} joined room ${userId}`
      );
    });

    // Test realtime
    socket.on("ping_server", () => {
      socket.emit("pong_server", {
        message: "Socket working",
      });
    });

    socket.on("disconnect", () => {
      console.log(
        ` User disconnected: ${socket.id}`
      );
    });
  });
};

module.exports = initSocket;