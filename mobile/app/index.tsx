import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { logout, checkSession } from '../services/api';
import AuthScreen from '../screens/AuthScreen';
import RiderHomeScreen from '../screens/RiderHomeScreen';
import BookingScreen from '../screens/BookingScreen';
import TicketScreen from '../screens/TicketScreen';

export default function Index() {
    const [user, setUser] = useState(null);
    const [currentScreen, setCurrentScreen] = useState('HOME');
    const [currentRide, setCurrentRide] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Session Restoration
    React.useEffect(() => {
        const restoreSession = async () => {
            const savedUser = await checkSession();
            if (savedUser) {
                setUser(savedUser);
                setCurrentScreen('HOME');
            }
            setIsLoading(false);
        };
        restoreSession();
    }, []);

    // Navigation Helper
    const handleLogin = (userData: any) => {
        setUser(userData);
        setCurrentScreen('HOME');
    };

    const handleLogout = async () => {
        await logout();
        setUser(null);
        setCurrentScreen('HOME');
        setCurrentRide(null);
    };

    // Register global 401 handler
    React.useEffect(() => {
        const { setUnauthorizedCallback } = require('../services/api');
        setUnauthorizedCallback(handleLogout);
    }, []);

    const renderScreen = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#059669" />
                </View>
            );
        }
        if (!user) {
            return <AuthScreen onLogin={handleLogin} />;
        }

        switch (currentScreen) {
            case 'HOME':
                return (
                    <RiderHomeScreen
                        user={user}
                        onLogout={handleLogout}
                        onBookPress={() => setCurrentScreen('BOOKING')}
                        onViewTicket={(ride: any) => {
                            setCurrentRide(ride);
                            setCurrentScreen('TICKET');
                        }}
                    />
                );
            case 'BOOKING':
                return (
                    <BookingScreen
                        user={user}
                        onCancel={() => setCurrentScreen('HOME')}
                        onRideConfirmed={(ride: any) => {
                            setCurrentRide(ride);
                            setCurrentScreen('TICKET');
                        }}
                    />
                );
            case 'TICKET':
                return (
                    <TicketScreen
                        ride={currentRide}
                        onClose={() => setCurrentScreen('HOME')}
                    />
                );
            default:
                return (
                    <RiderHomeScreen
                        user={user}
                        onLogout={handleLogout}
                        onBookPress={() => setCurrentScreen('BOOKING')}
                        onViewTicket={(ride: any) => {
                            setCurrentRide(ride);
                            setCurrentScreen('TICKET');
                        }}
                    />
                );
        }
    };

    return (
        <View style={styles.container}>
            {renderScreen()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    }
});
