const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String
}, { collection: 'users' });

const User = mongoose.model('UserCheck', UserSchema);

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Ashland2026', salt);

        const drivers = ['driver', 'driver1', 'driver2', 'driver3', 'driver4', 'driver5', 'driver6', 'driver7'];
        await User.updateMany(
            { username: { $in: drivers } }, 
            { $set: { password: hashedPassword } }
        );
        console.log("Passwords for all 8 drivers reset to Ashland2026");
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
