import React, { useState, useEffect } from 'react';
import { ShieldCheck, PackageSearch } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const STATUS_GROUPS = [
  { key: 'ACTIVE',             label: 'Live Auctions', isLive: true },
  { key: 'SCHEDULED',          label: 'Scheduled Auctions' },
  { key: 'PENDING_RESOLUTION', label: 'Resolving Settlement' },
  { key: 'COMPLETED',          label: 'Completed Auctions' },
  { key: 'UNSOLD',             label: 'Unsold Auctions' },
  { key: 'CANCELED',           label: 'Canceled Auctions' },
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
        const data = res.data;
        setAuctions(Array.isArray(data) ? data : (data?.participations || []));
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
        <h1>
          <ShieldCheck size={28} style={{ color: '#10b981', marginRight: '10px', verticalAlign: 'middle', display: 'inline' }} />
          My Bids & Participations
        </h1>
        <p className="page-subtitle">Track live, completed, and joined auction events</p>
      </div>

      {loading && (
        <div className="loading-box">
          <div className="loading-spinner" />
          <p>Loading joined auctions...</p>
        </div>
      )}

      {!loading && auctions.length === 0 && (
        <div className="empty-results-box">
          <PackageSearch size={48} className="empty-icon-svg" />
          <h3>No joined auctions</h3>
          <p>You haven't participated in any live auctions yet.</p>
        </div>
      )}

      {!loading && auctions.length > 0 && STATUS_GROUPS.map(group => {
        const grouped = auctions.filter(a => normalizeStatus(a.status) === group.key);
        if (grouped.length === 0) return null;
        return (
          <section key={group.key} className="auction-group">
            <h2 className="auction-group-title">
              {group.isLive && <span className="pulse-dot" />}
              {group.label}
            </h2>
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
