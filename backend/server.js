// Fix DNS resolution for MongoDB Atlas on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const connectDB = require('./config/db');
const socket = require('./socket');
const AuctionService = require('./services/auctionService');
const ReconciliationService = require('./services/reconciliationService');
const PlatformSettingsService = require('./services/platformSettingsService');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socket.init(server);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/bid', require('./routes/bid'));
app.use('/api/buyer', require('./routes/buyer'));
app.use('/api/join', require('./routes/join'));
app.use('/api/participations', require('./routes/participations'));
app.use('/api/extend', require('./routes/extend'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/watchlist', require('./routes/watchlist'));

const PORT = process.env.PORT || 3001;

// Connect to DB, run background checks, recover timers, and start server
connectDB().then(async () => {
  // Background reconciliation check
  ReconciliationService.runReconciliation().catch((err) => {
    console.error('[Reconciliation] Error:', err);
  });

  // Initialize Platform Settings cache
  await PlatformSettingsService.getSettings();

  // Recovery sweep: re-schedule timers for all ACTIVE auctions
  await AuctionService.recoverActiveAuctions().catch((err) => {
    console.error('[Recovery] Failed to recover active auctions:', err);
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

