const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(express.json()); // Parses incoming JSON
app.use(cors());         // Allows your React app to talk to this API
app.use(helmet());       // Security headers
app.use(morgan('dev'));  // Logging for development

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' 
    ? 200 : 2000,
  skip: (req) => {
    const open = [
      '/api/rides/fleet/driver-ping',
      '/api/rides/estimate-fare',
      '/api/rides/fare-info',
      '/api/rides/check-capacity',
      '/api/rides/track',
      '/api/rides/fleet/live',
    ]
    return open.some(r => req.path.includes(r))
  }
})
app.use('/api/', limiter);

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rides', require('./routes/rideRoutes'));

// Health Check
app.get('/', (req, res) => {
    res.json({ message: 'Ashland Transit API is Running...', status: 'Healthy' });
});

// Error Handling Middleware (Expert addition)
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const http = require('http');
const SocketService = require('./services/SocketService');
const AutoCancelService = require('./services/AutoCancelService');

const PORT = process.env.PORT || 5000;

// Create HTTP Server to attach both Express and Socket.io
const server = http.createServer(app);

// Initialize WebSockets
SocketService.init(server);

// Background sweep: auto-cancel expired rides and flag no-shows
AutoCancelService.start();

server.listen(PORT, () => {
    console.log(` Expert Server started on port ${PORT}`);
});