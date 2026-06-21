import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const MyParticipationsPage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyParticipations = async () => {
      try {
        const res = await api.get('/participations/me');
        setAuctions(res.data);
      } catch (err) {
        setError('Failed to load your participations');
      } finally {
        setLoading(false);
      }
    };
    fetchMyParticipations();
  }, []);

  const active = auctions.filter(a => a.status === 'Active');
  const closed = auctions.filter(a => a.status === 'Closed');

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>My Participations</h1>
        <p className="page-subtitle">Auctions you've joined</p>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && auctions.length === 0 && (
        <p>You haven't joined any auctions yet.</p>
      )}

      {active.length > 0 && (
        <>
          <h2>Active Auctions</h2>
          <div className="auction-grid">
            {active.map(auction => <AuctionCard key={auction._id} auction={auction} />)}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2>Closed Auctions</h2>
          <div className="auction-grid">
            {closed.map(auction => <AuctionCard key={auction._id} auction={auction} />)}
          </div>
        </>
      )}
    </div>
  );
};

export default MyParticipationsPage;
