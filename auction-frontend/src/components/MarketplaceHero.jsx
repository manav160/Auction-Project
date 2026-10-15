import React, { memo } from 'react';
import { Sparkles, ShieldCheck, Zap } from 'lucide-react';

const MarketplaceHero = () => {
  return (
    <div className="hero-marketplace-banner">
      <div className="hero-banner-content">
        <div className="hero-badge">
          <Sparkles size={14} className="hero-badge-icon" />
          <span>Next-Gen Auction Ledger</span>
        </div>
        <h1>Discover &amp; Bid on Exclusive Auctions</h1>
        <p className="hero-subtitle">
          Real-time anti-snipe bidding, instant settlements, and verified marketplace listings.
        </p>

        <div className="hero-stats-row">
          <div className="hero-stat-item">
            <span className="hero-stat-val">
              <span className="pulse-dot" /> Live
            </span>
            <span className="hero-stat-lbl">Real-time Bidding</span>
          </div>
          <div className="hero-stat-item">
            <span className="hero-stat-val">
              <ShieldCheck size={16} style={{ color: '#10b981', display: 'inline', marginRight: '4px' }} /> Verified
            </span>
            <span className="hero-stat-lbl">Ledger Escrow</span>
          </div>
          <div className="hero-stat-item">
            <span className="hero-stat-val">
              <Zap size={16} style={{ color: '#8b5cf6', display: 'inline', marginRight: '4px' }} /> Instant
            </span>
            <span className="hero-stat-lbl">Buy Now Option</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MarketplaceHero);
