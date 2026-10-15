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

        }
      });

      socket.on('disconnect', () => {

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
  broadcastBidPlaced: (data) => {
    try {
      if (!io) return;
      const { auctionId, updatedAuction, bid, user } = data;
      io.emit('bidPlaced', {
        auctionId,
        currentHighestBid: updatedAuction.currentHighestBid,
        winnerId: updatedAuction.winnerId,
        endDate: updatedAuction.endDate,
        bid: {
          ...bid.toObject(),
          userId: {
            _id: user?._id || user?.id,
            name: user?.name || 'Unknown User',
            email: user?.email || ''
          }
        }
      });
    } catch (err) {
      console.error('Socket broadcast error:', err.message);
    }
  }
};

