import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Mobile counterpart to client/src/components/BrandLogo.js.
 *
 * Renders the Ashland Transit brand lockup using a blue→indigo gradient
 * tile with a white bus glyph and a two-line ASHLAND / Transit wordmark.
 *
 * Props:
 *   - size:         'sm' | 'md' | 'lg'  default 'md'
 *   - showWordmark: boolean             default true
 *   - tone:         'auto' | 'onDark' | 'onLight'
 *                   'auto' uses the current theme resolve; use 'onDark'
 *                   over dark gradients (AuthScreen hero) and 'onLight'
 *                   on white/light surfaces.
 *   - style:        extra container style
 */
const SIZE_MAP = {
    sm: { tile: 28, radius: 8, icon: 14, eyebrow: 9, word: 14, gap: 8 },
    md: { tile: 36, radius: 10, icon: 18, eyebrow: 10, word: 16, gap: 10 },
    lg: { tile: 48, radius: 14, icon: 24, eyebrow: 11, word: 20, gap: 12 },
    xl: { tile: 64, radius: 18, icon: 32, eyebrow: 12, word: 26, gap: 14 },
};

const TONE_MAP = {
    onDark: {
        eyebrow: 'rgba(147,197,253,0.95)',
        word: '#ffffff',
    },
    onLight: {
        eyebrow: 'rgba(37,99,235,0.85)',
        word: '#0f172a',
    },
};

const BrandLogo = ({
    size = 'md',
    showWordmark = true,
    tone = 'onLight',
    style,
}) => {
    const s = SIZE_MAP[size] || SIZE_MAP.md;
    const t = TONE_MAP[tone] || TONE_MAP.onLight;

    return (
        <View style={[styles.row, { gap: s.gap }, style]}>
            <LinearGradient
                colors={['#2563eb', '#1d4ed8', '#3730a3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    width: s.tile,
                    height: s.tile,
                    borderRadius: s.radius,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...Platform.select({
                        ios: {
                            shadowColor: '#1d4ed8',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.35,
                            shadowRadius: 12,
                        },
                        android: {
                            elevation: 6,
                        },
                    }),
                }}
            >
                <Ionicons name="bus" size={s.icon} color="#ffffff" />
            </LinearGradient>

            {showWordmark && (
                <View>
                    <Text
                        style={{
                            fontSize: s.eyebrow,
                            fontWeight: '900',
                            letterSpacing: 2.4,
                            color: t.eyebrow,
                            lineHeight: s.eyebrow + 2,
                        }}
                    >
                        ASHLAND
                    </Text>
                    <Text
                        style={{
                            fontSize: s.word,
                            fontWeight: '900',
                            letterSpacing: -0.4,
                            color: t.word,
                            lineHeight: s.word + 2,
                            marginTop: -2,
                        }}
                    >
                        Transit
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default BrandLogo;
