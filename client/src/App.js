import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import BookingForm from './components/BookingForm';
import DispatcherDashboard from './components/DispatcherDashboard';

// THE GATEKEEPER: Prevents unauthorized access to sensitive transit data
const ProtectedRoute = ({ isAdmin, children }) => {
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLogin = () => {
    const password = prompt("Enter Dispatcher Access Code:");
    if (password === "Ashland2026") {
      setIsAdmin(true);
      alert("Access Granted: Dispatcher Mode Active");
    } else {
      alert("Access Denied: Incorrect Code");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    alert("Logged out of Dispatcher Mode");
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans">
        {/* NAVIGATION BAR */}
        <nav className="bg-blue-900 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link to="/" className="text-xl font-black tracking-tighter">ASHLAND TRANSIT</Link>
            
            <div className="flex items-center gap-6">
              <Link to="/" className="text-sm font-medium hover:text-blue-200 transition-colors">Book a Ride</Link>
              
              {isAdmin ? (
                <div className="flex items-center gap-4">
                  <Link to="/dashboard" className="bg-white text-blue-900 px-4 py-2 rounded-lg font-bold shadow-sm">Portal</Link>
                  <button onClick={handleLogout} className="text-xs text-blue-200 underline">Logout</button>
                </div>
              ) : (
                <button onClick={handleLogin} className="text-sm bg-blue-800 px-4 py-2 rounded-lg border border-blue-700 hover:bg-blue-700 transition-all">
                  Staff Login
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* MAIN ROUTING LOGIC */}
        <main className="py-10 px-4">
          <Routes>
            {/* RIDER VIEW */}
            <Route path="/" element={
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10">
                  <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Modern Transit for Ashland</h1>
                  <p className="text-gray-600 mt-2">Affordable, reliable, and now easy to book online.</p>
                </div>
                <BookingForm />
              </div>
            } />
            
            {/* DISPATCHER VIEW (Protected) */}
            <Route path="/dashboard" element={
              <ProtectedRoute isAdmin={isAdmin}>
                <DispatcherDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </main>

        <footer className="text-center py-10 text-gray-400 text-xs">
          © 2026 Ashland City Transit Project • Senior CS Thesis Portfolio
        </footer>
      </div>
    </Router>
  );
}

export default App;