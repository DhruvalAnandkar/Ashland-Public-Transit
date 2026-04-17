import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Alert, Modal, ScrollView,
    ActivityIndicator, Platform, ToastAndroid, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import QRCode from 'react-native-qrcode-svg';
import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import api from '../services/api';

const { width } = Dimensions.get('window');
const SOCKET_URL = (() => {
    const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
    return `http://${host}:5000`;
})();

const ASHLAND_REGION = {
    latitude: 40.8688, longitude: -82.3179,
    latitudeDelta: 0.05, longitudeDelta: 0.05,
};
const ETA_CITY_SPEED_MPH = 22;

const STATUS_THEME = {
    Pending: { color: '#f59e0b', bg: '#fef3c7', label: '⏳ Pending Confirmation' },
    Confirmed: { color: '#22c55e', bg: '#f0fdf4', label: '✅ Confirmed' },
    'En-Route': { color: '#3b82f6', bg: '#dbeafe', label: '🚐 Driver On The Way!' },
    Completed: { color: '#10b981', bg: '#d1fae5', label: '🎉 Ride Completed' },
    Cancelled: { color: '#ef4444', bg: '#fee2e2', label: '❌ Cancelled' },
};

const STAR_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

const showToast = (msg) => {
    if (Platform.OS === 'android') {
        ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
    } else {
        Alert.alert('Notice', msg);
    }
};

const toValidCoord = (latitude, longitude) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    ) {
        return { latitude: lat, longitude: lng };
    }
    return null;
};

