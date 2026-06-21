import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const HomePage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '', sort: '' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.sort) params.append('sort', filters.sort);
      const res = await api.get(`/auctions?${params}`);
      setAuctions(res.data);
    } catch (err) {
      setError('Failed to load auctions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Live Auctions</h1>
        <p className="page-subtitle">Discover and bid on exclusive items</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search auctions..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="form-field filter-search"
        />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="form-field filter-select">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="form-field filter-select">
          <option value="">Newest First</option>
          <option value="ending-soon">Ending Soon</option>
          <option value="highest-bid">Highest Bid</option>
          <option value="most-participants">Most Participants</option>
        </select>
      </div>

      {loading && <p>Loading auctions...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && auctions.length === 0 && <p>No auctions found.</p>}
      <div className="auction-grid">
        {auctions.map((auction) => (
          <AuctionCard key={auction._id} auction={auction} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
