import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import BookingForm from './components/BookingForm';
import DispatcherDashboard from './components/DispatcherDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Bar */}
        <nav className="bg-blue-800 text-white p-4 shadow-md">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link to="/" className="text-xl font-bold tracking-tight hover:text-blue-200 transition-colors">
              ASHLAND PUBLIC TRANSIT
            </Link>
            <div className="space-x-6 text-sm font-medium">
              <Link to="/" className="hover:text-blue-200">Home</Link>
              <Link to="/dashboard" className="hover:text-blue-200">My Rides</Link>
              <Link to="/dashboard" className="bg-white text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                Dispatcher Portal
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="py-10">
          <div className="max-w-6xl mx-auto px-4">
            <Routes>
              {/* Home Page: Booking Form */}
              <Route path="/" element={
                <>
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-extrabold text-gray-900">Modern Transit for Ashland</h2>
                    <p className="text-gray-600 mt-2">Affordable, reliable, and just a click away.</p>
                  </div>
                  <BookingForm />
                </>
              } />

              {/* Admin Page: Dispatcher Dashboard */}
              <Route path="/dashboard" element={<DispatcherDashboard />} />
            </Routes>
          </div>
        </main>
        
        <footer className="text-center py-10 text-gray-400 text-xs">
          © 2026 Ashland City Transit Project • Built by Senior CS Team
        </footer>
      </div>
    </Router>
  );
}

export default App;