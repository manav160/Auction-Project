const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const http = require('http');
const path = require('path');
const socket = require('./socket');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socket.init(server);

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/bid', require('./routes/bid'));
app.use('/api/buyer', require('./routes/buyer'));
app.use('/api/join', require('./routes/join'));
app.use('/api/participations', require('./routes/participations'));
app.use('/api/extend', require('./routes/extend'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
