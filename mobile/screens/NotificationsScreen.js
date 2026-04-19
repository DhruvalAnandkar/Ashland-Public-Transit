import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { getMyProfile, updateNotificationPrefs } from '../services/api';

const Row = ({ title, subtitle, value, onValueChange, delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.row}>
        <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
        <Switch
            value={!!value}
            onValueChange={(v) => { Haptics.selectionAsync(); onValueChange(v); }}
            trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
            thumbColor={value ? '#2563eb' : '#f8fafc'}
        />
    </Animated.View>
);

const NotificationsScreen = ({ onClose }) => {
    const [prefs, setPrefs] = useState({
        rideUpdates: true, driverArriving: true, promotions: false, receipts: true,
        serviceAlerts: true, smsEnabled: true, pushEnabled: true, emailEnabled: true,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const p = await getMyProfile();
                setPrefs({ ...prefs, ...(p.notificationPrefs || {}) });
            } finally {
                setLoading(false);
            }
        })();
    }, []); // eslint-disable-line

    const persist = async (patch) => {
        const merged = { ...prefs, ...patch };
        setPrefs(merged);
        try { await updateNotificationPrefs(patch); } catch { }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ScreenHeader title="Notifications" onBack={onClose} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScreenHeader title="Notifications" subtitle="Choose what you want to hear about" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <Text style={styles.section}>Ride Activity</Text>
                <View style={styles.card}>
                    <Row title="Ride updates"
                        subtitle="Pending → Confirmed → En-Route → Completed"
                        value={prefs.rideUpdates}
                        onValueChange={(v) => persist({ rideUpdates: v })} delay={20} />
                    <Row title="Driver arriving"
                        subtitle="Get a heads-up when your driver is nearby"
                        value={prefs.driverArriving}
                        onValueChange={(v) => persist({ driverArriving: v })} delay={40} />
                    <Row title="Receipts"
                        subtitle="Emailed + in-app receipt after payment"
                        value={prefs.receipts}
                        onValueChange={(v) => persist({ receipts: v })} delay={60} />
                </View>

                <Text style={styles.section}>Service</Text>
                <View style={styles.card}>
                    <Row title="Service alerts"
                        subtitle="Weather cancellations, schedule changes, holidays"
                        value={prefs.serviceAlerts}
                        onValueChange={(v) => persist({ serviceAlerts: v })} delay={80} />
                    <Row title="Promotions & programs"
                        subtitle="Occasional updates from APT"
                        value={prefs.promotions}
                        onValueChange={(v) => persist({ promotions: v })} delay={100} />
                </View>

                <Text style={styles.section}>Channels</Text>
                <View style={styles.card}>
                    <Row title="Push notifications"
                        subtitle="Delivered to this device"
                        value={prefs.pushEnabled}
                        onValueChange={(v) => persist({ pushEnabled: v })} delay={120} />
                    <Row title="Email"
                        subtitle="Receipts, service alerts"
                        value={prefs.emailEnabled}
                        onValueChange={(v) => persist({ emailEnabled: v })} delay={140} />
                    <Row title="SMS"
                        subtitle="Driver arriving, ride status"
                        value={prefs.smsEnabled}
                        onValueChange={(v) => persist({ smsEnabled: v })} delay={160} />
                </View>

                <Text style={styles.footer}>
                    APT will only send operational messages when push and email are off.
                    Standard SMS rates may apply.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    section: {
        fontSize: 11, fontWeight: '900', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginHorizontal: 4, marginTop: 16, marginBottom: 8,
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
    footer: {
        marginTop: 20, textAlign: 'center', color: '#94a3b8',
        fontSize: 11, fontWeight: '600', lineHeight: 16, paddingHorizontal: 12,
    },
});

export default NotificationsScreen;
