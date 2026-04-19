import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Modal, StatusBar, Dimensions, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
    FadeInDown, FadeInUp, FadeIn,
    useSharedValue, useAnimatedStyle, withSpring, withRepeat,
    withTiming, withDelay, withSequence, Easing,
} from 'react-native-reanimated';
import { getRideHistory } from '../services/api';
import HeroCanvas from '../components/HeroCanvas';

const { width } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const STATUS_COLORS = {
    Completed: { bg: '#dcfce7', text: '#166534', dot: '#22c55e', stripe: '#22c55e' },
    Cancelled: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', stripe: '#ef4444' },
    Pending: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b', stripe: '#f59e0b' },
    'Pending Review': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b', stripe: '#f59e0b' },
    'En-Route': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6', stripe: '#3b82f6' },
    Confirmed: { bg: '#d1fae5', text: '#065f46', dot: '#10b981', stripe: '#10b981' },
    Rejected: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8', stripe: '#94a3b8' },
};

/* ─── SKELETON LOADER ─────────────────────────────────────────────── */
const SkeletonCard = () => {
    const opacity = useSharedValue(0.3);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);
    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <Animated.View style={[styles.skeletonCard, animStyle]}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
            <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
        </Animated.View>
    );
};

/* ─── ACTION CHIP ─────────────────────────────────────────────────── */
const ActionChip = ({ emoji, label, colors, onPress, delay = 0 }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.88, { damping: 10, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.chipWrapper}>
            <AnimatedTouchable style={animStyle} onPress={handlePress} activeOpacity={1}>
                <LinearGradient colors={colors} style={styles.chip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={styles.chipEmoji}>{emoji}</Text>
                    <Text style={styles.chipLabel}>{label}</Text>
                </LinearGradient>
            </AnimatedTouchable>
        </Animated.View>
    );
};

/* ─── BOOK BUTTON ─────────────────────────────────────────────────── */
const BookButton = ({ onPress }) => {
    const shimmer = useSharedValue(0);
    const scale = useSharedValue(1);
    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }), -1, true
        );
    }, []);
    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: 0.15 + shimmer.value * 0.12,
    }));
    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));
    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.95, { damping: 12, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };
    return (
        <Animated.View entering={FadeInDown.delay(350).springify()}>
            <AnimatedTouchable onPress={handlePress} activeOpacity={1} style={scaleStyle}>
                <LinearGradient
                    colors={['#059669', '#047857', '#065f46']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.bookButton}
                >
                    <Animated.View style={[StyleSheet.absoluteFillObject, shimmerStyle, { backgroundColor: 'white', borderRadius: 18 }]} />
                    <Text style={styles.bookButtonText}>🚐  Book a Ride Now</Text>
                    <Text style={styles.bookSubtext}>On-demand transit across Ashland</Text>
                </LinearGradient>
            </AnimatedTouchable>
        </Animated.View>
    );
};

/* ─── RIDE CARD ───────────────────────────────────────────────────── */
const RideCard = ({ item, index, onPress, onViewTicket }) => {
    const theme = STATUS_COLORS[item.status] || STATUS_COLORS.Rejected;
    const scale = useSharedValue(1);
    const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.97, { damping: 12, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };
    return (
        <Animated.View entering={FadeInDown.delay(100 + index * 80).springify()}>
            <AnimatedTouchable style={scaleStyle} onPress={handlePress} activeOpacity={1}>
                <View style={styles.rideCard}>
                    <View style={[styles.cardStripe, { backgroundColor: theme.stripe }]} />
                    <View style={styles.cardContent}>
                        {/* Header */}
                        <View style={styles.rideHeader}>
                            <Text style={styles.rideDate}>
                                {new Date(item.scheduledTime).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                })}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                                <View style={[styles.statusDot, { backgroundColor: theme.dot }]} />
                                <Text style={[styles.statusText, { color: theme.text }]}>{item.status}</Text>
                            </View>
                        </View>
                        {/* Route */}
                        <View style={styles.routeBlock}>
                            <View style={styles.routeRow}>
                                <View style={styles.routeConnector}>
                                    <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
                                    <View style={styles.routeLineVert} />
                                    <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
                                </View>
                                <View style={styles.routeTexts}>
                                    <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
                                    <Text style={styles.routeText} numberOfLines={1}>{item.dropoff}</Text>
                                </View>
                            </View>
                        </View>
                        {/* Footer */}
                        <View style={styles.rideFooter}>
                            <View style={styles.farePill}>
                                <Text style={styles.fareText}>${(item.fare || 0).toFixed(2)}</Text>
                            </View>
                            <View style={styles.rideMetaRow}>
                                <Text style={styles.paxBadgeText}>👤 {item.passengers || 1}</Text>
                                <TouchableOpacity
                                    style={styles.viewTicketButton}
                                    onPress={() => onViewTicket?.(item)}
                                >
                                    <Text style={styles.viewTicketText}>View Ticket →</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </AnimatedTouchable>
        </Animated.View>
    );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════════════ */
