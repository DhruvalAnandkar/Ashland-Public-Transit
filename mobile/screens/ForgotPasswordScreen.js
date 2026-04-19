import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform, ScrollView,
    ActivityIndicator, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { requestPasswordReset, verifyResetCode, resetPassword } from '../services/api';

const CODE_LENGTH = 6;

const StepPill = ({ step, label, active, done }) => (
    <View style={[styles.stepPill, active && styles.stepPillActive, done && styles.stepPillDone]}>
        <Text style={[styles.stepNum, (active || done) && { color: 'white' }]}>{done ? '✓' : step}</Text>
        <Text style={[styles.stepLabel, (active || done) && { color: '#eff6ff' }]}>{label}</Text>
    </View>
);

const ForgotPasswordScreen = ({ onClose, onResetComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [devCode, setDevCode] = useState(null);
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const codeRefs = useRef([]);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [resendCooldown]);

    const requestCode = async () => {
        if (!identifier.trim()) {
            Alert.alert('Required', 'Enter your username or email to continue.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const data = await requestPasswordReset(identifier.trim());
            if (data?.devCode) setDevCode(data.devCode);
            setResendCooldown(30);
            setStep(2);
            setCode(['', '', '', '', '', '']);
            setTimeout(() => codeRefs.current[0]?.focus?.(), 100);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const submitCode = async () => {
        const joined = code.join('');
        if (joined.length !== CODE_LENGTH) {
            Alert.alert('Enter the code', `Enter the ${CODE_LENGTH}-digit code from your email/SMS.`);
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            await verifyResetCode(identifier.trim(), joined);
            setStep(3);
        } catch (err) {
            Alert.alert('Invalid code', err?.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const submitNewPwd = async () => {
        if (newPwd.length < 6) {
            Alert.alert('Too short', 'Password must be at least 6 characters.');
            return;
        }
        if (newPwd !== confirmPwd) {
            Alert.alert('Mismatch', 'The passwords do not match.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const joined = code.join('');
            const data = await resetPassword(identifier.trim(), joined, newPwd);
            Alert.alert('Password reset', 'You can now sign in with your new password.');
            onResetComplete?.(data);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const onCodeChange = (idx, value) => {
        const cleaned = value.replace(/[^0-9]/g, '').slice(0, 1);
        const copy = [...code];
        copy[idx] = cleaned;
        setCode(copy);
        if (cleaned && idx < CODE_LENGTH - 1) codeRefs.current[idx + 1]?.focus?.();
    };

    const onCodeBackspace = (idx) => {
        if (!code[idx] && idx > 0) codeRefs.current[idx - 1]?.focus?.();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <LinearGradient colors={['#0f172a', '#1e293b', '#0f172a']} style={StyleSheet.absoluteFillObject} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                        <Text style={styles.closeTxt}>✕</Text>
                    </TouchableOpacity>

                    <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
                        <Text style={styles.emoji}>🔐</Text>
                        <Text style={styles.title}>Reset Password</Text>
                        <Text style={styles.subtitle}>
                            {step === 1 && 'Enter your username or email, and we will send a 6-digit code.'}
                            {step === 2 && `We sent a code to ${identifier}. Enter it below.`}
                            {step === 3 && 'Choose a strong new password.'}
                        </Text>
                    </Animated.View>

                    <View style={styles.stepsRow}>
                        <StepPill step={1} label="Identify" active={step === 1} done={step > 1} />
                        <View style={styles.stepLine} />
                        <StepPill step={2} label="Verify" active={step === 2} done={step > 2} />
                        <View style={styles.stepLine} />
                        <StepPill step={3} label="Reset" active={step === 3} done={false} />
                    </View>

                    {step === 1 && (
                        <Animated.View entering={FadeInDown.delay(100).springify()} layout={Layout.springify()} style={styles.card}>
                            <Text style={styles.label}>Username or Email</Text>
                            <TextInput
                                style={styles.input}
                                value={identifier}
                                onChangeText={setIdentifier}
                                placeholder="your.email@ashland.edu"
                                placeholderTextColor="#64748b"
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                            />

                            <TouchableOpacity onPress={requestCode} disabled={loading} activeOpacity={0.85}>
                                <LinearGradient colors={loading ? ['#475569', '#334155'] : ['#2563eb', '#1d4ed8']} style={styles.cta}>
                                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.ctaTxt}>Send Code</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {step === 2 && (
                        <Animated.View entering={FadeInDown.delay(100).springify()} layout={Layout.springify()} style={styles.card}>
                            <Text style={styles.label}>6-digit code</Text>
                            <View style={styles.codeRow}>
                                {code.map((c, idx) => (
                                    <TextInput
                                        key={idx}
                                        ref={(r) => { codeRefs.current[idx] = r; }}
                                        style={styles.codeBox}
                                        value={c}
                                        onChangeText={(v) => onCodeChange(idx, v)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') onCodeBackspace(idx); }}
                                    />
                                ))}
                            </View>
                            {!!devCode && (
                                <View style={styles.devNote}>
                                    <Text style={styles.devNoteText}>
                                        Dev mode: code is {devCode}. In production this is emailed/SMS-delivered.
                                    </Text>
                                </View>
                            )}
                            <TouchableOpacity onPress={submitCode} disabled={loading} activeOpacity={0.85}>
                                <LinearGradient colors={loading ? ['#475569', '#334155'] : ['#2563eb', '#1d4ed8']} style={styles.cta}>
                                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.ctaTxt}>Verify Code</Text>}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={requestCode} disabled={resendCooldown > 0}>
                                <Text style={[styles.link, resendCooldown > 0 && { opacity: 0.5 }]}>
                                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {step === 3 && (
                        <Animated.View entering={FadeInDown.delay(100).springify()} layout={Layout.springify()} style={styles.card}>
                            <Text style={styles.label}>New Password</Text>
                            <TextInput
                                style={styles.input}
                                value={newPwd}
                                onChangeText={setNewPwd}
                                placeholder="At least 6 characters"
                                placeholderTextColor="#64748b"
                                secureTextEntry
                            />
                            <Text style={[styles.label, { marginTop: 14 }]}>Confirm Password</Text>
                            <TextInput
                                style={styles.input}
                                value={confirmPwd}
                                onChangeText={setConfirmPwd}
                                placeholder="Re-type new password"
                                placeholderTextColor="#64748b"
                                secureTextEntry
                            />
                            <TouchableOpacity onPress={submitNewPwd} disabled={loading} activeOpacity={0.85}>
                                <LinearGradient colors={loading ? ['#475569', '#334155'] : ['#059669', '#047857']} style={styles.cta}>
                                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.ctaTxt}>Reset Password</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    <TouchableOpacity onPress={onClose} style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={styles.backLink}>← Back to sign in</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },

    closeBtn: {
        position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 20,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
    },
    closeTxt: { color: 'white', fontSize: 16, fontWeight: '700' },

    header: { alignItems: 'center', marginBottom: 24 },
    emoji: { fontSize: 44, marginBottom: 8 },
    title: { fontSize: 26, fontWeight: '900', color: 'white', letterSpacing: -0.5 },
    subtitle: {
        color: '#94a3b8', fontSize: 14, fontWeight: '600', marginTop: 8,
        textAlign: 'center', lineHeight: 20,
    },

    stepsRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingHorizontal: 10,
    },
    stepPill: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        minWidth: 88,
    },
    stepPillActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
    stepPillDone: { backgroundColor: '#059669', borderColor: '#047857' },
    stepNum: { color: '#94a3b8', fontWeight: '900', fontSize: 13 },
    stepLabel: { color: '#94a3b8', fontWeight: '700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
    stepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 },

    card: {
        backgroundColor: 'rgba(255,255,255,0.06)', padding: 20, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    label: {
        fontSize: 11, fontWeight: '800', color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
        fontSize: 15, fontWeight: '600', color: 'white',
    },

    codeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    codeBox: {
        width: 44, height: 52, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        textAlign: 'center', fontSize: 22, fontWeight: '900', color: 'white',
    },

    devNote: {
        backgroundColor: 'rgba(250,204,21,0.12)', borderRadius: 10,
        padding: 10, borderWidth: 1, borderColor: 'rgba(250,204,21,0.4)', marginBottom: 12,
    },
    devNoteText: { color: '#fde68a', fontSize: 12, fontWeight: '700' },

    cta: {
        padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 18,
        shadowColor: '#2563eb', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
    },
    ctaTxt: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    link: { color: '#60a5fa', textAlign: 'center', marginTop: 14, fontWeight: '700' },
    backLink: { color: '#94a3b8', fontWeight: '700' },
});

export default ForgotPasswordScreen;
