import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import {
    listPaymentMethods, addPaymentMethod, setDefaultPaymentMethod, deletePaymentMethod,
} from '../services/api';

const BRANDS = [
    { key: 'Visa', emoji: '💳', colors: ['#1e3a8a', '#1e40af'] },
    { key: 'Mastercard', emoji: '💳', colors: ['#ea580c', '#dc2626'] },
    { key: 'Amex', emoji: '💳', colors: ['#0369a1', '#0891b2'] },
    { key: 'Cash', emoji: '💵', colors: ['#166534', '#15803d'] },
    { key: 'Wallet', emoji: '💼', colors: ['#4c1d95', '#6d28d9'] },
];

const MethodCard = ({ method, onMakeDefault, onDelete, delay = 0, isWalletStub }) => {
    const brand = BRANDS.find(b => b.key === method.brand) || BRANDS[0];
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify()}>
            <LinearGradient
                colors={brand.colors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
            >
                <View style={styles.cardTop}>
                    <Text style={styles.brandEmoji}>{brand.emoji}</Text>
                    {method.isDefault && <View style={styles.defaultPill}><Text style={styles.defaultTxt}>Default</Text></View>}
                </View>
                <Text style={styles.cardLabel}>{method.label}</Text>
                {!!method.last4 && <Text style={styles.cardNum}>•••• •••• •••• {method.last4}</Text>}
                <Text style={styles.cardBrand}>{method.brand}</Text>

                {!isWalletStub && (
                    <View style={styles.cardActions}>
                        {!method.isDefault && (
                            <TouchableOpacity onPress={onMakeDefault} style={styles.cardBtn}>
                                <Text style={styles.cardBtnTxt}>Make default</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onDelete} style={[styles.cardBtn, { backgroundColor: 'rgba(239,68,68,0.22)' }]}>
                            <Text style={[styles.cardBtnTxt, { color: '#fecaca' }]}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LinearGradient>
        </Animated.View>
    );
};

const PaymentMethodsScreen = ({ onClose, user }) => {
    const [loading, setLoading] = useState(true);
    const [methods, setMethods] = useState([]);
    const [defaultId, setDefaultId] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ label: '', brand: 'Visa', last4: '', isDefault: false });

    const load = async () => {
        setLoading(true);
        try {
            const data = await listPaymentMethods();
            setMethods(data.paymentMethods || []);
            setDefaultId(data.defaultPaymentMethodId || null);
        } catch (err) {
            Alert.alert('Error', 'Could not load payment methods.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const addNew = async () => {
        if (!form.label.trim()) {
            Alert.alert('Missing info', 'Please provide a label.');
            return;
        }
        const cleanedLast4 = form.last4.replace(/[^0-9]/g, '').slice(-4);
        try {
            const data = await addPaymentMethod({ ...form, last4: cleanedLast4 });
            setMethods(data.paymentMethods || []);
            setDefaultId(data.defaultPaymentMethodId || null);
            setModalOpen(false);
            setForm({ label: '', brand: 'Visa', last4: '', isDefault: false });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        }
    };

    const makeDefault = async (m) => {
        try {
            const data = await setDefaultPaymentMethod(m._id);
            setMethods(data.paymentMethods || []);
            setDefaultId(data.defaultPaymentMethodId || null);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        }
    };

    const remove = (m) => {
        Alert.alert('Remove method', `Delete "${m.label}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        const data = await deletePaymentMethod(m._id);
                        setMethods(data.paymentMethods || []);
                        setDefaultId(data.defaultPaymentMethodId || null);
                    } catch (err) {
                        Alert.alert('Error', err?.response?.data?.message || err.message);
                    }
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="Payment Methods"
                subtitle="Manage how you pay for rides"
                onBack={onClose}
                rightAction={
                    <TouchableOpacity onPress={() => setModalOpen(true)} hitSlop={8} style={styles.addBtn}>
                        <Text style={styles.addBtnTxt}>+</Text>
                    </TouchableOpacity>
                }
            />

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
                    {/* Wallet (read-only) */}
                    <Text style={styles.sectionLabel}>Built-in</Text>
                    <MethodCard
                        method={{
                            label: 'Transit Credits',
                            brand: 'Wallet',
                            last4: '',
                            isDefault: false,
                        }}
                        isWalletStub
                        delay={20}
                    />
                    <View style={styles.walletInfoCard}>
                        <Text style={styles.walletLabel}>Balance</Text>
                        <Text style={styles.walletAmt}>${(user?.walletBalance || 0).toFixed(2)}</Text>
                        <Text style={styles.walletHint}>
                            Transit Credits are managed by dispatch and used automatically when available.
                        </Text>
                    </View>

                    {/* User-added methods */}
                    <Text style={styles.sectionLabel}>Your Methods</Text>
                    {methods.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyEmoji}>💳</Text>
                            <Text style={styles.emptyTitle}>No payment methods yet</Text>
                            <Text style={styles.emptyText}>
                                Add a card or record cash as a method for easier checkout at ride completion.
                            </Text>
                            <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.emptyCta}>
                                <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.emptyCtaBg}>
                                    <Text style={styles.emptyCtaTxt}>+ Add Payment Method</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        methods.map((m, i) => (
                            <MethodCard
                                key={m._id}
                                method={m}
                                onMakeDefault={() => makeDefault(m)}
                                onDelete={() => remove(m)}
                                delay={40 + i * 60}
                            />
                        ))
                    )}

                    <Text style={styles.legal}>
                        APT does not store full card numbers. All payments are processed via Stripe.
                        This list is a reference for rider convenience.
                    </Text>
                </ScrollView>
            )}

            <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <Text style={styles.modalTitle}>Add Payment Method</Text>

                        <Text style={styles.inputLabel}>Brand</Text>
                        <View style={styles.brandRow}>
                            {BRANDS.map((b) => (
                                <TouchableOpacity
                                    key={b.key}
                                    onPress={() => setForm({ ...form, brand: b.key })}
                                    style={[styles.brandPick, form.brand === b.key && styles.brandPickActive]}
                                >
                                    <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
                                    <Text style={[styles.brandPickTxt, form.brand === b.key && { color: '#1e40af' }]}>{b.key}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Label</Text>
                        <TextInput
                            style={styles.input}
                            value={form.label}
                            onChangeText={(v) => setForm({ ...form, label: v })}
                            placeholder="Personal Visa, Company Amex, …"
                            placeholderTextColor="#94a3b8"
                        />

                        {['Visa', 'Mastercard', 'Amex'].includes(form.brand) && (
                            <>
                                <Text style={styles.inputLabel}>Last 4 digits</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.last4}
                                    onChangeText={(v) => setForm({ ...form, last4: v.replace(/[^0-9]/g, '').slice(0, 4) })}
                                    placeholder="4242"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                />
                            </>
                        )}

                        <TouchableOpacity
                            onPress={() => setForm({ ...form, isDefault: !form.isDefault })}
                            style={styles.defaultRow}
                        >
                            <View style={[styles.checkbox, form.isDefault && styles.checkboxActive]}>
                                {form.isDefault && <Text style={{ color: 'white', fontWeight: '900' }}>✓</Text>}
                            </View>
                            <Text style={styles.defaultLabel}>Use as default</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.cancelBtn}>
                                <Text style={styles.cancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={addNew} style={{ flex: 1 }} activeOpacity={0.85}>
                                <LinearGradient colors={['#059669', '#047857']} style={styles.saveBtn}>
                                    <Text style={styles.saveTxt}>Add Method</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    addBtn: {
        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    addBtnTxt: { color: 'white', fontSize: 26, fontWeight: '700', marginTop: -3 },

    sectionLabel: {
        fontSize: 11, fontWeight: '900', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 12, marginBottom: 8, marginLeft: 4,
    },

    cardGradient: {
        borderRadius: 18, padding: 20, marginBottom: 14,
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2, shadowRadius: 14, elevation: 5,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brandEmoji: { fontSize: 30 },
    defaultPill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    defaultTxt: { color: 'white', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    cardLabel: { color: 'white', fontSize: 16, fontWeight: '900', marginTop: 18 },
    cardNum: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '800', marginTop: 6, letterSpacing: 2 },
    cardBrand: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
    cardBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
    cardBtnTxt: { color: 'white', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

    walletInfoCard: {
        backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    walletLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
    walletAmt: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginTop: 2 },
    walletHint: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4 },

    empty: { alignItems: 'center', padding: 24 },
    emptyEmoji: { fontSize: 44, marginBottom: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    emptyText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 6, marginBottom: 18, textAlign: 'center' },
    emptyCta: { width: '100%' },
    emptyCtaBg: { padding: 14, borderRadius: 12, alignItems: 'center' },
    emptyCtaTxt: { color: 'white', fontWeight: '900', fontSize: 14 },

    legal: { marginTop: 18, textAlign: 'center', fontSize: 11, color: '#94a3b8', fontWeight: '600', lineHeight: 16, paddingHorizontal: 12 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 16 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 10 },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, fontWeight: '600', color: '#0f172a',
    },
    brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    brandPick: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#e2e8f0',
        flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    brandPickActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
    brandPickTxt: { fontWeight: '800', fontSize: 12, color: '#475569' },

    defaultRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    checkbox: {
        width: 24, height: 24, borderRadius: 6, borderWidth: 2,
        borderColor: '#cbd5e1', backgroundColor: 'white',
        alignItems: 'center', justifyContent: 'center', marginRight: 10,
    },
    checkboxActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    defaultLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

    cancelBtn: {
        paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14,
        backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    },
    cancelTxt: { color: '#475569', fontWeight: '800', fontSize: 14 },
    saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center' },
    saveTxt: { color: 'white', fontWeight: '900', fontSize: 14 },
});

export default PaymentMethodsScreen;
