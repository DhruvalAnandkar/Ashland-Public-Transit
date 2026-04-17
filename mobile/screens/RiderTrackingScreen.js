import React, { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import QRCode from "react-native-qrcode-svg";
import { io } from "socket.io-client";
import Constants from "expo-constants";
import api, { downloadRideReceipt } from "../services/api";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const SOCKET_URL = (() => {
  const host = Constants.expoConfig?.hostUri?.split(":")[0] || "localhost";
  return `http://${host}:5000`;
})();

const ASHLAND_REGION = {
  latitude: 40.8688,
  longitude: -82.3179,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
const ETA_CITY_SPEED_MPH = 22;

const STATUS_THEME = {
  Pending: {
    color: "#f59e0b",
    bg: "#fef3c7",
    gradient: ["#fef3c7", "#fde68a"],
    label: "Pending Confirmation",
    ionIcon: "time-outline",
  },
  Confirmed: {
    color: "#2563eb",
    bg: "#eff6ff",
    gradient: ["#eff6ff", "#dbeafe"],
    label: "Confirmed",
    ionIcon: "checkmark-circle-outline",
  },
  "En-Route": {
    color: "#3b82f6",
    bg: "#dbeafe",
    gradient: ["#dbeafe", "#bfdbfe"],
    label: "Driver On The Way",
    ionIcon: "navigate-circle-outline",
  },
  Completed: {
    color: "#10b981",
    bg: "#d1fae5",
    gradient: ["#d1fae5", "#a7f3d0"],
    label: "Ride Completed",
    ionIcon: "checkmark-done-circle-outline",
  },
  Cancelled: {
    color: "#ef4444",
    bg: "#fee2e2",
    gradient: ["#fee2e2", "#fecaca"],
    label: "Ride Cancelled",
    ionIcon: "close-circle-outline",
  },
};

const STAR_LABELS = ["Terrible", "Poor", "Okay", "Good", "Excellent"];

const showToast = (msg) => {
  if (Platform.OS === "android") {
    ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
  } else {
    Alert.alert("Notice", msg);
  }
};

const toValidCoord = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { latitude: lat, longitude: lng };
  }
  return null;
};

const haversineMiles = (from, to) => {
  if (!from || !to) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 0.621371;
};

const estimateEtaMinutes = (distanceMiles, mph = ETA_CITY_SPEED_MPH) => {
  if (
    !Number.isFinite(distanceMiles) ||
    distanceMiles < 0 ||
    !Number.isFinite(mph) ||
    mph <= 0
  )
    return null;
  return Math.max(1, Math.round((distanceMiles / mph) * 60));
};

const formatEta = (minutes) => {
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `~${hours}h` : `~${hours}h ${rem}m`;
};

// ─── PULSING LIVE DOT ────────────────────────────────────────────────────
const LivePulse = () => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "rgba(59,130,246,0.3)",
          },
          pulseStyle,
        ]}
      />
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#3b82f6",
        }}
      />
    </View>
  );
};

