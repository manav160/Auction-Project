import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../services/api';
import AuctionForm from '../components/AuctionForm';
import AuctionCard from '../components/AuctionCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useConfirm } from '../utils/useConfirm';
import { STATUS_GROUPS, normalizeAuctionStatus } from '../utils/constants';

const SellerDashboard = () => {
  const { showConfirm, ConfirmDialog } = useConfirm();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchMyAuctions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/auctions/seller');
      setAuctions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load your auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyAuctions();
  }, [fetchMyAuctions]);

  const handleExtend = async (auctionId) => {
    const confirmed = await showConfirm({
      title: 'Extend Auction',
      message: 'Extend this auction by 1 day? An extension fee of ₹100 will apply.',
      confirmText: 'Extend 1 Day',
      confirmVariant: 'warning'
    });
    if (!confirmed) return;
    try {
      await api.post(`/extend/${auctionId}`);
      fetchMyAuctions();
    } catch (err) {
      setError(err.response?.data?.message || 'Extension failed');
    }
  };

  const handleClose = async (auctionId) => {
    const confirmed = await showConfirm({
      title: 'Cancel Auction',
      message: 'Are you sure you want to cancel this auction? This action cannot be undone.',
      confirmText: 'Cancel Auction',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.post(`/auctions/${auctionId}/close`);
      fetchMyAuctions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel auction');
    }
  };

  // Stats
  const liveCount = auctions.filter(a => normalizeAuctionStatus(a.status) === 'ACTIVE').length;
  const scheduledCount = auctions.filter(a => normalizeAuctionStatus(a.status) === 'SCHEDULED').length;
  const completedCount = auctions.filter(a => normalizeAuctionStatus(a.status) === 'COMPLETED').length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Seller Dashboard</h1>
        <p className="page-subtitle">Manage your auctions and listings</p>
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
        type="button"
        className="primary-button toggle-form-btn"
        onClick={() => setShowForm(!showForm)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        {showForm ? <X size={16} /> : <Plus size={16} />}
        <span>{showForm ? 'Cancel Creation' : 'Create New Auction'}</span>
      </button>

      {showForm && (
        <AuctionForm onAuctionCreated={() => { fetchMyAuctions(); setShowForm(false); }} />
      )}

      {error && <div className="error-alert" style={{ marginBottom: '1rem', color: '#ef4444' }}>{error}</div>}

      {loading ? (
        <LoadingSpinner message="Loading your auctions..." />
      ) : auctions.length === 0 ? (
        <div className="empty-results-box">
          <p>You haven't created any auctions yet.</p>
        </div>
      ) : (
        <>
          {STATUS_GROUPS.map(group => {
            const groupAuctions = auctions.filter(a => normalizeAuctionStatus(a.status) === group.key);
            if (groupAuctions.length === 0) return null;
            return (
              <section key={group.key} className="auction-group">
                <h2 className="auction-group-title">
                  {group.isLive && <span className="pulse-dot" />}
                  {group.label}
                </h2>
                <div className="auction-grid">
                  {groupAuctions.map(auction => {
                    const norm = normalizeAuctionStatus(auction.status);
                    return (
                      <div key={auction._id} className="seller-auction-wrapper">
                        <AuctionCard auction={auction} onExtend={norm === 'ACTIVE' ? handleExtend : undefined} />
                        <div className="seller-action-row">
                          {(norm === 'ACTIVE' || norm === 'SCHEDULED' || norm === 'DRAFT') && (
                            <button type="button" className="danger-button" onClick={() => handleClose(auction._id)}>
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
      {ConfirmDialog}
    </div>
  );
};

export default SellerDashboard;
