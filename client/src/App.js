import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import BookingForm from "./components/BookingForm";
import DispatcherDashboard from "./components/DispatcherDashboard";
import DriverView from "./components/DriverView";
import FleetManager from "./components/FleetManager";
import LandingPage from "./components/LandingPage";
import TrackRide from "./components/TrackRide";
import LoginModal from "./components/LoginModal";
import SiteNavbar from "./components/SiteNavbar";
import SiteFooter from "./components/SiteFooter";
import {
  AboutPage,
  ServicesPage,
  FaresPage,
  AccessibilityPage,
  FAQPage,
  ContactPage,
} from "./components/MarketingPages";

// --- ROLE-BASED PROTECTION ---
const RoleProtectedRoute = ({ allowedRoles, userRole, children }) => {
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.includes(userRole)) {
    return children;
  }

  // Redirect based on their actual role if they try to access unauthorized routes
  if (userRole === "Driver") {
    return <Navigate to="/driver" replace />;
  }
  if (userRole === "Dispatcher" || userRole === "Admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
};

function App() {
  // --- STATE ---
  const [userRole, setUserRole] = useState(
    () => localStorage.getItem("role") || null,
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [targetLoginRole, setTargetLoginRole] = useState(""); // Role target for the modal title

  // --- HANDLERS ---
  const handleLogin = async (username, password) => {
    try {
      const { login } = require("./services/api");
      const data = await login(username, password);

      if (data.token) {
        // USE ROLE FROM JWT RESPONSE — backend returns role directly
        const role = data.role;

        // PERSIST
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", role);
        localStorage.setItem("userId", data._id); // Stored for Socket room joining (Fix #3)
        localStorage.setItem("username", data.username); // Stored for driver manifest filtering
        if (role === "Driver") {
          localStorage.setItem("driverUsername", username);
        }

        setUserRole(role);
        return true;
      }
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
    return false;
  };

  const handleLogout = () => {
    // HARD LOGOUT: Clear everything and force reload to landing
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-600">
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={async (username, password) => {
            const success = await handleLogin(username, password);
            // Navigation is handled by state change + Redirect logic or manual push if needed,
            // but here we just likely let the Router handle the new state
            if (success) {
              // READ ROLE FROM localStorage — set by handleLogin above, no more username guessing
              const role = localStorage.getItem("role");
              if (role === "Driver") {
                window.location.href = "/driver";
              } else {
                window.location.href = "/dashboard";
              }
            }
            return success;
          }}
          title={
            targetLoginRole === "Driver" ? "Driver Portal" : "Dispatcher Portal"
          }
          initialRole={targetLoginRole}
        />

        <SiteNavbar
          userRole={userRole}
          onStaffLogin={(role = "Dispatcher") => {
            setTargetLoginRole(role);
            setIsLoginModalOpen(true);
          }}
          onLogout={handleLogout}
        />

        {/* --- MAIN ROUTING LOGIC --- */}
        <main className="pt-16">
          <Routes>
            {/* PUBLIC marketing */}
            <Route
              path="/"
              element={
                <LandingPage
                  onLogin={() => {
                    setTargetLoginRole("Dispatcher");
                    setIsLoginModalOpen(true);
                  }}
                />
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/fares" element={<FaresPage />} />
            <Route path="/accessibility" element={<AccessibilityPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<ContactPage />} />

            <Route
              path="/book"
              element={
                <div className="py-12 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                  <BookingForm />
                </div>
              }
            />
            <Route
              path="/track"
              element={
                <div className="py-12 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                  <TrackRide />
                </div>
              }
            />

            {/* PROTECTED: DISPATCHER ONLY */}
            <Route
              path="/dashboard"
              element={
                <RoleProtectedRoute
                  allowedRoles={["Dispatcher", "Admin"]}
                  userRole={userRole}
                >
                  <div className="py-8 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                    <DispatcherDashboard />
                  </div>
                </RoleProtectedRoute>
              }
            />

            <Route
              path="/fleet"
              element={
                <RoleProtectedRoute
                  allowedRoles={["Dispatcher", "Admin"]}
                  userRole={userRole}
                >
                  <div className="py-8 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                    <FleetManager />
                  </div>
                </RoleProtectedRoute>
              }
            />

            {/* PROTECTED: DRIVER ONLY */}
            <Route
              path="/driver"
              element={
                <RoleProtectedRoute
                  allowedRoles={["Driver"]}
                  userRole={userRole}
                >
                  <div className="py-8 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
                    <DriverView />
                  </div>
                </RoleProtectedRoute>
              }
            />
          </Routes>
        </main>

        <SiteFooter />
      </div>
    </Router>
  );
}

export default App;
