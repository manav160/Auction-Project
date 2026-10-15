import React, { memo } from 'react';
import { Zap } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const AuctionInfoGrid = ({
  auction,
  isLive,
  timeLeft,
  isUrgent
}) => {
  return (
    <div className="auction-info-grid">
      {/* Current Highest Bid */}
      <div className="info-tile highlight-tile">
        <span className="info-label">Current Highest Bid</span>
        <span className="info-value price-value">
          {formatCurrency(auction.currentHighestBid || 0)}
        </span>
      </div>

      {/* Buy Now Price if present */}
      {auction.buyNowPrice && (
        <div className="info-tile buynow-tile">
          <span className="info-label">Buy Now Price</span>
          <span className="info-value buynow-value">
            <Zap size={16} style={{ display: 'inline', marginRight: '4px' }} />
            {formatCurrency(auction.buyNowPrice)}
          </span>
        </div>
      )}

      {/* Entry Fee */}
      <div className="info-tile">
        <span className="info-label">Entry Fee</span>
        <span className="info-value">
          {auction.entryFee > 0 ? formatCurrency(auction.entryFee) : 'Free'}
        </span>
      </div>

      {/* User's Highest Bid */}
      {auction.userBid && (
        <div className="info-tile user-bid-tile">
          <span className="info-label">Your Highest Bid</span>
          <span className="info-value user-bid-value">
            {formatCurrency(auction.userBid)}
          </span>
        </div>
      )}

      {/* Time Remaining / Ended At */}
      <div className="info-tile">
        <span className="info-label">{isLive ? 'Time Remaining' : 'Ended At'}</span>
        <span className={`info-value ${!isLive ? 'time-ended' : isUrgent ? 'time-urgent' : 'time-active'}`}>
          {isLive ? timeLeft : formatDateTime(auction.endDate)}
        </span>
      </div>

      {/* Participants Count */}
      <div className="info-tile">
        <span className="info-label">Participants</span>
        <span className="info-value">
          {auction.endCondition === 'time' 
            ? auction.participantsCount 
            : `${auction.participantsCount} / ${auction.maxParticipants || 15}`
          }
        </span>
      </div>
    </div>
  );
};

export default memo(AuctionInfoGrid);
