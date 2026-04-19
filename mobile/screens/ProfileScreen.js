import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { getMyProfile, updateMyProfile, getRideHistory } from '../services/api';
import { useAppTheme } from '../context/ThemeContext';

const Row = ({ icon, ionIcon, title, subtitle, onPress, right, danger, delay = 0, styles, colors }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
        <TouchableOpacity
            style={styles.row}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
            activeOpacity={0.7}
        >
            <View style={[styles.rowIcon, danger && { backgroundColor: colors.danger + '22' }]}>
                {ionIcon ? (
                    <Ionicons name={ionIcon} size={18} color={danger ? colors.danger : colors.brand} />
                ) : (
                    <Text style={styles.rowIconText}>{icon}</Text>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
                {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
            </View>
            {right || <Text style={styles.chev}>›</Text>}
        </TouchableOpacity>
    </Animated.View>
);

const SectionLabel = ({ children, styles }) => (
    <Text style={styles.sectionLabel}>{children}</Text>
);

const RIDER_TYPE_DESC = {
    General: 'Standard fare',
    Senior: 'Age 65+  •  discounted',
    'Elderly/Disabled': 'ADA-verified  •  discounted',
    Student: 'Ashland Univ student',
    Veteran: 'Free fares — thank you for your service',
    Child: 'Under 12',
};

const ProfileScreen = ({ user, onClose, onLogout, navigate, refreshUser }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [profile, setProfile] = useState(user || {});
    const [stats, setStats] = useState(user?.stats || {});
    const [refreshing, setRefreshing] = useState(false);

    // Keep the latest refreshUser in a ref so `load` is stable and
    // the profile effect doesn't re-run on every parent re-render
    // (which was causing a request loop and flickering stats).
    const refreshUserRef = useRef(refreshUser);
    useEffect(() => { refreshUserRef.current = refreshUser; }, [refreshUser]);

    const load = async () => {
        let serverStats = null;
        try {
            const fresh = await getMyProfile();
            setProfile(fresh);
            if (fresh.stats) {
                serverStats = fresh.stats;
                setStats(fresh.stats);
            }
            refreshUserRef.current?.(fresh);
        } catch { /* ignore */ }

        try {
            const rides = await getRideHistory();
            const total = rides.length;
            const completed = rides.filter((r) => r.status === 'Completed').length;
            const cancelled = rides.filter((r) => r.status === 'Cancelled').length;
            const spent = rides
                .filter((r) => r.paymentStatus === 'Paid')
                .reduce((s, r) => s + (r.fare || 0), 0);
            setStats({
                ...(serverStats || {}),
                totalRides: total,
                completedRides: completed,
                cancelledRides: cancelled,
                totalSpent: spent,
            });
        } catch { /* ignore */ }
    };

    useEffect(() => {
        load();
        // Intentionally run once on mount; pull-to-refresh re-runs it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const pickAvatar = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
            });
            if (result.canceled) return;
            const asset = result.assets?.[0];
            if (!asset?.base64) return;
            const dataUri = `data:image/jpeg;base64,${asset.base64}`;
            const updated = await updateMyProfile({ avatar: dataUri });
            setProfile(updated);
            refreshUser?.(updated);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        }
    };

    const initial = (profile.firstName || profile.username || 'R').charAt(0).toUpperCase();
    const displayName = profile.fullName?.trim()
        || [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
        || profile.username
        || 'Rider';
    const riderType = profile.riderType || 'General';

    return (
        <View style={styles.container}>
            <ScreenHeader title="Profile" onBack={onClose} />
            <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* ── Hero Card ─────────────────────────────────── */}
                <Animated.View entering={FadeIn.duration(400)} style={styles.heroWrap}>
                    <LinearGradient
                        colors={[colors.brandDeep, colors.brand]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.heroCard}
                    >
                        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
                            {profile.avatar ? (
                                <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
                            ) : (
                                <LinearGradient colors={['#60a5fa', '#3b82f6']} style={styles.avatar}>
                                    <Text style={styles.avatarTxt}>{initial}</Text>
                                </LinearGradient>
                            )}
                            <View style={styles.cameraBadge}>
                                <Text style={{ fontSize: 14 }}>📷</Text>
                            </View>
                        </TouchableOpacity>

                        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                        <Text style={styles.handle}>@{profile.username}</Text>

                        <View style={styles.badgeRow}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{riderType}</Text>
                            </View>
                            {profile.veteranVerified && (
                                <View style={[styles.badge, { backgroundColor: 'rgba(34,197,94,0.25)' }]}>
                                    <Text style={[styles.badgeText, { color: '#86efac' }]}>✓ Verified</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.tierHint}>{RIDER_TYPE_DESC[riderType]}</Text>
                    </LinearGradient>
                </Animated.View>

                {/* ── Quick Stats ───────────────────────────────── */}
                <View style={styles.statsRow}>
                    <View style={styles.stat}><Text style={styles.statNum}>{stats.totalRides || 0}</Text><Text style={styles.statLbl}>Total</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}><Text style={styles.statNum}>{stats.completedRides || 0}</Text><Text style={styles.statLbl}>Completed</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                        <Text style={styles.statNum}>${(stats.totalSpent || 0).toFixed(0)}</Text>
                        <Text style={styles.statLbl}>Spent</Text>
                    </View>
                </View>

                {/* ── Account ───────────────────────────────────── */}
                <SectionLabel styles={styles}>Account</SectionLabel>
                <View style={styles.card}>
                    <Row icon="✏️" title="Edit Profile" subtitle="Name, email, phone, DOB" onPress={() => navigate('EDIT_PROFILE')} delay={50} styles={styles} colors={colors} />
                    <Row icon="🎟️" title="Rider Category" subtitle={RIDER_TYPE_DESC[riderType]} onPress={() => navigate('EDIT_PROFILE')} delay={70} styles={styles} colors={colors} />
                    <Row icon="📍" title="Saved Places" subtitle={`${profile.savedPlaces?.length || 0} saved`} onPress={() => navigate('SAVED_PLACES')} delay={90} styles={styles} colors={colors} />
                    <Row icon="💳" title="Payment Methods" subtitle={`${profile.paymentMethods?.length || 0} on file`} onPress={() => navigate('PAYMENT_METHODS')} delay={110} styles={styles} colors={colors} />
                    <Row icon="🆘" title="Emergency Contact" subtitle={profile.emergencyContact?.name || 'Not set'} onPress={() => navigate('EDIT_PROFILE')} delay={130} styles={styles} colors={colors} />
                </View>

                {/* ── App ───────────────────────────────────────── */}
                <SectionLabel styles={styles}>App</SectionLabel>
                <View style={styles.card}>
                    <Row ionIcon="chatbubble-ellipses-outline" title="APT Assist" subtitle="AI helper · fares, booking, dispatch" onPress={() => navigate('CHATBOT')} delay={140} styles={styles} colors={colors} />
                    <Row icon="🔔" title="Notifications" subtitle="Ride alerts, receipts, promos" onPress={() => navigate('NOTIFICATIONS')} delay={150} styles={styles} colors={colors} />
                    <Row icon="⚙️" title="Settings & Privacy" subtitle="Appearance, language, data sharing" onPress={() => navigate('SETTINGS')} delay={170} styles={styles} colors={colors} />
                    <Row icon="💲" title="APT Fare Rates" subtitle="Official Ashland pricing" onPress={() => navigate('FARE_INFO')} delay={190} styles={styles} colors={colors} />
                    <Row icon="❓" title="Help & Support" subtitle="FAQ, contact dispatch" onPress={() => navigate('HELP')} delay={210} styles={styles} colors={colors} />
                    <Row icon="ℹ️" title="About Ashland Transit" subtitle="Hours, service area, legal" onPress={() => navigate('ABOUT')} delay={230} styles={styles} colors={colors} />
                </View>

                {/* ── Security ──────────────────────────────────── */}
                <SectionLabel styles={styles}>Security</SectionLabel>
                <View style={styles.card}>
                    <Row icon="🔑" title="Change Password" onPress={() => navigate('CHANGE_PASSWORD')} delay={250} styles={styles} colors={colors} />
                    <Row icon="🔒" title="Log Out" onPress={() => {
                        Alert.alert('Log out', 'Are you sure you want to log out?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Log out', style: 'destructive', onPress: onLogout },
                        ]);
                    }} delay={270} styles={styles} colors={colors} />
                </View>

                <Text style={styles.versionText}>
                    Ashland Public Transit  •  v1.0{'\n'}
                    Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
                </Text>
            </ScrollView>
        </View>
    );
};

