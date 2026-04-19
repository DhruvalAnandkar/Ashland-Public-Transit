import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { changePassword } from '../services/api';

const strengthOf = (pw) => {
    if (!pw) return { label: '', score: 0, color: '#e2e8f0' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#059669'];
    return { label: labels[score], score, color: colors[score] };
};

const Field = ({ label, value, onChangeText, placeholder, show, onToggleShow, delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.fieldWrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputRow}>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <TouchableOpacity onPress={onToggleShow} hitSlop={12} style={{ paddingHorizontal: 8 }}>
                <Text style={styles.eye}>{show ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
        </View>
    </Animated.View>
);

const ChangePasswordScreen = ({ onClose }) => {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show1, setShow1] = useState(false);
    const [show2, setShow2] = useState(false);
    const [show3, setShow3] = useState(false);
    const [saving, setSaving] = useState(false);

    const strength = useMemo(() => strengthOf(next), [next]);

    const submit = async () => {
        if (!current || !next || !confirm) {
            Alert.alert('Missing info', 'Please fill out all fields.');
            return;
        }
        if (next !== confirm) {
            Alert.alert('Password mismatch', 'New password and confirmation do not match.');
            return;
        }
        if (next.length < 6) {
            Alert.alert('Too short', 'Password must be at least 6 characters.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSaving(true);
        try {
            await changePassword(current, next);
            Alert.alert('Success', 'Your password has been updated.');
            onClose?.();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScreenHeader title="Change Password" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <Text style={styles.heading}>Keep your account secure</Text>
                    <Text style={styles.sub}>
                        Choose a password that is at least 8 characters, with a mix of upper, lower, numeric, and symbol characters.
                    </Text>

                    <Field
                        label="Current Password"
                        value={current}
                        onChangeText={setCurrent}
                        placeholder="Enter current password"
                        show={show1}
                        onToggleShow={() => setShow1(!show1)}
                        delay={40}
                    />
                    <Field
                        label="New Password"
                        value={next}
                        onChangeText={setNext}
                        placeholder="At least 6 characters"
                        show={show2}
                        onToggleShow={() => setShow2(!show2)}
                        delay={80}
                    />
                    {!!next && (
                        <View style={styles.strengthRow}>
                            {[0, 1, 2, 3].map((i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.strengthBar,
                                        { backgroundColor: i < strength.score ? strength.color : '#e2e8f0' },
                                    ]}
                                />
                            ))}
                            <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                        </View>
                    )}
                    <Field
                        label="Confirm New Password"
                        value={confirm}
                        onChangeText={setConfirm}
                        placeholder="Re-type new password"
                        show={show3}
                        onToggleShow={() => setShow3(!show3)}
                        delay={120}
                    />
                </View>

                <TouchableOpacity onPress={submit} disabled={saving} activeOpacity={0.85}>
                    <LinearGradient
                        colors={saving ? ['#64748b', '#475569'] : ['#2563eb', '#1d4ed8']}
                        style={styles.submit}
                    >
                        {saving ? <ActivityIndicator color="white" /> : <Text style={styles.submitTxt}>Update Password</Text>}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    card: {
        backgroundColor: 'white', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    heading: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    sub: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 4, marginBottom: 16, lineHeight: 18 },

    fieldWrap: { marginBottom: 12 },
    label: {
        fontSize: 11, fontWeight: '800', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12,
    },
    input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600', color: '#0f172a' },
    eye: { fontSize: 18 },

    strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, marginTop: -4 },
    strengthBar: { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 11, fontWeight: '800', marginLeft: 8 },

    submit: {
        padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24,
        shadowColor: '#2563eb', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
    },
    submitTxt: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});

export default ChangePasswordScreen;
