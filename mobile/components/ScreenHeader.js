import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

/**
 * Consistent screen header used across profile / settings / help screens.
 * Mirrors the blue gradient from the RiderHomeScreen for visual continuity.
 */
const ScreenHeader = ({ title, subtitle, onBack, rightAction, gradient }) => {
    const colors = gradient || ['#1e3a8a', '#1e40af', '#2563eb'];
    return (
        <View>
            <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView edges={['top']}>
                    <View style={styles.row}>
                        {onBack ? (
                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onBack();
                                }}
                                style={styles.iconBtn}
                                hitSlop={12}
                            >
                                <Text style={styles.iconTxt}>‹</Text>
                            </TouchableOpacity>
                        ) : <View style={styles.iconBtn} />}
                        <View style={styles.titleBlock}>
                            <Text style={styles.title} numberOfLines={1}>{title}</Text>
                            {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
                        </View>
                        <View style={styles.iconBtn}>
                            {rightAction}
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    gradient: {
        paddingBottom: 20,
        paddingTop: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    iconTxt: {
        color: 'white',
        fontSize: 30,
        fontWeight: '700',
        lineHeight: 30,
        marginTop: -3,
    },
    titleBlock: {
        flex: 1,
        paddingHorizontal: 12,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
});

export default ScreenHeader;
