let io;

module.exports = {
  init: (httpServer) => {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: {
        origin: '*', // In production, replace with frontend URL
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      socket.on('joinRoom', (userId) => {
        if (userId) {
          socket.join(userId);
          console.log(`User ${userId} joined their private room`);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected');
      });
    });

    console.log('Socket.io initialized');
    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  },
};
