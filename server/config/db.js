const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`Database Error: ${err.message}`);
        process.exit(1); // Stop the server if DB fails
    }
};

module.exports = connectDB;