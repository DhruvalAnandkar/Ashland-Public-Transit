import React, { useEffect, useState } from 'react';
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

const Row = ({ title, subtitle, value, onValueChange, delay = 0, onPress, right }) => (
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
                    trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                    thumbColor={value ? '#2563eb' : '#f8fafc'}
                />
            )}
        </TouchableOpacity>
    </Animated.View>
);

const SettingsScreen = ({ onClose, navigate, onLogout, refreshUser }) => {
    const [loading, setLoading] = useState(true);
    const [privacy, setPrivacy] = useState({
        shareLiveLocation: true,
        shareRideWithContact: false,
        marketingOptIn: false,
    });
    const [app, setApp] = useState({
        language: 'en',
        theme: 'system',
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
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScreenHeader title="Settings & Privacy" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* ── Account ────────────────────────── */}
                <Text style={styles.section}>Account</Text>
                <View style={styles.card}>
                    <Row
                        title="Edit Profile"
                        subtitle="Name, email, phone, DOB, rider tier"
                        onPress={() => navigate('EDIT_PROFILE')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={40}
                    />
                    <Row
                        title="Change Password"
                        subtitle="Update your login credentials"
                        onPress={() => navigate('CHANGE_PASSWORD')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={60}
                    />
                    <Row
                        title="Payment Methods"
                        subtitle="Cards, transit credits, cash"
                        onPress={() => navigate('PAYMENT_METHODS')}
                        right={<Text style={styles.chev}>›</Text>}
                        delay={80}
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
                    />
                    <Row
                        title="Alert emergency contact during ride"
                        subtitle="Sends trip details to your emergency contact"
                        value={privacy.shareRideWithContact}
                        onValueChange={(v) => persistPrivacy({ shareRideWithContact: v })}
                        delay={120}
                    />
                    <Row
                        title="Marketing & research opt-in"
                        subtitle="Occasional surveys from APT"
                        value={privacy.marketingOptIn}
                        onValueChange={(v) => persistPrivacy({ marketingOptIn: v })}
                        delay={140}
                    />
                </View>

                {/* ── App ────────────────────────────── */}
                <Text style={styles.section}>App</Text>
                <View style={styles.card}>
                    <Row
                        title="Theme"
                        subtitle={app.theme === 'system' ? 'Match system' : app.theme === 'dark' ? 'Dark mode' : 'Light mode'}
                        onPress={() => {
                            const next = app.theme === 'system' ? 'light' : app.theme === 'light' ? 'dark' : 'system';
                            persistApp({ theme: next });
                        }}
                        right={<Text style={styles.valuePill}>{app.theme}</Text>}
                        delay={160}
                    />
                    <Row
                        title="Distance units"
                        subtitle="Used for fare estimates"
                        onPress={() => persistApp({ distanceUnit: app.distanceUnit === 'mi' ? 'km' : 'mi' })}
                        right={<Text style={styles.valuePill}>{app.distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}</Text>}
                        delay={180}
                    />
                    <Row
                        title="Language"
                        subtitle="App display language"
                        right={<Text style={styles.valuePill}>English</Text>}
                        delay={200}
                    />
                    <Row
                        title="Biometric login"
                        subtitle="Face ID / Touch ID (coming soon)"
                        value={app.biometricEnabled}
                        onValueChange={(v) => persistApp({ biometricEnabled: v })}
                        delay={220}
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
                    />
                </View>

                {/* ── Support ────────────────────────── */}
                <Text style={styles.section}>Support</Text>
                <View style={styles.card}>
                    <Row title="Help Center" onPress={() => navigate('HELP')} right={<Text style={styles.chev}>›</Text>} delay={260} />
                    <Row title="APT Fare Information" onPress={() => navigate('FARE_INFO')} right={<Text style={styles.chev}>›</Text>} delay={280} />
                    <Row title="About Ashland Transit" onPress={() => navigate('ABOUT')} right={<Text style={styles.chev}>›</Text>} delay={300} />
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
                    />
                    <Row
                        title="Delete Account"
                        subtitle="Permanent, irreversible"
                        onPress={confirmDelete}
                        right={<Text style={[styles.chev, { color: '#dc2626' }]}>›</Text>}
                        delay={340}
                    />
                </View>

                <Text style={styles.footer}>Ashland Public Transit • v1.0</Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },

    section: {
        fontSize: 11, fontWeight: '900', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginHorizontal: 4, marginTop: 18, marginBottom: 8,
    },
    card: {
        backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
    },
    rowTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    rowSub: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
    chev: { color: '#cbd5e1', fontSize: 22, fontWeight: '500' },
    valuePill: {
        backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '800',
        fontSize: 11, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 10, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    footer: {
        textAlign: 'center', color: '#94a3b8', fontSize: 11,
        fontWeight: '600', marginTop: 24,
    },
});

export default SettingsScreen;
