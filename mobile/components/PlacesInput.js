import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Text,
    ActivityIndicator,
} from 'react-native';
import { MAPS_KEY } from '../constants/theme';

const ASHLAND_CENTER = { latitude: 40.8688, longitude: -82.3179 };

const PlacesInput = ({ placeholder, onSelect, value, listZIndex = 99999, onFocus }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [error, setError] = useState('');
    const [showList, setShowList] = useState(false);

    const normalizedValue = useMemo(() => (value || '').trim().toLowerCase(), [value]);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const query = inputValue.trim();
        if (!query || query.length < 2 || query.toLowerCase() === normalizedValue) {
            setSuggestions([]);
            setShowList(false);
            setError('');
            return;
        }

        if (!MAPS_KEY) {
            setError('Google Places key is missing.');
            setSuggestions([]);
            setShowList(false);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsLoading(true);
            setError('');

            try {
                const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': MAPS_KEY,
                        'X-Goog-FieldMask':
                            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
                    },
                    body: JSON.stringify({
                        input: query,
                        languageCode: 'en',
                        includedRegionCodes: ['us'],
                        locationBias: {
                            circle: {
                                center: ASHLAND_CENTER,
                                radius: 50000,
                            },
                        },
                    }),
                    signal: controller.signal,
                });

                const payload = await response.json();
                if (!response.ok) {
                    const apiMessage = payload?.error?.message || 'Places autocomplete failed.';
                    throw new Error(apiMessage);
                }

                const mapped = (payload?.suggestions || [])
                    .map((entry) => entry?.placePrediction)
                    .filter(Boolean)
                    .map((prediction) => ({
                        placeId: prediction.placeId,
                        primaryText:
                            prediction?.structuredFormat?.mainText?.text ||
                            prediction?.text?.text ||
                            '',
                        secondaryText: prediction?.structuredFormat?.secondaryText?.text || '',
                        description:
                            prediction?.text?.text ||
                            [
                                prediction?.structuredFormat?.mainText?.text,
                                prediction?.structuredFormat?.secondaryText?.text,
                            ]
                                .filter(Boolean)
                                .join(', '),
                    }))
                    .filter((item) => item.placeId && item.description);

                setSuggestions(mapped);
                setShowList(mapped.length > 0);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    const msg = err.message || 'Could not load suggestions.';
                    setError(msg);
                    setSuggestions([]);
                    setShowList(false);
                }
            } finally {
                setIsLoading(false);
            }
        }, 280);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [inputValue, normalizedValue]);

    const handleSelectPlace = async (item) => {
        if (!item?.placeId || !MAPS_KEY || isResolving) return;

        setIsResolving(true);
        setError('');

        try {
            const response = await fetch(`https://places.googleapis.com/v1/places/${item.placeId}`, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': MAPS_KEY,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
                },
            });

            const payload = await response.json();
            if (!response.ok) {
                const apiMessage = payload?.error?.message || 'Place details failed.';
                throw new Error(apiMessage);
            }

            const latitude = payload?.location?.latitude;
            const longitude = payload?.location?.longitude;
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                throw new Error('Selected place has no coordinates.');
            }

            const placeName =
                payload?.formattedAddress ||
                payload?.displayName?.text ||
                item.description;

            setInputValue(placeName);
            setSuggestions([]);
            setShowList(false);

            if (onSelect) {
                onSelect({
                    name: placeName,
                    latitude,
                    longitude,
                });
            }
        } catch (err) {
            const msg = err.message || 'Could not select this place.';
            setError(msg);
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputWrap}>
                <TextInput
                    style={styles.input}
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder={placeholder || 'Search'}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onFocus={() => {
                        if (onFocus) onFocus();
                        setShowList(suggestions.length > 0);
                    }}
                />
                {(isLoading || isResolving) && (
                    <View style={styles.spinnerWrap}>
                        <ActivityIndicator size="small" color="#2563eb" />
                    </View>
                )}
            </View>

            {showList && suggestions.length > 0 && (
                <View style={[styles.listView, { zIndex: listZIndex }]}>
                    {suggestions.slice(0, 8).map((item) => (
                        <TouchableOpacity
                            key={item.placeId}
                            style={styles.row}
                            onPress={() => handleSelectPlace(item)}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.primaryText} numberOfLines={1}>
                                {item.primaryText || item.description}
                            </Text>
                            {!!item.secondaryText && (
                                <Text style={styles.secondaryText} numberOfLines={1}>
                                    {item.secondaryText}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {!!error && (
                <Text style={styles.errorText} numberOfLines={3}>
                    {error}
                </Text>
            )}
            {!MAPS_KEY && (
                <Text style={styles.errorText} numberOfLines={3}>
                    Missing Google API key for places search.
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        zIndex: 9999,
        overflow: 'visible',
    },
    inputWrap: {
        position: 'relative',
        width: '100%',
    },
    input: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        fontSize: 16,
        color: '#1f2937',
        fontWeight: '500',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    spinnerWrap: {
        position: 'absolute',
        right: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listView: {
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 12,
        elevation: 50,
        maxHeight: 240,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    row: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    primaryText: {
        fontSize: 14,
        color: '#1f2937',
        fontWeight: '600',
    },
    secondaryText: {
        marginTop: 2,
        fontSize: 12,
        color: '#64748b',
    },
    errorText: {
        marginTop: 6,
        fontSize: 11,
        color: '#dc2626',
        fontWeight: '600',
    },
});

export default PlacesInput;
