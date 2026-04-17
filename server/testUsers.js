const mongoose = require('mongoose');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
    username: String,
    role: String
}, { collection: 'users' });

const User = mongoose.model('UserCheck', UserSchema);

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({});
        console.log("Users in DB:");
        users.forEach(u => console.log(u.username, "->", u.role));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
