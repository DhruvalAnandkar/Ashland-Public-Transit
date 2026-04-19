const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');

// ─── JWT helper ───────────────────────────────────────────────
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_dev_key_123', {
        expiresIn: '30d',
    });
};

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESET_ATTEMPTS = 5;

const buildResetCode = () => {
    // 6-digit numeric code (like Uber/Doordash verification codes)
    return String(Math.floor(100000 + Math.random() * 900000));
};

const publicUser = (user) => ({
    _id: user.id,
    username: user.username,
    role: user.role,
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    fullName: user.fullName || '',
    phoneNumber: user.phoneNumber || '',
    avatar: user.avatar || '',
    riderType: user.riderType || 'General',
    homeAddress: user.homeAddress || '',
    dateOfBirth: user.dateOfBirth || null,
    gender: user.gender || '',
    emergencyContact: user.emergencyContact || { name: '', phone: '', relationship: '' },
    mobilityNeeds: user.mobilityNeeds || [],
    accessibilityNotes: user.accessibilityNotes || '',
    notificationPrefs: user.notificationPrefs || {},
    privacyPrefs: user.privacyPrefs || {},
    appPrefs: user.appPrefs || {},
    savedPlaces: user.savedPlaces || [],
    paymentMethods: user.paymentMethods || [],
    defaultPaymentMethodId: user.defaultPaymentMethodId || null,
    walletBalance: user.walletBalance || 0,
    stats: user.stats || {},
    dobVerified: !!user.dobVerified,
    disabilityVerified: !!user.disabilityVerified,
    veteranVerified: !!user.veteranVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
});

