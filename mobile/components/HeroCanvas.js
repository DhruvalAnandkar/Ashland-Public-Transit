import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
    withSequence,
    interpolate,
} from 'react-native-reanimated';

/**
 * HeroCanvas — decorative animated layer for the rider home hero.
 * Floating glass orbs, pulse rings, and a traveling dot create a
 * "live system" feel without requiring real WebGL on RN.
 */

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Floating orb ────────────────────────────────────────────────
const FloatOrb = ({ size, color, left, top, delay = 0, duration = 3200 }) => {
    const y = useSharedValue(0);
    const opacity = useSharedValue(0.35);

    useEffect(() => {
        y.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-12, { duration, easing: Easing.inOut(Easing.ease) }),
                    withTiming(6, { duration, easing: Easing.inOut(Easing.ease) }),
                ),
                -1,
                true,
            ),
        );
        opacity.value = withDelay(
            delay,
            withRepeat(
                withTiming(0.7, { duration: duration * 0.9, easing: Easing.inOut(Easing.ease) }),
                -1,
                true,
            ),
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: y.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.orb,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    left,
                    top,
                },
                style,
            ]}
        />
    );
};

// ─── Pulse ring ──────────────────────────────────────────────────
const PulseRing = ({ color, left, top, delay = 0 }) => {
    const scale = useSharedValue(0.6);
    const opacity = useSharedValue(0.55);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withRepeat(
                withTiming(1.8, { duration: 2600, easing: Easing.out(Easing.ease) }),
                -1,
                false,
            ),
        );
        opacity.value = withDelay(
            delay,
            withRepeat(
                withTiming(0, { duration: 2600, easing: Easing.out(Easing.ease) }),
                -1,
                false,
            ),
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.ring,
                { borderColor: color, left, top },
                style,
            ]}
        />
    );
};

// ─── Traveling vehicle dot ───────────────────────────────────────
const TravelingDot = ({ widthPx }) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.ease) }),
            -1,
            false,
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(progress.value, [0, 1], [-20, widthPx + 20]),
            },
            {
                translateY: interpolate(
                    progress.value,
                    [0, 0.25, 0.5, 0.75, 1],
                    [0, -14, 4, -10, 0],
                ),
            },
        ],
        opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
    }));

    return (
        <Animated.View style={[styles.travelDot, style]}>
            <View style={styles.travelInner} />
            <View style={styles.travelGlow} />
        </Animated.View>
    );
};

const HeroCanvas = ({ height = 180 }) => {
    const w = useMemo(() => SCREEN_W, []);
    return (
        <View style={[styles.wrap, { height }]} pointerEvents="none">
            {/* Soft grid lines for a "HUD" feel */}
            <View style={[styles.gridLine, { top: '25%' }]} />
            <View style={[styles.gridLine, { top: '55%' }]} />
            <View style={[styles.gridLine, { top: '80%' }]} />

            {/* Floating orbs */}
            <FloatOrb size={70} color="rgba(96,165,250,0.45)" left={w * 0.08} top={8} delay={0} duration={3400} />
            <FloatOrb size={44} color="rgba(167,139,250,0.5)" left={w * 0.38} top={44} delay={600} duration={3000} />
            <FloatOrb size={90} color="rgba(56,189,248,0.35)" left={w * 0.7} top={-10} delay={300} duration={3600} />
            <FloatOrb size={30} color="rgba(52,211,153,0.55)" left={w * 0.86} top={60} delay={800} duration={2800} />
            <FloatOrb size={52} color="rgba(244,114,182,0.35)" left={w * 0.2} top={90} delay={1100} duration={3200} />

            {/* Pulse rings at "stations" */}
            <PulseRing color="rgba(255,255,255,0.55)" left={24} top={height - 40} delay={0} />
            <PulseRing color="rgba(255,255,255,0.55)" left={w - 60} top={height - 30} delay={900} />

            {/* Traveling vehicle dot near bottom of hero */}
            <View style={[styles.travelTrack, { top: height - 22 }]}>
                <TravelingDot widthPx={w - 40} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    orb: {
        position: 'absolute',
    },
    ring: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    travelTrack: {
        position: 'absolute',
        left: 20,
        right: 20,
        height: 10,
    },
    travelDot: {
        width: 18,
        height: 18,
        position: 'absolute',
        top: -4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    travelInner: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#fef08a',
    },
    travelGlow: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(250,204,21,0.3)',
    },
});

export default HeroCanvas;
