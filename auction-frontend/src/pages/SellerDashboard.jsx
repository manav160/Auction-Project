import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AuctionForm from '../components/AuctionForm';
import AuctionCard from '../components/AuctionCard';

// Groups that match our backend status enum
const STATUS_GROUPS = [
  { key: 'SCHEDULED',          label: '🗓 Scheduled',          emptyMsg: 'No scheduled auctions.' },
  { key: 'ACTIVE',             label: '🔴 Live',               emptyMsg: null },
  { key: 'PENDING_RESOLUTION', label: '⏳ Resolving',          emptyMsg: null },
  { key: 'COMPLETED',          label: '✅ Completed',          emptyMsg: null },
  { key: 'UNSOLD',             label: '📦 Unsold',             emptyMsg: null },
  { key: 'CANCELED',           label: '🚫 Canceled',           emptyMsg: null },
];

const SellerDashboard = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchMyAuctions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/auctions/seller');
      setAuctions(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load your auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMyAuctions(); }, [fetchMyAuctions]);

  const handleExtend = async (auctionId) => {
    if (!window.confirm('Extend this auction by 1 day?')) return;
    try {
      await api.post(`/extend/${auctionId}`);
      fetchMyAuctions();
    } catch (err) {
      setError(err.response?.data?.message || 'Extension failed');
    }
  };

  const handleClose = async (auctionId) => {
    if (!window.confirm('Are you sure you want to cancel this auction?')) return;
    try {
      await api.post(`/auctions/${auctionId}/close`);
      fetchMyAuctions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel auction');
    }
  };

  // Normalize status for resilient matching across new and legacy records
  const normalizeStatus = (s) => {
    if (!s) return 'CANCELED';
    const upper = String(s).toUpperCase();
    if (upper === 'ACTIVE') return 'ACTIVE';
    if (upper === 'CLOSED') return 'COMPLETED';
    return upper;
  };

  // Stats
  const liveCount       = auctions.filter(a => normalizeStatus(a.status) === 'ACTIVE').length;
  const scheduledCount  = auctions.filter(a => normalizeStatus(a.status) === 'SCHEDULED').length;
  const completedCount  = auctions.filter(a => normalizeStatus(a.status) === 'COMPLETED').length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Seller Dashboard</h1>
        <p className="page-subtitle">Manage your auctions</p>
      </div>

      {/* Stats row */}
      <div className="seller-stats">
        <div className="stat-card">
          <strong>{auctions.length}</strong>
          <span>Total</span>
        </div>
        <div className="stat-card">
          <strong>{scheduledCount}</strong>
          <span>Scheduled</span>
        </div>
        <div className="stat-card">
          <strong>{liveCount}</strong>
          <span>Live</span>
        </div>
        <div className="stat-card">
          <strong>{completedCount}</strong>
          <span>Completed</span>
        </div>
      </div>

      <button
        className="primary-button toggle-form-btn"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? '✕ Cancel' : '+ Create New Auction'}
      </button>

      {showForm && (
        <AuctionForm onAuctionCreated={() => { fetchMyAuctions(); setShowForm(false); }} />
      )}



      {loading ? (
        <p>Loading your auctions...</p>
      ) : auctions.length === 0 ? (
        <p>You haven't created any auctions yet.</p>
      ) : (
        <>
          {STATUS_GROUPS.map(group => {
            const group_auctions = auctions.filter(a => normalizeStatus(a.status) === group.key);
            if (group_auctions.length === 0) return null;
            return (
              <section key={group.key} className="auction-group">
                <h2 className="auction-group-title">{group.label}</h2>
                <div className="auction-grid">
                  {group_auctions.map(auction => {
                    const norm = normalizeStatus(auction.status);
                    return (
                      <div key={auction._id} className="seller-auction-wrapper">
                        <AuctionCard auction={auction} onExtend={norm === 'ACTIVE' ? handleExtend : undefined} />
                        <div className="seller-action-row">
                          {(norm === 'ACTIVE' || norm === 'SCHEDULED' || norm === 'DRAFT') && (
                            <button className="danger-button" onClick={() => handleClose(auction._id)}>
                              Cancel Auction
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};

export default SellerDashboard;
