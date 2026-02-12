const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(` Expert Server started on port ${PORT}`);
});