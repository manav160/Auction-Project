import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Sparkles, Clock, Heart, Zap, Award, CheckCircle2, AlertCircle, Gavel, Box } from 'lucide-react';
import api from '../services/api';
import { isBuyer } from '../services/auth';
import BidHistory from '../components/BidHistory';
import ParticipantsList from '../components/ParticipantsList';
import BidChart from '../components/BidChart';
import { useConfirm } from '../utils/useConfirm';

const AuctionDetailPage = () => {
  const { id } = useParams();
  const { showConfirm, ConfirmDialog } = useConfirm();
  const [auction, setAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [errorDismissing, setErrorDismissing] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const errorTimerRef = useRef(null);

  const triggerSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  const dismissError = useCallback(() => {
    setErrorDismissing(true);
    setTimeout(() => {
      setError('');
      setErrorDismissing(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (error) {
      setErrorDismissing(false);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        dismissError();
      }, 5000);
      return () => clearTimeout(errorTimerRef.current);
    }
  }, [error, dismissError]);

  const fetchAuction = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/${id}`);
      setAuction(response.data);
      if (response.data.isParticipated) {
        setBidAmount(response.data.minAllowedBid);
      }
    } catch (err) {
      setLoadError('Failed to load auction');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchBidHistory = useCallback(async () => {
    try {
      const res = await api.get(`/bid/${id}`);
      setBidHistory(res.data);
    } catch (err) {
      console.error('Failed to load bid history', err);
    }
  }, [id]);

  const fetchBidHistoryRef = useRef(fetchBidHistory);
  useEffect(() => {
    fetchBidHistoryRef.current = fetchBidHistory;
  }, [fetchBidHistory]);

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await api.get(`/participations/${id}`);
      setParticipants(res.data);
    } catch (err) {
      console.error('Failed to load participants', err);
    }
  }, [id]);

  const [extendDays, setExtendDays] = useState(1);

  const handleExtend = async () => {
    const confirmed = await showConfirm({
      title: 'Extend Auction Duration',
      message: `Extending the auction by ${extendDays} day(s) will cost ₹${extendDays * 100} extension fee. Proceed?`,
      confirmText: 'Extend Auction',
      confirmVariant: 'warning'
    });
    if (!confirmed) return;
    try {
      await api.post(`/auctions/${id}/extend`, { days: extendDays });
      triggerSuccess(`Auction extended by ${extendDays} day(s)`);
      fetchAuction();
    } catch (err) {
      setError(err.response?.data?.message || 'Extension failed');
    }
  };

  useEffect(() => {
    fetchAuction();
    fetchBidHistory();
    fetchParticipants();

    const socket = io('http://localhost:3001');
    socket.emit('joinAuction', id);

    socket.on('bidUpdated', (data) => {
      setAuction(prev => prev ? {
        ...prev,
        currentHighestBid: data.currentHighestBid,
        minAllowedBid: data.minAllowedBid,
        endDate: data.endDate || prev.endDate,
        winner: data.winner || prev.winner,
      } : prev);

      fetchBidHistoryRef.current();

      if (data.minAllowedBid) {
        setBidAmount(data.minAllowedBid);
      }
    });

    socket.on('auctionCompleted', (data) => {
      setAuction(prev => prev ? {
        ...prev,
        status: 'COMPLETED',
        winner: data.winner,
        currentHighestBid: data.winningBid || prev.currentHighestBid,
      } : prev);
      fetchBidHistoryRef.current();
    });

    socket.on('auctionExtended', (data) => {
      setAuction(prev => prev ? {
        ...prev,
        endDate: data.endDate,
      } : prev);
    });

    return () => {
      socket.emit('leaveAuction', id);
      socket.disconnect();
    };
  }, [id, fetchAuction, fetchParticipants]);

  useEffect(() => {
    if (!auction?.endDate) return;
    const calculateTime = () => {
      if (auction.status && auction.status !== 'ACTIVE') {
        setTimeLeft(auction.status);
        setIsUrgent(false);
        return true;
      }

      const diff = new Date(auction.endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Auction Ended');
        setIsUrgent(false);
        fetchAuction();
        return true;
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let formatted = '';
        if (days > 0) {
          formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
          formatted = `${hours}h ${minutes}m ${seconds}s`;
        } else {
          formatted = `${minutes}m ${seconds}s`;
        }

        setTimeLeft(formatted);
        setIsUrgent(diff < 3600000);
        return false;
      }
    };
    calculateTime();
    const timer = setInterval(() => {
      if (calculateTime()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [auction?.endDate, auction?.status, fetchAuction]);

  const handleJoinToggle = async () => {
    const wasParticipated = auction.isParticipated;

    if (wasParticipated) {
      if (auction.userBid) {
        setError('Cannot unjoin after placing a bid.');
        return;
      }
      if (new Date(auction.endDate).getTime() - Date.now() <= 300000) {
        setError('Cannot unjoin an auction in its final phase (last 5 minutes).');
        return;
      }
      const confirmed = await showConfirm({
        title: 'Unjoin Auction',
        message: 'Are you sure you want to unjoin this auction? Your entry fee will be refunded.',
        confirmText: 'Unjoin',
        confirmVariant: 'warning'
      });
      if (!confirmed) return;
    } else {
      const entryFeeMsg = auction.entryFee > 0 
        ? `Joining requires an entry fee of ₹${auction.entryFee}. Proceed?` 
        : 'Are you sure you want to join this auction?';
      const confirmed = await showConfirm({
        title: 'Join Auction',
        message: entryFeeMsg,
        confirmText: 'Join Now',
        confirmVariant: 'primary'
      });
      if (!confirmed) return;
    }

    setAuction(prev => ({
      ...prev,
      isParticipated: !wasParticipated,
      participantsCount: wasParticipated
        ? Math.max(0, prev.participantsCount - 1)
        : prev.participantsCount + 1,
    }));

    try {
      if (wasParticipated) {
        await api.delete(`/join/${id}`);
        fetchAuction();
        fetchParticipants();
        triggerSuccess('You unjoined the auction. Entry fee refunded.');
      } else {
        const res = await api.post(`/join`, { auctionId: id });
        fetchAuction();
        fetchParticipants();
        if (res.data?.message === 'Already joined' || res.data?.joined) {
          triggerSuccess('You have already joined this auction!');
        } else {
          triggerSuccess('Successfully joined the auction!');
        }
      }
    } catch (err) {
      setAuction(prev => ({
        ...prev,
        isParticipated: wasParticipated,
        participantsCount: wasParticipated
          ? prev.participantsCount + 1
          : Math.max(0, prev.participantsCount - 1),
      }));
      if (wasParticipated) {
        fetchBidHistory();
      }
      setError(err.response?.data?.message || 'Action failed');
    }
  };

  const handleIncreaseBid = async (increment) => {
    const confirmed = await showConfirm({
      title: 'Increase Bid Amount',
      message: `Are you sure you want to increase your bid by ₹${increment}?`,
      confirmText: 'Place Higher Bid',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;
    try {
      await api.post('/buyer/increase-bid', { auctionId: id, increment });
      fetchAuction(); 
      triggerSuccess(`Successfully increased your bid by ₹${increment}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to increase bid');
    }
  };
  const handleToggleWatchlist = async () => {
    try {
      const res = await api.post(`/watchlist/${id}/toggle`);
      setAuction(prev => ({ ...prev, isWatchlisted: res.data.isWatchlisted }));
      triggerSuccess(res.data.isWatchlisted ? 'Saved to Watchlist' : 'Removed from Watchlist');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle watchlist');
    }
  };

  const handleBuyNow = async () => {
    const confirmed = await showConfirm({
      title: 'Buy Now Confirmation',
      message: `Are you sure you want to purchase this item immediately for ₹${auction.buyNowPrice?.toLocaleString()}?`,
      confirmText: 'Buy Now',
      confirmVariant: 'success'
    });
    if (!confirmed) return;
    try {
      await api.post(`/auctions/${id}/buynow`);
      triggerSuccess('Congratulations! You purchased the item via Buy Now');
      fetchAuction();
      fetchBidHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Buy Now purchase failed');
    }
  };

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);
    if (amount < auction.minAllowedBid) {
      setError(`Bid must be at least ₹${auction.minAllowedBid}`);
      return;
    }
    const confirmed = await showConfirm({
      title: 'Confirm Your Bid',
      message: `Are you sure you want to place a bid of ₹${amount}?`,
      confirmText: 'Confirm Bid',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;
    try {
      await api.post('/bid', { auctionId: id, bidAmount: amount });
      triggerSuccess(`Bid of ₹${amount} placed successfully!`);
      setBidAmount('');
      fetchAuction();
      fetchBidHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid');
    }
  };

  if (loading) return (
    <div className="page-shell">
      <div className="loading-box">
        <div className="loading-spinner" />
        <p>Loading auction details...</p>
      </div>
    </div>
  );

  if (loadError || !auction) return (
    <div className="page-shell">
      <div className="empty-results-box">
        <AlertCircle size={40} className="empty-icon-svg" />
        <h3>Auction Not Found</h3>
        <p>{loadError || 'The requested auction does not exist.'}</p>
      </div>
    </div>
  );

  const isLive   = auction.status === 'ACTIVE';
  const isPremium  = auction.listingType === 'PREMIUM';
  const winnerName = auction.winner ? (typeof auction.winner === 'object' ? auction.winner.name : 'Winner') : null;

  const timeBeforeEnd = new Date(auction.endDate).getTime() - Date.now();
  const disableUnjoin = Boolean(auction.userBid) || (timeBeforeEnd <= 300000);
  let unjoinTitle = '';
  if (auction.userBid) unjoinTitle = 'Cannot unjoin after placing a bid';
  else if (timeBeforeEnd <= 300000) unjoinTitle = 'Cannot unjoin during final 5 minutes';

  return (
    <div className="page-shell auction-detail-shell">
      {successMessage && (
        <div className="success-popup">
          <CheckCircle2 size={20} className="success-popup-icon" />
          <span className="success-popup-text">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className={`error-toast ${errorDismissing ? 'error-toast-exit' : ''}`}>
          <div className="error-toast-accent" />
          <AlertCircle size={22} className="error-toast-icon" />
          <div className="error-toast-body">
            <div className="error-toast-title">Notice</div>
            <div className="error-toast-message">{error}</div>
          </div>
          <button className="error-toast-close" onClick={dismissError}>
            ✕
          </button>
        </div>
      )}

      <div className="auction-detail-layout">
        <div className="auction-main-col">
          <article className="auction-primary-card">
            <header className="auction-header-section">
              <div className="auction-header-top">
                <div className="auction-title-group">
                  <h1 className="auction-main-title">
                    {isPremium && <Sparkles size={22} style={{ color: '#f59e0b', marginRight: '8px', verticalAlign: 'middle' }} />}
                    {auction.title}
                  </h1>

                  <div className="auction-badge-bar">
                    <span className={`status-pill status-${auction.status?.toLowerCase()}`}>
                      {isLive && <span className="pulse-dot" />}
                      {{
                        ACTIVE:             'Live',
                        SCHEDULED:          'Scheduled',
                        PENDING_RESOLUTION: 'Resolving',
                        COMPLETED:          'Completed',
                        UNSOLD:             'Unsold',
                        CANCELED:           'Canceled',
                        DRAFT:              'Draft',
                      }[auction.status] || auction.status}
                    </span>

                    {isPremium && <span className="status-pill premium-badge">PREMIUM</span>}

                    {auction.category && auction.category !== 'Other' && (
                      <span className="metadata-pill category-pill">
                        {auction.category}
                      </span>
                    )}

                    {auction.condition && (
                      <span className="metadata-pill condition-pill">
                        {auction.condition.replace('_', ' ')}
                      </span>
                    )}

                    {auction.isOwner && <span className="role-tag owner-tag">Your Auction</span>}
                    {auction.isParticipated && <span className="role-tag participant-tag">Participated</span>}
                  </div>
                </div>

                {isBuyer() && !auction.isOwner && (
                  <button
                    className={`watchlist-btn ${auction.isWatchlisted ? 'watchlisted' : ''}`}
                    onClick={handleToggleWatchlist}
                    title={auction.isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    aria-label="Toggle Watchlist"
                  >
                    <Heart
                      size={18}
                      fill={auction.isWatchlisted ? "currentColor" : "none"}
                      stroke="currentColor"
                    />
                    <span>{auction.isWatchlisted ? 'Saved' : 'Save'}</span>
                  </button>
                )}
              </div>
            </header>

            {auction.picture && (
              <div className="auction-image-frame">
                <img 
                  src={`http://localhost:3001${auction.picture}`} 
                  alt={auction.title} 
                  className="auction-hero-image"
                />
              </div>
            )}

            {auction.status === 'COMPLETED' && (
              <div className={`status-banner ${auction.buyNowPurchased ? 'buynow-banner' : 'completed-banner'}`}>
                <div className="banner-icon">
                  {auction.buyNowPurchased ? <Zap size={28} /> : <Award size={28} />}
                </div>
                <div className="banner-content">
                  <span className="banner-subtitle">
                    {auction.buyNowPurchased ? 'Sold via Buy Now' : 'Auction Settled'}
                  </span>
                  <h3 className="banner-title">
                    {auction.buyNowPurchased 
                      ? `Purchased instantly by ${winnerName || 'Buyer'} for ₹${auction.currentHighestBid?.toLocaleString()}`
                      : `Won by ${winnerName || 'Highest Bidder'} for ₹${auction.currentHighestBid?.toLocaleString()}`
                    }
                  </h3>
                </div>
                <div className="banner-amount">
                  ₹{auction.currentHighestBid?.toLocaleString()}
                </div>
              </div>
            )}

            {auction.status === 'UNSOLD' && (
              <div className="status-banner unsold-banner">
                <div className="banner-icon"><Box size={28} /></div>
                <div className="banner-content">
                  <span className="banner-subtitle">Auction Ended</span>
                  <h3 className="banner-title">Unsold — No bids were placed</h3>
                </div>
              </div>
            )}

            {auction.status === 'PENDING_RESOLUTION' && (
              <div className="status-banner pending-banner">
                <div className="banner-icon"><Clock size={28} /></div>
                <div className="banner-content">
                  <span className="banner-subtitle">Bidding Closed</span>
                  <h3 className="banner-title">Resolving final settlement…</h3>
                </div>
              </div>
            )}

            {auction.status === 'CANCELED' && (
              <div className="status-banner canceled-banner">
                <div className="banner-icon"><AlertCircle size={28} /></div>
                <div className="banner-content">
                  <span className="banner-subtitle">Status</span>
                  <h3 className="banner-title">This auction was canceled by the seller</h3>
                </div>
              </div>
            )}

            {auction.description && (
              <div className="auction-description-box">
                <h4 className="section-subtitle">Item Details</h4>
                <p className="auction-description-text">{auction.description}</p>
              </div>
            )}

            <div className="auction-info-grid">
              <div className="info-tile highlight-tile">
                <span className="info-label">Current Highest Bid</span>
                <span className="info-value price-value">₹{auction.currentHighestBid?.toLocaleString() || '0'}</span>
              </div>

              {auction.buyNowPrice && (
                <div className="info-tile buynow-tile">
                  <span className="info-label">Buy Now Price</span>
                  <span className="info-value buynow-value">
                    <Zap size={16} style={{ display: 'inline', marginRight: '4px' }} />
                    ₹{auction.buyNowPrice?.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="info-tile">
                <span className="info-label">Entry Fee</span>
                <span className="info-value">
                  {auction.entryFee > 0 ? `₹${auction.entryFee}` : 'Free'}
                </span>
              </div>

              {auction.userBid && (
                <div className="info-tile user-bid-tile">
                  <span className="info-label">Your Highest Bid</span>
                  <span className="info-value user-bid-value">₹{auction.userBid?.toLocaleString()}</span>
                </div>
              )}

              <div className="info-tile">
                <span className="info-label">{isLive ? 'Time Remaining' : 'Ended At'}</span>
                <span className={`info-value ${!isLive ? 'time-ended' : isUrgent ? 'time-urgent' : 'time-active'}`}>
                  {isLive ? timeLeft : new Date(auction.endDate).toLocaleString()}
                </span>
              </div>

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

            <BidChart bids={bidHistory} />

            {isLive && !auction.isOwner && isBuyer() && auction.buyNowPrice && (!auction.currentHighestBid || auction.currentHighestBid < 0.8 * auction.buyNowPrice) && (
              <div className="buynow-action-box">
                <div className="buynow-action-info">
                  <h4>Instant Purchase Available</h4>
                  <p>Skip bidding and secure this item immediately.</p>
                </div>
                <button onClick={handleBuyNow} className="buynow-confirm-btn">
                  <Zap size={16} style={{ marginRight: '6px' }} />
                  Buy Now for ₹{auction.buyNowPrice?.toLocaleString()}
                </button>
              </div>
            )}

            {isLive && !auction.isOwner && !auction.isParticipated && isBuyer() && (
              <div className="join-action-box">
                <button onClick={handleJoinToggle} className="btn-primary-action join-btn">
                  {auction.entryFee > 0 ? `Pay ₹${auction.entryFee} Entry Fee & Join Auction` : 'Join Auction'}
                </button>
              </div>
            )}

            {isLive && auction.isParticipated && !auction.isOwner && isBuyer() && (
              <div className="bidding-control-card">
                <div className="control-card-header">
                  <h3>
                    <Gavel size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Bidding Controls
                  </h3>
                  <button 
                    onClick={handleJoinToggle} 
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
                      <button key={opt} onClick={() => handleIncreaseBid(opt)} className="quick-bid-btn">
                        +₹{opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="custom-bid-group">
                  <span className="control-section-label">Custom Bid Amount (Min: ₹{auction.minAllowedBid?.toLocaleString()})</span>
                  <div className="custom-bid-input-row">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`e.g. ₹${auction.minAllowedBid}`}
                      className="form-field custom-bid-field"
                      min={auction.minAllowedBid}
                    />
                    <button onClick={handleBid} className="btn-primary-action">
                      Place Bid
                    </button>
                  </div>
                </div>
              </div>
            )}

            {auction.isOwner && isLive && (
              <div className="seller-panel-box">
                <div className="seller-panel-header">
                  <h3>Seller Management</h3>
                  <span className="fee-notice-tag">Extension Fee: ₹100 / Day</span>
                </div>
                
                <div className="seller-action-row">
                  <span className="control-section-label">Extend Auction Duration:</span>
                  <div className="extend-input-group">
                    <select 
                      value={extendDays}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                      className="form-field extend-select"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <button onClick={handleExtend} className="btn-primary-action extend-confirm-btn">
                      Extend ({extendDays}d — ₹{extendDays * 100})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="auction-sidebar-col">
          <BidHistory bids={bidHistory} />
          <ParticipantsList participants={participants} />
        </aside>
      </div>

      {ConfirmDialog}
    </div>
  );
};

export default AuctionDetailPage;