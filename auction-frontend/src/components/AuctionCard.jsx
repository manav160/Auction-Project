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

const AuctionCard = ({ auction, onExtend, onToggleWatchlist }) => {
  const navigate = useNavigate();
  const handleClick = () => navigate(`/auction/${auction._id}`);

  const rawStatus = auction.status || (auction.isActive ? 'ACTIVE' : 'CANCELED');
  const meta = STATUS_META[rawStatus] || { label: rawStatus, css: 'status-draft' };

  const isLive      = rawStatus === 'ACTIVE';
  const isScheduled = rawStatus === 'SCHEDULED';
  const isPremium   = auction.listingType === 'PREMIUM';
  const hasBuyNow   = auction.buyNowPrice && auction.buyNowPrice > 0;

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
          <div className="status-badge-group" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isPremium && <span className="status-pill premium-badge" style={{ backgroundColor: '#ffd700', color: '#000', fontWeight: 'bold' }}>PREMIUM</span>}
            <span className={`status-pill ${meta.css}`}>{meta.label}</span>
          </div>
        </div>
        <div className="auction-card-body">
          <p><strong>Current Bid:</strong> ₹{auction.currentHighestBid?.toLocaleString()}</p>
          
          {hasBuyNow && (
            <p><strong>Buy Now:</strong> <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>⚡ ₹{auction.buyNowPrice?.toLocaleString()}</span></p>
          )}

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

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {auction.category && auction.category !== 'Other' && (
              <span className="status-pill" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', fontSize: '0.7rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                {auction.category}
              </span>
            )}
            {auction.condition && (
              <span className="status-pill" style={{ backgroundColor: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', fontSize: '0.7rem', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                {auction.condition.replace('_', ' ')}
              </span>
            )}
          </div>

          {auction.isParticipated && (
            <span className="participated-badge" style={{ marginTop: '0.5rem', display: 'inline-block' }}>✓ Joined</span>
          )}
        </div>
      </div>

      <div className="card-actions" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem 1rem' }}>
        {onExtend && isLive && (
          <button
            className="extend-button"
            style={{ flex: 1 }}
            onClick={(e) => { e.stopPropagation(); onExtend(auction._id); }}
          >
            ⏱ Extend
          </button>
        )}
        {onToggleWatchlist && (
          <button
            className={`watchlist-heart-btn ${auction.isWatchlisted ? 'watchlisted' : ''}`}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.4rem 0.6rem',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
            }}
            onClick={(e) => { e.stopPropagation(); onToggleWatchlist(auction._id); }}
            title={auction.isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            {auction.isWatchlisted ? '❤️' : '🤍'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AuctionCard;
