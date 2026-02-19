import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import BookingForm from './components/BookingForm';
import DispatcherDashboard from './components/DispatcherDashboard';
import DriverView from './components/DriverView';
import FleetManager from './components/FleetManager';
import LandingPage from './components/LandingPage';
import TrackRide from './components/TrackRide';
import LoginModal from './components/LoginModal';

// --- ROLE-BASED PROTECTION ---
const RoleProtectedRoute = ({ allowedRoles, userRole, children }) => {
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.includes(userRole)) {
    return children;
  }

  // Redirect based on their actual role if they try to access unauthorized routes
  if (userRole === 'Driver') {
    return <Navigate to="/driver" replace />;
  }
  if (userRole === 'Dispatcher') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
};

function App() {
  // --- STATE ---
  const [userRole, setUserRole] = useState(() => localStorage.getItem("role") || null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [targetLoginRole, setTargetLoginRole] = useState(''); // Role target for the modal title

  // --- HANDLERS ---
  const handleLogin = async (username, password) => {
    try {
      const { login } = require('./services/api');
      const data = await login(username, password);

      if (data.token) {
        // DETERMINE ROLE BASED ON USERNAME (Mock Logic for MVP)
        // In a real app, the backend should return the role in the response
        let role = 'Dispatcher';
        if (username.toLowerCase().startsWith('driver')) {
          role = 'Driver';
        }

        // PERSIST
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", role);
        if (role === 'Driver') {
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
    window.location.href = '/';
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
              // Optional: specific redirection if needed, but Router should handle "if userRole exists"
              if (username.toLowerCase().startsWith('driver')) {
                window.location.href = '/driver';
              } else {
                window.location.href = '/dashboard';
              }
            }
            return success;
          }}
          title={targetLoginRole === 'Driver' ? "Driver Portal" : "Dispatcher Portal"}
          initialRole={targetLoginRole}
        />

        {/* --- NAVIGATION BAR --- */}
        <nav className="sticky top-0 z-50 backdrop-blur-md bg-blue-900/95 text-white shadow-lg border-b border-white/10">
          <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
            <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-2">
              ASHLAND TRANSIT
            </Link>

            <div className="flex items-center gap-6">
              <Link to="/book" className="text-sm font-bold opacity-80 hover:opacity-100 transition-opacity">Book a Ride</Link>

              {userRole ? (
                <div className="flex items-center gap-4">
                  {/* SECURE HEADER: Drivers do NOT see the Portal link */}
                  {userRole === 'Dispatcher' && (
                    <Link to="/dashboard" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold backdrop-blur-sm transition-all border border-white/10">
                      Portal
                    </Link>
                  )}

                  <button onClick={handleLogout} className="text-xs text-blue-200 hover:text-white transition-colors uppercase tracking-wider font-bold">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    setTargetLoginRole('Driver');
                    setIsLoginModalOpen(true);
                  }} className="text-sm bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2">
                    To Driver View
                  </button>
                  <button onClick={() => {
                    setTargetLoginRole('Dispatcher');
                    setIsLoginModalOpen(true);
                  }} className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all border border-blue-400/30">
                    Dispatcher Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* --- MAIN ROUTING LOGIC --- */}
        <main className="py-12 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <Routes>
            {/* PUBLIC */}
            <Route path="/" element={<LandingPage onLogin={() => { setTargetLoginRole('Dispatcher'); setIsLoginModalOpen(true); }} />} />
            <Route path="/book" element={<BookingForm />} />
            <Route path="/track" element={<TrackRide />} />

            {/* PROTECTED: DISPATCHER ONLY */}
            <Route path="/dashboard" element={
              <RoleProtectedRoute allowedRoles={['Dispatcher']} userRole={userRole}>
                <DispatcherDashboard />
              </RoleProtectedRoute>
            } />

            <Route path="/fleet" element={
              <RoleProtectedRoute allowedRoles={['Dispatcher']} userRole={userRole}>
                <FleetManager />
              </RoleProtectedRoute>
            } />

            {/* PROTECTED: DRIVER ONLY */}
            <Route path="/driver" element={
              <RoleProtectedRoute allowedRoles={['Driver']} userRole={userRole}>
                <DriverView />
              </RoleProtectedRoute>
            } />
          </Routes>
        </main>

        <footer className="text-center py-10 text-slate-400 text-xs font-medium uppercase tracking-widest">
          © 2026 Ashland City Transit Project • Senior CS Thesis Portfolio
        </footer>
      </div>
    </Router>
  );
}

export default App;