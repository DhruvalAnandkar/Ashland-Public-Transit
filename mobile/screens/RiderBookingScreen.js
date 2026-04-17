import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  createRide,
  createRideCheckoutSession,
  verifyRideCheckoutSession,
} from "../services/api";
import PlacesInput from "../components/PlacesInput";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const EDGE = 20;

const ASHLAND_REGION = {
  latitude: 40.8688,
  longitude: -82.3179,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/* Fresh unique icons — never used by other screens */
const STEPS = [
  { label: "Route", icon: "location-outline" },
  { label: "Details", icon: "list-outline" },
  { label: "Confirm", icon: "shield-checkmark-outline" },
];

const USER_TYPES = [
  { key: "General", label: "Standard", icon: "person-outline" },
  { key: "Senior", label: "Senior", icon: "people-outline" },
  { key: "Student", label: "Student", icon: "school-outline" },
  { key: "Veteran", label: "Veteran", icon: "ribbon-outline" },
  { key: "Elderly/Disabled", label: "Elderly", icon: "accessibility-outline" },
  { key: "Child", label: "Child", icon: "happy-outline" },
];

const showToast = (msg) => {
  if (Platform.OS === "android") {
    ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
  } else {
    Alert.alert("Notice", msg);
  }
};

const isValidCoord = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/* ─── ANIMATED BUTTON ─────────────────────────────────────────── */
const PressableButton = ({ children, onPress, style, colors }) => {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.95, { damping: 12, stiffness: 400 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };
  return (
    <AnimatedTouchable
      style={[scaleStyle, style]}
      onPress={handlePress}
      activeOpacity={1}
    >
      {colors ? (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientInner, style]}
        >
          {children}
        </LinearGradient>
      ) : (
        children
      )}
    </AnimatedTouchable>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN BOOKING SCREEN
   ═══════════════════════════════════════════════════════════════════ */
const RiderBookingScreen = ({ navigation, route }) => {
  const scheduledMode = route?.params?.scheduledMode || false;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [step, setStep] = useState(0);
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [userType, setUserType] = useState("General");
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 30 * 60 * 1000),
  );
  const [showDatePicker, setShowDatePicker] = useState(scheduledMode);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSameDay, setIsSameDay] = useState(!scheduledMode);
  const [isOutOfTown, setIsOutOfTown] = useState(false);
  const [mileage, setMileage] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [selectingMode, setSelectingMode] = useState(null);
  const mapRef = useRef(null);

  const pickupCoord =
    pickup && isValidCoord(pickup.latitude, pickup.longitude)
      ? { latitude: pickup.latitude, longitude: pickup.longitude }
      : null;
  const dropoffCoord =
    dropoff && isValidCoord(dropoff.latitude, dropoff.longitude)
      ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
      : null;

  useEffect(() => {
    SecureStore.getItemAsync("user").then((str) => {
      if (str) setUser(JSON.parse(str));
    });
  }, []);

  useEffect(() => {
    if (
      pickup &&
      dropoff &&
      mapRef.current &&
      isValidCoord(pickup.latitude, pickup.longitude) &&
      isValidCoord(dropoff.latitude, dropoff.longitude)
    ) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: dropoff.latitude, longitude: dropoff.longitude },
        ],
        {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        },
      );
    }
  }, [pickup, dropoff]);

  const sanitizePlace = (place) => {
    if (!place) return null;
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!isValidCoord(latitude, longitude)) return null;
    return { ...place, latitude, longitude };
  };

  const handleSelectPickup = (place) => {
    const sanitized = sanitizePlace(place);
    if (!sanitized) {
      showToast("Invalid pickup coordinates.");
      return;
    }
    setPickup(sanitized);
  };

  const handleSelectDropoff = (place) => {
    const sanitized = sanitizePlace(place);
    if (!sanitized) {
      showToast("Invalid drop-off coordinates.");
      return;
    }
    setDropoff(sanitized);
  };

  const handleMapPress = (e) => {
    if (!selectingMode) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const locationName = `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    const location = { name: locationName, latitude, longitude };
    if (selectingMode === "pickup") setPickup(location);
    else if (selectingMode === "dropoff") setDropoff(location);
    setSelectingMode(null);
    showToast(
      `${selectingMode === "pickup" ? "Pickup" : "Dropoff"} location set!`,
    );
  };

  const estimateFare = () => {
    const RATES = {
      General: 2.0,
      Standard: 2.0,
      Senior: 1.0,
      Student: 1.5,
      Veteran: 0.0,
      "Elderly/Disabled": 1.0,
      Child: 1.0,
    };
    let baseFare = RATES[userType] || 2.0;
    if (isSameDay && ["General", "Standard", "Student"].includes(userType))
      baseFare += 1.0;
    let total = baseFare;
    if (passengerCount > 1 && baseFare > 0) {
      total += (baseFare / 2) * (passengerCount - 1);
    }
    if (isOutOfTown && mileage > 0) total += mileage * 2.5;
    return total.toFixed(2);
  };

  const goBack = () => {
    if (step === 0) {
      navigation?.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const goNext = () => {
    if (step === 0) {
      if (!pickup) {
        showToast("Please select a pickup location.");
        return;
      }
      if (!dropoff) {
        showToast("Please select a drop-off location.");
        return;
      }
      if (!isValidCoord(pickup.latitude, pickup.longitude)) {
        showToast("Pickup invalid.");
        return;
      }
      if (!isValidCoord(dropoff.latitude, dropoff.longitude)) {
        showToast("Drop-off invalid.");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const minFutureTime = new Date(now.getTime() + 2 * 60 * 1000);
      const finalScheduledTime =
        scheduledDate < minFutureTime ? minFutureTime : scheduledDate;

      const rideData = {
        passengerName: user?.username || "Mobile Rider",
        phoneNumber: user?.phoneNumber || "000-0000",
        pickup: pickup?.name || "Unknown",
        pickupCoordinates: pickup
          ? { type: "Point", coordinates: [pickup.longitude, pickup.latitude] }
          : undefined,
        dropoff: dropoff?.name || "Unknown",
        dropoffCoordinates: dropoff
          ? {
              type: "Point",
              coordinates: [dropoff.longitude, dropoff.latitude],
            }
          : undefined,
        userType,
        isSameDay,
        passengers: passengerCount,
        isOutOfTown,
        mileage,
        scheduledTime: finalScheduledTime.toISOString(),
        riderId: user?._id || user?.id,
        paymentMethod,
      };
      const newRide = await createRide(rideData);

      if (paymentMethod === "Stripe") {
        const ticketEnc = encodeURIComponent(newRide.ticketId);
        const expoBase = Linking.createURL("/").split("?")[0].split("#")[0];
        const apiBase = api.defaults.baseURL || "";
        const httpOrigin = apiBase.replace(/\/api\/?$/i, "");
        if (!/^https?:\/\//i.test(httpOrigin)) {
          showToast("Stripe return needs your API on http(s)://…");
          return;
        }
        const bridgePath = "/api/rides/payments/expo-return";
        const bridgePrefix = `${httpOrigin}${bridgePath}`;
        const successUrl = `${bridgePrefix}?expo=${encodeURIComponent(expoBase)}&ticketId=${ticketEnc}&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${bridgePrefix}?expo=${encodeURIComponent(expoBase)}&ticketId=${ticketEnc}&status=cancel`;
        const checkout = await createRideCheckoutSession(newRide._id, {
          source: "mobile",
          successUrl,
          cancelUrl,
        });
        if (checkout?.url) {
          try {
            const authResult = await WebBrowser.openAuthSessionAsync(
              checkout.url,
              bridgePrefix,
              { createTask: false },
            );
            if (authResult.type === "success" && authResult.url) {
              const parsed = Linking.parse(authResult.url);
              const rawStatus = parsed.queryParams?.status;
              const rawSession = parsed.queryParams?.session_id;
              const status = Array.isArray(rawStatus)
                ? rawStatus[0]
                : rawStatus;
              const sessionId = Array.isArray(rawSession)
                ? rawSession[0]
                : rawSession;
              const sidOk = sessionId && sessionId !== "{CHECKOUT_SESSION_ID}";
              if (status === "cancel") {
                showToast("Payment was cancelled.");
              } else if (sidOk && status !== "cancel") {
                try {
                  await verifyRideCheckoutSession(sessionId, newRide.ticketId);
                } catch {}
              }
            }
          } catch {
            showToast("Payment window closed — checking ride status…");
          }

          let rideToShow = newRide;
          for (let attempt = 0; attempt < 45 && mountedRef.current; attempt++) {
            try {
              const { data } = await api.get(`/rides/${newRide._id}`);
              rideToShow = data;
              if (data?.paymentStatus === "Paid") break;
            } catch {
              break;
            }
            await new Promise((r) => setTimeout(r, 1000));
          }
          if (mountedRef.current && navigation)
            navigation.replace("RiderTrackingScreen", { ride: rideToShow });
        } else if (checkout?.mockPaid) {
          showToast("Payment successful (test mode)!");
          try {
            const freshRes = await api.get(`/rides/${newRide._id}`);
            if (navigation)
              navigation.replace("RiderTrackingScreen", {
                ride: freshRes.data || newRide,
              });
          } catch {
            if (navigation)
              navigation.replace("RiderTrackingScreen", { ride: newRide });
          }
        }
        return;
      }

      showToast("Ride booked! Ticket: " + newRide.ticketId);
      if (navigation)
        navigation.replace("RiderTrackingScreen", { ride: newRide });
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || "Booking failed.";
      showToast("Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  /* ─── RENDER ────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      {/* ══ HEADER ════════════════════════════════════════════ */}
      <LinearGradient
        colors={["#1e3a8a", "#1e40af", "#2563eb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="chevron-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book a Ride</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      {/* ══ STEP INDICATOR ═════════════════════════════════════ */}
      <Animated.View entering={FadeInDown.delay(80).springify()}>
        <View style={styles.stepBar}>
          {STEPS.map((s, i) => {
            const isDone = i < step;
            const isActive = i === step;
            return (
              <React.Fragment key={s.label}>
                {/* Connector line BEFORE step (except first) */}
                {i > 0 && (
                  <View
                    style={[styles.stepLine, isDone && styles.stepLineDone]}
                  />
                )}
                <TouchableOpacity
                  style={styles.stepItem}
                  onPress={() => {
                    if (i < step) setStep(i);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isDone && styles.stepCircleDone,
                    ]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    ) : (
                      <Ionicons
                        name={s.icon}
                        size={15}
                        color={isActive ? "#3b82f6" : "#94a3b8"}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isActive && styles.stepLabelActive,
                      isDone && styles.stepLabelDone,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </Animated.View>

      {/* ══ SCROLLABLE BODY ═══════════════════════════════════ */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ STEP 0 — ROUTE ═══════════════════════════════ */}
        {step === 0 && (
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            {/* Map */}
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFillObject}
                initialRegion={ASHLAND_REGION}
                showsUserLocation
                onPress={handleMapPress}
              >
                {pickupCoord && (
                  <Marker
                    coordinate={pickupCoord}
                    title="Pickup"
                    pinColor="#22c55e"
                  />
                )}
                {dropoffCoord && (
                  <Marker
                    coordinate={dropoffCoord}
                    title="Drop-off"
                    pinColor="#ef4444"
                  />
                )}
                {pickupCoord && dropoffCoord && (
                  <Polyline
                    coordinates={[pickupCoord, dropoffCoord]}
                    strokeColor="#3b82f6"
                    strokeWidth={3}
                    lineDashPattern={[8, 4]}
                  />
                )}
              </MapView>
              {selectingMode && (
                <View style={styles.mapHintOverlay}>
                  <Text style={styles.mapHintText}>
                    Tap the map to set{" "}
                    {selectingMode === "pickup" ? "pickup" : "drop-off"}
                  </Text>
                </View>
              )}
            </View>

            {/* Location Inputs Card */}
            <View style={styles.inputsCard}>
              {/* Pickup */}
              <View style={[styles.locationSection, { zIndex: 100 }]}>
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationLabelRow}>
                    <View
                      style={[
                        styles.locationDot,
                        { backgroundColor: "#22c55e" },
                      ]}
                    />
                    <Text style={styles.locationLabel}>Pickup</Text>
                  </View>
                  {pickup && (
                    <TouchableOpacity
                      onPress={() => setPickup(null)}
                      style={styles.clearBtn}
                    >
                      <Text style={styles.clearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.inputRow}>
                  <View style={styles.placesWrapper}>
                    <PlacesInput
                      placeholder="Search pickup address…"
                      value={pickup?.name || ""}
                      onSelect={handleSelectPickup}
                      listZIndex={99999}
                      onFocus={() => setSelectingMode(null)}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.pinBtn,
                      selectingMode === "pickup" && styles.pinBtnActive,
                    ]}
                    onPress={() =>
                      setSelectingMode(
                        selectingMode === "pickup" ? null : "pickup",
                      )
                    }
                  >
                    <Ionicons
                      name="locate-outline"
                      size={18}
                      color={selectingMode === "pickup" ? "#3b82f6" : "#94a3b8"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Route connector */}
              <View style={styles.routeConnectorWrap}>
                <View style={styles.routeConnectorDots}>
                  <View style={styles.connectorDot} />
                  <View style={styles.connectorDot} />
                  <View style={styles.connectorDot} />
                </View>
              </View>

              {/* Drop-off */}
              <View style={[styles.locationSection, { zIndex: 1 }]}>
                <View style={styles.locationHeaderRow}>
                  <View style={styles.locationLabelRow}>
                    <View
                      style={[
                        styles.locationDot,
                        { backgroundColor: "#ef4444" },
                      ]}
                    />
                    <Text style={styles.locationLabel}>Drop-off</Text>
                  </View>
                  {dropoff && (
                    <TouchableOpacity
                      onPress={() => setDropoff(null)}
                      style={styles.clearBtn}
                    >
                      <Text style={styles.clearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.inputRow}>
                  <View style={styles.placesWrapper}>
                    <PlacesInput
                      placeholder="Search drop-off address…"
                      value={dropoff?.name || ""}
                      onSelect={handleSelectDropoff}
                      listZIndex={9999}
                      onFocus={() => setSelectingMode(null)}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.pinBtn,
                      selectingMode === "dropoff" && styles.pinBtnActive,
                    ]}
                    onPress={() =>
                      setSelectingMode(
                        selectingMode === "dropoff" ? null : "dropoff",
                      )
                    }
                  >
                    <Ionicons
                      name="locate-outline"
                      size={18}
                      color={
                        selectingMode === "dropoff" ? "#3b82f6" : "#94a3b8"
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ═══ STEP 1 — DETAILS ════════════════════════════ */}
        {step === 1 && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.detailsSection}
          >
            {/* Passenger Type */}
            <Text style={styles.fieldTitle}>Rider Category</Text>
            <View style={styles.typeGrid}>
              {USER_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    userType === type.key && styles.typeCardActive,
                  ]}
                  onPress={() => {
                    setUserType(type.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={type.icon}
                    size={22}
                    color={userType === type.key ? "#2563eb" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      userType === type.key && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Passenger Count */}
            <Text style={styles.fieldTitle}>Passengers</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() =>
                  setPassengerCount(Math.max(1, passengerCount - 1))
                }
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.counterDisplay}>
                <Text style={styles.counterVal}>{passengerCount}</Text>
              </View>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() =>
                  setPassengerCount(Math.min(10, passengerCount + 1))
                }
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Date & Time */}
            <Text style={styles.fieldTitle}>Schedule</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#64748b" />
              <View style={styles.dateBtnTextWrap}>
                <Text style={styles.dateBtnDate}>
                  {scheduledDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text style={styles.dateBtnTime}>
                  {scheduledDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Text style={styles.dateBtnArrow}>›</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(e, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setScheduledDate(date);
                    setShowTimePicker(true);
                  }
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="time"
                display="default"
                onChange={(e, date) => {
                  setShowTimePicker(false);
                  if (date) setScheduledDate(date);
                }}
              />
            )}

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleCard}>
                <Text style={styles.toggleLabel}>Same Day</Text>
                <TouchableOpacity
                  style={[styles.toggle, isSameDay && styles.toggleOn]}
                  onPress={() => setIsSameDay(!isSameDay)}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      isSameDay && styles.toggleThumbOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.toggleCard}>
                <Text style={styles.toggleLabel}>Out of Town</Text>
                <TouchableOpacity
                  style={[styles.toggle, isOutOfTown && styles.toggleOn]}
                  onPress={() => setIsOutOfTown(!isOutOfTown)}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      isOutOfTown && styles.toggleThumbOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isOutOfTown && (
              <>
                <Text style={styles.fieldTitle}>Estimated Miles</Text>
                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setMileage(Math.max(1, mileage - 1))}
                  >
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.counterDisplay}>
                    <Text style={styles.counterVal}>{mileage} mi</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setMileage(mileage + 1)}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Payment */}
            <Text style={styles.fieldTitle}>Payment</Text>
            <View style={styles.paymentRow}>
              {[
                { key: "Cash", icon: "cash-outline", label: "Cash" },
                { key: "Stripe", icon: "card-outline", label: "Card" },
              ].map((pm) => (
                <TouchableOpacity
                  key={pm.key}
                  style={[
                    styles.paymentBtn,
                    paymentMethod === pm.key && styles.paymentBtnActive,
                  ]}
                  onPress={() => {
                    setPaymentMethod(pm.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={pm.icon}
                    size={22}
                    color={paymentMethod === pm.key ? "#2563eb" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.paymentLabel,
                      paymentMethod === pm.key && styles.paymentLabelActive,
                    ]}
                  >
                    {pm.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ═══ STEP 2 — CONFIRM ════════════════════════════ */}
        {step === 2 && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.confirmSection}
          >
            <Text style={styles.confirmTitle}>Review & Confirm</Text>

            {/* Fare Card */}
            <LinearGradient
              colors={["#0f172a", "#1e293b"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fareCard}
            >
              <View style={styles.fareGlow} />
              <Text style={styles.fareCaption}>ESTIMATED FARE</Text>
              <Text style={styles.fareAmount}>${estimateFare()}</Text>
              <Text style={styles.fareMeta}>
                {passengerCount} pax · {userType}
              </Text>
            </LinearGradient>

            {/* Summary List */}
            <View style={styles.summaryCard}>
              {[
                {
                  icon: "location",
                  color: "#22c55e",
                  label: "Pickup",
                  value: pickup?.name || "—",
                },
                {
                  icon: "location",
                  color: "#ef4444",
                  label: "Drop-off",
                  value: dropoff?.name || "—",
                },
                {
                  icon: "calendar-outline",
                  color: "#3b82f6",
                  label: "Schedule",
                  value: `${scheduledDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
                },
                {
                  icon: "people-outline",
                  color: "#8b5cf6",
                  label: "Riders",
                  value: `${passengerCount} · ${userType}`,
                },
                {
                  icon:
                    paymentMethod === "Stripe"
                      ? "card-outline"
                      : "cash-outline",
                  color: "#f59e0b",
                  label: "Payment",
                  value: paymentMethod === "Stripe" ? "Card (Stripe)" : "Cash",
                },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <View style={styles.summaryRow}>
                    <View
                      style={[
                        styles.summaryIconWrap,
                        { backgroundColor: item.color + "18" },
                      ]}
                    >
                      <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <View style={styles.summaryTextBlock}>
                      <Text style={styles.summaryLabel}>{item.label}</Text>
                      <Text style={styles.summaryValue} numberOfLines={2}>
                        {item.value}
                      </Text>
                    </View>
                  </View>
                  {i < arr.length - 1 && <View style={styles.summaryDivider} />}
                </React.Fragment>
              ))}
            </View>

            {/* Confirm Button */}
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Booking your ride…</Text>
              </View>
            ) : (
              <PressableButton
                colors={
                  paymentMethod === "Stripe"
                    ? ["#4f46e5", "#6366f1"]
                    : ["#059669", "#047857"]
                }
                onPress={handleConfirm}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmBtnText}>
                  {paymentMethod === "Stripe"
                    ? "Continue to Payment"
                    : "Confirm Booking"}
                </Text>
              </PressableButton>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* ══ BOTTOM NAVIGATION ═════════════════════════════════ */}
      {step < 2 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
            <LinearGradient
              colors={["#1e3a8a", "#2563eb"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>
                {step === 0 ? "Continue to Details" : "Review Booking"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={17}
                color="rgba(255,255,255,0.85)"
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — consistent EDGE padding, aligned grid, pixel-perfect spacing
   ═══════════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4f8" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: EDGE,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: "white",
  },
  headerSpacer: { width: 38 },

  /* Step Indicator */
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: EDGE + 8,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  stepItem: { alignItems: "center", width: 56 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  stepCircleActive: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  stepCircleDone: { backgroundColor: "#059669", borderColor: "#059669" },

  stepLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  stepLabelActive: { color: "#2563eb", fontWeight: "800" },
  stepLabelDone: { color: "#059669" },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 2,
    marginBottom: 18,
  },
  stepLineDone: { backgroundColor: "#059669" },

  /* Body */
  body: { flex: 1 },
  bodyContent: { paddingBottom: 110 },

  /* Map */
  mapContainer: {
    height: 200,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  mapHintOverlay: {
    position: "absolute",
    top: 12,
    left: EDGE,
    right: EDGE,
    backgroundColor: "rgba(37,99,235,0.92)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  mapHintText: {
    color: "white",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },

  /* Location Inputs Card */
  inputsCard: {
    backgroundColor: "white",
    marginHorizontal: EDGE,
    marginTop: -16,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    overflow: "visible",
    zIndex: 10,
  },
  locationSection: {},
  locationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  locationLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationDot: { width: 8, height: 8, borderRadius: 4 },
  locationLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  placesWrapper: { flex: 1, zIndex: 999, overflow: "visible" },
  pinBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  pinBtnActive: { backgroundColor: "#dbeafe", borderColor: "#3b82f6" },

  /* Route connector between pickup/dropoff */
  routeConnectorWrap: { paddingLeft: 3, marginVertical: 8 },
  routeConnectorDots: { alignItems: "center", width: 8, gap: 3 },
  connectorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#cbd5e1",
  },

  /* ── Details section ───────────────────────────────────────── */
  detailsSection: {
    backgroundColor: "white",
    margin: EDGE,
    padding: 20,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  fieldTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeCard: {
    width: (width - EDGE * 2 - 40 - 16) / 3,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 3,
  },
  typeCardActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },

  typeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  typeLabelActive: { color: "#2563eb" },

  counterRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  counterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  counterBtnText: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  counterDisplay: {
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    alignItems: "center",
  },
  counterVal: { fontSize: 18, fontWeight: "900", color: "#0f172a" },

  /* Date Button */
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },

  dateBtnTextWrap: { flex: 1 },
  dateBtnDate: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  dateBtnTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },
  dateBtnArrow: { fontSize: 22, color: "#94a3b8", fontWeight: "300" },

  /* Toggles */
  toggleRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  toggleCard: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toggleLabel: { fontSize: 12, fontWeight: "700", color: "#374151" },
  toggle: {
    width: 44,
    height: 24,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#059669" },
  toggleThumb: {
    width: 20,
    height: 20,
    backgroundColor: "white",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { transform: [{ translateX: 20 }] },

  /* Payment */
  paymentRow: { flexDirection: "row", gap: 10 },
  paymentBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 3,
  },
  paymentBtnActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },

  paymentLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  paymentLabelActive: { color: "#2563eb" },

  /* ── Confirm section ───────────────────────────────────────── */
  confirmSection: {
    margin: EDGE,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 16,
  },
  fareCard: {
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  fareGlow: {
    position: "absolute",
    top: -25,
    right: -25,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  fareCaption: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 2,
  },
  fareAmount: {
    fontSize: 44,
    fontWeight: "900",
    color: "white",
    marginTop: 2,
    letterSpacing: -1,
  },
  fareMeta: { fontSize: 11, fontWeight: "700", color: "#94a3b8", marginTop: 4 },

  /* Summary */
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTextBlock: { flex: 1 },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 1,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 12,
  },

  loadingBox: { alignItems: "center", padding: 20, gap: 10 },
  loadingText: { fontSize: 14, fontWeight: "700", color: "#64748b" },
  confirmBtn: { borderRadius: 14, overflow: "hidden" },
  gradientInner: { padding: 16, borderRadius: 14, alignItems: "center" },
  confirmBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  /* Bottom Bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: EDGE,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    gap: 6,
  },
  nextBtnText: { color: "white", fontSize: 15, fontWeight: "900" },
});

export default RiderBookingScreen;
