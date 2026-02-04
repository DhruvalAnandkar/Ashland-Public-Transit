import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import BookingForm from './components/BookingForm';
import DispatcherDashboard from './components/DispatcherDashboard';
import DriverView from './components/DriverView';
import FleetManager from './components/FleetManager';
import LandingPage from './components/LandingPage';
import TrackRide from './components/TrackRide';
import LoginModal from './components/LoginModal'; // NEW COMPONENT

// THE GATEKEEPER: Prevents unauthorized access to sensitive transit data
const ProtectedRoute = ({ isAdmin, children }) => {
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem("isDispatcher") === "true";
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Updated to work with Modal (receives password directly)
  const handleLogin = (password) => {
    if (password === "Ashland2026") {
      setIsAdmin(true);
      localStorage.setItem("isDispatcher", "true");
      return true;
    } else {
      return false; // Modal handles the error state
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem("isDispatcher");
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans text-slate-600">
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLogin}
          title="Dispatcher Portal"
        />

        {/* NAVIGATION BAR */}
        <nav className="sticky top-0 z-50 backdrop-blur-md bg-blue-900/95 text-white shadow-lg border-b border-white/10">
          <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
            <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-2">
              ASHLAND TRANSIT
            </Link>

            <div className="flex items-center gap-6">
              <Link to="/book" className="text-sm font-bold opacity-80 hover:opacity-100 transition-opacity">Book a Ride</Link>

              {isAdmin ? (
                <div className="flex items-center gap-4">
                  <Link to="/dashboard" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold backdrop-blur-sm transition-all border border-white/10">Portal</Link>
                  <button onClick={handleLogout} className="text-xs text-blue-200 hover:text-white transition-colors">Logout</button>
                </div>
              ) : (
                <button onClick={() => setIsLoginModalOpen(true)} className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all">
                  Staff Login
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* MAIN ROUTING LOGIC */}
        <main className="py-12 container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <Routes>
            {/* LANDING PAGE */}
            <Route path="/" element={<LandingPage onLogin={() => setIsLoginModalOpen(true)} />} />

            {/* RIDER BOOKING PORTAL */}
            <Route path="/book" element={<BookingForm />} />

            {/* RIDER TRACKING PORTAL */}
            <Route path="/track" element={<TrackRide />} />

            {/* DISPATCHER VIEW (Protected) */}
            <Route path="/dashboard" element={
              <ProtectedRoute isAdmin={isAdmin}>
                <DispatcherDashboard />
              </ProtectedRoute>
            } />

            {/* DRIVER MANIFEST */}
            <Route path="/driver" element={<DriverView />} />

            {/* FLEET MANAGER (Protected) */}
            <Route path="/fleet" element={
              <ProtectedRoute isAdmin={isAdmin}>
                <FleetManager />
              </ProtectedRoute>
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