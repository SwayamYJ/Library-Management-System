import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import PublicBrowse from './pages/PublicBrowse';
import BookDetail from './pages/BookDetail';
import Profile from './pages/Profile';
import BorrowHistory from './pages/BorrowHistory';
import './styles/shelf.css';

// Real PrivateRoute — enforces authentication and optional role restriction
const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useContext(AuthContext);

  // While session is being restored from JWT, show nothing (AuthContext handles this with !loading && children)
  if (loading) return null;

  // Not logged in → go to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role mismatch → send to correct dashboard
  if (requiredRole === 'Admin' && user.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole === 'User' && user.role !== 'User') {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicBrowse />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Admin-only routes */}
          <Route
            path="/admin"
            element={
              <PrivateRoute requiredRole="Admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />

          {/* User routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute requiredRole="User">
                <UserDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/borrow-history"
            element={
              <PrivateRoute requiredRole="User">
                <BorrowHistory />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
