import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Alert, Modal,
    ActivityIndicator, Platform, ToastAndroid,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createRide } from '../services/api';
import PlacesInput from '../components/PlacesInput';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');
const ASHLAND_REGION = {
    latitude: 40.8688, longitude: -82.3179,
    latitudeDelta: 0.05, longitudeDelta: 0.05,
};

const STEPS = ['Route', 'Details', 'Confirm'];

const showToast = (msg) => {
    if (Platform.OS === 'android') {
        ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
    } else {
        Alert.alert('Notice', msg);
    }
};

const isValidCoord = (lat, lng) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

const RiderBookingScreen = ({ navigation, route }) => {
    const scheduledMode = route?.params?.scheduledMode || false;

    const [step, setStep] = useState(0); // 0=Route, 1=Details, 2=Confirm
    const [pickup, setPickup] = useState(null);
    const [dropoff, setDropoff] = useState(null);
    const [passengerCount, setPassengerCount] = useState(1);
    const [userType, setUserType] = useState('General');
    const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 30 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(scheduledMode);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isSameDay, setIsSameDay] = useState(!scheduledMode);
    const [isOutOfTown, setIsOutOfTown] = useState(false);
    const [mileage, setMileage] = useState(5);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [selectingMode, setSelectingMode] = useState(null); // 'pickup' or 'dropoff' when selecting from map
    const mapRef = useRef(null);
    const pickupCoord =
        pickup && isValidCoord(pickup.latitude, pickup.longitude)
            ? { latitude: pickup.latitude, longitude: pickup.longitude }
            : null;
    const dropoffCoord =
        dropoff && isValidCoord(dropoff.latitude, dropoff.longitude)
            ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
            : null;

    useEffect(() => {
        SecureStore.getItemAsync('user').then(str => {
            if (str) setUser(JSON.parse(str));
        });
    }, []);

    useEffect(() => {
        if (
            pickup &&
            dropoff &&
            mapRef.current &&
            isValidCoord(pickup.latitude, pickup.longitude) &&
            isValidCoord(dropoff.latitude, dropoff.longitude)
        ) {
            mapRef.current.fitToCoordinates(
                [{ latitude: pickup.latitude, longitude: pickup.longitude },
                 { latitude: dropoff.latitude, longitude: dropoff.longitude }],
                { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
            );
        }
    }, [pickup, dropoff]);

    const sanitizePlace = (place) => {
        if (!place) return null;
        const latitude = Number(place.latitude);
        const longitude = Number(place.longitude);
        if (!isValidCoord(latitude, longitude)) {
            return null;
        }
        return {
            ...place,
            latitude,
            longitude,
        };
    };

    const handleSelectPickup = (place) => {
        const sanitized = sanitizePlace(place);
        if (!sanitized) {
            showToast('Invalid pickup coordinates. Please pick another location.');
            return;
        }
        setPickup(sanitized);
    };

    const handleSelectDropoff = (place) => {
        const sanitized = sanitizePlace(place);
        if (!sanitized) {
            showToast('Invalid drop-off coordinates. Please pick another location.');
            return;
        }
        setDropoff(sanitized);
    };

    const handleMapPress = (e) => {
        if (!selectingMode) return;
        
        const { latitude, longitude } = e.nativeEvent.coordinate;
        const locationName = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        
        const location = {
            name: locationName,
            latitude,
            longitude,
        };

        if (selectingMode === 'pickup') {
            setPickup(location);
        } else if (selectingMode === 'dropoff') {
            setDropoff(location);
        }
        setSelectingMode(null);
        showToast(`${selectingMode === 'pickup' ? 'Pickup' : 'Dropoff'} location set!`);
    };

    const estimateFare = () => {
        // Match server fareCalculator.js logic exactly
        const RATES = {
            'General': 2.00,
            'Standard': 2.00,
            'Senior': 1.00,
            'Student': 1.50,
            'Veteran': 0.00,
            'Elderly/Disabled': 1.00,
            'Child': 1.00,
        };
        
        let baseFare = RATES[userType] || 2.00;
        
        // Same Day booking adds $1.00 surcharge for Standard/General/Student
        if (isSameDay && (['General', 'Standard', 'Student'].includes(userType))) {
            baseFare += 1.00;
        }
        
        // Multi-passenger logic (second person pays half-price if not free)
        let total = baseFare;
        if (passengerCount > 1 && baseFare > 0) {
            const discountedRiders = passengerCount - 1;
            total += (baseFare / 2) * discountedRiders;
        }
        
        // Out of town: $2.50 per mile
        if (isOutOfTown && mileage > 0) {
            total += (mileage * 2.50);
        }
        
        return total.toFixed(2);
    };

    const goBack = () => {
        if (step === 0) {
            navigation ? navigation.goBack() : null;
        } else {
            setStep(s => s - 1);
        }
    };

    const goNext = () => {
        if (step === 0) {
            if (!pickup) { showToast('Please select a pickup location.'); return; }
            if (!dropoff) { showToast('Please select a drop-off location.'); return; }
            if (!isValidCoord(pickup.latitude, pickup.longitude)) {
                showToast('Pickup location is invalid. Please reselect.');
                return;
            }
            if (!isValidCoord(dropoff.latitude, dropoff.longitude)) {
                showToast('Drop-off location is invalid. Please reselect.');
                return;
            }
            setStep(1);
        } else if (step === 1) {
            setStep(2);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            const rideData = {
                passengerName: user?.username || 'Mobile Rider',
                phoneNumber: user?.phoneNumber || '000-0000',
                pickup: pickup?.name || 'Unknown',
                pickupCoordinates: pickup
                    ? { type: 'Point', coordinates: [pickup.longitude, pickup.latitude] }
                    : undefined,
                dropoff: dropoff?.name || 'Unknown',
                dropoffCoordinates: dropoff
                    ? { type: 'Point', coordinates: [dropoff.longitude, dropoff.latitude] }
                    : undefined,
                userType,
                isSameDay,
                passengers: passengerCount,
                isOutOfTown,
                mileage,
                scheduledTime: scheduledDate.toISOString(),
                riderId: user?._id || user?.id,
            };
            const newRide = await createRide(rideData);
            showToast('Ride booked! Ticket: ' + newRide.ticketId);
            if (navigation) {
                navigation.replace('RiderTrackingScreen', { ride: newRide });
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Booking failed.';
            showToast('Error: ' + msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Book a Ride</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Step indicators */}
            <View style={styles.stepRow}>
                {STEPS.map((label, i) => (
                    <React.Fragment key={label}>
                        <View style={styles.stepItem}>
                            <View style={[styles.stepCircle, i <= step && styles.stepCircleActive]}>
                                <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>
                                    {i < step ? '✓' : i + 1}
                                </Text>
                            </View>
                            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>
                                {label}
                            </Text>
                        </View>
                        {i < STEPS.length - 1 && (
                            <View style={[styles.stepConnector, i < step && styles.stepConnectorActive]} />
                        )}
                    </React.Fragment>
                ))}
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
                {/* ─── STEP 0: ROUTE ─── */}
                {step === 0 && (
                    <View>
                        {/* Map */}
                        <View style={styles.mapContainer}>
                            <MapView
                                ref={mapRef}
                                provider={PROVIDER_GOOGLE}
                                style={{ width: '100%', height: '100%' }}
                                initialRegion={ASHLAND_REGION}
                                showsUserLocation
                                onPress={handleMapPress}
                            >
                                {pickupCoord && (
                                    <Marker
                                        coordinate={pickupCoord}
                                        title="Pickup"
                                        pinColor="#22c55e"
                                    />
                                )}
                                {dropoffCoord && (
                                    <Marker
                                        coordinate={dropoffCoord}
                                        title="Drop-off"
                                        pinColor="#ef4444"
                                    />
                                )}
                                {pickupCoord && dropoffCoord && (
                                    <Polyline
                                        coordinates={[
                                            pickupCoord,
                                            dropoffCoord,
                                        ]}
                                        strokeColor="#3b82f6"
                                        strokeWidth={3}
                                        lineDashPattern={[8, 4]}
                                    />
                                )}
                            </MapView>
                            {selectingMode && (
                                <View style={styles.mapHintOverlay}>
                                    <Text style={styles.mapHintText}>
                                        👆 Tap the map to set {selectingMode === 'pickup' ? 'pickup' : 'drop-off'} location
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Places inputs – container must be overflow visible */}
                        <View style={styles.inputsCard}>
                            <View style={styles.locationHeader}>
                                <Text style={styles.inputLabel}>🟢  Pickup Location</Text>
                                {pickup && (
                                    <TouchableOpacity onPress={() => setPickup(null)} style={styles.clearBtn}>
                                        <Text style={styles.clearText}>✕ Clear</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.inputRow}>
                                <View style={styles.placesWrapper}>
                                    <PlacesInput
                                        placeholder="Enter pickup address..."
                                        value={pickup?.name || ''}
                                        onSelect={handleSelectPickup}
                                        listZIndex={99999}
                                        onFocus={() => setSelectingMode(null)}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.mapBtn, selectingMode === 'pickup' && styles.mapBtnActive]}
                                    onPress={() => setSelectingMode(selectingMode === 'pickup' ? null : 'pickup')}
                                >
                                    <Text style={styles.mapBtnText}>📍</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.locationHeader, { marginTop: 20 }]}>
                                <Text style={styles.inputLabel}>🔴  Drop-off Location</Text>
                                {dropoff && (
                                    <TouchableOpacity onPress={() => setDropoff(null)} style={styles.clearBtn}>
                                        <Text style={styles.clearText}>✕ Clear</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={styles.inputRow}>
                                <View style={styles.placesWrapper}>
                                    <PlacesInput
                                        placeholder="Enter drop-off address..."
                                        value={dropoff?.name || ''}
                                        onSelect={handleSelectDropoff}
                                        listZIndex={9999}
                                        onFocus={() => setSelectingMode(null)}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.mapBtn, selectingMode === 'dropoff' && styles.mapBtnActive]}
                                    onPress={() => setSelectingMode(selectingMode === 'dropoff' ? null : 'dropoff')}
                                >
                                    <Text style={styles.mapBtnText}>📍</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* ─── STEP 1: DETAILS ─── */}
                {step === 1 && (
                    <View style={styles.detailsCard}>
                        {/* Passenger Type */}
                        <Text style={styles.fieldLabel}>Passenger Type</Text>
                        <View style={styles.segmentRow}>
                            {['General', 'Elderly/Disabled', 'Child'].map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.segment, userType === type && styles.segmentActive]}
                                    onPress={() => setUserType(type)}
                                >
                                    <Text style={[styles.segmentText, userType === type && styles.segmentTextActive]}>
                                        {type === 'Elderly/Disabled' ? 'Elderly' : type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Passenger Count */}
                        <Text style={styles.fieldLabel}>Passengers</Text>
                        <View style={styles.counterRow}>
                            <TouchableOpacity style={styles.counterBtn} onPress={() => setPassengerCount(Math.max(1, passengerCount - 1))}>
                                <Text style={styles.counterBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.counterVal}>{passengerCount}</Text>
                            <TouchableOpacity style={styles.counterBtn} onPress={() => setPassengerCount(Math.min(10, passengerCount + 1))}>
                                <Text style={styles.counterBtnText}>+</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Date & Time */}
                        <Text style={styles.fieldLabel}>Scheduled Date & Time</Text>
                        <TouchableOpacity
                            style={styles.datePickerBtn}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.datePickerText}>
                                📅  {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>

                        {showDatePicker && (
                            <DateTimePicker
                                value={scheduledDate}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={(e, date) => {
                                    setShowDatePicker(false);
                                    if (date) { setScheduledDate(date); setShowTimePicker(true); }
                                }}
                            />
                        )}
                        {showTimePicker && (
                            <DateTimePicker
                                value={scheduledDate}
                                mode="time"
                                display="default"
                                onChange={(e, date) => {
                                    setShowTimePicker(false);
                                    if (date) setScheduledDate(date);
                                }}
                            />
                        )}

                        {/* Toggles */}
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleItem}>
                                <Text style={styles.toggleLabel}>Same Day</Text>
                                <TouchableOpacity
                                    style={[styles.toggle, isSameDay && styles.toggleOn]}
                                    onPress={() => setIsSameDay(!isSameDay)}
                                >
                                    <View style={[styles.toggleThumb, isSameDay && styles.toggleThumbOn]} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.toggleItem}>
                                <Text style={styles.toggleLabel}>Out of Town</Text>
                                <TouchableOpacity
                                    style={[styles.toggle, isOutOfTown && styles.toggleOn]}
                                    onPress={() => setIsOutOfTown(!isOutOfTown)}
                                >
                                    <View style={[styles.toggleThumb, isOutOfTown && styles.toggleThumbOn]} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isOutOfTown && (
                            <>
                                <Text style={styles.fieldLabel}>Estimated Miles</Text>
                                <View style={styles.counterRow}>
                                    <TouchableOpacity style={styles.counterBtn} onPress={() => setMileage(Math.max(1, mileage - 1))}>
                                        <Text style={styles.counterBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.counterVal}>{mileage} mi</Text>
                                    <TouchableOpacity style={styles.counterBtn} onPress={() => setMileage(mileage + 1)}>
                                        <Text style={styles.counterBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                )}

                {/* ─── STEP 2: CONFIRM ─── */}
                {step === 2 && (
                    <View style={styles.confirmCard}>
                        <Text style={styles.confirmTitle}>Confirm Your Ride</Text>

                        <View style={styles.fareDisplay}>
                            <Text style={styles.fareLabel}>Estimated Fare</Text>
                            <Text style={styles.fareAmount}>${estimateFare()}</Text>
                        </View>

                        <View style={styles.summarySection}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryIcon}>🟢</Text>
                                <View style={styles.summaryTextBlock}>
                                    <Text style={styles.summaryLabel}>Pickup</Text>
                                    <Text style={styles.summaryValue}>{pickup?.name || '—'}</Text>
                                </View>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryIcon}>🔴</Text>
                                <View style={styles.summaryTextBlock}>
                                    <Text style={styles.summaryLabel}>Drop-off</Text>
                                    <Text style={styles.summaryValue}>{dropoff?.name || '—'}</Text>
                                </View>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryIcon}>📅</Text>
                                <View style={styles.summaryTextBlock}>
                                    <Text style={styles.summaryLabel}>Date & Time</Text>
                                    <Text style={styles.summaryValue}>
                                        {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryIcon}>👥</Text>
                                <View style={styles.summaryTextBlock}>
                                    <Text style={styles.summaryLabel}>Passengers</Text>
                                    <Text style={styles.summaryValue}>{passengerCount} · {userType}</Text>
                                </View>
                            </View>
                        </View>

                        {loading ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator size="large" color="#059669" />
                                <Text style={styles.loadingText}>Booking your ride...</Text>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                                <Text style={styles.confirmBtnText}>✓  Confirm Booking</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Bottom Navigation */}
            {step < 2 && (
                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
                        <Text style={styles.nextBtnText}>
                            {step === 0 ? 'Choose Details →' : 'Review Booking →'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
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
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    stepRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    stepItem: { alignItems: 'center', gap: 4 },
    stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
    stepCircleActive: { backgroundColor: '#059669' },
    stepNum: { fontSize: 13, fontWeight: '800', color: '#94a3b8' },
    stepNumActive: { color: 'white' },
    stepLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
    stepLabelActive: { color: '#059669' },
    stepConnector: { flex: 1, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 4, marginBottom: 16 },
    stepConnectorActive: { backgroundColor: '#059669' },
    body: { flex: 1 },
    bodyContent: { paddingBottom: 100 },
    mapContainer: { height: 220, backgroundColor: '#e2e8f0' },
    inputsCard: {
        backgroundColor: 'white', padding: 20, margin: 16, borderRadius: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
        overflow: 'visible', zIndex: 10,
    },
    placesWrapper: { flex: 1, zIndex: 999, overflow: 'visible' },
    inputLabel: { fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    locationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    clearBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fee2e2', borderRadius: 8 },
    clearText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },
    inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    mapBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginTop: 0, borderWidth: 2, borderColor: '#e2e8f0' },
    mapBtnActive: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
    mapBtnText: { fontSize: 20 },
    mapHintOverlay: { position: 'absolute', top: 20, left: 20, right: 20, backgroundColor: 'rgba(59, 130, 246, 0.95)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, zIndex: 100 },
    mapHintText: { color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 14 },
    detailsCard: { backgroundColor: 'white', margin: 16, padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    fieldLabel: { fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 10, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    segmentRow: { flexDirection: 'row', gap: 8 },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
    segmentActive: { borderColor: '#059669', backgroundColor: '#f0fdf4' },
    segmentText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
    segmentTextActive: { color: '#059669' },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    counterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    counterBtnText: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    counterVal: { fontSize: 22, fontWeight: '900', color: '#0f172a', minWidth: 60, textAlign: 'center' },
    datePickerBtn: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    datePickerText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    toggleRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
    toggleItem: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
    toggleLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
    toggle: { width: 48, height: 26, backgroundColor: '#e2e8f0', borderRadius: 13, padding: 2 },
    toggleOn: { backgroundColor: '#059669' },
    toggleThumb: { width: 22, height: 22, backgroundColor: 'white', borderRadius: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
    toggleThumbOn: { transform: [{ translateX: 22 }] },
    confirmCard: { backgroundColor: 'white', margin: 16, padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    confirmTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 20 },
    fareDisplay: { backgroundColor: '#f0fdf4', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: '#bbf7d0' },
    fareLabel: { fontSize: 12, fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: 1 },
    fareAmount: { fontSize: 48, fontWeight: '900', color: '#059669', marginTop: 4 },
    summarySection: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 4, marginBottom: 24 },
    summaryRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
    summaryIcon: { fontSize: 18, marginTop: 2 },
    summaryTextBlock: { flex: 1 },
    summaryLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
    summaryValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    summaryDivider: { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 14 },
    loadingBox: { alignItems: 'center', padding: 24, gap: 12 },
    loadingText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
    confirmBtn: { backgroundColor: '#059669', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
    confirmBtnText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    nextBtn: { backgroundColor: '#0f172a', padding: 18, borderRadius: 16, alignItems: 'center' },
    nextBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});

export default RiderBookingScreen;
