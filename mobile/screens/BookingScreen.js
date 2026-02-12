import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
    Switch,
    Platform
} from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createRide } from '../services/api'; // Corrected import to use named export

const BookingScreen = ({ user, onCancel, onRideConfirmed }) => {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');

    // Passenger Breakdown
    const [passengers, setPassengers] = useState({
        adults: 1,
        elderly: 0,
        children: 0
    });
    const [accessibility, setAccessibility] = useState(false);
    const [rideDate, setRideDate] = useState(new Date(Date.now() + 5 * 60000)); // Default: Now + 5m
    const [estimatedPrice, setEstimatedPrice] = useState(0);
    const [fareType, setFareType] = useState('Same Day');
    const [loading, setLoading] = useState(false);

    // --- FARE CALCULATION ENGINE ---
    useEffect(() => {
        calculateFare(rideDate, passengers);
    }, [rideDate, passengers]);

    const calculateFare = (date, pax) => {
        const now = new Date();
        const diffHours = (date - now) / (1000 * 60 * 60);

        // Rule 1: Scheduled (>24h) vs Same Day
        const isScheduled = diffHours >= 24;
        const type = isScheduled ? 'Scheduled' : 'Same Day';
        setFareType(type);

        // Rule 2: Rates
        // Same Day: General $5.00, Elderly $2.50
        // Scheduled: General $3.00, Elderly $1.50
        const rateGeneral = isScheduled ? 3.00 : 5.00;
        const rateElderly = isScheduled ? 1.50 : 2.50;

        let total = 0;
        total += pax.adults * rateGeneral;
        total += pax.elderly * rateElderly;
        // Children are free

        setEstimatedPrice(total);
    };

    // --- DATE PICKER (ANDROID SAFE) ---
    const showDatePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: rideDate,
                onChange: (event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                        setRideDate(selectedDate);
                    }
                },
                mode: 'date',
                minimumDate: new Date(),
            });
        } else {
            Alert.alert("Notice", "iOS DatePicker not implemented in this Android fix view");
        }
    };

    const showTimePicker = () => {
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: rideDate,
                onChange: (event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                        setRideDate(selectedDate);
                    }
                },
                mode: 'time',
            });
        } else {
            // on iOS we would show the time picker here
        }
    };

    const updatePassenger = (type, change) => {
        const newPax = { ...passengers, [type]: Math.max(0, passengers[type] + change) };

        // Prevent total 0
        const total = newPax.adults + newPax.elderly + newPax.children;
        if (total === 0 && change < 0) return;

        setPassengers(newPax);
    };

    const handleBooking = async () => {
        if (!pickup || !dropoff) {
            Alert.alert('Missing Info', 'Please enter both pickup and dropoff locations.');
            return;
        }

        setLoading(true);
        try {
            const totalPax = passengers.adults + passengers.elderly + passengers.children;

            const rideData = {
                pickup,
                dropoff,
                scheduledTime: rideDate.toISOString(),
                passengers: totalPax,
                passengerDetails: passengers,
                fareType,
                estimatedPrice,
                accessibility,
                // Add required fields
                phoneNumber: user.phoneNumber || '555-555-5555',
                passengerName: user.username,
                riderId: user._id,
                fare: estimatedPrice,
                isSameDay: fareType === 'Same Day',
                userType: 'Standard',
                isOutOfTown: false,
                mileage: 5
            };

            // Call the API
            const result = await createRide(rideData);

            Alert.alert('Request Sent', 'Your ride has been sent to dispatch for approval.');
            onRideConfirmed(result);

        } catch (error) {
            const msg = error.response?.data?.message || 'Booking Failed';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Book a Ride</Text>

            <View style={styles.card}>
                <Text style={styles.label}>PICKUP LOCATION</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Student Center"
                    value={pickup}
                    onChangeText={setPickup}
                />

                <Text style={styles.label}>DROPOFF LOCATION</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Walmart"
                    value={dropoff}
                    onChangeText={setDropoff}
                />

                <Text style={styles.label}>DATE & TIME</Text>
                <View style={styles.row}>
                    <TouchableOpacity onPress={showDatePicker} style={styles.dateBtn}>
                        <Text style={styles.btnText}>{rideDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={showTimePicker} style={styles.dateBtn}>
                        <Text style={styles.btnText}>{rideDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                    Rate: {fareType} ({rideDate > new Date(Date.now() + 86400000) ? 'Scheduled >24hr' : 'Same Day'})
                </Text>

                <Text style={styles.label}>PASSENGERS</Text>

                {/* Adults */}
                <View style={styles.paxRow}>
                    <Text style={styles.paxLabel}>General Public (${fareType === 'Scheduled' ? '3.00' : '5.00'})</Text>
                    <View style={styles.counter}>
                        <TouchableOpacity onPress={() => updatePassenger('adults', -1)}><Text style={styles.plusMinus}>-</Text></TouchableOpacity>
                        <Text style={styles.countText}>{passengers.adults}</Text>
                        <TouchableOpacity onPress={() => updatePassenger('adults', 1)}><Text style={styles.plusMinus}>+</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Elderly */}
                <View style={styles.paxRow}>
                    <Text style={styles.paxLabel}>Elderly/Disabled (${fareType === 'Scheduled' ? '1.50' : '2.50'})</Text>
                    <View style={styles.counter}>
                        <TouchableOpacity onPress={() => updatePassenger('elderly', -1)}><Text style={styles.plusMinus}>-</Text></TouchableOpacity>
                        <Text style={styles.countText}>{passengers.elderly}</Text>
                        <TouchableOpacity onPress={() => updatePassenger('elderly', 1)}><Text style={styles.plusMinus}>+</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Children */}
                <View style={styles.paxRow}>
                    <Text style={styles.paxLabel}>Children (Under 12) - FREE</Text>
                    <View style={styles.counter}>
                        <TouchableOpacity onPress={() => updatePassenger('children', -1)}><Text style={styles.plusMinus}>-</Text></TouchableOpacity>
                        <Text style={styles.countText}>{passengers.children}</Text>
                        <TouchableOpacity onPress={() => updatePassenger('children', 1)}><Text style={styles.plusMinus}>+</Text></TouchableOpacity>
                    </View>
                </View>

                {/* Wheelchair Toggle */}
                <View style={styles.toggleRow}>
                    <Text style={styles.label}>Wheelchair Required</Text>
                    <Switch
                        trackColor={{ false: "#767577", true: "#059669" }}
                        thumbColor={accessibility ? "#f4f3f4" : "#f4f3f4"}
                        onValueChange={setAccessibility}
                        value={accessibility}
                    />
                </View>

                {/* Total Fare */}
                <View style={styles.fareBox}>
                    <Text style={styles.fareLabel}>Estimated Fare</Text>
                    <Text style={styles.fareValue}>${estimatedPrice.toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.bookBtn, loading && styles.disabled]}
                    onPress={handleBooking}
                    disabled={loading}
                >
                    <Text style={styles.bookBtnText}>{loading ? 'Sending...' : 'Request Ride'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, backgroundColor: '#f8fafc' },
    header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#0f172a' },
    card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 3 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5, marginTop: 15 },
    input: { backgroundColor: '#f1f5f9', padding: 15, borderRadius: 10, fontSize: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    dateBtn: { flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 10, alignItems: 'center' },
    btnText: { fontWeight: '600', color: '#334155' },
    hint: { fontSize: 12, color: '#16a34a', marginTop: 5, fontStyle: 'italic' },

    paxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    paxLabel: { fontSize: 14, color: '#334155', flex: 1 },
    counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8 },
    plusMinus: { padding: 10, fontSize: 18, fontWeight: 'bold', color: '#0f172a', width: 40, textAlign: 'center' },
    countText: { fontSize: 16, fontWeight: 'bold', width: 30, textAlign: 'center' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
    fareBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ecfdf5', padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: '#10b981' },
    fareLabel: { fontSize: 18, fontWeight: 'bold', color: '#065f46' },
    fareValue: { fontSize: 24, fontWeight: 'bold', color: '#059669' },
    bookBtn: { backgroundColor: '#0f766e', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    bookBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    disabled: { opacity: 0.7 },
    cancelBtn: { alignItems: 'center', marginTop: 15 },
    cancelText: { color: '#64748b', fontWeight: '600' }
});

export default BookingScreen;
