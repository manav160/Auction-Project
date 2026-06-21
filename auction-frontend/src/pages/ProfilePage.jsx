import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { getUserName, getUserRole } from '../services/auth';

const ProfilePage = () => {
  const [walletInfo, setWalletInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        setWalletInfo(res.data);
      } catch (err) {
        console.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  const userName = getUserName();
  const userRole = getUserRole();

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>My Profile</h1>
      </div>
      <div className="detail-card" style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>👤</div>
          <h2 style={{ margin: '0 0 4px' }}>{userName}</h2>
          <span className="status-pill status-active" style={{ textTransform: 'capitalize' }}>{userRole}</span>
        </div>
        {loading ? (
          <p>Loading wallet info...</p>
        ) : walletInfo ? (
          <div className="detail-metrics">
            <div>
              <strong>Email</strong>
              <p>{walletInfo.email}</p>
            </div>
            <div>
              <strong>Wallet Balance</strong>
              <p style={{ color: '#10b981', fontWeight: 700, fontSize: '1.2rem' }}>
                ₹{walletInfo.walletBalance?.toLocaleString()}
              </p>
            </div>
            <div>
              <strong>Locked Balance</strong>
              <p style={{ color: '#f59e0b', fontWeight: 700 }}>
                ₹{walletInfo.lockedBalance?.toLocaleString()}
              </p>
            </div>
            <div>
              <strong>Available</strong>
              <p style={{ color: '#3b82f6', fontWeight: 700 }}>
                ₹{((walletInfo.walletBalance || 0) - (walletInfo.lockedBalance || 0)).toLocaleString()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProfilePage;
