import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { logout, checkSession } from '../services/api';
import AuthScreen from '../screens/AuthScreen';
import RiderHomeScreen from '../screens/RiderHomeScreen';
import RiderBookingScreen from '../screens/RiderBookingScreen';
import RiderTrackingScreen from '../screens/RiderTrackingScreen';
import RiderRidesScreen from '../screens/RiderRidesScreen';

export default function Index() {
    const [user, setUser] = useState(null);
    const [currentScreen, setCurrentScreen] = useState('HOME');
    const [currentRide, setCurrentRide] = useState(null);
    const [currentParams, setCurrentParams] = useState(null);
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
        setCurrentParams(null);
    };

    // Register global 401 handler
    React.useEffect(() => {
        const { setUnauthorizedCallback } = require('../services/api');
        setUnauthorizedCallback(handleLogout);
    }, []);

    // Mock Navigation Object
    const navigation = {
        navigate: (screenName: string, params?: any) => {
            setCurrentParams(params || null);
            if (screenName === 'RiderBookingScreen') setCurrentScreen('BOOKING');
            else if (screenName === 'RiderRidesScreen') setCurrentScreen('RIDES');
            else if (screenName === 'RiderTrackingScreen') {
                if (params?.ride) setCurrentRide(params.ride);
                setCurrentScreen('TICKET');
            }
        },
        replace: (screenName: string, params?: any) => {
            setCurrentParams(params || null);
            if (screenName === 'RiderBookingScreen') setCurrentScreen('BOOKING');
            else if (screenName === 'RiderRidesScreen') setCurrentScreen('RIDES');
            else if (screenName === 'RiderTrackingScreen') {
                if (params?.ride) setCurrentRide(params.ride);
                setCurrentScreen('TICKET');
            }
        },
        goBack: () => setCurrentScreen('HOME'),
        popToTop: () => setCurrentScreen('HOME')
    };

    const route = { params: currentParams };

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
                        navigation={navigation}
                        onViewTicket={(ride: any) => {
                            setCurrentRide(ride);
                            setCurrentScreen('TICKET');
                        }}
                    />
                );
            case 'BOOKING':
                return (
                    <RiderBookingScreen
                        navigation={navigation}
                        route={route}
                    />
                );
            case 'TICKET':
                return (
                    <RiderTrackingScreen
                        navigation={navigation}
                        route={{ params: { ride: currentRide } }}
                    />
                );
            case 'RIDES':
                return (
                    <RiderRidesScreen
                        navigation={navigation}
                    />
                );
            default:
                return (
                    <RiderHomeScreen
                        user={user}
                        onLogout={handleLogout}
                        navigation={navigation}
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
