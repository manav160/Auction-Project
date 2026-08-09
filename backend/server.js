// Fix DNS resolution for MongoDB Atlas on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const path = require('path');
const socket = require('./socket');
const AuctionService = require('./services/auctionService');

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

// Connect to DB, then start server and recover auction timers
connectDB().then(async () => {
  // Run a startup reconciliation check
  const ReconciliationService = require('./services/reconciliationService');
  await ReconciliationService.runReconciliation();

  // Initialize Platform Settings
  const PlatformSettingsService = require('./services/platformSettingsService');
  await PlatformSettingsService.getSettings();
  // Recovery sweep: re-schedule timers for all ACTIVE auctions
  await AuctionService.recoverActiveAuctions().catch((err) => {
    console.error('[Recovery] Failed to recover active auctions:', err);
  });
  // user cant hit any end point before server is ready and all active auctions are recovered
  // active auctions rely on in-memory timers (setTimeout). After a server restart those timers are lost.
  //  Recovering them before accepting requests ensures auctions continue correctly and prevents users from interacting with auctions in an inconsistent state.
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });


});
