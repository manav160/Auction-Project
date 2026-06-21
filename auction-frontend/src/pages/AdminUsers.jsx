import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/users').then(res => setUsers(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header"><h1>All Users (Admin)</h1></div>
      {loading ? <p>Loading...</p> : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Wallet</th><th>Locked</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td><span className="status-pill status-active">{u.role}</span></td>
                  <td>₹{u.walletBalance?.toLocaleString()}</td>
                  <td>₹{u.lockedBalance?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
