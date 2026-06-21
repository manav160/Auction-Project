import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AuctionForm from '../components/AuctionForm';
import AuctionCard from '../components/AuctionCard';

const SellerDashboard = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchMyAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/auctions/seller');
      setAuctions(res.data);
    } catch (err) {
      setError('Failed to load your auctions');
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
    if (!window.confirm('Are you sure you want to close this auction?')) return;
    try {
      await api.post(`/auctions/${auctionId}/close`);
      fetchMyAuctions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close auction');
    }
  };

  const activeAuctions = auctions.filter(a => a.status === 'Active');
  const closedAuctions = auctions.filter(a => a.status === 'Closed');

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Seller Dashboard</h1>
        <p className="page-subtitle">Manage your auctions</p>
      </div>

      <div className="seller-stats">
        <div className="stat-card">
          <strong>{auctions.length}</strong>
          <span>Total Auctions</span>
        </div>
        <div className="stat-card">
          <strong>{activeAuctions.length}</strong>
          <span>Active</span>
        </div>
        <div className="stat-card">
          <strong>{closedAuctions.length}</strong>
          <span>Closed</span>
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

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading your auctions...</p>
      ) : (
        <>
          {activeAuctions.length > 0 && (
            <>
              <h2>Active Auctions</h2>
              <div className="auction-grid">
                {activeAuctions.map(auction => (
                  <div key={auction._id} className="seller-auction-wrapper">
                    <AuctionCard auction={auction} onExtend={handleExtend} />
                    <div className="seller-action-row">
                      <button className="danger-button" onClick={() => handleClose(auction._id)}>
                        Close Auction
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {closedAuctions.length > 0 && (
            <>
              <h2>Closed Auctions</h2>
              <div className="auction-grid">
                {closedAuctions.map(auction => (
                  <AuctionCard key={auction._id} auction={auction} />
                ))}
              </div>
            </>
          )}
          {auctions.length === 0 && <p>You haven't created any auctions yet.</p>}
        </>
      )}
    </div>
  );
};

export default SellerDashboard;
