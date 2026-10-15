import React, { memo } from 'react';
import { Zap, Award, Box, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const AuctionStatusBanner = ({ status, buyNowPurchased, currentHighestBid, winnerName }) => {
  if (status === 'COMPLETED') {
    return (
      <div className={`status-banner ${buyNowPurchased ? 'buynow-banner' : 'completed-banner'}`}>
        <div className="banner-icon">
          {buyNowPurchased ? <Zap size={28} /> : <Award size={28} />}
        </div>
        <div className="banner-content">
          <span className="banner-subtitle">
            {buyNowPurchased ? 'Sold via Buy Now' : 'Auction Settled'}
          </span>
          <h3 className="banner-title">
            {buyNowPurchased 
              ? `Purchased instantly by ${winnerName || 'Buyer'} for ${formatCurrency(currentHighestBid)}`
              : `Won by ${winnerName || 'Highest Bidder'} for ${formatCurrency(currentHighestBid)}`
            }
          </h3>
        </div>
        <div className="banner-amount">
          {formatCurrency(currentHighestBid)}
        </div>
      </div>
    );
  }

  if (status === 'UNSOLD') {
    return (
      <div className="status-banner unsold-banner">
        <div className="banner-icon"><Box size={28} /></div>
        <div className="banner-content">
          <span className="banner-subtitle">Auction Ended</span>
          <h3 className="banner-title">Unsold — No bids were placed</h3>
        </div>
      </div>
    );
  }

  if (status === 'PENDING_RESOLUTION') {
    return (
      <div className="status-banner pending-banner">
        <div className="banner-icon"><Clock size={28} /></div>
        <div className="banner-content">
          <span className="banner-subtitle">Bidding Closed</span>
          <h3 className="banner-title">Resolving final settlement…</h3>
        </div>
      </div>
    );
  }

  if (status === 'CANCELED') {
    return (
      <div className="status-banner canceled-banner">
        <div className="banner-icon"><AlertCircle size={28} /></div>
        <div className="banner-content">
          <span className="banner-subtitle">Status</span>
          <h3 className="banner-title">This auction was canceled by the seller</h3>
        </div>
      </div>
    );
  }

  return null;
};

export default memo(AuctionStatusBanner);
