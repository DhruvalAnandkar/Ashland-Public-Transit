import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRideHistory } from '../services/api';

const ASHLAND = { latitude: 40.8688, longitude: -82.3179, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const STATUS_COLORS = {
    Completed: { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    Cancelled: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    Pending: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'Pending Review': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'En-Route': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    Confirmed: { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    Rejected: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
};

const SkeletonCard = () => (
    <View style={styles.skeletonCard}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 8 }]} />
    </View>
);

const RiderHomeScreen = ({ user, onLogout, onBookPress, onViewTicket, navigation }) => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);
    const [showScheduleInfo, setShowScheduleInfo] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showSosModal, setShowSosModal] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState({ visible: false, emoji: '', title: '', msg: '' });

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

    const handleRefresh = () => {
        setRefreshing(true);
        fetchHistory();
    };

    const openComingSoon = (emoji, title, msg) =>
        setShowComingSoon({ visible: true, emoji, title, msg });

    const renderStatusBadge = (status) => {
        const theme = STATUS_COLORS[status] || STATUS_COLORS.Rejected;
        return (
            <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: theme.dot }]} />
                <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>
            </View>
        );
    };

    const renderRideCard = (item) => (
        <TouchableOpacity
            key={item._id}
            style={styles.rideCard}
            activeOpacity={0.85}
            onPress={() => setSelectedRide(item)}
        >
            <View style={styles.rideHeader}>
                <Text style={styles.rideDate}>
                    {new Date(item.scheduledTime).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                    })}
                </Text>
                {renderStatusBadge(item.status)}
            </View>
            <View style={styles.rideRoute}>
                <View style={styles.routeDot} />
                <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.rideRoute}>
                <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.routeText} numberOfLines={1}>{item.dropoff}</Text>
            </View>
            <View style={styles.rideFooter}>
                <Text style={styles.fareText}>${(item.fare || 0).toFixed(2)}</Text>
                <TouchableOpacity
                    style={styles.viewTicketButton}
                    onPress={() => onViewTicket && onViewTicket(item)}
                >
                    <Text style={styles.viewTicketText}>View Ticket →</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                scrollEventThrottle={16}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Welcome back,</Text>
                        <Text style={styles.username}>{user?.username || 'Rider'} 👋</Text>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

                {/* Wallet Card */}
                <View style={styles.walletCard}>
                    <Text style={styles.walletLabel}>Wallet Balance</Text>
                    <Text style={styles.walletAmount}>
                        ${(user?.walletBalance || 0).toFixed(2)}
                    </Text>
                    <Text style={styles.walletSub}>Ashland Transit Credits</Text>
                </View>

                {/* Action Chips */}
                <View style={styles.chipsRow}>
                    <TouchableOpacity
                        style={[styles.chip, styles.chipSchedule]}
                        onPress={() => {
                            if (onBookPress) {
                                onBookPress({ scheduledMode: true });
                            } else if (navigation) {
                                navigation.navigate('RiderBookingScreen', { scheduledMode: true });
                            }
                        }}
                    >
                        <Text style={styles.chipEmoji}>📅</Text>
                        <Text style={styles.chipLabel}>Schedule</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, styles.chipRides]}
                        onPress={() => {
                            if (navigation) {
                                navigation.navigate('RiderRidesScreen');
                            } else {
                                openComingSoon('🎫', 'My Rides', 'Tap "My Rides" from the main menu.');
                            }
                        }}
                    >
                        <Text style={styles.chipEmoji}>🎫</Text>
                        <Text style={styles.chipLabel}>My Rides</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, styles.chipHelp]}
                        onPress={() => setShowHelpModal(true)}
                    >
                        <Text style={styles.chipEmoji}>❓</Text>
                        <Text style={styles.chipLabel}>Help</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, styles.chipSos]}
                        onPress={() => setShowSosModal(true)}
                    >
                        <Text style={styles.chipEmoji}>🆘</Text>
                        <Text style={styles.chipLabel}>SOS</Text>
                    </TouchableOpacity>
                </View>

                {/* Book Button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={styles.bookButton}
                        onPress={() => {
                            if (onBookPress) onBookPress({ scheduledMode: false });
                            else if (navigation) navigation.navigate('RiderBookingScreen', { scheduledMode: false });
                        }}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.bookButtonText}>🚐  Book a Ride Now</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Rides */}
                <View style={styles.activityContainer}>
                    <View style={styles.activityHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <TouchableOpacity onPress={handleRefresh}>
                            <Text style={styles.refreshText}>Refresh ↻</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : rides.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🚌</Text>
                            <Text style={styles.emptyTitle}>No rides yet</Text>
                            <Text style={styles.emptyText}>Book your first ride above!</Text>
                        </View>
                    ) : (
                        rides.slice(0, 10).map(renderRideCard)
                    )}
                </View>
            </ScrollView>

            {/* Ride Detail Modal */}
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
                                    {renderStatusBadge(selectedRide.status)}
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Date</Text>
                                    <Text style={styles.detailValue}>
                                        {new Date(selectedRide.scheduledTime).toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Pickup</Text>
                                    <Text style={styles.detailValue}>{selectedRide.pickup}</Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Drop-off</Text>
                                    <Text style={styles.detailValue}>{selectedRide.dropoff}</Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Fare</Text>
                                    <Text style={[styles.detailValue, { color: '#059669', fontWeight: '900' }]}>
                                        ${(selectedRide.fare || 0).toFixed(2)}
                                    </Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Passengers</Text>
                                    <Text style={styles.detailValue}>{selectedRide.passengers || 1}</Text>
                                </View>
                                {selectedRide.assignedVehicle && (
                                    <>
                                        <View style={styles.detailDivider} />
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailLabel}>Vehicle</Text>
                                            <Text style={styles.detailValue}>{selectedRide.assignedVehicle}</Text>
                                        </View>
                                    </>
                                )}
                                <TouchableOpacity
                                    style={styles.closeDetailBtn}
                                    onPress={() => setSelectedRide(null)}
                                >
                                    <Text style={styles.closeDetailText}>Close</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Help Modal */}
            <Modal visible={showHelpModal} transparent animationType="fade" onRequestClose={() => setShowHelpModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.comingSoonBox}>
                        <Text style={styles.csEmoji}>❓</Text>
                        <Text style={styles.csTitle}>Help Center</Text>
                        <Text style={styles.csMsg}>
                            Call Dispatch: (419) 289-0000{'\n'}
                            Mon–Fri 7am–6pm{'\n\n'}
                            Email: transit@ashlandohio.gov
                        </Text>
                        <TouchableOpacity style={styles.csDismiss} onPress={() => setShowHelpModal(false)}>
                            <Text style={styles.csDismissText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* SOS Modal */}
            <Modal visible={showSosModal} transparent animationType="fade" onRequestClose={() => setShowSosModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.comingSoonBox, { borderTopColor: '#ef4444' }]}>
                        <Text style={styles.csEmoji}>🆘</Text>
                        <Text style={styles.csTitle}>Emergency Contact</Text>
                        <Text style={styles.csMsg}>
                            For emergencies, call 911{'\n\n'}
                            Ashland Transit Emergency:{'\n'}
                            (419) 289-0000
                        </Text>
                        <TouchableOpacity
                            style={[styles.csDismiss, { backgroundColor: '#ef4444' }]}
                            onPress={() => setShowSosModal(false)}
                        >
                            <Text style={styles.csDismissText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    container: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    greeting: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    username: { fontSize: 22, color: '#0f172a', fontWeight: '900' },
    logoutButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fee2e2', borderRadius: 20 },
    logoutText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },
    walletCard: {
        margin: 20,
        padding: 24,
        backgroundColor: '#0f172a',
        borderRadius: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    walletLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    walletAmount: { color: 'white', fontSize: 42, fontWeight: '900', marginTop: 4 },
    walletSub: { color: '#475569', fontSize: 12, fontWeight: '600', marginTop: 4 },
    chipsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
    chip: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
        backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },
    chipSchedule: { borderColor: '#bfdbfe' },
    chipRides: { borderColor: '#d1fae5' },
    chipHelp: { borderColor: '#fde68a' },
    chipSos: { borderColor: '#fecaca' },
    chipEmoji: { fontSize: 20, marginBottom: 4 },
    chipLabel: { fontSize: 10, fontWeight: '700', color: '#374151' },
    actionContainer: { paddingHorizontal: 20, marginBottom: 24 },
    bookButton: {
        backgroundColor: '#059669',
        paddingVertical: 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    bookButtonText: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
    activityContainer: { paddingHorizontal: 20 },
    activityHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    refreshText: { color: '#059669', fontWeight: '700', fontSize: 14 },
    rideCard: {
        backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rideDate: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    rideRoute: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
    routeText: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
    routeLine: { width: 2, height: 12, backgroundColor: '#e2e8f0', marginLeft: 3, marginBottom: 4 },
    rideFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    fareText: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    viewTicketButton: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#eff6ff', borderRadius: 8 },
    viewTicketText: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
    emptyState: { alignItems: 'center', padding: 48, backgroundColor: 'white', borderRadius: 20, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed' },
    emptyEmoji: { fontSize: 42, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
    emptyText: { color: '#94a3b8', fontWeight: '600', textAlign: 'center' },
    skeletonCard: {
        backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
    },
    skeletonLine: { height: 14, backgroundColor: '#f1f5f9', borderRadius: 8, width: '100%' },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    detailSheet: {
        backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 40, minHeight: 400,
    },
    sheetHandle: { width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    detailTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    closeBtn: { fontSize: 20, color: '#94a3b8', fontWeight: '700' },
    detailCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12 },
    detailTicket: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
    detailLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', maxWidth: '60%', textAlign: 'right' },
    detailDivider: { height: 1, backgroundColor: '#f1f5f9' },
    closeDetailBtn: { marginTop: 24, backgroundColor: '#0f172a', padding: 16, borderRadius: 14, alignItems: 'center' },
    closeDetailText: { color: 'white', fontWeight: '800', fontSize: 15 },
    comingSoonBox: {
        backgroundColor: 'white', margin: 30, borderRadius: 24,
        padding: 32, alignItems: 'center', borderTopWidth: 5, borderTopColor: '#059669',
    },
    csEmoji: { fontSize: 52, marginBottom: 12 },
    csTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
    csMsg: { fontSize: 14, color: '#64748b', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
    csDismiss: { marginTop: 24, backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
    csDismissText: { color: 'white', fontWeight: '800', fontSize: 15 },
});

export default RiderHomeScreen;