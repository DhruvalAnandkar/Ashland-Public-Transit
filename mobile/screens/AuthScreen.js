import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { login, signup } from '../services/api';

const AuthScreen = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState(''); // Optional/Future use? Server doesn't strictly need it but good practice
    const [phoneNumber, setPhoneNumber] = useState('');
    const [role, setRole] = useState('Rider'); // Default

    const handleSubmit = async () => {
        if (!username || !password) {
            Alert.alert("Error", "Please fill in all required fields.");
            return;
        }

        setLoading(true);
        try {
            let response;
            if (isLogin) {
                console.log("Attempting login...");
                response = await login(username, password);
                Alert.alert("Success", `Welcome back, ${response.username}!`);
                console.log("Logged in:", response);
                if (onLogin) onLogin(response);
            } else {
                console.log("Attempting signup...");
                const userData = {
                    username,
                    password,
                    role,
                    phoneNumber,
                    // email // Add to request if backend expects it
                };
                response = await signup(userData);
                Alert.alert("Success", "Account created! Please log in.");
                console.log("Signed up:", response);
                setIsLogin(true); // Switch to login to confirm
            }
        } catch (error) {
            const msg = error.response?.data?.message || "Something went wrong";
            Alert.alert("Authentication Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const checkBiometrics = async () => {
        Alert.alert("Biometrics", "FaceID/TouchID feature coming soon!");
        // TODO: Implement expo-local-authentication
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <Text style={styles.title}>Ashland Transit</Text>
                <Text style={styles.subtitle}>{isLogin ? "Welcome Back" : "Create Account"}</Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter username"
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter password"
                        secureTextEntry
                    />

                    {!isLogin && (
                        <>
                            {/* Additional Signup Fields */}
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="555-0000"
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.label}>I am a:</Text>
                            <View style={styles.roleContainer}>
                                <TouchableOpacity
                                    style={[styles.roleButton, role === 'Rider' && styles.roleButtonActive]}
                                    onPress={() => setRole('Rider')}
                                >
                                    <Text style={[styles.roleText, role === 'Rider' && styles.roleTextActive]}>Rider</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleButton, role === 'Driver' && styles.roleButtonActive]}
                                    onPress={() => setRole('Driver')}
                                >
                                    <Text style={[styles.roleText, role === 'Driver' && styles.roleTextActive]}>Driver</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? "Processing..." : (isLogin ? "Log In" : "Sign Up")}
                        </Text>
                    </TouchableOpacity>

                    {/* Biometric Stub */}
                    {isLogin && (
                        <TouchableOpacity style={styles.biometricButton} onPress={checkBiometrics}>
                            <Text style={styles.biometricText}>Login with FaceID</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleButton}>
                        <Text style={styles.toggleText}>
                            {isLogin ? "Need an account? Sign Up" : "Already have an account? Log In"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 18,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
    },
    form: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 5,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#f1f5f9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        fontSize: 16,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    button: {
        backgroundColor: '#059669',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: "#059669",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    toggleButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    toggleText: {
        color: '#059669',
        fontWeight: '600',
    },
    roleContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    roleButton: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    roleButtonActive: {
        borderColor: '#059669',
        backgroundColor: '#ecfdf5',
    },
    roleText: {
        fontWeight: '600',
        color: '#64748b',
    },
    roleTextActive: {
        color: '#059669',
    },
    biometricButton: {
        marginTop: 16,
        alignItems: 'center',
        padding: 10,
    },
    biometricText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    }
});

export default AuthScreen;
