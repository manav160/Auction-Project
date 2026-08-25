import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, LogOut, Menu, X, Gavel, Heart, Grid, ShieldCheck, User } from 'lucide-react';
import './App.css';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import SellerDashboard from './pages/SellerDashboard';
import MyParticipationsPage from './pages/MyParticipationsPage';
import WatchlistPage from './pages/WatchlistPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/AdminDashboard';
import { removeToken, isAuthenticated, isAdmin, getUserName, getUserRole, getUserAvatar } from './services/auth';

const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticated = isAuthenticated();
  const userName = getUserName();
  const userRole = getUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const handleGlobalClick = (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => {
        ripple.remove();
      }, 600);
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleLogout = () => {
    removeToken();
    navigate('/auth');
  };

  const userInitial = userName ? userName.charAt(0).toUpperCase() : 'U';
  const userAvatar = getUserAvatar();

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-left">
          {authenticated && (
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}

          <Link to="/" className="brand" title="BIDX Marketplace">
            <svg className="bidx-logo-mark" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="30" height="30" rx="9" fill="url(#bidx-bg)" fillOpacity="0.12" />
              <rect x="0.5" y="0.5" width="29" height="29" rx="8.5" stroke="url(#bidx-border)" strokeOpacity="0.3" />
              <path d="M8 22L22 8" stroke="url(#bidx-accent-grad)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M22 22L15.5 15.5" stroke="var(--text-primary)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M8 8L12.5 12.5" stroke="var(--text-primary)" strokeWidth="3.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="bidx-accent-grad" x1="8" y1="22" x2="22" y2="8" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="bidx-bg" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="bidx-border" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a5b4fc" />
                </linearGradient>
              </defs>
            </svg>
            <span className="brand-wordmark">
              <span className="brand-bid">BID</span><span className="brand-x">X</span>
            </span>
          </Link>
        </div>

        {authenticated && (
          <nav className="site-nav desktop-only-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Auctions
            </NavLink>
            {!isAdmin() && (
              <NavLink to="/seller" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                My Auctions
              </NavLink>
            )}
            {!isAdmin() && (
              <NavLink to="/my-participations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                My Bids
              </NavLink>
            )}
            {!isAdmin() && (
              <NavLink to="/watchlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Watchlist
              </NavLink>
            )}
            {isAdmin() && (
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                Admin
              </NavLink>
            )}
          </nav>
        )}

        <div className="nav-user-actions">
          {authenticated ? (
            <>
              <Link to="/profile" className="user-profile-badge" title="View Profile">
                <div className="user-avatar">
                  {userAvatar ? (
                    <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    userInitial
                  )}
                </div>
                <span className="user-name">{userName}</span>
                <span className="user-role-tag">{userRole}</span>
              </Link>

              <button className="logout-btn" onClick={handleLogout} title="Sign Out">
                <LogOut size={15} style={{ marginRight: '6px' }} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <Link to="/auth" className="nav-link active">Sign In</Link>
          )}

          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} className="theme-toggle-icon" /> : <Moon size={16} className="theme-toggle-icon" />}
            <span className="theme-toggle-text">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {authenticated && mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <span className="mobile-drawer-title">Navigation</span>
              <button className="mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="mobile-nav-links">
              <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Grid size={18} />
                <span>Auctions</span>
              </NavLink>
              {!isAdmin() && (
                <NavLink to="/seller" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                  <Gavel size={18} />
                  <span>My Auctions</span>
                </NavLink>
              )}
              {!isAdmin() && (
                <NavLink to="/my-participations" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                  <ShieldCheck size={18} />
                  <span>My Bids</span>
                </NavLink>
              )}
              {!isAdmin() && (
                <NavLink to="/watchlist" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                  <Heart size={18} />
                  <span>Watchlist</span>
                </NavLink>
              )}
              <NavLink to="/profile" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <User size={18} />
                <span>Profile</span>
              </NavLink>
              {isAdmin() && (
                <NavLink to="/admin" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                  <ShieldCheck size={18} />
                  <span>Admin</span>
                </NavLink>
              )}
            </nav>
          </div>
        </div>
      )}

      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={authenticated ? <HomePage /> : <Navigate to="/auth" />} />
        <Route path="/auction/:id" element={authenticated ? <AuctionDetailPage /> : <Navigate to="/auth" />} />
        <Route path="/seller" element={authenticated && !isAdmin() ? <SellerDashboard /> : <Navigate to="/auth" />} />
        <Route path="/my-participations" element={authenticated ? <MyParticipationsPage /> : <Navigate to="/auth" />} />
        <Route path="/watchlist" element={authenticated ? <WatchlistPage /> : <Navigate to="/auth" />} />
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
