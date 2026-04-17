import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, Modal, ActivityIndicator,
    RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { getRideHistory } from '../services/api';

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
        <View style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, { width: 100 }]} />
            <View style={[styles.skeletonBlock, { width: 70, height: 22, borderRadius: 12 }]} />
        </View>
        <View style={[styles.skeletonBlock, { width: '70%', marginTop: 12 }]} />
        <View style={[styles.skeletonBlock, { width: '50%', marginTop: 8 }]} />
    </View>
);

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

    const onRefresh = () => {
        setRefreshing(true);
        fetchRides();
    };

    const renderStatus = (status) => {
        const theme = STATUS_COLORS[status] || STATUS_COLORS.Rejected;
        return (
            <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: theme.dot }]} />
                <Text style={[styles.statusText, { color: theme.text }]}>{status}</Text>
            </View>
        );
    };

    const renderRide = ({ item }) => (
        <TouchableOpacity
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
                {renderStatus(item.status)}
            </View>

            <View style={styles.routeBlock}>
                <View style={styles.routeRow}>
                    <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
                </View>
                <View style={styles.vertLine} />
                <View style={styles.routeRow}>
                    <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.dropoff}</Text>
                </View>
            </View>

            <View style={styles.rideFooter}>
                <Text style={styles.ticketSmall}>🎫 {item.ticketId || 'N/A'}</Text>
                <Text style={styles.fareSmall}>${(item.fare || 0).toFixed(2)}</Text>
            </View>
        </TouchableOpacity>
    );

    const isActive = selectedRide?.status === 'Confirmed' || selectedRide?.status === 'En-Route';

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={styles.header}>
                {navigation && (
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.headerTitle}>My Rides</Text>
                <View style={{ width: 40 }} />
            </View>

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
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#059669"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🚌</Text>
                            <Text style={styles.emptyTitle}>No rides yet.</Text>
                            <Text style={styles.emptyText}>Book your first ride!</Text>
                            {navigation && (
                                <TouchableOpacity
                                    style={styles.bookNowBtn}
                                    onPress={() => navigation.navigate('RiderBookingScreen')}
                                >
                                    <Text style={styles.bookNowText}>Book a Ride →</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Ride Detail Bottom Sheet */}
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

                                        {/* Status + Ticket */}
                                        <View style={styles.sheetTicketRow}>
                                            <Text style={styles.sheetTicket}>🎫 {selectedRide.ticketId || '—'}</Text>
                                            {renderStatus(selectedRide.status)}
                                        </View>

                                        {isActive && (
                                            <View style={styles.qrContainer}>
                                                <View style={styles.qrCodeWrapper}>
                                                    <QRCode
                                                        value={selectedRide.ticketId || 'N/A'}
                                                        size={200}
                                                        backgroundColor="white"
                                                        color="black"
                                                    />
                                                </View>
                                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    {selectedRide.ticketId}
                                                </Text>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 }}>
                                                    {selectedRide.passengerName}
                                                </Text>
                                                <View style={{ marginTop: 10, backgroundColor: '#dcfce7', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>
                                                        {selectedRide.status}
                                                    </Text>
                                                </View>
                                                <Text style={styles.qrLabel}>Show to Driver to Board</Text>
                                            </View>
                                        )}

                                        {/* Details list */}
                                        {[
                                            ['Date', new Date(selectedRide.scheduledTime).toLocaleString()],
                                            ['Pickup', selectedRide.pickup],
                                            ['Drop-off', selectedRide.dropoff],
                                            ['Fare', `$${(selectedRide.fare || 0).toFixed(2)}`],
                                            ['Passengers', String(selectedRide.passengers || 1)],
                                            ['Type', selectedRide.userType || 'General'],
                                            ['Vehicle', selectedRide.assignedVehicle || 'Unassigned'],
                                        ].map(([label, value]) => (
                                            <React.Fragment key={label}>
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>{label}</Text>
                                                    <Text style={styles.detailValue}>{value}</Text>
                                                </View>
                                                <View style={styles.divider} />
                                            </React.Fragment>
                                        ))}

                                        <TouchableOpacity
                                            style={styles.closeSheetBtn}
                                            onPress={() => setSelectedRide(null)}
                                        >
                                            <Text style={styles.closeSheetText}>Close</Text>
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

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 20 },
    backArrow: { fontSize: 18, color: '#334155', fontWeight: '700' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    listContent: { padding: 16, gap: 12, paddingBottom: 40 },
    listPad: { padding: 16, gap: 12 },
    rideCard: {
        backgroundColor: 'white', borderRadius: 18, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
        marginBottom: 0,
    },
    rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rideDate: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    routeBlock: { marginBottom: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    vertLine: { width: 2, height: 14, backgroundColor: '#e2e8f0', marginLeft: 3, marginVertical: 2 },
    routeText: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1 },
    rideFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    ticketSmall: { fontSize: 12, fontWeight: '800', color: '#475569' },
    fareSmall: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b', marginBottom: 8 },
    emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600', textAlign: 'center' },
    bookNowBtn: { marginTop: 24, backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16 },
    bookNowText: { color: 'white', fontWeight: '800', fontSize: 16 },
    skeletonCard: { backgroundColor: 'white', borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    skeletonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    skeletonBlock: { height: 14, backgroundColor: '#f1f5f9', borderRadius: 8 },
    // Sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%' },
    handle: { width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    closeX: { fontSize: 20, color: '#94a3b8', fontWeight: '700' },
    sheetTicketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12 },
    sheetTicket: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    qrContainer: { alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 20 },
    qrCodeWrapper: { padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0' },
    qrLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
    detailLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
    detailValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', maxWidth: '60%', textAlign: 'right' },
    divider: { height: 1, backgroundColor: '#f1f5f9' },
    closeSheetBtn: { marginTop: 20, backgroundColor: '#0f172a', padding: 16, borderRadius: 14, alignItems: 'center' },
    closeSheetText: { color: 'white', fontWeight: '800', fontSize: 15 },
});

export default RiderRidesScreen;