const RiderHomeScreen = ({ user, onLogout, onBookPress, onViewTicket, navigation, openMenu }) => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showSosModal, setShowSosModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const go = (key) => {
        setShowMenu(false);
        if (openMenu) openMenu(key);
    };

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const history = await getRideHistory();
            setRides(Array.isArray(history) ? history : []);
        } catch (error) {
            console.error('Failed to fetch rides', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleRefresh = () => { setRefreshing(true); fetchHistory(); };

    const getInitial = () => (user?.username || 'R').charAt(0).toUpperCase();
    const activeRides = rides.filter(r => ['Pending', 'Confirmed', 'En-Route'].includes(r.status));
    const completedRides = rides.filter(r => r.status === 'Completed');

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
                }
                scrollEventThrottle={16}
            >
                {/* ══ HEADER ════════════════════════════════════════ */}
                <LinearGradient
                    colors={['#0b1e5c', '#1e3a8a', '#1e40af', '#2563eb']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    {/* Live decorative canvas — floating orbs + traveling dot */}
                    <HeroCanvas height={180} />
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={{ position: 'relative', zIndex: 2 }}>
                        {/* Top Row: Avatar + Name + Menu */}
                        <View style={styles.headerTop}>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    go('PROFILE');
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={styles.avatarContainer}>
                                    {user?.avatar ? (
                                        <Animated.Image
                                            source={{ uri: user.avatar }}
                                            style={styles.avatarImg}
                                        />
                                    ) : (
                                        <LinearGradient colors={['#60a5fa', '#3b82f6']} style={styles.avatarGradient}>
                                            <Text style={styles.avatarText}>{getInitial()}</Text>
                                        </LinearGradient>
                                    )}
                                    <View style={styles.avatarRing} />
                                </View>
                            </TouchableOpacity>
                            <View style={styles.headerTextBlock}>
                                <View style={styles.livePill}>
                                    <View style={styles.livePillDot} />
                                    <Text style={styles.livePillText}>LIVE • ASHLAND TRANSIT</Text>
                                </View>
                                <Text style={styles.greeting}>Welcome back,</Text>
                                <Text style={styles.username}>{user?.firstName || user?.username || 'Rider'} 👋</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowMenu(true);
                                }}
                                style={styles.menuButton}
                                hitSlop={10}
                            >
                                <View style={styles.menuDot} />
                                <View style={styles.menuDot} />
                                <View style={styles.menuDot} />
                            </TouchableOpacity>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{activeRides.length}</Text>
                                <Text style={styles.statLabel}>Active</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{completedRides.length}</Text>
                                <Text style={styles.statLabel}>Completed</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{rides.length}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                        </View>
                    </Animated.View>
                </LinearGradient>

                {/* ══ BODY ══════════════════════════════════════════ */}
                <View style={styles.body}>
                    {/* ── Wallet Card ───────────────────────────────── */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
                        <LinearGradient
                            colors={['#0f172a', '#1e293b', '#0f172a']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.walletCard}
                        >
                            <View style={styles.walletGlow} />
                            <View style={styles.walletRow}>
                                <View>
                                    <Text style={styles.walletLabel}>WALLET BALANCE</Text>
                                    <Text style={styles.walletAmount}>
                                        ${(user?.walletBalance || 0).toFixed(2)}
                                    </Text>
                                </View>
                                <View style={styles.creditsBadge}>
                                    <Text style={styles.creditsText}>TRANSIT{'\n'}CREDITS</Text>
                                </View>
                            </View>
                            <Text style={styles.walletSub}>Ashland City Transit • Prepaid</Text>
                        </LinearGradient>
                    </Animated.View>

                    {/* ── Action Chips ──────────────────────────────── */}
                    <View style={[styles.section, styles.chipsRow]}>
                        <ActionChip
                            emoji="📅" label="Schedule"
                            colors={['#eff6ff', '#dbeafe']}
                            delay={250}
                            onPress={() => {
                                if (onBookPress) onBookPress({ scheduledMode: true });
                                else if (navigation) navigation.navigate('RiderBookingScreen', { scheduledMode: true });
                            }}
                        />
                        <ActionChip
                            emoji="🎫" label="My Rides"
                            colors={['#f0fdf4', '#dcfce7']}
                            delay={300}
                            onPress={() => {
                                if (navigation) navigation.navigate('RiderRidesScreen');
                            }}
                        />
                        <ActionChip
                            emoji="💲" label="Fares"
                            colors={['#fffbeb', '#fef3c7']}
                            delay={350}
                            onPress={() => go('FARE_INFO')}
                        />
                        <ActionChip
                            emoji="🆘" label="SOS"
                            colors={['#fef2f2', '#fee2e2']}
                            delay={400}
                            onPress={() => setShowSosModal(true)}
                        />
                    </View>

                    {/* ── Book Button ───────────────────────────────── */}
                    <View style={styles.section}>
                        <BookButton onPress={() => {
                            if (onBookPress) onBookPress({ scheduledMode: false });
                            else if (navigation) navigation.navigate('RiderBookingScreen', { scheduledMode: false });
                        }} />
                    </View>

                    {/* ── Recent Activity ───────────────────────────── */}
                    <View style={styles.section}>
                        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.activityHeader}>
                            <Text style={styles.sectionTitle}>Recent Activity</Text>
                            <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
                                <Text style={styles.refreshText}>Refresh ↻</Text>
                            </TouchableOpacity>
                        </Animated.View>

                        {loading ? (
                            <>
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </>
                        ) : rides.length === 0 ? (
                            <Animated.View entering={FadeIn.delay(500)} style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>🚌</Text>
                                <Text style={styles.emptyTitle}>No rides yet</Text>
                                <Text style={styles.emptyText}>Book your first ride above!</Text>
                            </Animated.View>
                        ) : (
                            rides.slice(0, 10).map((item, index) => (
                                <RideCard
                                    key={item._id}
                                    item={item}
                                    index={index}
                                    onPress={() => setSelectedRide(item)}
                                    onViewTicket={onViewTicket}
                                />
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* ══ RIDE DETAIL MODAL ═════════════════════════════════ */}
            <Modal
                visible={!!selectedRide}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedRide(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.detailSheet}>
                        <View style={styles.sheetHandle} />
                        {selectedRide && (
                            <>
                                <View style={styles.detailHeader}>
                                    <Text style={styles.detailTitle}>Ride Details</Text>
                                    <TouchableOpacity onPress={() => setSelectedRide(null)}>
                                        <Text style={styles.closeBtn}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.detailCard}>
                                    <Text style={styles.detailTicket}>
                                        🎫 {selectedRide.ticketId || 'N/A'}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedRide.status] || STATUS_COLORS.Rejected).bg }]}>
                                        <View style={[styles.statusDot, { backgroundColor: (STATUS_COLORS[selectedRide.status] || STATUS_COLORS.Rejected).dot }]} />
                                        <Text style={[styles.statusText, { color: (STATUS_COLORS[selectedRide.status] || STATUS_COLORS.Rejected).text }]}>{selectedRide.status}</Text>
                                    </View>
                                </View>
                                {[
                                    ['Date', new Date(selectedRide.scheduledTime).toLocaleString()],
                                    ['Pickup', selectedRide.pickup],
                                    ['Drop-off', selectedRide.dropoff],
                                    ['Fare', `$${(selectedRide.fare || 0).toFixed(2)}`],
                                    ['Passengers', String(selectedRide.passengers || 1)],
                                    ...(selectedRide.assignedVehicle ? [['Vehicle', selectedRide.assignedVehicle]] : []),
                                ].map(([label, value]) => (
                                    <React.Fragment key={label}>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>{label}</Text>
                                            <Text style={[styles.detailValue, label === 'Fare' && { color: '#059669', fontWeight: '900' }]}>{value}</Text>
                                        </View>
                                        <View style={styles.detailDivider} />
                                    </React.Fragment>
                                ))}
                                <TouchableOpacity
                                    style={styles.closeDetailBtn}
                                    onPress={() => setSelectedRide(null)}
                                >
                                    <LinearGradient
                                        colors={['#0f172a', '#1e293b']}
                                        style={styles.closeDetailGradient}
                                    >
                                        <Text style={styles.closeDetailText}>Close</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ══ HELP MODAL ═══════════════════════════════════════ */}
            <Modal visible={showHelpModal} transparent animationType="fade" onRequestClose={() => setShowHelpModal(false)}>
                <View style={styles.centeredOverlay}>
                    <View style={styles.comingSoonBox}>
                        <View style={[styles.modalAccent, { backgroundColor: '#059669' }]} />
                        <Text style={styles.csEmoji}>❓</Text>
                        <Text style={styles.csTitle}>Help Center</Text>
                        <Text style={styles.csMsg}>
                            Call Dispatch: (419) 289-0000{'\n'}
                            Mon–Fri 7am–6pm{'\n\n'}
                            Email: transit@ashlandohio.gov
                        </Text>
                        <TouchableOpacity style={styles.csDismiss} onPress={() => setShowHelpModal(false)}>
                            <LinearGradient colors={['#059669', '#047857']} style={styles.csDismissGradient}>
                                <Text style={styles.csDismissText}>Got it</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══ SOS MODAL ════════════════════════════════════════ */}
            <Modal visible={showSosModal} transparent animationType="fade" onRequestClose={() => setShowSosModal(false)}>
                <View style={styles.centeredOverlay}>
                    <View style={styles.comingSoonBox}>
                        <View style={[styles.modalAccent, { backgroundColor: '#ef4444' }]} />
                        <Text style={styles.csEmoji}>🆘</Text>
                        <Text style={styles.csTitle}>Emergency Contact</Text>
                        <Text style={styles.csMsg}>
                            For emergencies, call 911{'\n\n'}
                            Ashland Transit Dispatch:{'\n'}
                            (419) 207-8240
                        </Text>
                        <TouchableOpacity style={styles.csDismiss} onPress={() => setShowSosModal(false)}>
                            <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.csDismissGradient}>
                                <Text style={styles.csDismissText}>Close</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══ SIDE MENU DRAWER ═════════════════════════════════ */}
            <Modal
                visible={showMenu}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    style={styles.drawerBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.drawer} onPress={() => { }}>
                        <LinearGradient
                            colors={['#1e3a8a', '#2563eb']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.drawerHeader}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.drawerAvatar}>
                                    <Text style={styles.drawerAvatarTxt}>{getInitial()}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.drawerName} numberOfLines={1}>
                                        {user?.firstName || user?.username || 'Rider'}
                                    </Text>
                                    <Text style={styles.drawerSub} numberOfLines={1}>
                                        @{user?.username}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => go('PROFILE')}
                                style={styles.drawerViewProfile}
                            >
                                <Text style={styles.drawerViewProfileTxt}>View profile →</Text>
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
                            {[
                                { icon: '👤', title: 'Profile', onPress: () => go('PROFILE') },
                                { icon: '🎫', title: 'My Rides', onPress: () => { setShowMenu(false); navigation?.navigate('RiderRidesScreen'); } },
                                { icon: '📍', title: 'Saved Places', onPress: () => go('SAVED_PLACES') },
                                { icon: '💳', title: 'Payment Methods', onPress: () => go('PAYMENT_METHODS') },
                                { icon: '💲', title: 'APT Fares', onPress: () => go('FARE_INFO') },
                                { icon: '🔔', title: 'Notifications', onPress: () => go('NOTIFICATIONS') },
                                { icon: '⚙️', title: 'Settings & Privacy', onPress: () => go('SETTINGS') },
                                { icon: '❓', title: 'Help & Support', onPress: () => go('HELP') },
                                { icon: 'ℹ️', title: 'About APT', onPress: () => go('ABOUT') },
                            ].map((item, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.drawerItem}
                                    onPress={item.onPress}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                                    <Text style={styles.drawerItemText}>{item.title}</Text>
                                    <Text style={styles.drawerItemChev}>›</Text>
                                </TouchableOpacity>
                            ))}

                            <View style={styles.drawerDivider} />

                            <TouchableOpacity
                                style={styles.drawerItem}
                                onPress={() => { setShowMenu(false); onLogout?.(); }}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.drawerItemIcon}>🚪</Text>
                                <Text style={[styles.drawerItemText, { color: '#dc2626' }]}>Sign Out</Text>
                            </TouchableOpacity>

                            <Text style={styles.drawerFooter}>
                                Ashland Public Transit{'\n'}
                                v1.0
                            </Text>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — Pixel-perfect, consistent 20px edge padding, 16px section gap
   ═══════════════════════════════════════════════════════════════════════ */