const RiderTrackingScreen = ({ navigation, route }) => {
  const [ride, setRide] = useState(route?.params?.ride || null);
  const [loading, setLoading] = useState(!route?.params?.ride);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState({
    visible: false,
    iconName: "",
    title: "",
    msg: "",
  });
  const [driverLiveCoord, setDriverLiveCoord] = useState(null);
  const [driverLastUpdateAt, setDriverLastUpdateAt] = useState(null);
  const pollInterval = useRef(null);
  const socketRef = useRef(null);

  const openComingSoon = (iconName, title, msg) =>
    setShowComingSoon({ visible: true, iconName, title, msg });

  const fetchRide = async (id) => {
    try {
      const res = await api.get(`/rides/${id}`);
      setRide(res.data);
    } catch (err) {
      console.error("Tracking poll error", err);
    }
  };

  useEffect(() => {
    if (!ride) return;
    if (ride.status === "Completed" || ride.status === "Cancelled") return;
    pollInterval.current = setInterval(() => fetchRide(ride._id), 8000);
    return () => clearInterval(pollInterval.current);
  }, [ride?.status]);

  useEffect(() => {
    if (!ride?._id) return;
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      if (ride?.riderId) socket.emit("join_client_room", String(ride.riderId));
      socket.emit("join_client_room", String(ride._id));
    });
    socket.on("ride_status_changed", (updatedRide) => {
      if (updatedRide?._id === ride._id) setRide(updatedRide);
    });
    socket.on("driver_location_update", (payload) => {
      const coords = payload?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const normalized = toValidCoord(coords[1], coords[0]);
        if (normalized) {
          setDriverLiveCoord(normalized);
          setDriverLastUpdateAt(Date.now());
        }
      }
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [ride?._id, ride?.riderId]);

  const handleCancel = () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelLoading(true);
          try {
            await api.patch(`/rides/${ride._id}/status`, {
              status: "Cancelled",
            });
            setRide((prev) => ({ ...prev, status: "Cancelled" }));
            clearInterval(pollInterval.current);
            showToast("Ride cancelled.");
          } catch (err) {
            showToast(
              "Failed to cancel: " +
                (err?.response?.data?.message || err.message),
            );
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  };

  const handleRate = async (stars) => {
    setRating(stars);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/rides/${ride._id}/rate`, { rating: stars });
    } catch {}
    showToast("Thanks for your feedback!");
    setRatingSubmitted(true);
  };

  const goHome = () => {
    if (navigation) navigation.popToTop();
  };

  const statusRaw = String(ride?.status || "");
  const statusNorm = statusRaw.toLowerCase().replace(/[^a-z]/g, "");
  const isEnRoute = statusNorm === "enroute";
  const isConfirmed = statusNorm === "confirmed";
  const isLive = isConfirmed || isEnRoute;
  const isCompleted = statusNorm === "completed";
  const isCancelled = statusNorm === "cancelled";
  const theme =
    STATUS_THEME[ride?.status] ||
    (isEnRoute
      ? STATUS_THEME["En-Route"]
      : isConfirmed
        ? STATUS_THEME.Confirmed
        : isCompleted
          ? STATUS_THEME.Completed
          : isCancelled
            ? STATUS_THEME.Cancelled
            : STATUS_THEME.Pending);

  if (loading || !ride) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  const pickupCoord = ride.pickupCoordinates?.coordinates
    ? toValidCoord(
        ride.pickupCoordinates.coordinates[1],
        ride.pickupCoordinates.coordinates[0],
      )
    : ride.pickupCoords
      ? toValidCoord(ride.pickupCoords.lat, ride.pickupCoords.lng)
      : null;
  const dropoffCoord = ride.dropoffCoordinates?.coordinates
    ? toValidCoord(
        ride.dropoffCoordinates.coordinates[1],
        ride.dropoffCoordinates.coordinates[0],
      )
    : ride.dropoffCoords
      ? toValidCoord(ride.dropoffCoords.lat, ride.dropoffCoords.lng)
      : null;
  const driverCoord =
    driverLiveCoord ||
    (ride.driverCoordinates?.coordinates
      ? toValidCoord(
          ride.driverCoordinates.coordinates[1],
          ride.driverCoordinates.coordinates[0],
        )
      : null);
  const driverDistanceMiles =
    isLive && driverCoord && pickupCoord
      ? haversineMiles(driverCoord, pickupCoord)
      : null;
  const etaMinutes =
    driverDistanceMiles !== null
      ? estimateEtaMinutes(driverDistanceMiles)
      : null;
  const etaText = formatEta(etaMinutes);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── MAP ────────────────────────────────────────── */}
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ width: "100%", height: "100%" }}
            initialRegion={ASHLAND_REGION}
            showsUserLocation
            showsMyLocationButton={false}
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
            {isLive && driverCoord && (
              <Marker
                coordinate={driverCoord}
                title="Driver"
                pinColor="#3b82f6"
              />
            )}
          </MapView>

          {/* FABs */}
          <View style={styles.fabRow}>
            {isLive && (
              <TouchableOpacity
                style={styles.fabBtn}
                onPress={() => setShowQr(true)}
              >
                <Ionicons name="ticket-outline" size={22} color="#1e293b" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.fabBtn}
              onPress={() =>
                openComingSoon(
                  "chatbubble-ellipses-outline",
                  "Driver Chat",
                  "Live driver chat is coming soon!",
                )
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="#1e293b"
              />
            </TouchableOpacity>
          </View>

          {/* Back Button */}
          <TouchableOpacity style={styles.mapBackBtn} onPress={goHome}>
            <Ionicons name="chevron-back" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>

        {/* ── STATUS BANNER ───────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <LinearGradient colors={theme.gradient} style={styles.statusBanner}>
            <View style={styles.statusRow}>
              {isLive && <LivePulse />}
              <Ionicons name={theme.ionIcon} size={20} color={theme.color} />
              <Text style={[styles.statusText, { color: theme.color }]}>
                {theme.label}
              </Text>
            </View>
            {isEnRoute && (
              <Text style={styles.statusSub}>
                Your driver is heading to you
              </Text>
            )}
            {isConfirmed && (
              <Text style={styles.statusSub}>
                Driver assigned. Preparing to head your way.
              </Text>
            )}
            {isLive && etaText && (
              <View style={styles.etaPill}>
                <View style={styles.etaInner}>
                  <Ionicons name="time-outline" size={14} color="#2563eb" />
                  <Text style={styles.etaText}>{etaText}</Text>
                </View>
              </View>
            )}
            {isLive && driverDistanceMiles !== null && (
              <Text style={styles.statusSub}>
                Driver is{" "}
                {driverDistanceMiles.toFixed(driverDistanceMiles < 1 ? 2 : 1)}{" "}
                mi away
              </Text>
            )}
            {isLive && !driverCoord && (
              <Text style={styles.statusSub}>Waiting for driver GPS…</Text>
            )}
            {isLive && driverLastUpdateAt && (
              <Text style={styles.statusSubSmall}>
                Updated at{" "}
                {new Date(driverLastUpdateAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── RIDE INFO CARD ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.infoCard}>
            {/* Ticket + Fare */}
            <View style={styles.ticketRow}>
              <View>
                <Text style={styles.ticketLabel}>TICKET ID</Text>
                <Text style={styles.ticketId}>{ride.ticketId || "N/A"}</Text>
              </View>
              <View style={styles.farePill}>
                <Text style={styles.fareText}>
                  ${(ride.fare || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Route */}
            <View style={styles.routeSection}>
              <View style={styles.routeRow}>
                <View style={styles.routeConnectorVert}>
                  <View
                    style={[styles.routeDot, { backgroundColor: "#22c55e" }]}
                  />
                  <View style={styles.routeLineVert} />
                  <View
                    style={[styles.routeDot, { backgroundColor: "#ef4444" }]}
                  />
                </View>
                <View style={styles.routeTexts}>
                  <View>
                    <Text style={styles.routeLabel}>PICKUP</Text>
                    <Text style={styles.routeValue}>{ride.pickup}</Text>
                    {ride.pickupDetails ? (
                      <View style={styles.pickupNoteRow}>
                        <Ionicons
                          name="document-text-outline"
                          size={12}
                          color="#d97706"
                        />
                        <Text style={styles.pickupNote}>
                          {ride.pickupDetails}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View>
                    <Text style={styles.routeLabel}>DROP-OFF</Text>
                    <Text style={styles.routeValue}>{ride.dropoff}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Detail Grid */}
            <View style={styles.detailGrid}>
              {[
                {
                  label: "Passengers",
                  value: `${ride.passengers || 1}`,
                  icon: "people-outline",
                  color: "#3b82f6",
                },
                {
                  label: "Vehicle",
                  value: ride.assignedVehicle || "Unassigned",
                  icon: "bus-outline",
                  color: "#64748b",
                },
                {
                  label: "Type",
                  value: ride.userType || "General",
                  icon: "pricetag-outline",
                  color: "#8b5cf6",
                },
                {
                  label: "Time",
                  value: ride.scheduledTime
                    ? new Date(ride.scheduledTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—",
                  icon: "time-outline",
                  color: "#f59e0b",
                },
                {
                  label: "Payment",
                  value: `${ride.paymentStatus || "Pending"}`,
                  icon:
                    ride.paymentStatus === "Paid"
                      ? "checkmark-circle"
                      : "time-outline",
                  color: ride.paymentStatus === "Paid" ? "#059669" : "#f59e0b",
                },
              ].map((item) => (
                <View key={item.label} style={styles.detailCell}>
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={item.color}
                    style={styles.detailCellIconIon}
                  />
                  <Text style={styles.detailCellLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.detailCellValue,
                      item.label === "Payment" &&
                        ride.paymentStatus === "Paid" && { color: "#059669" },
                    ]}
                  >
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Receipt Buttons */}
            {ride.paymentStatus === "Paid" && (
              <View style={styles.receiptRow}>
                <TouchableOpacity
                  style={styles.receiptBtn}
                  onPress={async () => {
                    try {
                      const receiptText = await downloadRideReceipt(
                        ride.ticketId,
                      );
                      const safeName = `${String(ride.ticketId).replace(/[^a-zA-Z0-9-_]/g, "")}-receipt.txt`;
                      const file = new File(Paths.document, safeName);
                      await file.write(receiptText);
                      await Clipboard.setStringAsync(receiptText);
                      showToast("Receipt saved & copied!");
                    } catch {
                      showToast("Receipt not available yet.");
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#1e3a8a", "#2563eb"]}
                    style={styles.receiptBtnGrad}
                  >
                    <View style={styles.receiptBtnInner}>
                      <Ionicons
                        name="download-outline"
                        size={18}
                        color="white"
                      />
                      <Text style={styles.receiptBtnText}>
                        Save & copy receipt
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.receiptBtnSecondary}
                  onPress={async () => {
                    try {
                      const receiptText = await downloadRideReceipt(
                        ride.ticketId,
                      );
                      const safeName = `${String(ride.ticketId).replace(/[^a-zA-Z0-9-_]/g, "")}-receipt.txt`;
                      const file = new File(Paths.cache, safeName);
                      await file.write(receiptText);
                      if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(file.uri, {
                          mimeType: "text/plain",
                          dialogTitle: "Save or share receipt file",
                        });
                      } else {
                        showToast("Sharing not available.");
                      }
                    } catch {
                      showToast("Receipt not available yet.");
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.exportBtnInner}>
                    <Ionicons name="share-outline" size={16} color="#334155" />
                    <Text style={styles.receiptBtnTextSecondary}>
                      Export file…
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Notifications */}
            {ride.notifications && ride.notifications.length > 0 && (
              <View style={styles.notificationsSection}>
                <View style={styles.notifTitleRow}>
                  <Ionicons
                    name="notifications-outline"
                    size={13}
                    color="#475569"
                  />
                  <Text style={styles.notifTitle}>NOTIFICATIONS</Text>
                </View>
                {ride.notifications
                  .filter((n) => n.audience === "Rider")
                  .slice(-3)
                  .map((n, i) => (
                    <View key={i} style={styles.notifItem}>
                      <Text style={styles.notifText}>{n.message}</Text>
                      <Text style={styles.notifTime}>
                        {n.timestamp
                          ? new Date(n.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── RATING ───────────────────────────────────────── */}
        {isCompleted && !ratingSubmitted && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={styles.ratingCard}>
              <Text style={styles.ratingTitle}>Rate your ride</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRate(star)}
                    style={styles.starBtn}
                  >
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={36}
                      color={star <= rating ? "#f59e0b" : "#cbd5e1"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingLabel}>
                  {STAR_LABELS[rating - 1]}
                </Text>
              )}
            </View>
          </Animated.View>
        )}
        {isCompleted && ratingSubmitted && (
          <Animated.View entering={FadeIn.delay(200)}>
            <View style={styles.ratingCard}>
              <Text style={styles.ratingTitle}>Thanks for your feedback!</Text>
            </View>
          </Animated.View>
        )}

        {/* ── ACTIONS ──────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          {!isCompleted && !isCancelled && (
            <TouchableOpacity
              style={styles.cancelBtnWrap}
              onPress={handleCancel}
              disabled={cancelLoading}
            >
              <LinearGradient
                colors={["#ef4444", "#dc2626"]}
                style={styles.actionBtnGrad}
              >
                {cancelLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={styles.actionBtnInner}>
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color="white"
                    />
                    <Text style={styles.actionBtnText}>Cancel Ride</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          {(isCompleted || isCancelled) && (
            <TouchableOpacity style={styles.doneBtnWrap} onPress={goHome}>
              <LinearGradient
                colors={["#0f172a", "#1e293b"]}
                style={styles.actionBtnGrad}
              >
                <View style={styles.actionBtnInner}>
                  <Ionicons name="arrow-back" size={20} color="white" />
                  <Text style={styles.actionBtnText}>Back to Home</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── QR MODAL ─────────────────────────────────────── */}
      <Modal
        visible={showQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQr(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrBox}>
            <View style={[styles.qrAccent, { backgroundColor: theme.color }]} />
            <Text style={styles.qrTitle}>Boarding Pass</Text>
            <LinearGradient
              colors={["#f0f9ff", "#e0f2fe"]}
              style={styles.qrContainer}
            >
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={ride.ticketId || "N/A"}
                  size={200}
                  backgroundColor="white"
                  color="#0f172a"
                />
              </View>
              <Text style={styles.qrTicketId}>{ride.ticketId}</Text>
              <Text style={styles.qrName}>{ride.passengerName}</Text>
              <View
                style={[styles.qrStatusPill, { backgroundColor: theme.bg }]}
              >
                <Text style={[styles.qrStatusText, { color: theme.color }]}>
                  {ride.status}
                </Text>
              </View>
            </LinearGradient>
            <Text style={styles.qrSub}>Show this to your driver to board</Text>
            <TouchableOpacity onPress={() => setShowQr(false)}>
              <LinearGradient
                colors={["#0f172a", "#1e293b"]}
                style={styles.qrClose}
              >
                <Text style={styles.qrCloseText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── COMING SOON MODAL ────────────────────────────── */}
      <Modal
        visible={showComingSoon.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowComingSoon((s) => ({ ...s, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.csBox}>
            <View style={[styles.csAccent, { backgroundColor: "#059669" }]} />
            {showComingSoon.iconName ? (
              <Ionicons
                name={showComingSoon.iconName}
                size={52}
                color="#1e3a8a"
                style={styles.csIcon}
              />
            ) : null}
            <Text style={styles.csTitle}>{showComingSoon.title}</Text>
            <Text style={styles.csMsg}>{showComingSoon.msg}</Text>
            <TouchableOpacity
              onPress={() =>
                setShowComingSoon((s) => ({ ...s, visible: false }))
              }
            >
              <LinearGradient
                colors={["#1e3a8a", "#2563eb"]}
                style={styles.csDismiss}
              >
                <Text style={styles.csDismissText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0f4f8" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f0f4f8",
  },
  loadingText: { fontSize: 15, fontWeight: "700", color: "#64748b" },

  // Map
  mapContainer: {
    height: 280,
    backgroundColor: "#e2e8f0",
    position: "relative",
  },
  fabRow: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "column",
    gap: 10,
  },
  fabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  mapBackBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  // Status
  statusBanner: {
    padding: 20,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { fontSize: 20, fontWeight: "900" },
  statusSub: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  statusSubSmall: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    marginTop: 2,
  },
  etaPill: {
    backgroundColor: "rgba(59,130,246,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  etaInner: { flexDirection: "row", alignItems: "center", gap: 5 },
  etaText: { fontSize: 14, fontWeight: "800", color: "#2563eb" },

  // Info Card
  infoCard: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  ticketLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  ticketId: { fontSize: 16, fontWeight: "900", color: "#1e293b" },
  farePill: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  fareText: { fontSize: 22, fontWeight: "900", color: "white" },

  routeSection: { marginBottom: 20 },
  routeRow: { flexDirection: "row" },
  routeConnectorVert: { alignItems: "center", marginRight: 14, paddingTop: 4 },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLineVert: {
    width: 2,
    height: 28,
    backgroundColor: "#e2e8f0",
    marginVertical: 2,
  },
  routeTexts: { flex: 1, justifyContent: "space-between", gap: 18 },
  routeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeValue: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  pickupNote: {
    fontSize: 12,
    color: "#d97706",
    fontWeight: "600",
    marginTop: 2,
  },
  pickupNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },

  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailCell: {
    width: (width - 80) / 2.5,
    minWidth: 100,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  detailCellIconIon: { marginBottom: 4 },
  detailCellLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailCellValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
  },

  receiptRow: { marginTop: 16, gap: 10 },
  receiptBtn: { borderRadius: 14, overflow: "hidden" },
  receiptBtnGrad: { padding: 16, alignItems: "center", borderRadius: 14 },
  receiptBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  receiptBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  receiptBtnSecondary: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  exportBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  receiptBtnTextSecondary: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 14,
  },

  notificationsSection: {
    marginTop: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  notifItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  notifText: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  notifTime: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 2,
  },

  // Rating
  ratingCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 16,
  },
  starsRow: { flexDirection: "row", gap: 12 },
  starBtn: { padding: 4 },
  ratingLabel: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#f59e0b",
  },

  // Actions
  actionsRow: { paddingHorizontal: 16, gap: 12, marginTop: 16 },
  cancelBtnWrap: { borderRadius: 16, overflow: "hidden" },
  doneBtnWrap: { borderRadius: 16, overflow: "hidden" },
  actionBtnGrad: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  actionBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtnText: { color: "white", fontSize: 16, fontWeight: "900" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrBox: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "90%",
    overflow: "hidden",
  },
  qrAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  qrTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 20,
  },
  qrContainer: {
    padding: 24,
    borderRadius: 20,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  qrCodeWrapper: {
    padding: 14,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  qrTicketId: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  qrName: { fontSize: 12, fontWeight: "700", color: "#64748b", marginTop: 4 },
  qrStatusPill: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
  },
  qrStatusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  qrSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qrClose: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  qrCloseText: { color: "white", fontWeight: "800", fontSize: 15 },

  csBox: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "90%",
    overflow: "hidden",
  },
  csAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  csIcon: { marginBottom: 12 },
  csTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 10,
  },
  csMsg: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  csDismiss: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  csDismissText: { color: "white", fontWeight: "800", fontSize: 15 },
});

export default RiderTrackingScreen;
