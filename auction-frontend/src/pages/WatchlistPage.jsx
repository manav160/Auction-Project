import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const WatchlistPage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const res = await api.get('/watchlist');
      setAuctions(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleToggleWatchlist = async (auctionId) => {
    try {
      // Toggle call will remove from watchlist because it's already watchlisted
      await api.post(`/watchlist/${auctionId}/toggle`);
      // Update local state by filtering out the removed auction
      setAuctions(prev => prev.filter(auc => auc._id !== auctionId));
    } catch (err) {
      console.error('Watchlist toggle error:', err);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>My Watchlist ❤️</h1>
        <p className="page-subtitle">Track your favorite auctions and buy or bid before they end</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      
      {loading ? (
        <p>Loading watchlist...</p>
      ) : auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <span style={{ fontSize: '3rem' }}>🤍</span>
          <p style={{ marginTop: '1rem', fontSize: '1.2rem', opacity: 0.8 }}>Your watchlist is empty.</p>
          <p style={{ fontSize: '0.95rem', opacity: 0.6 }}>Browse live auctions and click the heart button to save them here.</p>
        </div>
      ) : (
        <div className="auction-grid">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction._id}
              auction={auction}
              onToggleWatchlist={handleToggleWatchlist}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