const EDGE = 20;

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#1e3a8a' },
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    scrollContent: { paddingBottom: 32 },

    /* ── Header ────────────────────────────────────────────────── */
    headerGradient: {
        paddingTop: 12,
        paddingBottom: 28,
        paddingHorizontal: EDGE,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    avatarContainer: { position: 'relative', marginRight: 12 },
    avatarGradient: {
        width: 48, height: 48, borderRadius: 24,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    avatarText: { color: 'white', fontSize: 20, fontWeight: '900' },
    avatarRing: {
        position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
        borderRadius: 27, borderWidth: 2, borderColor: 'rgba(96,165,250,0.4)',
    },
    headerTextBlock: { flex: 1 },
    livePill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderColor: 'rgba(255,255,255,0.25)',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 3,
        marginBottom: 5,
    },
    livePillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#34d399',
    },
    livePillText: {
        color: 'white',
        fontSize: 8.5,
        letterSpacing: 1.4,
        fontWeight: '900',
    },
    greeting: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
    username: { fontSize: 22, color: 'white', fontWeight: '900', marginTop: 1, letterSpacing: -0.3 },
    logoutButton: {
        paddingVertical: 7, paddingHorizontal: 14,
        backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    },
    logoutText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

    /* Stats */
    statsRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 14, paddingVertical: 12,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: '900', color: 'white' },
    statLabel: {
        fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase', letterSpacing: 1, marginTop: 2,
    },
    statDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },

    /* ── Body wrapper — consistent edge padding ────────────────── */
    body: {
        paddingHorizontal: EDGE,
        paddingTop: 16,
    },
    section: {
        marginBottom: 16,
    },

    /* ── Wallet ────────────────────────────────────────────────── */
    walletCard: {
        borderRadius: 20, padding: 22, overflow: 'hidden',
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    },
    walletGlow: {
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: 'rgba(59,130,246,0.12)',
    },
    walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    walletLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
    walletAmount: { color: 'white', fontSize: 38, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
    walletSub: { color: '#475569', fontSize: 11, fontWeight: '700', marginTop: 10 },
    creditsBadge: {
        backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    creditsText: { fontSize: 9, fontWeight: '900', color: '#60a5fa', textAlign: 'center', letterSpacing: 1, lineHeight: 14 },

    /* ── Chips ──────────────────────────────────────────────────── */
    chipsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    chipWrapper: { flex: 1 },
    chip: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    chipEmoji: { fontSize: 20, marginBottom: 4 },
    chipLabel: { fontSize: 9, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.3 },

    /* ── Book Button ────────────────────────────────────────────── */
    bookButton: {
        paddingVertical: 20, borderRadius: 18, alignItems: 'center',
        shadowColor: '#059669', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
        overflow: 'hidden',
    },
    bookButtonText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
    bookSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 3 },

    /* ── Activity ───────────────────────────────────────────────── */
    activityHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
    },
    sectionTitle: { fontSize: 17, fontWeight: '900', color: '#1e293b' },
    refreshBtn: {
        backgroundColor: '#f0fdf4', paddingVertical: 6,
        paddingHorizontal: 14, borderRadius: 10,
    },
    refreshText: { color: '#059669', fontWeight: '800', fontSize: 11 },

    /* ── Ride Card ──────────────────────────────────────────────── */
    rideCard: {
        backgroundColor: 'white', borderRadius: 16, marginBottom: 12,
        flexDirection: 'row', overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    cardStripe: { width: 4 },
    cardContent: { flex: 1, padding: 14 },
    rideHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
    },
    rideDate: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    routeBlock: { marginBottom: 10 },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
    routeConnector: { alignItems: 'center', marginRight: 10, paddingTop: 3 },
    routeDot: { width: 8, height: 8, borderRadius: 4 },
    routeLineVert: { width: 2, height: 14, backgroundColor: '#e2e8f0', marginVertical: 2 },
    routeTexts: { flex: 1, justifyContent: 'space-between', gap: 8 },
    routeText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },

    rideFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9',
    },
    farePill: {
        backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
    },
    fareText: { fontSize: 14, fontWeight: '900', color: 'white' },
    rideMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    paxBadgeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    viewTicketButton: {
        paddingVertical: 5, paddingHorizontal: 12,
        backgroundColor: '#eff6ff', borderRadius: 8,
    },
    viewTicketText: { color: '#2563eb', fontWeight: '800', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },

    /* ── Empty State ────────────────────────────────────────────── */
    emptyState: {
        alignItems: 'center', padding: 40, backgroundColor: 'white',
        borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed',
    },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '900', color: '#1e293b', marginBottom: 4 },
    emptyText: { color: '#94a3b8', fontWeight: '600', textAlign: 'center', fontSize: 13 },

    /* ── Skeleton ───────────────────────────────────────────────── */
    skeletonCard: {
        backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
    },
    skeletonLine: { height: 14, backgroundColor: '#e2e8f0', borderRadius: 8, width: '100%' },

    /* ── Modals ─────────────────────────────────────────────────── */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    detailSheet: {
        backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 36, minHeight: 400,
    },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    detailTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    closeBtn: { fontSize: 20, color: '#94a3b8', fontWeight: '700', padding: 4 },
    detailCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 14,
    },
    detailTicket: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12 },
    detailLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', maxWidth: '60%', textAlign: 'right' },
    detailDivider: { height: 1, backgroundColor: '#f1f5f9' },
    closeDetailBtn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
    closeDetailGradient: { padding: 16, alignItems: 'center', borderRadius: 14 },
    closeDetailText: { color: 'white', fontWeight: '800', fontSize: 15 },

    /* ── Help / SOS Modals ──────────────────────────────────────── */
    comingSoonBox: {
        backgroundColor: 'white', marginHorizontal: 28, borderRadius: 24,
        padding: 28, alignItems: 'center', overflow: 'hidden',
        width: width - 56,
    },
    modalAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    csEmoji: { fontSize: 48, marginBottom: 12 },
    csTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
    csMsg: { fontSize: 14, color: '#64748b', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
    csDismiss: { marginTop: 20, borderRadius: 14, overflow: 'hidden', width: '100%' },
    csDismissGradient: { paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
    csDismissText: { color: 'white', fontWeight: '800', fontSize: 15 },

    /* ── Avatar image (header) ─────────────────────────────────── */
    avatarImg: {
        width: 48, height: 48, borderRadius: 24,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    },
    /* ── Menu button (3 dots) ──────────────────────────────────── */
    menuButton: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'column', gap: 3,
    },
    menuDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'white' },

    /* ── Side Drawer ───────────────────────────────────────────── */
    drawerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.5)',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    drawer: {
        width: width * 0.82,
        maxWidth: 340,
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
        overflow: 'hidden',
    },
    drawerHeader: {
        paddingTop: 48, paddingBottom: 24, paddingHorizontal: 20,
    },
    drawerAvatar: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center', justifyContent: 'center',
    },
    drawerAvatarTxt: { color: 'white', fontSize: 22, fontWeight: '900' },
    drawerName: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
    drawerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
    drawerViewProfile: {
        marginTop: 14, alignSelf: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 7,
        backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12,
    },
    drawerViewProfileTxt: { color: 'white', fontSize: 12, fontWeight: '800' },

    drawerItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 18, paddingVertical: 14,
    },
    drawerItemIcon: { fontSize: 20, width: 30 },
    drawerItemText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    drawerItemChev: { color: '#cbd5e1', fontSize: 20, fontWeight: '500' },
    drawerDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8, marginHorizontal: 16 },
    drawerFooter: {
        textAlign: 'center', color: '#94a3b8',
        fontSize: 11, fontWeight: '600', marginTop: 20, lineHeight: 16,
    },
});

export default RiderHomeScreen;