import React, { memo } from 'react';
import { Gavel, Zap } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const AuctionBiddingControls = ({
  auction,
  isLive,
  isBuyer,
  bidAmount,
  setBidAmount,
  disableUnjoin,
  unjoinTitle,
  onJoinToggle,
  onIncreaseBid,
  onBid,
  onBuyNow
}) => {
  if (!isLive || auction.isOwner || !isBuyer) return null;

  const showBuyNowAction = auction.buyNowPrice && (!auction.currentHighestBid || auction.currentHighestBid < 0.8 * auction.buyNowPrice);

  return (
    <>
      {/* Buy Now Option Box */}
      {showBuyNowAction && (
        <div className="buynow-action-box">
          <div className="buynow-action-info">
            <h4>Instant Purchase Available</h4>
            <p>Skip bidding and secure this item immediately.</p>
          </div>
          <button onClick={onBuyNow} className="buynow-confirm-btn">
            <Zap size={16} style={{ marginRight: '6px' }} />
            Buy Now for {formatCurrency(auction.buyNowPrice)}
          </button>
        </div>
      )}

      {/* Join Auction CTA (when not joined yet) */}
      {!auction.isParticipated && (
        <div className="join-action-box">
          <button onClick={onJoinToggle} className="btn-primary-action join-btn">
            {auction.entryFee > 0 
              ? `Pay ${formatCurrency(auction.entryFee)} Entry Fee & Join Auction` 
              : 'Join Auction'}
          </button>
        </div>
      )}

      {/* Bidding Controls Card (when participated) */}
      {auction.isParticipated && (
        <div className="bidding-control-card">
          <div className="control-card-header">
            <h3>
              <Gavel size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Bidding Controls
            </h3>
            <button 
              onClick={onJoinToggle} 
              className="unjoin-link-btn"
              disabled={disableUnjoin}
              title={unjoinTitle}
              style={disableUnjoin ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              Unjoin Auction
            </button>
          </div>

          <div className="quick-increment-group">
            <span className="control-section-label">Quick Bid Increment</span>
            <div className="increment-pill-row">
              {(auction.bidIncrementOptions || [100, 500, 1000]).map(opt => (
                <button key={opt} onClick={() => onIncreaseBid(opt)} className="quick-bid-btn">
                  +{formatCurrency(opt)}
                </button>
              ))}
            </div>
          </div>

          <div className="custom-bid-group">
            <span className="control-section-label">
              Custom Bid Amount (Min: {formatCurrency(auction.minAllowedBid || 0)})
            </span>
            <div className="custom-bid-input-row">
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`e.g. ₹${auction.minAllowedBid}`}
                className="form-field custom-bid-field"
                min={auction.minAllowedBid}
              />
              <button onClick={onBid} className="btn-primary-action">
                Place Bid
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(AuctionBiddingControls);