const haversineMiles = (from, to) => {
    if (!from || !to) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(to.latitude - from.latitude);
    const dLng = toRad(to.longitude - from.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(from.latitude)) *
        Math.cos(toRad(to.latitude)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = R * c;
    return km * 0.621371;
};

const estimateEtaMinutes = (distanceMiles, mph = ETA_CITY_SPEED_MPH) => {
    if (!Number.isFinite(distanceMiles) || distanceMiles < 0 || !Number.isFinite(mph) || mph <= 0) {
        return null;
    }
    return Math.max(1, Math.round((distanceMiles / mph) * 60));
};

const formatEta = (minutes) => {
    if (!Number.isFinite(minutes)) return null;
    if (minutes < 60) return `ETA ~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem === 0 ? `ETA ~${hours}h` : `ETA ~${hours}h ${rem}m`;
};

const RiderTrackingScreen = ({ navigation, route }) => {
    const [ride, setRide] = useState(route?.params?.ride || null);
    const [loading, setLoading] = useState(!route?.params?.ride);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [rating, setRating] = useState(0);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState({ visible: false, emoji: '', title: '', msg: '' });
    const [driverLiveCoord, setDriverLiveCoord] = useState(null);
    const [driverLastUpdateAt, setDriverLastUpdateAt] = useState(null);
    const pollInterval = useRef(null);
    const socketRef = useRef(null);

    const openComingSoon = (emoji, title, msg) =>
        setShowComingSoon({ visible: true, emoji, title, msg });

    const fetchRide = async (id) => {
        try {
            const res = await api.get(`/rides/${id}`);
            setRide(res.data);
        } catch (err) {
            console.error('Tracking poll error', err);
        }
    };

    useEffect(() => {
        if (!ride) return;
        if (ride.status === 'Completed' || ride.status === 'Cancelled') return;
        pollInterval.current = setInterval(() => fetchRide(ride._id), 8000);
        return () => clearInterval(pollInterval.current);
    }, [ride?.status]);

    useEffect(() => {
        if (!ride?._id) return;
        const socket = io(SOCKET_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (ride?.riderId) {
                socket.emit('join_client_room', String(ride.riderId));
            }
            socket.emit('join_client_room', String(ride._id));
        });

        socket.on('ride_status_changed', (updatedRide) => {
            if (updatedRide?._id === ride._id) {
                setRide(updatedRide);
            }
        });

        socket.on('driver_location_update', (payload) => {
            const coords = payload?.coordinates;
            if (Array.isArray(coords) && coords.length === 2) {
                const normalized = toValidCoord(coords[1], coords[0]);
                if (normalized) {
                    setDriverLiveCoord(normalized);
                    setDriverLastUpdateAt(Date.now());
                }
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [ride?._id, ride?.riderId]);

    const handleCancel = () => {
        Alert.alert(
            'Cancel Ride',
            'Are you sure you want to cancel this ride?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelLoading(true);
                        try {
                            await api.patch(`/rides/${ride._id}/status`, { status: 'Cancelled' });
                            setRide(prev => ({ ...prev, status: 'Cancelled' }));
                            clearInterval(pollInterval.current);
                            showToast('Ride cancelled.');
                        } catch (err) {
                            showToast('Failed to cancel: ' + (err?.response?.data?.message || err.message));
                        } finally {
                            setCancelLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleRate = async (stars) => {
        setRating(stars);
        try {
            await api.post(`/rides/${ride._id}/rate`, { rating: stars });
        } catch {
            // Endpoint may not exist — save locally & show thanks
        }
        showToast('Thanks for your feedback! ⭐️'.repeat(stars));
        setRatingSubmitted(true);
    };

    const goHome = () => {
        if (navigation) navigation.popToTop();
    };

    const statusRaw = String(ride?.status || '');
    const statusNorm = statusRaw.toLowerCase().replace(/[^a-z]/g, '');
    const isEnRoute = statusNorm === 'enroute';
    const isConfirmed = statusNorm === 'confirmed';
    const isLive = isConfirmed || isEnRoute;
    const isCompleted = statusNorm === 'completed';
    const isCancelled = statusNorm === 'cancelled';
    const theme = STATUS_THEME[ride?.status] || (isEnRoute
        ? STATUS_THEME['En-Route']
        : isConfirmed
            ? STATUS_THEME.Confirmed
            : isCompleted
                ? STATUS_THEME.Completed
                : isCancelled
                    ? STATUS_THEME.Cancelled
                    : STATUS_THEME.Pending);

    if (loading || !ride) {
        return (
            <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Loading ride details...</Text>
            </View>
        );
    }

    const pickupCoord = ride.pickupCoordinates?.coordinates
        ? toValidCoord(ride.pickupCoordinates.coordinates[1], ride.pickupCoordinates.coordinates[0])
        : ride.pickupCoords
            ? toValidCoord(ride.pickupCoords.lat, ride.pickupCoords.lng)
            : null;
    const dropoffCoord = ride.dropoffCoordinates?.coordinates
        ? toValidCoord(ride.dropoffCoordinates.coordinates[1], ride.dropoffCoordinates.coordinates[0])
        : ride.dropoffCoords
            ? toValidCoord(ride.dropoffCoords.lat, ride.dropoffCoords.lng)
            : null;
    const driverCoord = driverLiveCoord || (
        ride.driverCoordinates?.coordinates
            ? toValidCoord(ride.driverCoordinates.coordinates[1], ride.driverCoordinates.coordinates[0])
            : null
    );
    const driverDistanceMiles = isLive && driverCoord && pickupCoord
        ? haversineMiles(driverCoord, pickupCoord)
        : null;
    const etaMinutes = driverDistanceMiles !== null
        ? estimateEtaMinutes(driverDistanceMiles, ETA_CITY_SPEED_MPH)
        : null;
    const etaText = formatEta(etaMinutes);

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Map */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={{ width: '100%', height: '100%' }}
                        initialRegion={ASHLAND_REGION}
                        showsUserLocation
                        showsMyLocationButton={false}
                    >
                        {pickupCoord && <Marker coordinate={pickupCoord} title="Pickup" pinColor="#22c55e" />}
                        {dropoffCoord && <Marker coordinate={dropoffCoord} title="Drop-off" pinColor="#ef4444" />}
                        {isLive && driverCoord && (
                            <Marker
                                coordinate={driverCoord}
                                title="Driver"
                                pinColor="#3b82f6"
                            />
                        )}
                    </MapView>

                    {/* FAB buttons over map */}
                    <View style={styles.fabRow}>
                        {isLive && (
                            <TouchableOpacity
                                style={styles.fabBtn}
                                onPress={() => setShowQr(true)}
                            >
                                <Text style={styles.fabIcon}>🎫</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.fabBtn}
                            onPress={() => openComingSoon('💬', 'Driver Chat', 'Live driver chat is coming soon!')}
                        >
                            <Text style={styles.fabIcon}>💬</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: theme.bg }]}>
                    <Text style={[styles.statusText, { color: theme.color }]}>{theme.label}</Text>
                    {isEnRoute && (
                        <Text style={styles.statusSub}>Your driver is heading to you</Text>
                    )}
                    {isConfirmed && (
                        <Text style={styles.statusSub}>Driver assigned. Preparing to head your way.</Text>
                    )}
                    {isLive && driverDistanceMiles !== null && (
                        <Text style={styles.statusSub}>
                            Driver is about {driverDistanceMiles.toFixed(driverDistanceMiles < 1 ? 2 : 1)} miles away
                        </Text>
                    )}
                    {isLive && etaText && (
                        <Text style={styles.statusSub}>{etaText}</Text>
                    )}
                    {isLive && !driverCoord && (
                        <Text style={styles.statusSub}>Live location: waiting for driver GPS update...</Text>
                    )}
                    {isLive && driverCoord && !pickupCoord && (
                        <Text style={styles.statusSub}>Live location active. Pickup coordinates unavailable for distance ETA.</Text>
                    )}
                    {isLive && driverLastUpdateAt && (
                        <Text style={styles.statusSub}>
                            Live location updated at {new Date(driverLastUpdateAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>

                {/* Ride Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.ticketRow}>
                        <Text style={styles.ticketId}>🎫 {ride.ticketId || 'N/A'}</Text>
                        <Text style={styles.fareText}>${(ride.fare || 0).toFixed(2)}</Text>
                    </View>

                    <View style={styles.routeSection}>
                        <View style={styles.routeRow}>
                            <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
                            <View>
                                <Text style={styles.routeLabel}>Pickup</Text>
                                <Text style={styles.routeValue}>{ride.pickup}</Text>
                                {ride.pickupDetails ? (
                                    <Text style={styles.pickupNote}>📝 {ride.pickupDetails}</Text>
                                ) : null}
                            </View>
                        </View>
                        <View style={styles.routeConnector} />
                        <View style={styles.routeRow}>
                            <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
                            <View>
                                <Text style={styles.routeLabel}>Drop-off</Text>
                                <Text style={styles.routeValue}>{ride.dropoff}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.detailGrid}>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailCellLabel}>Passengers</Text>
                            <Text style={styles.detailCellValue}>{ride.passengers || 1}</Text>
                        </View>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailCellLabel}>Vehicle</Text>
                            <Text style={styles.detailCellValue}>{ride.assignedVehicle || 'TBD'}</Text>
                        </View>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailCellLabel}>Type</Text>
                            <Text style={styles.detailCellValue}>{ride.userType || 'General'}</Text>
                        </View>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailCellLabel}>Time</Text>
                            <Text style={styles.detailCellValue}>
                                {ride.scheduledTime
                                    ? new Date(ride.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Rating Section – only show when completed */}
                {isCompleted && !ratingSubmitted && (
                    <View style={styles.ratingCard}>
                        <Text style={styles.ratingTitle}>Rate your ride</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity key={star} onPress={() => handleRate(star)} style={styles.starBtn}>
                                    <Text style={[styles.starIcon, star <= rating && styles.starActive]}>⭐</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {rating > 0 && (
                            <Text style={styles.ratingLabel}>{STAR_LABELS[rating - 1]}</Text>
                        )}
                    </View>
                )}
                {isCompleted && ratingSubmitted && (
                    <View style={styles.ratingCard}>
                        <Text style={styles.ratingTitle}>Thanks for your feedback! ⭐️</Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                    {!isCompleted && !isCancelled && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.cancelBtn]}
                            onPress={handleCancel}
                            disabled={cancelLoading}
                        >
                            {cancelLoading
                                ? <ActivityIndicator color="white" />
                                : <Text style={styles.actionBtnText}>✕ Cancel Ride</Text>
                            }
                        </TouchableOpacity>
                    )}

                    {(isCompleted || isCancelled) && (
                        <TouchableOpacity style={[styles.actionBtn, styles.doneBtn]} onPress={goHome}>
                            <Text style={styles.actionBtnText}>← Back to Home</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* QR Modal */}
            <Modal
                visible={showQr}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQr(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.qrBox}>
                        <Text style={styles.qrTitle}>🎫 Boarding Pass</Text>
                        <View style={styles.qrContainer}>
                            <View style={styles.qrCodeWrapper}>
                                <QRCode
                                    value={ride.ticketId || 'N/A'}
                                    size={220}
                                    backgroundColor="white"
                                    color="black"
                                />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 16, letterSpacing: 1 }}>
                                {ride.ticketId}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 6 }}>
                                {ride.passengerName}
                            </Text>
                            <View style={{ marginTop: 12, backgroundColor: '#dcfce7', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>
                                    {ride.status}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.qrSub}>Show this to your driver to board</Text>
                        <TouchableOpacity style={styles.qrClose} onPress={() => setShowQr(false)}>
                            <Text style={styles.qrCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Coming Soon Modal */}
            <Modal
                visible={showComingSoon.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setShowComingSoon(s => ({ ...s, visible: false }))}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.csBox}>
                        <Text style={styles.csEmoji}>{showComingSoon.emoji}</Text>
                        <Text style={styles.csTitle}>{showComingSoon.title}</Text>
                        <Text style={styles.csMsg}>{showComingSoon.msg}</Text>
                        <TouchableOpacity
                            style={styles.csDismiss}
                            onPress={() => setShowComingSoon(s => ({ ...s, visible: false }))}
                        >
                            <Text style={styles.csDismissText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8fafc' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
    mapContainer: { height: 280, backgroundColor: '#e2e8f0', position: 'relative' },
    fabRow: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'column', gap: 10 },
    fabBtn: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'white',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
    },
    fabIcon: { fontSize: 22 },
    statusBanner: { padding: 20, alignItems: 'center' },
    statusText: { fontSize: 20, fontWeight: '900' },
    statusSub: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
    infoCard: {
        backgroundColor: 'white', margin: 16, borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    },
    ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    ticketId: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    fareText: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
    routeSection: { marginBottom: 20 },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    routeDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    routeLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
    routeValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    pickupNote: { fontSize: 12, color: '#d97706', fontWeight: '600', marginTop: 2 },
    routeConnector: { width: 2, height: 20, backgroundColor: '#e2e8f0', marginLeft: 5, marginVertical: 4 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailCell: { flex: 1, minWidth: '45%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12 },
    detailCellLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
    detailCellValue: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
    ratingCard: {
        backgroundColor: 'white', margin: 16, borderRadius: 20, padding: 20, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    },
    ratingTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
    starsRow: { flexDirection: 'row', gap: 8 },
    starBtn: { padding: 4 },
    starIcon: { fontSize: 32, opacity: 0.3 },
    starActive: { opacity: 1 },
    ratingLabel: { marginTop: 10, fontSize: 14, fontWeight: '700', color: '#f59e0b' },
    actionsRow: { paddingHorizontal: 16, gap: 12 },
    actionBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#ef4444' },
    doneBtn: { backgroundColor: '#0f172a' },
    actionBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    qrBox: { backgroundColor: 'white', borderRadius: 24, padding: 32, alignItems: 'center', width: '90%' },
    qrTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 20 },
    qrContainer: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 16, alignItems: 'center' },
    qrCodeWrapper: { padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0' },
    qrSub: { fontSize: 13, fontWeight: '600', color: '#64748b', textAlign: 'center' },
    qrClose: { marginTop: 8, backgroundColor: '#0f172a', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
    qrCloseText: { color: 'white', fontWeight: '800', fontSize: 15 },
    csBox: { backgroundColor: 'white', borderRadius: 24, padding: 32, alignItems: 'center', borderTopWidth: 5, borderTopColor: '#059669', width: '90%' },
    csEmoji: { fontSize: 52, marginBottom: 12 },
    csTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
    csMsg: { fontSize: 14, color: '#64748b', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
    csDismiss: { marginTop: 24, backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
    csDismissText: { color: 'white', fontWeight: '800', fontSize: 15 },
});

export default RiderTrackingScreen;
