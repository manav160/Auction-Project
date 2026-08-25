import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
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
      const data = res.data;
      setAuctions(Array.isArray(data) ? data : (data?.auctions || data?.watchlist || []));
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
        <h1>
          <Heart size={28} style={{ color: '#ef4444', marginRight: '10px', verticalAlign: 'middle', display: 'inline' }} />
          Saved Watchlist
        </h1>
        <p className="page-subtitle">Track your saved auctions and monitor price movements</p>
      </div>

      {error && <p className="error-text">{error}</p>}
      
      {loading ? (
        <div className="loading-box">
          <div className="loading-spinner" />
          <p>Loading watchlist...</p>
        </div>
      ) : auctions.length === 0 ? (
        <div className="empty-results-box">
          <Heart size={48} className="empty-icon-svg" />
          <h3>Your watchlist is empty</h3>
          <p>Browse live auctions and click the heart icon on any listing to save it here.</p>
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
