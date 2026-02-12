import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { getRideHistory } from '../services/api';

const RiderHomeScreen = ({ user, onLogout, onBookPress, onViewTicket }) => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const history = await getRideHistory();
            setRides(history);
        } catch (error) {
            console.error("Failed to fetch rides", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const renderRideItem = ({ item }) => (
        <View style={styles.rideCard}>
            <View style={styles.rideHeader}>
                <Text style={styles.rideDate}>
                    {new Date(item.scheduledTime).toLocaleDateString()}
                </Text>
                <View style={[styles.statusBadge,
                item.status === 'Confirmed' ? styles.statusConfirmed :
                    item.status === 'Pending' ? styles.statusPending : styles.statusDefault]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
            <View style={styles.rideRoute}>
                <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.routeText} numberOfLines={1}>{item.dropoff}</Text>
            </View>

            {/* View Ticket Action */}
            <TouchableOpacity
                style={styles.viewTicketButton}
                onPress={() => onViewTicket(item)}
            >
                <Text style={styles.viewTicketText}>View Ticket ID</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome,</Text>
                    <Text style={styles.username}>{user?.username || 'Rider'}</Text>
                </View>
                <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>

            {/* Wallet Card */}
            <View style={styles.walletCard}>
                <Text style={styles.walletLabel}>Wallet Balance</Text>
                <Text style={styles.walletAmount}>${user?.walletBalance?.toFixed(2) || '0.00'}</Text>
            </View>

            {/* Main Action Area */}
            <View style={styles.actionContainer}>
                <TouchableOpacity style={styles.bookButton} onPress={onBookPress}>
                    <Text style={styles.bookButtonText}>Book a Ride</Text>
                </TouchableOpacity>
            </View>

            {/* Recent Activity */}
            <View style={styles.activityContainer}>
                <View style={styles.activityHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <TouchableOpacity onPress={fetchHistory}>
                        <Text style={styles.refreshText}>Refresh</Text>
                    </TouchableOpacity>
                </View>

                {rides.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No recent rides found.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={rides}
                        renderItem={renderRideItem}
                        keyExtractor={item => item.ticketId || item._id} // Fallback to _id if ticketId missing
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 60, // Top Safe Area
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    greeting: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    username: {
        fontSize: 24,
        color: '#0f172a',
        fontWeight: '900',
    },
    logoutButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
    },
    logoutText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ef4444',
    },
    walletCard: {
        margin: 24,
        padding: 24,
        backgroundColor: '#0f172a',
        borderRadius: 24,
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    walletLabel: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    walletAmount: {
        color: 'white',
        fontSize: 42,
        fontWeight: '900',
    },
    actionContainer: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    bookButton: {
        backgroundColor: '#059669',
        paddingVertical: 24,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: "#059669",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    bookButtonText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    activityContainer: {
        flex: 1,
        paddingHorizontal: 24,
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#334155',
    },
    refreshText: {
        color: '#059669',
        fontWeight: '600',
        fontSize: 14,
    },
    listContent: {
        paddingBottom: 24,
    },
    emptyState: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 16,
    },
    emptyText: {
        color: '#94a3b8',
        fontWeight: '600',
    },
    rideCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    rideDate: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusConfirmed: {
        backgroundColor: '#dcfce7',
    },
    statusPending: {
        backgroundColor: '#fef3c7',
    },
    statusDefault: {
        backgroundColor: '#f1f5f9',
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#0f172a',
    },
    rideRoute: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    routeText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        flex: 1,
    },
    arrow: {
        marginHorizontal: 8,
        color: '#94a3b8',
    },
    viewTicketButton: {
        marginTop: 12,
        padding: 10,
        backgroundColor: '#e0f2fe',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewTicketText: {
        color: '#0284c7',
        fontWeight: 'bold',
        fontSize: 12,
    }
});

export default RiderHomeScreen;