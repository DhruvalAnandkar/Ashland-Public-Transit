import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Modal, RefreshControl, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import Animated, {
    FadeInDown, FadeIn,
    useSharedValue, useAnimatedStyle, withRepeat,
    withTiming, withSequence, withSpring, Easing,
} from 'react-native-reanimated';
import { getRideHistory, riderCancelRide } from '../services/api';

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

// ── ANIMATED SKELETON ────────────────────────────────────────────────────
const SkeletonCard = () => {
    const opacity = useSharedValue(0.3);
    useEffect(() => {
        opacity.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);
    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return (
        <Animated.View style={[styles.skeletonCard, animStyle]}>
            <View style={styles.skeletonRow}>
                <View style={[styles.skeletonBlock, { width: 100 }]} />
                <View style={[styles.skeletonBlock, { width: 70, height: 22, borderRadius: 12 }]} />
            </View>
            <View style={[styles.skeletonBlock, { width: '70%', marginTop: 12 }]} />
            <View style={[styles.skeletonBlock, { width: '50%', marginTop: 8 }]} />
        </Animated.View>
    );
};

// ── RIDE CARD COMPONENT ──────────────────────────────────────────────────
const RideCardItem = ({ item, index, onPress }) => {
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
        <Animated.View entering={FadeInDown.delay(80 + index * 60).springify()}>
            <AnimatedTouchable style={scaleStyle} onPress={handlePress} activeOpacity={1}>
                <View style={styles.rideCard}>
                    {/* Status Accent Stripe */}
                    <View style={[styles.cardStripe, { backgroundColor: theme.stripe }]} />
                    <View style={styles.cardContent}>
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

                        {/* Route Connector */}
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
                            <View style={styles.footerLeft}>
                                <Text style={styles.ticketSmall}>🎫 {item.ticketId || 'N/A'}</Text>
                            </View>
                            <View style={styles.footerRight}>
                                <View style={styles.farePill}>
                                    <Text style={styles.fareSmall}>${(item.fare || 0).toFixed(2)}</Text>
                                </View>
                                <Text style={[styles.paymentStatus, {
                                    color: item.paymentStatus === 'Paid' ? '#059669' : '#d97706'
                                }]}>
                                    {item.paymentStatus || 'Pending'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </AnimatedTouchable>
        </Animated.View>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════
const RiderRidesScreen = ({ navigation }) => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);

    const fetchRides = useCallback(async () => {
        try {
            const data = await getRideHistory();
            setRides(Array.isArray(data) ? data.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime)) : []);
        } catch (err) {
            console.error('Rides fetch error', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchRides(); }, [fetchRides]);

    const onRefresh = () => { setRefreshing(true); fetchRides(); };

    const renderRide = ({ item, index }) => (
        <RideCardItem item={item} index={index} onPress={() => setSelectedRide(item)} />
    );

    const isActive = selectedRide?.status === 'Confirmed' || selectedRide?.status === 'En-Route';
    const selectedTheme = selectedRide ? (STATUS_COLORS[selectedRide.status] || STATUS_COLORS.Rejected) : STATUS_COLORS.Rejected;

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />

            {/* ── PREMIUM HEADER ─────────────────────────────────── */}
            <LinearGradient
                colors={['#1e3a8a', '#1e40af', '#2563eb']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                {navigation && (
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.headerTitle}>My Rides</Text>
                <View style={styles.rideBadge}>
                    <Text style={styles.rideBadgeText}>{rides.length}</Text>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.listPad}>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            ) : (
                <FlatList
                    data={rides}
                    keyExtractor={item => item._id}
                    renderItem={renderRide}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
                    }
                    ListEmptyComponent={
                        <Animated.View entering={FadeIn.delay(300)} style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🚌</Text>
                            <Text style={styles.emptyTitle}>No rides yet</Text>
                            <Text style={styles.emptyText}>Book your first ride!</Text>
                            {navigation && (
                                <TouchableOpacity
                                    style={styles.bookNowBtn}
                                    onPress={() => navigation.navigate('RiderBookingScreen')}
                                >
                                    <LinearGradient
                                        colors={['#059669', '#047857']}
                                        style={styles.bookNowGradient}
                                    >
                                        <Text style={styles.bookNowText}>Book a Ride →</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    }
                />
            )}

            {/* ── RIDE DETAIL BOTTOM SHEET ───────────────────────── */}
            <Modal
                visible={!!selectedRide}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedRide(null)}
            >
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />

                        {selectedRide && (
                            <FlatList
                                data={[]}
                                ListHeaderComponent={
                                    <>
                                        <View style={styles.sheetHeader}>
                                            <Text style={styles.sheetTitle}>Ride Details</Text>
                                            <TouchableOpacity onPress={() => setSelectedRide(null)}>
                                                <Text style={styles.closeX}>✕</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Ticket + Status */}
                                        <View style={[styles.sheetTicketRow, { borderLeftWidth: 4, borderLeftColor: selectedTheme.stripe }]}>
                                            <Text style={styles.sheetTicket}>🎫 {selectedRide.ticketId || '—'}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: selectedTheme.bg }]}>
                                                <View style={[styles.statusDot, { backgroundColor: selectedTheme.dot }]} />
                                                <Text style={[styles.statusText, { color: selectedTheme.text }]}>{selectedRide.status}</Text>
                                            </View>
                                        </View>

                                        {/* QR Boarding Pass */}
                                        {isActive && (
                                            <View style={styles.qrSection}>
                                                <LinearGradient
                                                    colors={['#f0f9ff', '#e0f2fe']}
                                                    style={styles.qrContainer}
                                                >
                                                    <View style={styles.qrCodeWrapper}>
                                                        <QRCode
                                                            value={selectedRide.ticketId || 'N/A'}
                                                            size={180}
                                                            backgroundColor="white"
                                                            color="#0f172a"
                                                        />
                                                    </View>
                                                    <Text style={styles.qrTicketId}>{selectedRide.ticketId}</Text>
                                                    <Text style={styles.qrName}>{selectedRide.passengerName}</Text>
                                                    <View style={[styles.qrStatusPill, { backgroundColor: selectedTheme.bg }]}>
                                                        <Text style={[styles.qrStatusText, { color: selectedTheme.text }]}>
                                                            {selectedRide.status}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.qrLabel}>SHOW TO DRIVER TO BOARD</Text>
                                                </LinearGradient>
                                            </View>
                                        )}

                                        {/* Detail Rows */}
                                        {[
                                            ['Date', new Date(selectedRide.scheduledTime).toLocaleString()],
                                            ['Pickup', selectedRide.pickup],
                                            ['Drop-off', selectedRide.dropoff],
                                            ['Fare', `$${(selectedRide.fare || 0).toFixed(2)}`],
                                            ['Payment', `${selectedRide.paymentStatus || 'Pending'} (${selectedRide.paymentMethod || 'Cash'})`],
                                            ['Passengers', String(selectedRide.passengers || 1)],
                                            ['Type', selectedRide.userType || 'General'],
                                            ['Vehicle', selectedRide.assignedVehicle || 'Unassigned'],
                                        ].map(([label, value]) => (
                                            <React.Fragment key={label}>
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>{label}</Text>
                                                    <Text style={[
                                                        styles.detailValue,
                                                        label === 'Fare' && { color: '#059669', fontWeight: '900' },
                                                    ]}>{value}</Text>
                                                </View>
                                                <View style={styles.divider} />
                                            </React.Fragment>
                                        ))}

                                        {['Pending', 'Confirmed'].includes(selectedRide.status) && (
                                            <TouchableOpacity
                                                style={[styles.closeSheetBtn, { marginTop: 14 }]}
                                                onPress={() => {
                                                    Alert.alert(
                                                        'Cancel Ride',
                                                        'Are you sure you want to cancel this ride? Cancellations before dispatch are free. If your driver is already dispatched, APT no-show rules may apply.',
                                                        [
                                                            { text: 'Keep ride', style: 'cancel' },
                                                            {
                                                                text: 'Cancel ride',
                                                                style: 'destructive',
                                                                onPress: async () => {
                                                                    try {
                                                                        const updated = await riderCancelRide(selectedRide._id);
                                                                        setRides((prev) => prev.map((r) => r._id === updated._id ? updated : r));
                                                                        setSelectedRide(updated);
                                                                        Alert.alert('Cancelled', 'Your ride has been cancelled.');
                                                                    } catch (err) {
                                                                        Alert.alert('Error', err?.response?.data?.message || err.message);
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    );
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={['#dc2626', '#991b1b']}
                                                    style={styles.closeSheetGradient}
                                                >
                                                    <Text style={styles.closeSheetText}>Cancel Ride</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.closeSheetBtn, { marginTop: 10 }]}
                                            onPress={() => setSelectedRide(null)}
                                        >
                                            <LinearGradient
                                                colors={['#0f172a', '#1e293b']}
                                                style={styles.closeSheetGradient}
                                            >
                                                <Text style={styles.closeSheetText}>Close</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                }
                                renderItem={() => null}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1e3a8a' },

    // ── Header ────────────────────────────────────────────────────
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 16,
    },
    backBtn: {
        width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 21,
    },
    backArrow: { fontSize: 20, color: 'white', fontWeight: '700' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: 'white' },
    rideBadge: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    rideBadgeText: { color: 'white', fontWeight: '900', fontSize: 14 },

    // ── List ──────────────────────────────────────────────────────
    listContent: { padding: 16, gap: 0, paddingBottom: 40, backgroundColor: '#f0f4f8' },
    listPad: { padding: 16, gap: 12, backgroundColor: '#f0f4f8', flex: 1 },

    // ── Ride Card ─────────────────────────────────────────────────
    rideCard: {
        backgroundColor: 'white', borderRadius: 18, marginBottom: 12,
        flexDirection: 'row', overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    },
    cardStripe: { width: 5 },
    cardContent: { flex: 1, padding: 16 },
    rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rideDate: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    routeBlock: { marginBottom: 12 },
    routeRow: { flexDirection: 'row' },
    routeConnector: { alignItems: 'center', marginRight: 12, paddingTop: 2 },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeLineVert: { width: 2, height: 18, backgroundColor: '#e2e8f0', marginVertical: 2 },
    routeTexts: { flex: 1, justifyContent: 'space-between', gap: 12 },
    routeText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },

    rideFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9',
    },
    footerLeft: {},
    footerRight: { alignItems: 'flex-end' },
    ticketSmall: { fontSize: 12, fontWeight: '800', color: '#475569' },
    farePill: {
        backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
    },
    fareSmall: { fontSize: 16, fontWeight: '900', color: 'white' },
    paymentStatus: { fontSize: 9, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' },

    // ── Empty State ───────────────────────────────────────────────
    emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 8 },
    emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600', textAlign: 'center' },
    bookNowBtn: { marginTop: 24, borderRadius: 16, overflow: 'hidden', width: '100%' },
    bookNowGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
    bookNowText: { color: 'white', fontWeight: '900', fontSize: 16 },

    // ── Skeleton ──────────────────────────────────────────────────
    skeletonCard: {
        backgroundColor: 'white', borderRadius: 18, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    skeletonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    skeletonBlock: { height: 14, backgroundColor: '#e2e8f0', borderRadius: 8 },

    // ── Bottom Sheet ──────────────────────────────────────────────
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 40, maxHeight: '90%',
    },
    handle: { width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    closeX: { fontSize: 20, color: '#94a3b8', fontWeight: '700' },
    sheetTicketRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 14,
    },
    sheetTicket: { fontSize: 15, fontWeight: '800', color: '#1e293b' },

    // ── QR Section ────────────────────────────────────────────────
    qrSection: { marginBottom: 20 },
    qrContainer: {
        alignItems: 'center', padding: 24, borderRadius: 20,
        borderWidth: 1, borderColor: '#bae6fd',
    },
    qrCodeWrapper: {
        padding: 14, backgroundColor: 'white', borderRadius: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
    },
    qrTicketId: {
        fontSize: 16, fontWeight: '900', color: '#0f172a', marginTop: 14,
        textTransform: 'uppercase', letterSpacing: 2,
    },
    qrName: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4 },
    qrStatusPill: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 16 },
    qrStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    qrLabel: {
        fontSize: 10, fontWeight: '800', color: '#2563eb', marginTop: 14,
        letterSpacing: 1.5, textTransform: 'uppercase',
    },

    // ── Detail Rows ───────────────────────────────────────────────
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12 },
    detailLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', maxWidth: '60%', textAlign: 'right' },
    divider: { height: 1, backgroundColor: '#f1f5f9' },
    closeSheetBtn: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
    closeSheetGradient: { padding: 16, alignItems: 'center', borderRadius: 14 },
    closeSheetText: { color: 'white', fontWeight: '800', fontSize: 15 },
});

export default RiderRidesScreen;
