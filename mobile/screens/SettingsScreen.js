import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
    Alert, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import {
    getMyProfile, updatePrivacyPrefs, updateAppPrefs,
    deleteMyAccount,
} from '../services/api';
import { useAppTheme } from '../context/ThemeContext';

const Row = ({ title, subtitle, value, onValueChange, delay = 0, onPress, right, styles, colors }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
        <TouchableOpacity
            style={styles.row}
            onPress={() => { if (onPress) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); } }}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{title}</Text>
                {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
            </View>
            {right || (
                <Switch
                    value={!!value}
                    onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onValueChange?.(v); }}
                    trackColor={{ false: colors.border, true: colors.brandSoft }}
                    thumbColor={value ? colors.brand : colors.surface}
                />
            )}
        </TouchableOpacity>
    </Animated.View>
);

// 3-way segmented Appearance picker.
const AppearancePicker = ({ value, onChange, colors, styles }) => {
    const opts = [
        { id: 'light', label: 'Light' },
        { id: 'system', label: 'System' },
        { id: 'dark', label: 'Dark' },
    ];
    return (
        <View style={styles.segmented}>
            {opts.map((o) => {
                const active = value === o.id;
                return (
                    <TouchableOpacity
                        key={o.id}
                        activeOpacity={0.8}
                        onPress={() => {
                            Haptics.selectionAsync();
                            onChange(o.id);
                        }}
                        style={[
                            styles.segBtn,
                            active && { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                        ]}
                    >
                        <Text
                            style={[
                                styles.segLabel,
                                { color: active ? colors.brand : colors.muted },
                            ]}
                        >
                            {o.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const SettingsScreen = ({ onClose, navigate, onLogout, refreshUser }) => {
    const { colors, preference, setPreference } = useAppTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [loading, setLoading] = useState(true);
    const [privacy, setPrivacy] = useState({
        shareLiveLocation: true,
        shareRideWithContact: false,
        marketingOptIn: false,
    });
    const [app, setApp] = useState({
        language: 'en',
        distanceUnit: 'mi',
        biometricEnabled: false,
    });

    useEffect(() => {
        (async () => {
            try {
                const p = await getMyProfile();
                setPrivacy({ ...privacy, ...(p.privacyPrefs || {}) });
                setApp({ ...app, ...(p.appPrefs || {}) });
            } finally {
                setLoading(false);
            }
        })();
    }, []); // eslint-disable-line

    const persistPrivacy = async (patch) => {
        const merged = { ...privacy, ...patch };
        setPrivacy(merged);
        try { await updatePrivacyPrefs(patch); } catch { }
    };
    const persistApp = async (patch) => {
        const merged = { ...app, ...patch };
        setApp(merged);
        try { await updateAppPrefs(patch); } catch { }
    };

    const confirmDelete = () => {
        Alert.alert(
            'Delete Account',
            'This cannot be undone. Your profile, saved places and payment methods will be permanently removed. Ride history is retained for APT compliance.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMyAccount();
                            Alert.alert('Account deleted', 'We are sorry to see you go.');
                            onLogout?.();
                        } catch (err) {
                            Alert.alert('Error', err?.response?.data?.message || err.message);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ScreenHeader title="Settings & Privacy" onBack={onClose} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={colors.brand} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScreenHeader title="Settings & Privacy" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* ── Appearance (new) ───────────────── */}
                <Text style={styles.section}>Appearance</Text>
                <View style={styles.card}>
                    <Animated.View entering={FadeInDown.delay(30).springify()} style={styles.appearanceRow}>
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.rowTitle}>Theme</Text>
                            <Text style={styles.rowSub}>
                                {preference === 'system'
                                    ? 'Match system — follows your phone'
                                    : preference === 'dark'
                                        ? 'Dark mode — easier on the eyes at night'
                                        : 'Light mode — bright and high-contrast'}
                            </Text>
                        </View>
                        <AppearancePicker
                            value={preference}
                            onChange={setPreference}
                            colors={colors}
                            styles={styles}
                        />
                    </Animated.View>
                </View>

                {/* ── Account ────────────────────────── */}
                <Text style={styles.section}>Account</Text>
                <View style={styles.card}>
                    <Row
                        title="Edit Profile"
                        subtitle="Name, email, phone, DOB, rider tier"
                        onPress={() => navigate('EDIT_PROFILE')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={40}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Change Password"
                        subtitle="Update your login credentials"
                        onPress={() => navigate('CHANGE_PASSWORD')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={60}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Payment Methods"
                        subtitle="Cards, transit credits, cash"
                        onPress={() => navigate('PAYMENT_METHODS')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={80}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {/* ── Privacy ────────────────────────── */}
                <Text style={styles.section}>Privacy</Text>
                <View style={styles.card}>
                    <Row
                        title="Share live location with driver"
                        subtitle="Helps the driver find you faster"
                        value={privacy.shareLiveLocation}
                        onValueChange={(v) => persistPrivacy({ shareLiveLocation: v })}
                        delay={100}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Alert emergency contact during ride"
                        subtitle="Sends trip details to your emergency contact"
                        value={privacy.shareRideWithContact}
                        onValueChange={(v) => persistPrivacy({ shareRideWithContact: v })}
                        delay={120}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Marketing & research opt-in"
                        subtitle="Occasional surveys from APT"
                        value={privacy.marketingOptIn}
                        onValueChange={(v) => persistPrivacy({ marketingOptIn: v })}
                        delay={140}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {/* ── App ────────────────────────────── */}
                <Text style={styles.section}>App</Text>
                <View style={styles.card}>
                    <Row
                        title="Distance units"
                        subtitle="Used for fare estimates"
                        onPress={() => persistApp({ distanceUnit: app.distanceUnit === 'mi' ? 'km' : 'mi' })}
                        right={<Text style={styles.valuePill}>{app.distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}</Text>}
                        delay={180}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Language"
                        subtitle="App display language"
                        right={<Text style={styles.valuePill}>English</Text>}
                        delay={200}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Biometric login"
                        subtitle="Face ID / Touch ID (coming soon)"
                        value={app.biometricEnabled}
                        onValueChange={(v) => persistApp({ biometricEnabled: v })}
                        delay={220}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {/* ── Notifications shortcut ─────────── */}
                <Text style={styles.section}>Notifications</Text>
                <View style={styles.card}>
                    <Row
                        title="Manage notifications"
                        subtitle="Ride alerts, receipts, promos, service updates"
                        onPress={() => navigate('NOTIFICATIONS')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={240}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                {/* ── Support ────────────────────────── */}
                <Text style={styles.section}>Support</Text>
                <View style={styles.card}>
                    <Row title="Help Center" onPress={() => navigate('HELP')} right={<Text style={styles.chev}>›</Text>} delay={260} colors={colors} styles={styles} />
                    <Row title="APT Fare Information" onPress={() => navigate('FARE_INFO')} right={<Text style={styles.chev}>›</Text>} delay={280} colors={colors} styles={styles} />
                    <Row title="About Ashland Transit" onPress={() => navigate('ABOUT')} right={<Text style={styles.chev}>›</Text>} delay={300} colors={colors} styles={styles} />
                </View>

                {/* ── Danger ─────────────────────────── */}
                <Text style={styles.section}>Danger Zone</Text>
                <View style={styles.card}>
                    <Row
                        title="Log Out"
                        onPress={() => {
                            Alert.alert('Log out', 'Are you sure?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Log out', style: 'destructive', onPress: onLogout }
                            ]);
                        }}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={320}
                        colors={colors}
                        styles={styles}
                    />
                    <Row
                        title="Delete Account"
                        subtitle="Permanent, irreversible"
                        onPress={confirmDelete}
                        right={<Text style={[styles.chev, { color: colors.danger }]}>›</Text>}
                        delay={340}
                        colors={colors}
                        styles={styles}
                    />
                </View>

                <Text style={styles.footer}>Ashland Public Transit • v1.0</Text>
            </ScrollView>
        </View>
    );
};

const makeStyles = (c) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    section: {
        fontSize: 11, fontWeight: '900', color: c.muted,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginHorizontal: 4, marginTop: 18, marginBottom: 8,
    },
    card: {
        backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
        shadowColor: c.shadow, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    rowSub: { fontSize: 12, fontWeight: '500', color: c.muted, marginTop: 2 },
    chev: { color: c.subtle, fontSize: 22, fontWeight: '500' },
    valuePill: {
        backgroundColor: c.brandSoft, color: c.brand, fontWeight: '800',
        fontSize: 11, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.5,
        overflow: 'hidden',
    },
    footer: {
        textAlign: 'center', color: c.subtle, fontSize: 11,
        fontWeight: '600', marginTop: 24,
    },
    appearanceRow: {
        paddingHorizontal: 16, paddingVertical: 14,
    },
    segmented: {
        flexDirection: 'row',
        backgroundColor: c.surfaceAlt,
        borderRadius: 12, padding: 4, gap: 4,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    segBtn: {
        flex: 1, paddingVertical: 9, borderRadius: 9,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'transparent',
    },
    segLabel: {
        fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8,
    },
});

export default SettingsScreen;
