import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_META = {
  DRAFT:               { label: 'Draft',              css: 'status-draft' },
  SCHEDULED:           { label: 'Scheduled',          css: 'status-scheduled' },
  ACTIVE:              { label: 'Live',               css: 'status-active' },
  PENDING_RESOLUTION:  { label: 'Resolving…',         css: 'status-pending' },
  COMPLETED:           { label: 'Completed',          css: 'status-completed' },
  UNSOLD:              { label: 'Unsold',             css: 'status-unsold' },
  CANCELED:            { label: 'Canceled',           css: 'status-closed' },
};

const AuctionCard = ({ auction, onExtend }) => {
  const navigate = useNavigate();
  const handleClick = () => navigate(`/auction/${auction._id}`);

  const rawStatus = auction.status || (auction.isActive ? 'ACTIVE' : 'CANCELED');
  const meta = STATUS_META[rawStatus] || { label: rawStatus, css: 'status-draft' };

  const isLive      = rawStatus === 'ACTIVE';
  const isScheduled = rawStatus === 'SCHEDULED';
  const isPremium   = auction.listingType === 'PREMIUM';

  return (
    <div className={`auction-card-wrapper ${isPremium ? 'premium-wrapper' : ''}`}>
      <div className={`auction-card ${isPremium ? 'premium-card' : ''}`} onClick={handleClick}>
        {auction.imageUrl && (
          <div className="card-image-container">
            <img
              src={auction.imageUrl}
              alt={auction.title}
              className="card-product-image"
            />
          </div>
        )}
        <div className="auction-card-header">
          <h3>
            {isPremium && <span className="premium-star" title="Premium Listing">⭐ </span>}
            {auction.title}
          </h3>
          <div className="status-badge-group" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {isPremium && <span className="status-pill premium-badge" style={{ backgroundColor: '#ffd700', color: '#000', fontWeight: 'bold' }}>PREMIUM</span>}
            <span className={`status-pill ${meta.css}`}>{meta.label}</span>
          </div>
        </div>
        <div className="auction-card-body">
          <p><strong>Current Bid:</strong> ₹{auction.currentHighestBid?.toLocaleString()}</p>
          <p><strong>Participants:</strong> {auction.participantsCount} / {auction.maxParticipants}</p>

          {auction.entryFee > 0 ? (
            <p><strong>Entry Fee:</strong> <span style={{ color: '#d97706', fontWeight: 'bold' }}>₹{auction.entryFee}</span></p>
          ) : (
            <p><strong>Entry Fee:</strong> <span style={{ color: '#16a34a' }}>Free</span></p>
          )}

          {isScheduled && auction.startDate && (
            <p><strong>Starts:</strong> {new Date(auction.startDate).toLocaleString()}</p>
          )}

          <p><strong>{isLive ? 'Ends:' : isScheduled ? 'Ends (after start):' : 'Ended:'}</strong> {new Date(auction.endDate).toLocaleString()}</p>

          {auction.isParticipated && (
            <span className="participated-badge">✓ Joined</span>
          )}
        </div>
      </div>

      {onExtend && isLive && (
        <button
          className="extend-button"
          onClick={(e) => { e.stopPropagation(); onExtend(auction._id); }}
        >
          ⏱ Extend
        </button>
      )}
    </div>
  );
};

export default AuctionCard;
