import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const AdminAuctions = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/auctions').then(res => setAuctions(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header"><h1>All Auctions (Admin)</h1></div>
      {loading ? <p>Loading...</p> : (
        <div className="auction-grid">
          {auctions.map(a => <AuctionCard key={a._id} auction={a} />)}
        </div>
      )}
    </div>
  );
};

export default AdminAuctions;
