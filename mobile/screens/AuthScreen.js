import React, { useMemo, useState } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform, ScrollView,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
    FadeInDown, FadeIn,
    useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import { login, signup } from '../services/api';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import HeroCanvas from '../components/HeroCanvas';
import BrandLogo from '../components/BrandLogo';
import { useAppTheme } from '../context/ThemeContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const AuthScreen = ({ onLogin }) => {
    const { colors, resolved } = useAppTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const bgGradient = resolved === 'dark'
        ? ['#0f172a', '#1e293b', '#0f172a']
        : ['#1e3a8a', '#1d4ed8', '#1e40af'];
    const [showForgot, setShowForgot] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [role, setRole] = useState('Rider');

    const btnScale = useSharedValue(1);
    const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

    const handleSubmit = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }
        btnScale.value = withSequence(
            withSpring(0.95, { damping: 12, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 })
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setLoading(true);
        try {
            if (isLogin) {
                const response = await login(username, password);
                Alert.alert('Success', `Welcome back, ${response.username}!`);
                if (onLogin) onLogin(response);
            } else {
                const userData = { username, password, role, phoneNumber };
                await signup(userData);
                Alert.alert('Success', 'Account created! Please log in.');
                setIsLogin(true);
            }
        } catch (error) {
            const msg = error.response?.data?.message || 'Something went wrong';
            Alert.alert('Authentication Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    if (showForgot) {
        return (
            <ForgotPasswordScreen
                onClose={() => setShowForgot(false)}
                onResetComplete={(data) => {
                    setShowForgot(false);
                    if (data && onLogin) onLogin(data);
                }}
            />
        );
    }

    return (
        <View style={styles.outerContainer}>
            {/* Background Gradient — warm brand blue in light mode, deep slate in dark */}
            <LinearGradient
                colors={bgGradient}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Decorative Elements */}
            <View style={[styles.decorCircle, { top: -60, right: -60, width: 200, height: 200, backgroundColor: 'rgba(37,99,235,0.08)' }]} />
            <View style={[styles.decorCircle, { bottom: 80, left: -40, width: 150, height: 150, backgroundColor: 'rgba(5,150,105,0.06)' }]} />

            {/* Animated hero canvas */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, opacity: 0.55 }}>
                <HeroCanvas height={260} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                    {/* Logo Area */}
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoSection}>
                        <BrandLogo size="xl" showWordmark={false} />
                        <Text style={styles.title}>Ashland Transit</Text>
                        <Text style={styles.subtitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
                    </Animated.View>

                    {/* Form Card */}
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.formCard}>
                        {/* Username */}
                        <Text style={styles.label}>Username</Text>
                        <View style={styles.inputWrap}>
                            <Text style={styles.inputIcon}>👤</Text>
                            <TextInput
                                style={styles.input}
                                value={username}
                                onChangeText={setUsername}
                                placeholder="Enter username"
                                placeholderTextColor="#64748b"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password */}
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrap}>
                            <Text style={styles.inputIcon}>🔒</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Enter password"
                                placeholderTextColor="#64748b"
                                secureTextEntry
                            />
                        </View>

                        {!isLogin && (
                            <Animated.View entering={FadeInDown.delay(100).springify()}>
                                {/* Phone */}
                                <Text style={styles.label}>Phone Number</Text>
                                <View style={styles.inputWrap}>
                                    <Text style={styles.inputIcon}>📱</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={phoneNumber}
                                        onChangeText={setPhoneNumber}
                                        placeholder="555-0000"
                                        placeholderTextColor="#64748b"
                                        keyboardType="phone-pad"
                                    />
                                </View>

                                {/* Role */}
                                <Text style={styles.label}>I am a:</Text>
                                <View style={styles.roleContainer}>
                                    {[
                                        { key: 'Rider', emoji: '🧑', label: 'Rider' },
                                        { key: 'Driver', emoji: '🚐', label: 'Driver' },
                                    ].map(item => (
                                        <TouchableOpacity
                                            key={item.key}
                                            style={[styles.roleButton, role === item.key && styles.roleButtonActive]}
                                            onPress={() => { setRole(item.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                                        >
                                            <Text style={styles.roleEmoji}>{item.emoji}</Text>
                                            <Text style={[styles.roleText, role === item.key && styles.roleTextActive]}>{item.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </Animated.View>
                        )}

                        {/* Submit Button */}
                        <AnimatedTouchable style={btnStyle} onPress={handleSubmit} disabled={loading} activeOpacity={1}>
                            <LinearGradient
                                colors={isLogin ? ['#2563eb', '#1d4ed8'] : ['#059669', '#047857']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.submitBtn}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.submitBtnText}>
                                        {isLogin ? 'Sign In' : 'Create Account'}
                                    </Text>
                                )}
                            </LinearGradient>
                        </AnimatedTouchable>

                        {/* Forgot password */}
                        {isLogin && (
                            <TouchableOpacity
                                style={styles.forgotButton}
                                onPress={() => setShowForgot(true)}
                            >
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </TouchableOpacity>
                        )}

                        {/* Biometric */}
                        {isLogin && (
                            <TouchableOpacity
                                style={styles.biometricButton}
                                onPress={() => Alert.alert('Biometrics', 'FaceID/TouchID coming soon!')}
                            >
                                <Text style={styles.biometricText}>🔐 Login with FaceID</Text>
                            </TouchableOpacity>
                        )}
                    </Animated.View>

                    {/* Toggle */}
                    <Animated.View entering={FadeIn.delay(400)}>
                        <TouchableOpacity
                            onPress={() => { setIsLogin(!isLogin); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                            style={styles.toggleButton}
                        >
                            <Text style={styles.toggleText}>
                                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                                <Text style={styles.toggleHighlight}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const makeStyles = (c) => StyleSheet.create({
    outerContainer: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    decorCircle: { position: 'absolute', borderRadius: 999 },

    // Logo
    logoSection: { alignItems: 'center', marginBottom: 32 },
    title: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -0.5, marginTop: 16 },
    subtitle: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 4 },

    // Form
    formCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', padding: 24, borderRadius: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    label: {
        fontSize: 11, fontWeight: '800', color: '#94a3b8',
        marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1,
    },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
        paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    inputIcon: { fontSize: 16 },
    input: {
        flex: 1, paddingVertical: 16,
        fontSize: 16, color: 'white', fontWeight: '600',
    },
    roleContainer: { flexDirection: 'row', gap: 12 },
    roleButton: {
        flex: 1, padding: 14, borderRadius: 14,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)',
    },
    roleButtonActive: { borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)' },
    roleEmoji: { fontSize: 22 },
    roleText: { fontWeight: '700', color: '#64748b', fontSize: 12, textTransform: 'uppercase' },
    roleTextActive: { color: '#60a5fa' },

    submitBtn: {
        padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 24,
        shadowColor: '#2563eb', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
    },
    submitBtnText: { color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

    biometricButton: {
        marginTop: 12, alignItems: 'center', padding: 12,
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    },
    biometricText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },

    forgotButton: { alignItems: 'center', marginTop: 16, paddingVertical: 6 },
    forgotText: { color: '#60a5fa', fontWeight: '700', fontSize: 13 },

    toggleButton: { marginTop: 24, alignItems: 'center', padding: 12 },
    toggleText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    toggleHighlight: { color: '#60a5fa', fontWeight: '800' },
});

export default AuthScreen;