// @route   GET /api/auth/drivers
router.get('/drivers', protect, async (req, res) => {
    try {
        const drivers = await User.find({ role: { $regex: /^driver$/i } }).select('username _id');
        res.json(drivers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        // Admin bootstrap (legacy)
        if (!user && username === 'admin' && password === 'Ashland2026') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const admin = await User.create({
                username: 'admin',
                password: hashedPassword,
                role: 'Admin'
            });
            return res.json({
                ...publicUser(admin),
                token: generateToken(admin.id),
            });
        }

        if (user && (await bcrypt.compare(password, user.password))) {
            user.lastLoginAt = new Date();
            await user.save();
            return res.json({
                ...publicUser(user),
                token: generateToken(user.id),
            });
        }
        res.status(401).json({ message: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const {
            username, password, email, role, phoneNumber,
            firstName, lastName, riderType, dateOfBirth, pushToken
        } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." });
        }

        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        if (email) {
            const emailTaken = await User.findOne({ email });
            if (emailTaken) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        let assignedRole = 'Rider';
        if (role === 'Driver') assignedRole = 'Driver';

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const combinedFullName =
            [firstName, lastName].filter(Boolean).join(' ').trim() || username;

        const user = await User.create({
            username,
            password: hashedPassword,
            role: assignedRole,
            email: email || '',
            phoneNumber: phoneNumber || '',
            firstName: firstName || '',
            lastName: lastName || '',
            fullName: combinedFullName,
            riderType: ['General', 'Senior', 'Elderly/Disabled', 'Student', 'Veteran', 'Child'].includes(riderType)
                ? riderType
                : 'General',
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            pushToken: pushToken || '',
            walletBalance: 0
        });

            res.status(201).json({
            ...publicUser(user),
                token: generateToken(user.id)
            });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/auth/me  — current profile
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(publicUser(user));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   PATCH /api/auth/me  — update basic profile
router.patch('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const allowed = [
            'firstName', 'lastName', 'email', 'phoneNumber',
            'dateOfBirth', 'gender', 'avatar', 'homeAddress',
            'riderType', 'mobilityNeeds', 'accessibilityNotes',
            'emergencyContact', 'defaultPickupLocation',
            'notificationPrefs', 'privacyPrefs', 'appPrefs',
            'pushToken'
        ];

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'dateOfBirth') {
                    user.dateOfBirth = req.body.dateOfBirth
                        ? new Date(req.body.dateOfBirth)
                        : undefined;
                } else if (key === 'emergencyContact') {
                    user.emergencyContact = {
                        name: req.body.emergencyContact?.name || '',
                        phone: req.body.emergencyContact?.phone || '',
                        relationship: req.body.emergencyContact?.relationship || ''
                    };
                } else if (['notificationPrefs', 'privacyPrefs', 'appPrefs'].includes(key)) {
                    user[key] = { ...(user[key]?.toObject?.() || user[key] || {}), ...(req.body[key] || {}) };
                } else if (key === 'riderType') {
                    if (['General', 'Senior', 'Elderly/Disabled', 'Student', 'Veteran', 'Child'].includes(req.body.riderType)) {
                        user.riderType = req.body.riderType;
                    }
                } else if (key === 'email') {
                    const newEmail = String(req.body.email || '').toLowerCase().trim();
                    if (newEmail && newEmail !== user.email) {
                        const taken = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
                        if (taken) return res.status(400).json({ message: 'Email already in use' });
                    }
                    user.email = newEmail;
        } else {
                    user[key] = req.body[key];
                }
            }
        }

        const combinedFullName =
            [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        if (combinedFullName) user.fullName = combinedFullName;

        await user.save();
        res.json(publicUser(user));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/change-password
router.post('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new passwords are required' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordChangedAt = new Date();
        user.resetPasswordCode = null;
        user.resetPasswordCodeExpires = null;
        user.resetPasswordAttempts = 0;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/password/forgot
//          Step 1 - user requests a reset code
router.post('/password/forgot', async (req, res) => {
    try {
        const { identifier } = req.body; // username OR email
        if (!identifier) {
            return res.status(400).json({ message: 'Username or email is required' });
        }
        const ident = String(identifier).trim();
        const query = ident.includes('@')
            ? { email: ident.toLowerCase() }
            : { username: ident };
        const user = await User.findOne(query);

        const genericMsg = 'If an account exists, a reset code has been issued.';

        if (!user) {
            // do not leak account existence
            return res.json({ message: genericMsg });
        }

        const code = buildResetCode();
        user.resetPasswordCode = code;
        user.resetPasswordCodeExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
        user.resetPasswordAttempts = 0;
        await user.save();

        // In production, email/SMS this. For dev we return it so the mobile
        // app can prefill and continue without email infra.
        const devPayload = process.env.NODE_ENV === 'production'
            ? {}
            : { devCode: code, expiresAt: user.resetPasswordCodeExpires };

        res.json({
            message: genericMsg,
            ...devPayload
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/password/verify-code
router.post('/password/verify-code', async (req, res) => {
    try {
        const { identifier, code } = req.body;
        if (!identifier || !code) {
            return res.status(400).json({ message: 'Identifier and code required' });
        }
        const ident = String(identifier).trim();
        const query = ident.includes('@')
            ? { email: ident.toLowerCase() }
            : { username: ident };
        const user = await User.findOne(query);
        if (!user || !user.resetPasswordCode) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }
        if (user.resetPasswordAttempts >= MAX_RESET_ATTEMPTS) {
            return res.status(429).json({ message: 'Too many attempts. Request a new code.' });
        }
        if (!user.resetPasswordCodeExpires || user.resetPasswordCodeExpires < new Date()) {
            return res.status(400).json({ message: 'Code has expired. Request a new one.' });
        }
        if (String(user.resetPasswordCode) !== String(code)) {
            user.resetPasswordAttempts += 1;
            await user.save();
            return res.status(400).json({ message: 'Invalid code' });
        }
        res.json({ verified: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/auth/password/reset
//          Step 2 - confirm with code and set new password
router.post('/password/reset', async (req, res) => {
    try {
        const { identifier, code, newPassword } = req.body;
        if (!identifier || !code || !newPassword) {
            return res.status(400).json({ message: 'identifier, code and newPassword are required' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const ident = String(identifier).trim();
        const query = ident.includes('@')
            ? { email: ident.toLowerCase() }
            : { username: ident };
        const user = await User.findOne(query);

        if (!user || !user.resetPasswordCode) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }
        if (user.resetPasswordAttempts >= MAX_RESET_ATTEMPTS) {
            return res.status(429).json({ message: 'Too many attempts. Request a new code.' });
        }
        if (!user.resetPasswordCodeExpires || user.resetPasswordCodeExpires < new Date()) {
            return res.status(400).json({ message: 'Code has expired' });
        }
        if (String(user.resetPasswordCode) !== String(code)) {
            user.resetPasswordAttempts += 1;
            await user.save();
            return res.status(400).json({ message: 'Invalid code' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordCode = null;
        user.resetPasswordCodeExpires = null;
        user.resetPasswordAttempts = 0;
        user.passwordChangedAt = new Date();
        await user.save();

        res.json({
            message: 'Password has been reset successfully.',
            ...publicUser(user),
            token: generateToken(user.id)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Saved Places ─────────────────────────────────────────────
router.get('/places', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('savedPlaces');
        res.json(user?.savedPlaces || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/places', protect, async (req, res) => {
    try {
        const { label, icon, address, coordinates } = req.body;
        if (!label || !address) {
            return res.status(400).json({ message: 'Label and address required' });
        }
        const user = await User.findById(req.user.id);
        user.savedPlaces.push({
            label, icon: icon || 'place', address,
            coordinates: coordinates
                ? { type: 'Point', coordinates: coordinates }
                : undefined
        });
        await user.save();
        res.status(201).json(user.savedPlaces);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/places/:placeId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const place = user.savedPlaces.id(req.params.placeId);
        if (!place) return res.status(404).json({ message: 'Place not found' });

        ['label', 'icon', 'address'].forEach((k) => {
            if (req.body[k] !== undefined) place[k] = req.body[k];
        });
        if (req.body.coordinates) {
            place.coordinates = { type: 'Point', coordinates: req.body.coordinates };
        }
        await user.save();
        res.json(user.savedPlaces);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/places/:placeId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const place = user.savedPlaces.id(req.params.placeId);
        if (!place) return res.status(404).json({ message: 'Place not found' });
        place.deleteOne();
        await user.save();
        res.json(user.savedPlaces);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Payment Methods ──────────────────────────────────────────
router.get('/payment-methods', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('paymentMethods defaultPaymentMethodId');
        res.json({
            paymentMethods: user?.paymentMethods || [],
            defaultPaymentMethodId: user?.defaultPaymentMethodId || null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/payment-methods', protect, async (req, res) => {
    try {
        const { label, brand, last4, provider, isDefault } = req.body;
        if (!label) return res.status(400).json({ message: 'Label is required' });
        const user = await User.findById(req.user.id);
        if (isDefault) {
            user.paymentMethods.forEach((p) => { p.isDefault = false; });
        }
        const created = user.paymentMethods.create({
            label,
            brand: brand || 'Cash',
            last4: last4 || '',
            provider: provider || 'manual',
            isDefault: !!isDefault
        });
        user.paymentMethods.push(created);
        if (isDefault) user.defaultPaymentMethodId = created._id;
        await user.save();
        res.status(201).json({
            paymentMethods: user.paymentMethods,
            defaultPaymentMethodId: user.defaultPaymentMethodId
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/payment-methods/:methodId/default', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const method = user.paymentMethods.id(req.params.methodId);
        if (!method) return res.status(404).json({ message: 'Method not found' });
        user.paymentMethods.forEach((p) => { p.isDefault = false; });
        method.isDefault = true;
        user.defaultPaymentMethodId = method._id;
        await user.save();
        res.json({
            paymentMethods: user.paymentMethods,
            defaultPaymentMethodId: user.defaultPaymentMethodId
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/payment-methods/:methodId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const method = user.paymentMethods.id(req.params.methodId);
        if (!method) return res.status(404).json({ message: 'Method not found' });
        const wasDefault = String(user.defaultPaymentMethodId) === String(method._id);
        method.deleteOne();
        if (wasDefault) {
            user.defaultPaymentMethodId = user.paymentMethods[0]?._id || null;
            if (user.paymentMethods[0]) user.paymentMethods[0].isDefault = true;
        }
        await user.save();
        res.json({
            paymentMethods: user.paymentMethods,
            defaultPaymentMethodId: user.defaultPaymentMethodId
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Preference blocks (granular PATCH) ───────────────────────
router.patch('/notification-prefs', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.notificationPrefs = {
            ...(user.notificationPrefs?.toObject?.() || user.notificationPrefs || {}),
            ...(req.body || {})
        };
        await user.save();
        res.json(user.notificationPrefs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/privacy-prefs', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.privacyPrefs = {
            ...(user.privacyPrefs?.toObject?.() || user.privacyPrefs || {}),
            ...(req.body || {})
        };
        await user.save();
        res.json(user.privacyPrefs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/app-prefs', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.appPrefs = {
            ...(user.appPrefs?.toObject?.() || user.appPrefs || {}),
            ...(req.body || {})
        };
        await user.save();
        res.json(user.appPrefs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Account: delete ──────────────────────────────────────────
router.delete('/me', protect, async (req, res) => {
    try {
        const { confirm } = req.body;
        if (confirm !== 'DELETE') {
            return res.status(400).json({ message: 'Confirmation text required (send "DELETE")' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role === 'Admin') {
            return res.status(403).json({ message: 'Admins cannot self-delete via this endpoint.' });
        }
        await User.deleteOne({ _id: user._id });
        res.json({ message: 'Account deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
