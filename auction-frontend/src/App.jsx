import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import './App.css';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import SellerDashboard from './pages/SellerDashboard';
import MyParticipationsPage from './pages/MyParticipationsPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import { removeToken, isAuthenticated, isSeller, isAdmin, getUserName, getUserRole } from './services/auth';

const AppShell = () => {
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const userName = getUserName();
  const userRole = getUserRole();

  const handleLogout = () => {
    removeToken();
    navigate('/auth');
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="brand">🏛️ Auction Hub</div>
        <nav className="site-nav">
          {authenticated ? (
            <>
              <Link to="/" className="nav-link">Auctions</Link>
              {isSeller() && <Link to="/seller" className="nav-link">My Auctions</Link>}
              {!isSeller() && <Link to="/my-participations" className="nav-link">My Bids</Link>}
              {isAdmin() && <Link to="/admin" className="nav-link">Admin</Link>}
              <Link to="/profile" className="nav-link">
                <span className="nav-role-badge">{userRole}</span> {userName}
              </Link>
              <button className="nav-button" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <Link to="/auth" className="nav-link">Sign In</Link>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={authenticated ? <HomePage /> : <Navigate to="/auth" />} />
        <Route path="/auction/:id" element={authenticated ? <AuctionDetailPage /> : <Navigate to="/auth" />} />
        <Route path="/seller" element={authenticated && isSeller() ? <SellerDashboard /> : <Navigate to="/auth" />} />
        <Route path="/my-participations" element={authenticated ? <MyParticipationsPage /> : <Navigate to="/auth" />} />
        <Route path="/profile" element={authenticated ? <ProfilePage /> : <Navigate to="/auth" />} />
        <Route path="/admin" element={authenticated && isAdmin() ? <AdminDashboard /> : <Navigate to="/" />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <Router>
    <AppShell />
  </Router>
);

export default App;
