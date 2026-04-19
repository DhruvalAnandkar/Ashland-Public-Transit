import React, { useEffect } from 'react';
import { StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withSpring,
    Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Floating "Ask APT Assist" bubble that sits above the tab content
 * on every logged-in screen. Tapping it opens the chatbot.
 *
 * Design decisions:
 *   • Bottom-right, above the scroll content but below modals
 *   • Gentle pulse glow so it's discoverable without being annoying
 *   • Tap spring so it feels like a real button
 *   • Theme-aware so it pops in both light and dark
 */
const ChatbotBubble = ({ onPress, bottom = 24, right = 18 }) => {
    const { colors, resolved } = useAppTheme();

    const glow = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        glow.value = withRepeat(
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, [glow]);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: 0.35 + glow.value * 0.35,
        transform: [{ scale: 1 + glow.value * 0.18 }],
    }));

    const scaleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.9, { damping: 12, stiffness: 400 }),
            withSpring(1, { damping: 8, stiffness: 300 }),
        );
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
    };

    const gradient =
        resolved === 'dark'
            ? ['#1d4ed8', '#1e3a8a', '#0b1e5c']
            : ['#3b82f6', '#1d4ed8', '#1e3a8a'];

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFillObject, styles.wrap]}
        >
            <Animated.View
                style={[
                    styles.container,
                    { bottom, right },
                    scaleStyle,
                ]}
                pointerEvents="box-none"
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.glow,
                        { backgroundColor: colors.brand },
                        glowStyle,
                    ]}
                />
                <AnimatedPressable
                    onPress={handlePress}
                    accessibilityRole="button"
                    accessibilityLabel="Open APT Assist chatbot"
                    hitSlop={8}
                    style={styles.press}
                >
                    <LinearGradient
                        colors={gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.fab}
                    >
                        <Ionicons
                            name="chatbubble-ellipses"
                            size={26}
                            color="#ffffff"
                        />
                    </LinearGradient>
                </AnimatedPressable>
            </Animated.View>
        </Animated.View>
    );
};

const SIZE = 58;

const styles = StyleSheet.create({
    wrap: {
        // Let touches pass through everywhere except the FAB itself.
    },
    container: {
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    press: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
    },
    fab: {
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#1e3a8a',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.45,
                shadowRadius: 14,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    glow: {
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
    },
});

export default ChatbotBubble;
