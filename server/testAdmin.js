const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');

const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: String
}, { collection: 'users' });

const User = mongoose.model('UserCheck', UserSchema);

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = await User.findOne({ username: 'admin' });
        const all = await User.find({});
        
        const output = {
            admin,
            matchesAdmin: admin ? await bcrypt.compare('admin', admin.password) : null,
            matchesAshland: admin ? await bcrypt.compare('Ashland2026', admin.password) : null,
            allUsers: all.map(u => u.username)
        };
        fs.writeFileSync('out.json', JSON.stringify(output, null, 2));
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('out.json', JSON.stringify({error: e.message}));
        process.exit(1);
    }
}
check();
