import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { getFareInfo } from '../services/api';

const fmt = (n) => `$${Number(n).toFixed(2)}`;

const FareTable = ({ title, data, colors = ['#2563eb', '#1d4ed8'], delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.tableCard}>
        <LinearGradient colors={colors} style={styles.tableHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.tableTitle}>{title}</Text>
        </LinearGradient>
        {data.map((row, i) => (
            <View key={i} style={[styles.tableRow, i === data.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.rowKey}>{row[0]}</Text>
                <Text style={styles.rowVal}>{row[1]}</Text>
            </View>
        ))}
    </Animated.View>
);

const FareInfoScreen = ({ onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const info = await getFareInfo();
                setData(info);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading || !data) {
        return (
            <View style={styles.container}>
                <ScreenHeader title="APT Fares" onBack={onClose} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            </View>
        );
    }

    const sched = data.inCity.Scheduled;
    const sameDay = data.inCity.SameDay;

    return (
        <View style={styles.container}>
            <ScreenHeader title="APT Fare Rates" subtitle="Official Ashland Public Transit pricing" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                <Animated.View entering={FadeInDown.springify()} style={styles.banner}>
                    <Text style={styles.bannerEmoji}>💲</Text>
                    <Text style={styles.bannerTitle}>Transparent, flat pricing</Text>
                    <Text style={styles.bannerSub}>
                        No surge, no hidden fees. Rates set by the City of Ashland.
                    </Text>
                </Animated.View>

                <FareTable
                    title="Scheduled Ahead · 24h+ Reservation"
                    colors={['#059669', '#047857']}
                    delay={40}
                    data={[
                        ['General Public', fmt(sched.General)],
                        ['Elderly / Disabled', fmt(sched['Elderly/Disabled'])],
                        ['Under 12 with adult', 'FREE'],
                        ['Under 12 without adult', fmt(sched.ChildAlone)],
                        ['Companion · 2nd rider (General)', `${fmt(sched.General / 2)} (½ price)`],
                    ]}
                />

                <FareTable
                    title="Same-Day Service · One-way"
                    colors={['#2563eb', '#1d4ed8']}
                    delay={80}
                    data={[
                        ['General Public', fmt(sameDay.General)],
                        ['Elderly / Disabled', fmt(sameDay['Elderly/Disabled'])],
                        ['Under 12 with adult', 'FREE'],
                        ['Under 12 without adult', fmt(sameDay.ChildAlone)],
                        ['Companion · 2nd rider (General)', `${fmt(sameDay.General / 2)} (½ price)`],
                    ]}
                />

                <FareTable
                    title="Hours of Operation"
                    colors={['#7c3aed', '#6d28d9']}
                    delay={120}
                    data={[
                        ['Monday – Friday', '6:00 a.m. – 9:00 p.m.'],
                        ['Saturday', '8:00 a.m. – 6:00 p.m.'],
                        ['Sunday', 'Closed'],
                        ['City Holidays', 'Closed'],
                    ]}
                />

                <FareTable
                    title="No-Show Fees"
                    colors={['#dc2626', '#991b1b']}
                    delay={160}
                    data={[
                        ['General Public', fmt(data.noShow.general)],
                        ['Elderly / Disabled', fmt(data.noShow.elderlyDisabled)],
                    ]}
                />

                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.notesCard}>
                    <Text style={styles.notesTitle}>How fares work</Text>
                    <Text style={styles.note}>• A "scheduled" fare requires booking at least 24 hours in advance; anything closer books at same-day rates.</Text>
                    <Text style={styles.note}>• Children under 12 always ride FREE with a fare-paying adult.</Text>
                    <Text style={styles.note}>• A 2nd person going to the same destination as a General Public rider pays half the primary fare.</Text>
                    <Text style={styles.note}>• Child restraint seats are available — please notify dispatch when you book.</Text>
                    <Text style={styles.note}>• No-show fees apply if you miss a scheduled pick-up without cancelling.</Text>
                </Animated.View>

                <Text style={styles.footer}>
                    Rate card source: City of Ashland, Ohio — Public Transit Division.{'\n'}
                    Rates are subject to change; this app reflects the latest published rates.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    banner: {
        backgroundColor: 'white', borderRadius: 16, padding: 16, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    bannerEmoji: { fontSize: 34 },
    bannerTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginTop: 6 },
    bannerSub: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4, textAlign: 'center' },

    tableCard: {
        marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: 'white',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    tableHeader: { padding: 14 },
    tableTitle: {
        color: 'white', fontSize: 13, fontWeight: '900',
        textTransform: 'uppercase', letterSpacing: 0.8,
    },
    tableRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
    },
    rowKey: { fontSize: 13, fontWeight: '600', color: '#0f172a', flex: 1, paddingRight: 8 },
    rowVal: { fontSize: 14, fontWeight: '900', color: '#059669' },

    notesCard: {
        marginTop: 14, padding: 16, borderRadius: 16,
        backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    },
    notesTitle: { fontSize: 14, fontWeight: '900', color: '#1e40af', marginBottom: 8 },
    note: { fontSize: 12, fontWeight: '600', color: '#1e3a8a', lineHeight: 18 },

    footer: {
        marginTop: 20, textAlign: 'center', fontSize: 11,
        fontWeight: '600', color: '#94a3b8', lineHeight: 16,
    },
});

export default FareInfoScreen;
