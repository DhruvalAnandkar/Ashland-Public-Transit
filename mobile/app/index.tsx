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
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import SavedPlacesScreen from '../screens/SavedPlacesScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import HelpScreen from '../screens/HelpScreen';
import AboutScreen from '../screens/AboutScreen';
import FareInfoScreen from '../screens/FareInfoScreen';

WebBrowser.maybeCompleteAuthSession();

type ScreenKey =
    | 'HOME'
    | 'BOOKING'
    | 'TICKET'
    | 'RIDES'
    | 'PROFILE'
    | 'EDIT_PROFILE'
    | 'SETTINGS'
    | 'CHANGE_PASSWORD'
    | 'SAVED_PLACES'
    | 'PAYMENT_METHODS'
    | 'NOTIFICATIONS'
    | 'HELP'
    | 'ABOUT'
    | 'FARE_INFO';

export default function Index() {
    const [user, setUser] = useState<any>(null);
    const [stack, setStack] = useState<ScreenKey[]>(['HOME']);
    const [currentRide, setCurrentRide] = useState<any>(null);
    const [currentParams, setCurrentParams] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const stripeUrlHandledRef = useRef<string | null>(null);

    const currentScreen = stack[stack.length - 1] || 'HOME';

    const push = (screen: ScreenKey, params?: any) => {
        setCurrentParams(params || null);
        setStack((s) => [...s, screen]);
    };
    const pop = () => {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    };
    const resetTo = (screen: ScreenKey, params?: any) => {
        setCurrentParams(params || null);
        setStack([screen]);
    };

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
                    resetTo('TICKET');
                }
            } catch {
                try {
                    const res = await api.get(`/rides/track/${encodeURIComponent(ticketId)}`);
                    if (res.data) {
                        setCurrentRide(res.data);
                        resetTo('TICKET');
                    }
                } catch {
                    // ignore
                }
            }
            setTimeout(() => {
                try { router.replace('/'); } catch { /* ignore */ }
            }, 150);
        };

        const handleIncomingUrl = (incomingUrl: string) => {
            if (!incomingUrl) return;
            if (stripeUrlHandledRef.current === incomingUrl) return;

            let parsed: Linking.ParsedURL;
            try { parsed = Linking.parse(incomingUrl); } catch { return; }

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
                try { router.replace('/'); } catch { /* ignore */ }
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

        return () => sub.remove();
    }, [user, isLoading, router]);

    React.useEffect(() => {
        const restoreSession = async () => {
            const savedUser = await checkSession();
            if (savedUser) {
                setUser(savedUser);
                resetTo('HOME');
            }
            setIsLoading(false);
        };
        restoreSession();
    }, []);

    const handleLogin = (userData: any) => {
        setUser(userData);
        resetTo('HOME');
    };

    const handleLogout = async () => {
        await logout();
        setUser(null);
        resetTo('HOME');
        setCurrentRide(null);
        setCurrentParams(null);
    };

    const refreshUser = (patched: any) => {
        setUser((prev: any) => ({ ...(prev || {}), ...(patched || {}) }));
    };

    React.useEffect(() => {
        const { setUnauthorizedCallback } = require('../services/api');
        setUnauthorizedCallback(handleLogout);
    }, []);

    const navigation = {
        navigate: (screenName: string, params?: any) => {
            if (screenName === 'RiderBookingScreen') push('BOOKING', params);
            else if (screenName === 'RiderRidesScreen') push('RIDES', params);
            else if (screenName === 'RiderTrackingScreen') {
                if (params?.ride) setCurrentRide(params.ride);
                push('TICKET', params);
            }
            else if (screenName === 'ProfileScreen') push('PROFILE', params);
            else if (screenName === 'SettingsScreen') push('SETTINGS', params);
        },
        replace: (screenName: string, params?: any) => {
            if (screenName === 'RiderBookingScreen') resetTo('BOOKING', params);
            else if (screenName === 'RiderRidesScreen') resetTo('RIDES', params);
            else if (screenName === 'RiderTrackingScreen') {
                if (params?.ride) setCurrentRide(params.ride);
                resetTo('TICKET', params);
            }
        },
        goBack: () => pop(),
        popToTop: () => resetTo('HOME'),
    };

    const route = { params: currentParams };

    // Opens any sub-screen from the rider menu
    const openSubScreen = (key: ScreenKey) => push(key);

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
                        onViewTicket={(ride: any) => { setCurrentRide(ride); push('TICKET'); }}
                        openMenu={(key: ScreenKey) => openSubScreen(key)}
                    />
                );
            case 'BOOKING':
                return <RiderBookingScreen navigation={navigation} route={route} />;
            case 'TICKET':
                return (
                    <RiderTrackingScreen
                        navigation={navigation}
                        route={{ params: { ride: currentRide } }}
                    />
                );
            case 'RIDES':
                return <RiderRidesScreen navigation={navigation} />;

            case 'PROFILE':
                return (
                    <ProfileScreen
                        user={user}
                        refreshUser={refreshUser}
                        onClose={pop}
                        onLogout={handleLogout}
                        navigate={openSubScreen}
                    />
                );
            case 'EDIT_PROFILE':
                return <EditProfileScreen onClose={pop} refreshUser={refreshUser} />;
            case 'SETTINGS':
                return (
                    <SettingsScreen
                        onClose={pop}
                        navigate={openSubScreen}
                        onLogout={handleLogout}
                        refreshUser={refreshUser}
                    />
                );
            case 'CHANGE_PASSWORD':
                return <ChangePasswordScreen onClose={pop} />;
            case 'SAVED_PLACES':
                return <SavedPlacesScreen onClose={pop} />;
            case 'PAYMENT_METHODS':
                return <PaymentMethodsScreen onClose={pop} user={user} />;
            case 'NOTIFICATIONS':
                return <NotificationsScreen onClose={pop} />;
            case 'HELP':
                return <HelpScreen onClose={pop} />;
            case 'ABOUT':
                return <AboutScreen onClose={pop} />;
            case 'FARE_INFO':
                return <FareInfoScreen onClose={pop} />;

            default:
                return (
                    <RiderHomeScreen
                        user={user}
                        onLogout={handleLogout}
                        navigation={navigation}
                        openMenu={(key: ScreenKey) => openSubScreen(key)}
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
