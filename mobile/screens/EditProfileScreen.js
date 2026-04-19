import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { getMyProfile, updateMyProfile } from '../services/api';

const RIDER_TYPES = [
    { key: 'General', emoji: '🧑', label: 'General', hint: 'Standard APT fare' },
    { key: 'Senior', emoji: '👵', label: 'Senior', hint: '65+, discounted' },
    { key: 'Elderly/Disabled', emoji: '♿', label: 'ADA', hint: 'Disability-verified' },
    { key: 'Student', emoji: '🎓', label: 'Student', hint: 'Ashland University' },
    { key: 'Veteran', emoji: '🎖️', label: 'Veteran', hint: 'Rides free' },
    { key: 'Child', emoji: '🧒', label: 'Child', hint: 'Under 12' },
];

const Field = ({ label, value, onChangeText, placeholder, keyboardType, multiline, secureTextEntry, maxLength, autoCapitalize, delay = 0 }) => (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.fieldWrap}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
            style={[styles.input, multiline && { height: 84, textAlignVertical: 'top' }]}
            value={value ?? ''}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            keyboardType={keyboardType}
            multiline={multiline}
            secureTextEntry={secureTextEntry}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
        />
    </Animated.View>
);

const EditProfileScreen = ({ onClose, refreshUser }) => {
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', phoneNumber: '',
        dateOfBirth: null, gender: '', homeAddress: '',
        riderType: 'General', accessibilityNotes: '',
        emergencyContact: { name: '', phone: '', relationship: '' },
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const p = await getMyProfile();
                setForm((f) => ({
                    ...f,
                    firstName: p.firstName || '',
                    lastName: p.lastName || '',
                    email: p.email || '',
                    phoneNumber: p.phoneNumber || '',
                    dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
                    gender: p.gender || '',
                    homeAddress: p.homeAddress || '',
                    riderType: p.riderType || 'General',
                    accessibilityNotes: p.accessibilityNotes || '',
                    emergencyContact: {
                        name: p.emergencyContact?.name || '',
                        phone: p.emergencyContact?.phone || '',
                        relationship: p.emergencyContact?.relationship || '',
                    },
                }));
            } catch (e) {
                Alert.alert('Error', 'Could not load profile');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const dobLabel = useMemo(() => {
        if (!form.dateOfBirth) return 'Add date of birth';
        return form.dateOfBirth.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }, [form.dateOfBirth]);

    const save = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSaving(true);
        try {
            const updated = await updateMyProfile({
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim().toLowerCase(),
                phoneNumber: form.phoneNumber.trim(),
                dateOfBirth: form.dateOfBirth || null,
                gender: form.gender,
                homeAddress: form.homeAddress.trim(),
                riderType: form.riderType,
                accessibilityNotes: form.accessibilityNotes.trim(),
                emergencyContact: form.emergencyContact,
            });
            refreshUser?.(updated);
            Alert.alert('Saved', 'Your profile has been updated.');
            onClose?.();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ScreenHeader title="Edit Profile" onBack={onClose} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScreenHeader title="Edit Profile" onBack={onClose} />
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.section}>Personal</Text>
                <View style={styles.card}>
                    <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                            <Field
                                label="First Name"
                                value={form.firstName}
                                onChangeText={(v) => setForm({ ...form, firstName: v })}
                                placeholder="Jane"
                                autoCapitalize="words"
                                delay={50}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field
                                label="Last Name"
                                value={form.lastName}
                                onChangeText={(v) => setForm({ ...form, lastName: v })}
                                placeholder="Doe"
                                autoCapitalize="words"
                                delay={70}
                            />
                        </View>
                    </View>
                    <Field
                        label="Email"
                        value={form.email}
                        onChangeText={(v) => setForm({ ...form, email: v })}
                        placeholder="jane@ashland.edu"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        delay={90}
                    />
                    <Field
                        label="Phone"
                        value={form.phoneNumber}
                        onChangeText={(v) => setForm({ ...form, phoneNumber: v })}
                        placeholder="(419) 555-0100"
                        keyboardType="phone-pad"
                        delay={110}
                    />

                    <Animated.View entering={FadeInDown.delay(130).springify()} style={styles.fieldWrap}>
                        <Text style={styles.label}>Date of Birth</Text>
                        <TouchableOpacity
                            style={styles.input}
                            onPress={() => setShowDatePicker(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: form.dateOfBirth ? '#0f172a' : '#94a3b8', fontSize: 15, fontWeight: '600' }}>
                                {dobLabel}
                            </Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={form.dateOfBirth || new Date(2000, 0, 1)}
                                mode="date"
                                maximumDate={new Date()}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, date) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (date) setForm((f) => ({ ...f, dateOfBirth: date }));
                                }}
                            />
                        )}
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.fieldWrap}>
                        <Text style={styles.label}>Gender</Text>
                        <View style={styles.pillRow}>
                            {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map((g) => (
                                <TouchableOpacity
                                    key={g}
                                    onPress={() => setForm({ ...form, gender: form.gender === g ? '' : g })}
                                    style={[styles.pill, form.gender === g && styles.pillActive]}
                                >
                                    <Text style={[styles.pillText, form.gender === g && styles.pillTextActive]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>

                    <Field
                        label="Home Address"
                        value={form.homeAddress}
                        onChangeText={(v) => setForm({ ...form, homeAddress: v })}
                        placeholder="123 Main St, Ashland, OH"
                        multiline
                        delay={170}
                    />
                </View>

                <Text style={styles.section}>Rider Category</Text>
                <Text style={styles.sectionHint}>
                    This controls your APT fare. You may be asked to verify documentation for Senior, ADA, Student, or Veteran tiers.
                </Text>
                <View style={styles.card}>
                    <View style={styles.tierGrid}>
                        {RIDER_TYPES.map((t) => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => { Haptics.selectionAsync(); setForm({ ...form, riderType: t.key }); }}
                                style={[styles.tier, form.riderType === t.key && styles.tierActive]}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.tierEmoji}>{t.emoji}</Text>
                                <Text style={[styles.tierLabel, form.riderType === t.key && { color: '#1e40af' }]}>{t.label}</Text>
                                <Text style={styles.tierHint}>{t.hint}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <Text style={styles.section}>Accessibility</Text>
                <View style={styles.card}>
                    <Field
                        label="Notes for the driver"
                        value={form.accessibilityNotes}
                        onChangeText={(v) => setForm({ ...form, accessibilityNotes: v })}
                        placeholder="e.g., Wheelchair lift needed; service dog; need help with bags"
                        multiline
                        maxLength={240}
                        delay={190}
                    />
                </View>

                <Text style={styles.section}>Emergency Contact</Text>
                <Text style={styles.sectionHint}>
                    Shared with dispatch and optionally alerted during your ride with your consent.
                </Text>
                <View style={styles.card}>
                    <Field
                        label="Name"
                        value={form.emergencyContact.name}
                        onChangeText={(v) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: v } })}
                        placeholder="Contact name"
                        autoCapitalize="words"
                        delay={210}
                    />
                    <Field
                        label="Phone"
                        value={form.emergencyContact.phone}
                        onChangeText={(v) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: v } })}
                        placeholder="(555) 000-0000"
                        keyboardType="phone-pad"
                        delay={230}
                    />
                    <Field
                        label="Relationship"
                        value={form.emergencyContact.relationship}
                        onChangeText={(v) => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: v } })}
                        placeholder="Parent, spouse, friend…"
                        autoCapitalize="words"
                        delay={250}
                    />
                </View>

                <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.85}>
                    <LinearGradient
                        colors={saving ? ['#64748b', '#475569'] : ['#059669', '#047857']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.saveBtn}
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.saveTxt}>Save Changes</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },

    section: {
        fontSize: 11, fontWeight: '900', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginHorizontal: 4, marginTop: 18, marginBottom: 8,
    },
    sectionHint: {
        fontSize: 12, fontWeight: '600', color: '#94a3b8',
        marginBottom: 8, marginHorizontal: 4, lineHeight: 18,
    },
    card: {
        backgroundColor: 'white', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },

    fieldWrap: { marginBottom: 14 },
    label: {
        fontSize: 11, fontWeight: '800', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, fontWeight: '600', color: '#0f172a', minHeight: 46,
    },

    twoCol: { flexDirection: 'row', gap: 10 },

    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
        backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
    },
    pillActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
    pillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    pillTextActive: { color: '#1e40af' },

    tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tier: {
        width: '48%', padding: 12, borderRadius: 14,
        borderWidth: 2, borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc', alignItems: 'center',
    },
    tierActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
    tierEmoji: { fontSize: 26, marginBottom: 4 },
    tierLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    tierHint: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 2, textAlign: 'center' },

    saveBtn: {
        padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 24,
        shadowColor: '#059669', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
    },
    saveTxt: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});

export default EditProfileScreen;
