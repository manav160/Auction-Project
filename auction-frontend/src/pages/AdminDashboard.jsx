import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [usersRes, auctionsRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/auctions'),
        ]);
        setUsers(usersRes.data);
        setAuctions(auctionsRes.data);
      } catch (err) {
        console.error('Admin fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
      </div>
      <div className="seller-stats">
        <div className="stat-card"><strong>{users.length}</strong><span>Total Users</span></div>
        <div className="stat-card"><strong>{auctions.length}</strong><span>Total Auctions</span></div>
        <div className="stat-card"><strong>{auctions.filter(a => a.isActive).length}</strong><span>Active Auctions</span></div>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
        <button className={`tab-btn ${activeTab === 'auctions' ? 'active' : ''}`} onClick={() => setActiveTab('auctions')}>Auctions</button>
      </div>
      {loading ? <p>Loading...</p> : activeTab === 'users' ? (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Wallet</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td><span className="status-pill status-active">{u.role}</span></td>
                  <td>₹{u.walletBalance?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Seller</th><th>Bid</th><th>Status</th><th>Ends</th></tr></thead>
            <tbody>
              {auctions.map(a => (
                <tr key={a._id}>
                  <td>{a.title}</td><td>{a.sellerId?.name}</td>
                  <td>₹{a.currentHighestBid}</td>
                  <td><span className={`status-pill ${a.isActive ? 'status-active' : 'status-closed'}`}>{a.isActive ? 'Active' : 'Closed'}</span></td>
                  <td>{new Date(a.endDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
