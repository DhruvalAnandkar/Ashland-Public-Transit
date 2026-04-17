import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import api, { logout, checkSession, verifyRideCheckoutSession } from '../services/api';
import AuthScreen from '../screens/AuthScreen';
import RiderHomeScreen from '../screens/RiderHomeScreen';
import RiderBookingScreen from '../screens/RiderBookingScreen';
import RiderTrackingScreen from '../screens/RiderTrackingScreen';
import RiderRidesScreen from '../screens/RiderRidesScreen';

WebBrowser.maybeCompleteAuthSession();

export default function Index() {
    const [user, setUser] = useState(null);
    const [currentScreen, setCurrentScreen] = useState('HOME');
    const [currentRide, setCurrentRide] = useState(null);
    const [currentParams, setCurrentParams] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const stripeUrlHandledRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user || isLoading) return;

        const goToTracking = async (sessionId: string, ticketId: string) => {
            try {
                const data = await verifyRideCheckoutSession(sessionId, ticketId);
                let ride = data?.ride;
                if (!ride) {
                    const res = await api.get(`/rides/track/${encodeURIComponent(ticketId)}`);
                    ride = res.data;
                }
                if (ride) {
                    setCurrentRide(ride);
                    setCurrentScreen('TICKET');
                }
            } catch {
                try {
                    const res = await api.get(`/rides/track/${encodeURIComponent(ticketId)}`);
                    if (res.data) {
                        setCurrentRide(res.data);
                        setCurrentScreen('TICKET');
                    }
                } catch {
                    // ignore
                }
            }
            setTimeout(() => {
                try {
                    router.replace('/');
                } catch {
                    // ignore
                }
            }, 150);
        };

        const handleIncomingUrl = (incomingUrl: string) => {
            if (!incomingUrl) return;
            if (stripeUrlHandledRef.current === incomingUrl) return;

            let parsed: Linking.ParsedURL;
            try {
                parsed = Linking.parse(incomingUrl);
            } catch {
                return;
            }

            const qs = parsed.queryParams || {};
            const rawSt = qs.status;
            const rawTi = qs.ticketId;
            const rawSe = qs.session_id;
            const status = Array.isArray(rawSt) ? rawSt[0] : rawSt;
            const ticketId = Array.isArray(rawTi) ? rawTi[0] : rawTi;
            const sessionId = rawSe ? (Array.isArray(rawSe) ? rawSe[0] : rawSe) : '';

            if (!status || !ticketId) return;

            if (status === 'cancel') {
                stripeUrlHandledRef.current = incomingUrl;
                try {
                    router.replace('/');
                } catch {
                    // ignore
                }
                return;
            }

            if (status !== 'success' || !sessionId) return;

            stripeUrlHandledRef.current = incomingUrl;
            void goToTracking(sessionId, ticketId);
        };

        void Linking.getInitialURL().then((u) => {
            if (u) handleIncomingUrl(u);
        });

        const sub = Linking.addEventListener('url', ({ url }) => {
            handleIncomingUrl(url);
        });

        return () => {
            sub.remove();
        };
    }, [user, isLoading, router]);

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
