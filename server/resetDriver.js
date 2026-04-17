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

        // Reset both driver and driver1 for convenience
        await User.updateMany(
            { username: { $in: ['driver', 'driver1'] } }, 
            { $set: { password: hashedPassword } }
        );
        console.log("Password for driver and driver1 reset to Ashland2026");
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