const makeStyles = (c) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    heroWrap: { padding: 16 },
    heroCard: {
        borderRadius: 24, padding: 24, alignItems: 'center',
        shadowColor: c.brandDeep, shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
    },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    },
    avatarImg: {
        width: 88, height: 88, borderRadius: 44,
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    },
    avatarTxt: { color: '#fff', fontSize: 34, fontWeight: '900' },
    cameraBadge: {
        position: 'absolute', right: -2, bottom: -2,
        backgroundColor: c.surface, borderRadius: 14,
        width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: c.brand,
    },
    name: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 12, letterSpacing: -0.3 },
    handle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    badge: {
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    tierHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 8 },

    statsRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.surface, borderRadius: 16, padding: 16,
        marginHorizontal: 16, marginBottom: 8,
        shadowColor: c.shadow, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    stat: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: '900', color: c.text },
    statLbl: {
        fontSize: 10, fontWeight: '700', color: c.muted,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: 2,
    },
    statDivider: { width: 1, height: 30, backgroundColor: c.border },

    sectionLabel: {
        fontSize: 11, fontWeight: '900', color: c.muted,
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginHorizontal: 20, marginTop: 18, marginBottom: 8,
    },
    card: {
        backgroundColor: c.surface, marginHorizontal: 16, borderRadius: 16,
        shadowColor: c.shadow, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    rowIcon: {
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: c.brandSoft,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    rowIconText: { fontSize: 18 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: c.text },
    rowSubtitle: { fontSize: 12, fontWeight: '500', color: c.muted, marginTop: 2 },
    chev: { color: c.subtle, fontSize: 22, fontWeight: '500' },

    versionText: {
        textAlign: 'center', color: c.subtle, fontSize: 11, fontWeight: '600',
        marginTop: 28, lineHeight: 16,
    },
});

export default ProfileScreen;
