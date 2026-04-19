import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import ScreenHeader from '../components/ScreenHeader';
import { useAppTheme } from '../context/ThemeContext';
import { getReply } from '../utils/chatbotEngine';
import {
    STARTER_PROMPTS, DISPATCH_PHONE, DISPATCH_PHONE_TEL,
} from '../constants/chatbotKnowledge';

const WELCOME = {
    role: 'bot',
    text:
        "Hi! I'm APT Assist — your Ashland Public Transit helper. " +
        "Ask me anything about fares, booking, the pickup window, or out-of-town trips.",
};

const ChatbotScreen = ({ onClose, navigate, user }) => {
    const { colors, resolved } = useAppTheme();
    const styles = useMemo(() => makeStyles(colors, resolved), [colors, resolved]);

    const [messages, setMessages] = useState([WELCOME]);
    const [input, setInput] = useState('');
    const [pending, setPending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
        return () => clearTimeout(t);
    }, [messages, pending]);

    const send = async (raw) => {
        const text = String(raw ?? input).trim();
        if (!text || pending) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setInput('');
        setMessages((m) => [...m, { role: 'user', text }]);
        setPending(true);

        try {
            const reply = await getReply(text);
            setMessages((m) => [
                ...m,
                { role: 'bot', text: reply.answer, actions: reply.actions, id: reply.id },
            ]);
        } catch {
            setMessages((m) => [
                ...m,
                {
                    role: 'bot',
                    text: "Sorry, I hit a snag. Please try again — or call dispatch at " + DISPATCH_PHONE + '.',
                },
            ]);
        } finally {
            setPending(false);
        }
    };

    const handleAction = async (action) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (action.screen === 'CALL_DISPATCH') {
            try {
                const ok = await Linking.canOpenURL(DISPATCH_PHONE_TEL);
                if (ok) await Linking.openURL(DISPATCH_PHONE_TEL);
                else Alert.alert('Dispatch', DISPATCH_PHONE);
            } catch {
                Alert.alert('Dispatch', DISPATCH_PHONE);
            }
            return;
        }

        if (typeof navigate === 'function') {
            navigate(action.screen, action.params);
        }
    };

    const clearChat = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setMessages([WELCOME]);
    };

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="APT Assist"
                subtitle={user?.username ? `Hi ${user.username} — how can I help?` : 'Ashland Public Transit helper'}
                onBack={onClose}
                rightAction={
                    <TouchableOpacity
                        onPress={clearChat}
                        hitSlop={12}
                        accessibilityLabel="Clear conversation"
                    >
                        <Ionicons name="refresh" size={20} color="#ffffff" />
                    </TouchableOpacity>
                }
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((m, i) => (
                        <MessageBubble
                            key={`${i}-${m.role}`}
                            message={m}
                            styles={styles}
                            colors={colors}
                            onAction={handleAction}
                        />
                    ))}

                    {pending && <TypingIndicator styles={styles} colors={colors} />}

                    {messages.length === 1 && !pending && (
                        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.suggestWrap}>
                            <Text style={styles.suggestLabel}>Try asking:</Text>
                            <View style={styles.suggestRow}>
                                {STARTER_PROMPTS.map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        onPress={() => send(p)}
                                        style={styles.suggestChip}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={styles.suggestChipText} numberOfLines={2}>
                                            {p}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}
                </ScrollView>

                <View style={styles.inputBar}>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Ask me anything…"
                        placeholderTextColor={colors.subtle}
                        style={styles.input}
                        multiline
                        maxLength={500}
                        onSubmitEditing={() => send()}
                        returnKeyType="send"
                        blurOnSubmit={false}
                        editable={!pending}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendBtn,
                            (!input.trim() || pending) && styles.sendBtnDisabled,
                        ]}
                        onPress={() => send()}
                        disabled={!input.trim() || pending}
                        activeOpacity={0.75}
                        accessibilityLabel="Send message"
                    >
                        <Ionicons name="arrow-up" size={20} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.footerNote}>
                    APT Assist uses on-device rules. For complex issues, call dispatch at {DISPATCH_PHONE}.
                </Text>
            </KeyboardAvoidingView>
        </View>
    );
};

