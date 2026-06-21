import React from 'react';
import { useNavigate } from 'react-router-dom';

const AuctionCard = ({ auction, onExtend }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/auction/${auction._id}`);
  };

  const isClosed = auction.status === 'Closed' || !auction.isActive;

  return (
    <div className="auction-card-wrapper">
      <div className="auction-card" onClick={handleClick}>
        {auction.picture && (
          <div className="card-image-container">
            <img
              src={`http://localhost:3001${auction.picture}`}
              alt={auction.title}
              className="card-product-image"
            />
          </div>
        )}
        <div className="auction-card-header">
          <h3>{auction.title}</h3>
          <span className={`status-pill ${isClosed ? 'status-closed' : 'status-active'}`}>
            {auction.status}
          </span>
        </div>
        <div className="auction-card-body">
          <p><strong>Current Bid:</strong> ₹{auction.currentHighestBid}</p>
          <p><strong>Participants:</strong> {auction.participantsCount} / {auction.maxParticipants}</p>
          <p><strong>Ends:</strong> {new Date(auction.endDate).toLocaleString()}</p>
          {auction.isParticipated && (
            <span className="participated-badge">✓ Joined</span>
          )}
        </div>
      </div>
      {onExtend && !isClosed && (
        <button
          className="extend-button"
          onClick={(e) => { e.stopPropagation(); onExtend(auction._id); }}
        >
          Extend
        </button>
      )}
    </div>
  );
};

export default AuctionCard;
