import React, { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import LoadingSpinner from '../components/LoadingSpinner';

const WatchlistPage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWatchlist = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleToggleWatchlist = useCallback(async (auctionId) => {
    try {
      await api.post(`/watchlist/${auctionId}/toggle`);
      setAuctions(prev => prev.filter(auc => auc._id !== auctionId));
    } catch (err) {
      console.error('Watchlist toggle error:', err);
    }
  }, []);

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
        <LoadingSpinner message="Loading watchlist..." />
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
