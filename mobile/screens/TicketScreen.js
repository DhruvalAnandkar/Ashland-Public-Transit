import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const TicketScreen = ({ ride, onClose }) => {
    const qrData = JSON.stringify({
        id: ride.ticketId,
        name: ride.passengerName,
        status: ride.status,
    });

    const isPending = ride.status === 'Pending';

    return (
        <LinearGradient
            colors={isPending ? ['#92400e', '#b45309', '#d97706'] : ['#047857', '#059669', '#10b981']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            {/* Decorative Circles */}
            <View style={[styles.decorCircle, styles.decorCircle1]} />
            <View style={[styles.decorCircle, styles.decorCircle2]} />

            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.ticket}>
                {/* Top Accent */}
                <LinearGradient
                    colors={isPending ? ['#fef3c7', '#fde68a'] : ['#dcfce7', '#bbf7d0']}
                    style={styles.ticketAccent}
                />

                {/* Header */}
                <View style={styles.header}>
                    <Animated.Text entering={FadeIn.delay(200)} style={styles.headerEmoji}>
                        {isPending ? '⏳' : '🎉'}
                    </Animated.Text>
                    <Text style={[styles.successTitle, isPending && styles.pendingTitle]}>
                        {isPending ? 'Request Sent' : 'Ride Confirmed'}
                    </Text>
                    <Text style={styles.ticketLabel}>TICKET ID</Text>
                    <Text style={styles.ticketId}>{ride.ticketId}</Text>
                </View>

                {/* Tear Line */}
                <View style={styles.tearLine}>
                    <View style={[styles.tearCircle, styles.tearLeft]} />
                    <View style={styles.tearDash} />
                    <View style={[styles.tearCircle, styles.tearRight]} />
                </View>

                {/* QR / Pending */}
                <View style={styles.qrSection}>
                    {isPending ? (
                        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.pendingBadge}>
                            <Text style={styles.pendingEmoji}>⏳</Text>
                            <Text style={styles.pendingText}>Waiting for{'\n'}Dispatcher Approval</Text>
                        </Animated.View>
                    ) : (
                        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.qrCodeWrapper}>
                            <QRCode value={qrData} size={180} color="#0f172a" backgroundColor="white" />
                        </Animated.View>
                    )}
                </View>

                {/* Route Info */}
                <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.infoSection}>
                    <View style={styles.routeRow}>
                        <View style={styles.routeConnector}>
                            <View style={[styles.routeDot, { backgroundColor: '#22c55e' }]} />
                            <View style={styles.routeLineVert} />
                            <View style={[styles.routeDot, { backgroundColor: '#ef4444' }]} />
                        </View>
                        <View style={styles.routeTexts}>
                            <View>
                                <Text style={styles.routeLabel}>PICKUP</Text>
                                <Text style={styles.routeValue}>{ride.pickup}</Text>
                            </View>
                            <View>
                                <Text style={styles.routeLabel}>DROP-OFF</Text>
                                <Text style={styles.routeValue}>{ride.dropoff}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {!isPending && (
                    <Animated.View entering={FadeIn.delay(500)}>
                        <Text style={styles.boardingText}>SHOW QR TO DRIVER TO BOARD</Text>
                    </Animated.View>
                )}
            </Animated.View>

            {/* Close Button */}
            <Animated.View entering={FadeInDown.delay(500).springify()}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeText}>← Back to Home</Text>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1, justifyContent: 'center', padding: 24,
    },
    decorCircle: {
        position: 'absolute', borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    decorCircle1: { width: 200, height: 200, top: -40, right: -40 },
    decorCircle2: { width: 150, height: 150, bottom: 40, left: -30 },

    ticket: {
        backgroundColor: 'white', borderRadius: 28, padding: 0,
        alignItems: 'center', overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
    },
    ticketAccent: { width: '100%', height: 6 },
    header: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, paddingHorizontal: 32 },
    headerEmoji: { fontSize: 48, marginBottom: 8 },
    successTitle: { fontSize: 22, fontWeight: '900', color: '#059669', marginBottom: 12 },
    pendingTitle: { color: '#d97706' },
    ticketLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '800', letterSpacing: 2 },
    ticketId: {
        fontSize: 28, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: 'bold', color: '#0f172a', letterSpacing: 3, marginTop: 4,
    },

    // Tear Line
    tearLine: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 4 },
    tearCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f0f4f8' },
    tearLeft: { marginLeft: -12 },
    tearRight: { marginRight: -12 },
    tearDash: { flex: 1, height: 1, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },

    // QR
    qrSection: { paddingVertical: 20, alignItems: 'center' },
    qrCodeWrapper: {
        padding: 16, backgroundColor: 'white', borderRadius: 20,
        borderWidth: 2, borderColor: '#e2e8f0',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    },
    pendingBadge: {
        width: 180, height: 180, borderRadius: 20,
        backgroundColor: '#fffbeb', borderWidth: 2, borderColor: '#fcd34d',
        borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', padding: 16,
    },
    pendingEmoji: { fontSize: 36, marginBottom: 8 },
    pendingText: { color: '#d97706', fontWeight: '900', textAlign: 'center', fontSize: 14 },

    // Route
    infoSection: { paddingHorizontal: 32, paddingBottom: 20, width: '100%' },
    routeRow: { flexDirection: 'row' },
    routeConnector: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeLineVert: { width: 2, height: 20, backgroundColor: '#e2e8f0', marginVertical: 2 },
    routeTexts: { flex: 1, justifyContent: 'space-between', gap: 14 },
    routeLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    routeValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 1 },

    boardingText: {
        fontSize: 10, fontWeight: '900', color: '#2563eb',
        letterSpacing: 2, textTransform: 'uppercase',
        paddingBottom: 20,
    },

    closeButton: {
        marginTop: 24, backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 18, borderRadius: 18, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    closeText: { color: 'white', fontWeight: '900', fontSize: 16 },
});

export default TicketScreen;
