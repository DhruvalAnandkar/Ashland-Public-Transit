import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Linking, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';

const FAQS = [
    {
        q: 'How do I book a ride?',
        a: 'Tap "Book a Ride Now" on the home screen. Enter pickup and drop-off, choose a time, and confirm. Rides inside Ashland city limits can be booked for today (same-day) or scheduled 24+ hours in advance for the lower rate.',
    },
    {
        q: 'What is the pickup window?',
        a: 'Ashland Public Transit operates on a 30-minute pickup window. Your driver may arrive anytime within that window. Please be ready at the earliest minute of the window.',
    },
    {
        q: 'Can I cancel a ride?',
        a: 'Yes — from My Rides, select the ride and tap Cancel. Cancellations before the driver is En-Route are free. If the ride was Confirmed and you don\'t show, an APT no-show fee will apply ($3 general public, $1.50 elderly/disabled).',
    },
    {
        q: 'What happens if no one picks me up?',
        a: 'Rides that are not dispatched within 10 minutes of their scheduled time are automatically cancelled (no charge). Call dispatch at (419) 207-8240 for urgent assistance.',
    },
    {
        q: 'How do I qualify for the reduced fare?',
        a: 'Seniors (65+) and disabled riders qualify for reduced fares. In Edit Profile, set your Rider Category to "Senior" or "ADA" — you may be asked to present proof (driver\'s license or ADA documentation) when boarding.',
    },
    {
        q: 'Do you go outside Ashland?',
        a: 'Yes, up to a 100-mile radius. Trips must start OR end inside city limits and be booked at least 72 hours in advance. Out-of-town trips cost the in-city rate + $2.50 per mile + $20/hr wait time when applicable.',
    },
    {
        q: 'Do you offer airport service?',
        a: 'Yes. Flat rates apply — $100 for Cleveland (CLE) or Akron-Canton (CAK), $150 for Columbus (CMH). Each additional passenger is +$10.',
    },
    {
        q: 'Is APT wheelchair accessible?',
        a: 'All APT vehicles are wheelchair-accessible. Note accessibility needs in your profile so dispatch can dispatch the right vehicle.',
    },
];

const FaqItem = ({ item, open, onPress, delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.faqCard}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.faqHeader}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqChev}>{open ? '−' : '+'}</Text>
        </TouchableOpacity>
        {open && <Text style={styles.faqA}>{item.a}</Text>}
    </Animated.View>
);

const ContactCard = ({ icon, title, value, onPress, colors, delay }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ flex: 1 }}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.contactCard}>
                <Text style={styles.contactIcon}>{icon}</Text>
                <Text style={styles.contactTitle}>{title}</Text>
                <Text style={styles.contactValue}>{value}</Text>
            </LinearGradient>
        </TouchableOpacity>
    </Animated.View>
);

const HelpScreen = ({ onClose }) => {
    const [openIdx, setOpenIdx] = useState(null);

    const openUrl = async (url, label) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert(label || 'Unable to open', url);
        }
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Help & Support" subtitle="We're here to help" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

                {/* Contact Quick Actions */}
                <Text style={styles.section}>Contact Dispatch</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <ContactCard
                        icon="📞" title="Call Dispatch" value="(419) 207-8240"
                        onPress={() => openUrl('tel:+14192078240', 'Dial dispatch')}
                        colors={['#059669', '#047857']}
                        delay={40}
                    />
                    <ContactCard
                        icon="📞" title="Office" value="(419) 289-8221"
                        onPress={() => openUrl('tel:+14192898221', 'Dial office')}
                        colors={['#2563eb', '#1d4ed8']}
                        delay={80}
                    />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <ContactCard
                        icon="♿" title="TTDY" value="Ohio Relay 711"
                        onPress={() => openUrl('tel:711', 'Ohio Relay')}
                        colors={['#7c3aed', '#6d28d9']}
                        delay={120}
                    />
                    <ContactCard
                        icon="🌐" title="Website" value="ashlandohio.gov"
                        onPress={() => openUrl('https://www.ashlandohio.us/183/Ashland-Public-Transit', 'Website')}
                        colors={['#0891b2', '#0e7490']}
                        delay={160}
                    />
                </View>

                {/* Hours */}
                <Text style={styles.section}>Hours of Operation</Text>
                <View style={styles.card}>
                    <View style={styles.hrsRow}><Text style={styles.hrsDay}>Monday – Friday</Text><Text style={styles.hrsTime}>6:00 AM – 9:00 PM</Text></View>
                    <View style={styles.hrsRow}><Text style={styles.hrsDay}>Saturday</Text><Text style={styles.hrsTime}>8:00 AM – 6:00 PM</Text></View>
                    <View style={styles.hrsRow}><Text style={styles.hrsDay}>Sunday / Holidays</Text><Text style={[styles.hrsTime, { color: '#dc2626' }]}>Closed</Text></View>
                </View>

                {/* FAQ */}
                <Text style={styles.section}>Frequently Asked</Text>
                {FAQS.map((item, i) => (
                    <FaqItem
                        key={i}
                        item={item}
                        open={openIdx === i}
                        onPress={() => { Haptics.selectionAsync(); setOpenIdx(openIdx === i ? null : i); }}
                        delay={40 + i * 30}
                    />
                ))}

                {/* Emergency */}
                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emergencyCard}>
                    <Text style={styles.emergencyTitle}>Emergency?</Text>
                    <Text style={styles.emergencyBody}>
                        In life-threatening situations, always call 911 first. For urgent transit issues, use the
                        in-app SOS button on your active ride or call dispatch directly.
                    </Text>
                    <TouchableOpacity
                        onPress={() => openUrl('tel:911')}
                        activeOpacity={0.85}
                        style={{ marginTop: 10 }}
                    >
                        <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.emergencyBtn}>
                            <Text style={styles.emergencyBtnTxt}>Call 911</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
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
    contactCard: {
        padding: 16, borderRadius: 16,
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
    },
    contactIcon: { fontSize: 26, marginBottom: 6 },
    contactTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    contactValue: { color: 'white', fontSize: 15, fontWeight: '900', marginTop: 4 },

    card: {
        backgroundColor: 'white', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    hrsRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6,
    },
    hrsDay: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    hrsTime: { fontSize: 13, fontWeight: '800', color: '#059669' },

    faqCard: {
        backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    faqHeader: { flexDirection: 'row', alignItems: 'center' },
    faqQ: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0f172a' },
    faqChev: { color: '#2563eb', fontSize: 22, fontWeight: '700', paddingHorizontal: 8 },
    faqA: { fontSize: 13, fontWeight: '500', color: '#475569', marginTop: 10, lineHeight: 20 },

    emergencyCard: {
        marginTop: 20, padding: 16, borderRadius: 16,
        backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    },
    emergencyTitle: { fontSize: 15, fontWeight: '900', color: '#991b1b' },
    emergencyBody: { fontSize: 13, fontWeight: '600', color: '#7f1d1d', marginTop: 6, lineHeight: 18 },
    emergencyBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    emergencyBtnTxt: { color: 'white', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
});

export default HelpScreen;
