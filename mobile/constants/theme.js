import Constants from 'expo-constants';

const expoConfig = Constants.expoConfig || Constants.manifest || {};
const androidKey = expoConfig.android?.config?.googleMaps?.apiKey;
const iosKey = expoConfig.ios?.config?.googleMapsApiKey;

export const MAPS_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  androidKey ||
  iosKey ||
  '';

if (!MAPS_KEY) {
  console.warn('MAPS_KEY is missing. Add a Google Maps Places API key to app.json or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
}
