import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScreenHeader from '../components/ScreenHeader';

const Section = ({ title, children, delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        {children}
    </Animated.View>
);

const AboutScreen = ({ onClose }) => {
    const openUrl = async (url) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try { await Linking.openURL(url); } catch { }
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="About APT" subtitle="Our mission, hours & service" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                <Animated.View entering={FadeIn.duration(400)}>
                    <LinearGradient
                        colors={['#1e3a8a', '#2563eb']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.hero}
                    >
                        <Text style={styles.heroEmoji}>🚐</Text>
                        <Text style={styles.heroTitle}>Ashland Public Transit</Text>
                        <Text style={styles.heroSub}>A "Shared Ride" Public Transportation System</Text>
                    </LinearGradient>
                </Animated.View>

                <Section title="Our Mission" delay={40}>
                    <Text style={styles.p}>
                        It is the mission of Ashland Public Transit, through the efforts of dedicated and
                        well-trained employees, to provide all citizens and visitors with safe, reliable and
                        efficient transportation, which continues to grow to meet their needs.
                    </Text>
                </Section>

                <Section title="Hours of Operation" delay={60}>
                    <View style={styles.kv}><Text style={styles.k}>Monday – Friday</Text><Text style={styles.v}>6:00 AM – 9:00 PM</Text></View>
                    <View style={styles.kv}><Text style={styles.k}>Saturday</Text><Text style={styles.v}>8:00 AM – 6:00 PM</Text></View>
                    <View style={styles.kv}><Text style={styles.k}>Sunday / Holidays</Text><Text style={[styles.v, { color: '#dc2626' }]}>Closed</Text></View>
                </Section>

                <Section title="Service Area" delay={80}>
                    <Text style={styles.p}>
                        Curb-to-curb, demand-response service within Ashland city limits. Out-of-town service
                        available up to a 100-mile radius, as long as the trip starts OR ends in Ashland.
                    </Text>
                    <Text style={[styles.p, { marginTop: 6 }]}>
                        All vehicles are wheelchair accessible. APT complies with ADA, Title VI, and all Civil Rights laws.
                    </Text>
                </Section>

                <Section title="Trip Types" delay={100}>
                    <View style={styles.tripRow}>
                        <Text style={styles.tripEmoji}>📆</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tripTitle}>Subscription</Text>
                            <Text style={styles.tripBody}>Recurring standing orders (e.g., groceries every Saturday).</Text>
                        </View>
                    </View>
                    <View style={styles.tripRow}>
                        <Text style={styles.tripEmoji}>⏰</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tripTitle}>Demand Response</Text>
                            <Text style={styles.tripBody}>Scheduled 24+ hours in advance.</Text>
                        </View>
                    </View>
                    <View style={styles.tripRow}>
                        <Text style={styles.tripEmoji}>⚡</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tripTitle}>Same Day</Text>
                            <Text style={styles.tripBody}>Booked the day of travel (higher fare).</Text>
                        </View>
                    </View>
                    <View style={styles.tripRow}>
                        <Text style={styles.tripEmoji}>🛣️</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tripTitle}>Out of Town</Text>
                            <Text style={styles.tripBody}>Up to 100 miles, 72-hour advance notice required.</Text>
                        </View>
                    </View>
                </Section>

                <Section title="Contact" delay={120}>
                    <TouchableOpacity onPress={() => openUrl('tel:+14192078240')} style={styles.linkRow}>
                        <Text style={styles.linkEmoji}>📞</Text>
                        <Text style={styles.link}>Dispatch: (419) 207-8240</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openUrl('tel:+14192898221')} style={styles.linkRow}>
                        <Text style={styles.linkEmoji}>🏢</Text>
                        <Text style={styles.link}>Office: (419) 289-8221</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openUrl('https://www.ashlandohio.us/183/Ashland-Public-Transit')} style={styles.linkRow}>
                        <Text style={styles.linkEmoji}>🌐</Text>
                        <Text style={styles.link}>ashlandohio.us/APT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openUrl('https://www.facebook.com/AshlandTransit')} style={styles.linkRow}>
                        <Text style={styles.linkEmoji}>📘</Text>
                        <Text style={styles.link}>facebook.com/AshlandTransit</Text>
                    </TouchableOpacity>
                    <View style={styles.linkRow}>
                        <Text style={styles.linkEmoji}>📍</Text>
                        <Text style={styles.link}>206 Claremont Avenue, Ashland, OH 44805</Text>
                    </View>
                </Section>

                <Section title="Funding & Compliance" delay={140}>
                    <Text style={styles.p}>
                        This service is financed in part by an Operating Assistance Grant from the Ohio Department
                        of Transportation and the Federal Transit Administration. Ashland Public Transit complies
                        with all Title VI and Civil Rights Laws.
                    </Text>
                </Section>

                <Text style={styles.version}>Ashland Public Transit App • v1.0{'\n'}© Ashland, Ohio</Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    hero: {
        padding: 24, borderRadius: 20, alignItems: 'center',
        shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
    },
    heroEmoji: { fontSize: 48 },
    heroTitle: { color: 'white', fontSize: 22, fontWeight: '900', marginTop: 8, letterSpacing: -0.3 },
    heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 4 },

    card: {
        marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: 'white',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    cardTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
    p: { fontSize: 13, fontWeight: '500', color: '#475569', lineHeight: 20 },

    kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    k: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    v: { fontSize: 13, fontWeight: '800', color: '#059669' },

    tripRow: {
        flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
    },
    tripEmoji: { fontSize: 22, marginRight: 12 },
    tripTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    tripBody: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },

    linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    linkEmoji: { fontSize: 18, marginRight: 10 },
    link: { fontSize: 13, fontWeight: '700', color: '#1e40af' },

    version: { marginTop: 22, textAlign: 'center', color: '#94a3b8', fontSize: 11, fontWeight: '600', lineHeight: 16 },
});

export default AboutScreen;
