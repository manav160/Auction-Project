import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, Clock, Heart, ArrowRight, Clock3, CheckCircle2 } from 'lucide-react';

const STATUS_META = {
  DRAFT: { label: 'Draft', css: 'status-draft', icon: null },
  SCHEDULED: { label: 'Scheduled', css: 'status-scheduled', icon: Clock },
  ACTIVE: { label: 'Live', css: 'status-active', isLive: true },
  PENDING_RESOLUTION: { label: 'Resolving', css: 'status-pending', icon: Clock3 },
  COMPLETED: { label: 'Completed', css: 'status-completed', icon: CheckCircle2 },
  UNSOLD: { label: 'Unsold', css: 'status-unsold', icon: null },
  CANCELED: { label: 'Canceled', css: 'status-closed', icon: null },
};

const formatTimeLeft = (endDateStr, status) => {
  if (status && status !== 'ACTIVE') return null;
  const diff = new Date(endDateStr).getTime() - Date.now();
  if (diff <= 0) return { text: 'Ended', urgency: 'ended' };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  let text;
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    text = `${days}d ${remHours}h`;
  } else if (hours > 0) {
    text = `${hours}h ${mins}m`;
  } else {
    text = `${mins}m`;
  }
  const urgency = hours === 0 && mins < 10 ? 'critical' : hours === 0 ? 'warning' : 'normal';
  return { text, urgency };
};

const AuctionCard = ({ auction, onExtend, onToggleWatchlist }) => {
  const navigate = useNavigate();
  const handleClick = () => navigate(`/auction/${auction._id}`);

  const rawStatus = auction.status || (auction.isActive ? 'ACTIVE' : 'CANCELED');
  const meta = STATUS_META[rawStatus] || { label: rawStatus, css: 'status-draft' };

  const isLive = rawStatus === 'ACTIVE';
  const isPremium = auction.listingType === 'PREMIUM';
  const hasBuyNow = auction.buyNowPrice && auction.buyNowPrice > 0 && (!auction.currentHighestBid || auction.currentHighestBid < 0.8 * auction.buyNowPrice);

  const imageSrc = auction.picture
    ? (auction.picture.startsWith('http') ? auction.picture : `http://localhost:3001${auction.picture}`)
    : auction.imageUrl;

  const timeRemainingText = formatTimeLeft(auction.endDate, rawStatus);

  return (
    <div className={`auction-card-wrapper ${isPremium ? 'premium-wrapper' : ''}`}>
      <div className={`auction-card ${isPremium ? 'premium-card' : ''}`} onClick={handleClick}>

        {/* Product Image Frame with Overlay Badges */}
        <div className="card-image-box">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={auction.title}
              className="card-hero-img"
            />
          ) : (
            <div className="card-placeholder-img">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="placeholder-text">No Image</span>
            </div>
          )}

          {/* Top-Left Status Badge */}
          <span className={`card-status-badge ${meta.css}`}>
            {meta.isLive && <span className="pulse-dot" />}
            {meta.label}
          </span>

          {/* Top-Right Watchlist Heart Button */}
          {onToggleWatchlist && (
            <button
              type="button"
              className={`card-watchlist-btn ${auction.isWatchlisted ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleWatchlist(auction._id); }}
              title={auction.isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
              aria-label="Toggle Watchlist"
            >
              <Heart
                size={16}
                fill={auction.isWatchlisted ? "currentColor" : "none"}
                stroke="currentColor"
              />
            </button>
          )}
        </div>

        <div className="card-content-body">
          <div className="card-title-row">
            <h3 className="card-item-title">
              {isPremium && <Sparkles size={16} style={{ color: '#f59e0b', marginRight: '6px', verticalAlign: 'middle' }} />}
              {auction.title}
            </h3>
          </div>

          {/* Strong Financial Current Bid */}
          <div className="card-financial-box">
            <div className="price-label">Current Bid</div>
            <div className="price-amount">₹{auction.currentHighestBid?.toLocaleString() || '0'}</div>
          </div>

          {hasBuyNow && (
            <div className="card-buynow-row">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={14} style={{ color: '#8b5cf6' }} /> Buy Now
              </span>
              <strong style={{ color: '#8b5cf6' }}>₹{auction.buyNowPrice?.toLocaleString()}</strong>
            </div>
          )}

          {/* Metadata Row */}
          <div className="card-meta-details">
            <div className="meta-item">
              <span className="meta-label">Participants</span>
              <span className="meta-val">{auction.participantsCount || 0} / {auction.maxParticipants || 15}</span>
            </div>

            <div className="meta-item">
              <span className="meta-label">Entry Fee</span>
              <span className="meta-val" style={{ color: auction.entryFee > 0 ? '#f59e0b' : '#10b981' }}>
                {auction.entryFee > 0 ? `₹${auction.entryFee}` : 'Free'}
              </span>
            </div>

            {timeRemainingText && (
              <div className="meta-item">
                <span className="meta-label">{isLive ? 'Ends in' : 'Ended'}</span>
                <span className={`meta-val countdown-val ${timeRemainingText.urgency === 'critical' ? 'countdown-critical' : timeRemainingText.urgency === 'warning' ? 'countdown-warning' : ''}`}>
                  {timeRemainingText.text}
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="card-tags-bar">
            {auction.category && auction.category !== 'Other' && (
              <span className="card-tag category-tag">{auction.category}</span>
            )}
            {auction.condition && (
              <span className="card-tag condition-tag">{auction.condition.replace('_', ' ')}</span>
            )}
            {auction.isParticipated && (
              <span className="card-tag participated-tag">✓ Joined</span>
            )}
          </div>
        </div>

        {onExtend && isLive && (
          <div className="card-extend-bar">
            <button
              className="extend-button"
              onClick={(e) => { e.stopPropagation(); onExtend(auction._id); }}
            >
              <Clock size={14} style={{ marginRight: '6px' }} />
              Extend Auction
            </button>
          </div>
        )}

        {/* Subtle primary action */}
        <div className="card-view-action">
          <span className="view-auction-link">
            View Auction <ArrowRight size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuctionCard;


