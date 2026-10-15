import React, { useState, useEffect } from 'react';
import { ShieldCheck, PackageSearch } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { STATUS_GROUPS, normalizeAuctionStatus } from '../utils/constants';

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
          My Bids &amp; Participations
        </h1>
        <p className="page-subtitle">Track live, completed, and joined auction events</p>
      </div>

      {loading && (
        <LoadingSpinner message="Loading joined auctions..." />
      )}

      {!loading && auctions.length === 0 && (
        <div className="empty-results-box">
          <PackageSearch size={48} className="empty-icon-svg" />
          <h3>No joined auctions</h3>
          <p>You haven't participated in any live auctions yet.</p>
        </div>
      )}

      {!loading && auctions.length > 0 && STATUS_GROUPS.map(group => {
        const grouped = auctions.filter(a => normalizeAuctionStatus(a.status) === group.key);
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
