import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Modal, TextInput,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import {
    listSavedPlaces, addSavedPlace, updateSavedPlace, deleteSavedPlace,
} from '../services/api';

const ICONS = [
    { key: 'home', emoji: '🏠', label: 'Home' },
    { key: 'work', emoji: '💼', label: 'Work' },
    { key: 'school', emoji: '🎓', label: 'School' },
    { key: 'gym', emoji: '💪', label: 'Gym' },
    { key: 'star', emoji: '⭐', label: 'Favorite' },
    { key: 'place', emoji: '📍', label: 'Other' },
];

const PlaceRow = ({ place, onEdit, onDelete, delay = 0 }) => {
    const icon = ICONS.find(i => i.key === place.icon)?.emoji || '📍';
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} layout={Layout.springify()}>
            <View style={styles.row}>
                <View style={styles.rowIcon}>
                    <Text style={styles.rowIconText}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{place.label}</Text>
                    <Text style={styles.rowAddr} numberOfLines={2}>{place.address}</Text>
                </View>
                <TouchableOpacity onPress={onEdit} style={styles.miniBtn} hitSlop={8}>
                    <Text style={styles.miniBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={[styles.miniBtn, { marginLeft: 6 }]} hitSlop={8}>
                    <Text style={[styles.miniBtnText, { color: '#dc2626' }]}>×</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const SavedPlacesScreen = ({ onClose }) => {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ label: '', icon: 'home', address: '' });

    const load = async () => {
        setLoading(true);
        try {
            const list = await listSavedPlaces();
            setPlaces(Array.isArray(list) ? list : []);
        } catch (err) {
            Alert.alert('Error', 'Could not load saved places.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditing(null);
        setForm({ label: '', icon: 'home', address: '' });
        setModalOpen(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({ label: p.label, icon: p.icon || 'place', address: p.address });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.label.trim() || !form.address.trim()) {
            Alert.alert('Missing info', 'Provide a label and address.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            if (editing) {
                const list = await updateSavedPlace(editing._id, form);
                setPlaces(list);
            } else {
                const list = await addSavedPlace(form);
                setPlaces(list);
            }
            setModalOpen(false);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message);
        }
    };

    const remove = (p) => {
        Alert.alert('Remove place', `Delete "${p.label}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const list = await deleteSavedPlace(p._id);
                        setPlaces(list);
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
                title="Saved Places"
                subtitle="Quick access during booking"
                onBack={onClose}
                rightAction={
                    <TouchableOpacity onPress={openNew} hitSlop={8} style={styles.addBtn}>
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
                    {places.length === 0 ? (
                        <Animated.View entering={FadeInDown.springify()} style={styles.empty}>
                            <Text style={styles.emptyEmoji}>📍</Text>
                            <Text style={styles.emptyTitle}>No saved places yet</Text>
                            <Text style={styles.emptyText}>
                                Save your Home, Work, or any frequent destination for one-tap booking.
                            </Text>
                            <TouchableOpacity onPress={openNew} style={styles.emptyCta}>
                                <LinearGradient colors={['#2563eb', '#1d4ed8']} style={styles.emptyCtaBg}>
                                    <Text style={styles.emptyCtaTxt}>Add your first place</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    ) : (
                        <View style={styles.card}>
                            {places.map((p, idx) => (
                                <PlaceRow
                                    key={p._id}
                                    place={p}
                                    onEdit={() => openEdit(p)}
                                    onDelete={() => remove(p)}
                                    delay={idx * 50}
                                />
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Modal */}
            <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editing ? 'Edit Place' : 'Add Place'}</Text>
                            <TouchableOpacity onPress={() => setModalOpen(false)}>
                                <Text style={styles.closeTxt}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Icon</Text>
                        <View style={styles.iconRow}>
                            {ICONS.map((i) => (
                                <TouchableOpacity
                                    key={i.key}
                                    onPress={() => setForm({ ...form, icon: i.key })}
                                    style={[styles.iconPick, form.icon === i.key && styles.iconPickActive]}
                                >
                                    <Text style={{ fontSize: 24 }}>{i.emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Label</Text>
                        <TextInput
                            style={styles.input}
                            value={form.label}
                            onChangeText={(v) => setForm({ ...form, label: v })}
                            placeholder="Home, Work, Mom’s House…"
                            placeholderTextColor="#94a3b8"
                        />
                        <Text style={styles.label}>Address</Text>
                        <TextInput
                            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                            value={form.address}
                            onChangeText={(v) => setForm({ ...form, address: v })}
                            placeholder="123 Main St, Ashland, OH 44805"
                            placeholderTextColor="#94a3b8"
                            multiline
                        />

                        <TouchableOpacity onPress={save} activeOpacity={0.85}>
                            <LinearGradient colors={['#059669', '#047857']} style={styles.saveBtn}>
                                <Text style={styles.saveTxt}>{editing ? 'Save changes' : 'Add place'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    addBtn: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    addBtnTxt: { color: 'white', fontSize: 26, fontWeight: '700', marginTop: -3 },

    card: {
        backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0',
    },
    rowIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    rowIconText: { fontSize: 22 },
    rowLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    rowAddr: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
    miniBtn: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    miniBtnText: { fontSize: 11, fontWeight: '800', color: '#334155', textTransform: 'uppercase' },

    empty: { alignItems: 'center', padding: 24 },
    emptyEmoji: { fontSize: 50, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    emptyText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 6, marginBottom: 20, textAlign: 'center' },
    emptyCta: { width: '100%' },
    emptyCtaBg: { padding: 14, borderRadius: 12, alignItems: 'center' },
    emptyCtaTxt: { color: 'white', fontWeight: '900', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 28,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
    closeTxt: { fontSize: 20, color: '#64748b', fontWeight: '700' },
    label: {
        fontSize: 11, fontWeight: '800', color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 8,
    },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
    iconPick: {
        width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#e2e8f0',
    },
    iconPickActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, fontWeight: '600', color: '#0f172a', minHeight: 46,
    },
    saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
    saveTxt: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});

export default SavedPlacesScreen;
