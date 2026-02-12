import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const TicketScreen = ({ ride, onClose }) => {
    // Data to encode in QR
    const qrData = JSON.stringify({
        id: ride.ticketId,
        name: ride.passengerName,
        status: ride.status
    });

    return (
        <View style={styles.container}>
            <View style={styles.ticket}>
                <View style={styles.header}>
                    <Text style={[styles.successTitle, ride.status === 'Pending' ? styles.pendingTitle : null]}>
                        {ride.status === 'Pending' ? 'Request Sent' : 'Ride Confirmed'}
                    </Text>
                    <Text style={styles.ticketLabel}>Ticket ID</Text>
                    <Text style={styles.ticketId}>{ride.ticketId}</Text>
                </View>

                <View style={styles.qrContainer}>
                    {ride.status === 'Pending' ? (
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingText}>Waiting for Dispatcher Approval</Text>
                        </View>
                    ) : (
                        <QRCode
                            value={qrData}
                            size={200}
                            color="black"
                            backgroundColor="white"
                        />
                    )}
                </View>

                <View style={styles.info}>
                    <Text style={styles.infoText}>Pickup: {ride.pickup}</Text>
                    <Text style={styles.infoText}>Dropoff: {ride.dropoff}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Back to Home</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#059669', // Success Green Background
        justifyContent: 'center',
        padding: 24,
    },
    ticket: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#059669',
        marginBottom: 12,
    },
    ticketLabel: {
        fontSize: 12,
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    ticketId: {
        fontSize: 32,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: 'bold',
        color: '#0f172a',
        letterSpacing: 2,
    },
    qrContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 16,
        // dashed border would represent a cutout, simpler for now
        marginBottom: 24,
    },
    info: {
        width: '100%',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 16,
        color: '#334155',
        fontWeight: '600',
        marginBottom: 4,
    },
    closeButton: {
        marginTop: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    pendingTitle: {
        color: '#d97706',
    },
    pendingBadge: {
        width: 200,
        height: 200,
        borderRadius: 16,
        backgroundColor: '#fffbeb',
        borderWidth: 2,
        borderColor: '#fcd34d',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    pendingText: {
        color: '#d97706',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
    closeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default TicketScreen;
