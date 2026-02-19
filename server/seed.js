const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Load env vars
dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const seedUsers = async () => {
    try {
        // Drop the collection to clear old indexes (like unique email) that conflict with current schema
        try {
            await User.collection.drop();
            console.log('User collection dropped (indexes cleared)');
        } catch (error) {
            // Ignore error if collection doesn't exist
            if (error.code === 26) {
                console.log('Collection does not exist, creating new one...');
            } else {
                throw error;
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const users = [
            {
                username: 'admin',
                password: hashedPassword,
                role: 'Admin'
            },
            {
                username: 'dispatcher',
                password: hashedPassword,
                role: 'Dispatcher'
            },
            {
                username: 'driver',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver1',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver2',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver3',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver4',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver5',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver6',
                password: hashedPassword,
                role: 'Driver'
            },
            {
                username: 'driver7',
                password: hashedPassword,
                role: 'Driver'
            }
        ];

        await User.insertMany(users);
        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

connectDB().then(seedUsers);