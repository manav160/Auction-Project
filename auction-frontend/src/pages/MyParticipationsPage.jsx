import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const STATUS_GROUPS = [
  { key: 'ACTIVE',             label: '🔴 Live' },
  { key: 'SCHEDULED',          label: '🗓 Scheduled' },
  { key: 'PENDING_RESOLUTION', label: '⏳ Resolving' },
  { key: 'COMPLETED',          label: '✅ Completed' },
  { key: 'UNSOLD',             label: '📦 Unsold' },
  { key: 'CANCELED',           label: '🚫 Canceled' },
];

const normalizeStatus = (s) => {
  if (!s) return 'CANCELED';
  const upper = String(s).toUpperCase();
  if (upper === 'CLOSED') return 'COMPLETED';
  return upper;
};

const MyParticipationsPage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyParticipations = async () => {
      try {
        const res = await api.get('/participations/me');
        setAuctions(res.data);
      } catch (err) {
        console.error('Failed to load participations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyParticipations();
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>My Participations</h1>
        <p className="page-subtitle">Auctions you've joined</p>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && auctions.length === 0 && (
        <p>You haven't joined any auctions yet.</p>
      )}

      {!loading && auctions.length > 0 && STATUS_GROUPS.map(group => {
        const grouped = auctions.filter(a => normalizeStatus(a.status) === group.key);
        if (grouped.length === 0) return null;
        return (
          <section key={group.key} className="auction-group">
            <h2 className="auction-group-title">{group.label}</h2>
            <div className="auction-grid">
              {grouped.map(auction => <AuctionCard key={auction._id} auction={auction} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default MyParticipationsPage;