const MessageBubble = ({ message, styles, colors, onAction }) => {
    const isUser = message.role === 'user';
    return (
        <Animated.View
            entering={FadeInDown.duration(260).springify()}
            style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}
        >
            {!isUser && (
                <View style={styles.avatar}>
                    <Ionicons
                        name="chatbubble-ellipses"
                        size={16}
                        color={styles.avatarIconColor.color}
                    />
                </View>
            )}
            <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                    <Text style={[styles.bubbleTxt, isUser ? styles.bubbleTxtUser : styles.bubbleTxtBot]}>
                        {message.text}
                    </Text>
                </View>

                {!isUser && Array.isArray(message.actions) && message.actions.length > 0 && (
                    <View style={styles.actionsRow}>
                        {message.actions.map((a, i) => (
                            <TouchableOpacity
                                key={`${a.screen}-${i}`}
                                style={styles.actionChip}
                                activeOpacity={0.75}
                                onPress={() => onAction(a)}
                            >
                                <Text style={styles.actionChipTxt}>{a.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </Animated.View>
    );
};

const TypingIndicator = ({ styles }) => (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.bubbleRow, styles.bubbleRowBot]}>
        <View style={styles.avatar}>
            <Ionicons
                name="chatbubble-ellipses"
                size={16}
                color={styles.avatarIconColor.color}
            />
        </View>
        <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
            <View style={styles.typingDotsRow}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, { opacity: 0.6 }]} />
                <View style={[styles.typingDot, { opacity: 0.3 }]} />
            </View>
        </View>
    </Animated.View>
);

const makeStyles = (c, resolved) => {
    const isDark = resolved === 'dark';
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },

        scroll: { flex: 1 },
        scrollContent: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 20,
            gap: 14,
        },

        /* ── Bubble row ──────────────────────────────────────────── */
        bubbleRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
        },
        bubbleRowBot: { justifyContent: 'flex-start' },
        bubbleRowUser: { justifyContent: 'flex-end' },

        avatar: {
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: c.brandSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 2,
        },
        // Exposed as a style key so the <Ionicons> in the component
        // tree can pull its color from the theme without re-reading
        // `colors` (keeps the render tight).
        avatarIconColor: { color: c.brand },

        bubble: {
            maxWidth: '86%',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 18,
        },
        bubbleBot: {
            backgroundColor: c.surface,
            borderTopLeftRadius: 4,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.4 : 0.05,
            shadowRadius: 6,
            elevation: 2,
        },
        bubbleUser: {
            backgroundColor: c.brand,
            borderTopRightRadius: 4,
            shadowColor: c.brand,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
        },
        bubbleTxt: { fontSize: 14.5, lineHeight: 21, fontWeight: '500' },
        bubbleTxtBot: { color: c.text },
        bubbleTxtUser: { color: '#ffffff' },

        /* ── Action chips under a bot bubble ─────────────────────── */
        actionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 8,
            paddingLeft: 2,
        },
        actionChip: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 14,
            backgroundColor: c.brandSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? c.borderStrong : 'transparent',
        },
        actionChipTxt: {
            fontSize: 12,
            fontWeight: '800',
            color: c.brand,
            letterSpacing: 0.2,
        },

        /* ── Typing indicator ────────────────────────────────────── */
        typingBubble: { paddingVertical: 12, paddingHorizontal: 16 },
        typingDotsRow: { flexDirection: 'row', gap: 4 },
        typingDot: {
            width: 7, height: 7, borderRadius: 4,
            backgroundColor: c.muted,
        },

        /* ── Suggested starter prompts ───────────────────────────── */
        suggestWrap: { marginTop: 4 },
        suggestLabel: {
            fontSize: 11,
            fontWeight: '800',
            color: c.subtle,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 10,
            marginLeft: 2,
        },
        suggestRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        suggestChip: {
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 14,
            backgroundColor: c.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
        },
        suggestChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: c.text,
            maxWidth: 240,
        },

        /* ── Input bar ───────────────────────────────────────────── */
        inputBar: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: Platform.OS === 'ios' ? 20 : 12,
            gap: 8,
            backgroundColor: c.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.border,
        },
        input: {
            flex: 1,
            backgroundColor: c.surfaceAlt,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 15,
            color: c.text,
            maxHeight: 120,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
        },
        sendBtn: {
            width: 42, height: 42, borderRadius: 21,
            backgroundColor: c.brand,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: c.brand,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        sendBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },

        footerNote: {
            fontSize: 10,
            color: c.subtle,
            textAlign: 'center',
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 6 : 8,
            backgroundColor: c.surface,
        },
    });
};

export default ChatbotScreen;
