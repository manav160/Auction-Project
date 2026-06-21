import React from 'react';

const BidHistory = ({ bids }) => {
  if (!bids || bids.length === 0) {
    return (
      <div className="history-card">
        <h3>Bid History</h3>
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No bids yet</p>
      </div>
    );
  }

  return (
    <div className="history-card">
      <h3>Bid History</h3>
      <ul className="bid-list">
        {bids.map((bid, index) => (
          <li key={bid._id || index} className="bid-item">
            <div className="bid-item-info">
              <span className="bid-user">{bid.userId?.name || 'Anonymous'}</span>
              <span className="bid-time">{new Date(bid.createdAt).toLocaleString()}</span>
            </div>
            <span className="bid-amount">₹{bid.amount?.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BidHistory;
