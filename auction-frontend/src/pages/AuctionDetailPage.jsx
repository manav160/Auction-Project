import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Sparkles, Heart, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL, getImageUrl } from '../utils/config';
import { formatCurrency } from '../utils/formatters';
import { useCountdown } from '../hooks/useCountdown';
import { useConfirm } from '../utils/useConfirm';

import AuctionStatusBanner from '../components/AuctionStatusBanner';
import AuctionInfoGrid from '../components/AuctionInfoGrid';
import AuctionBiddingControls from '../components/AuctionBiddingControls';
import SellerManagementPanel from '../components/SellerManagementPanel';
import BidHistory from '../components/BidHistory';
import ParticipantsList from '../components/ParticipantsList';
import LoadingSpinner from '../components/LoadingSpinner';

const AuctionDetailPage = () => {
  const { id } = useParams();
  const { isBuyer } = useAuth();
  const { showConfirm, ConfirmDialog } = useConfirm();

  const [auction, setAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [errorDismissing, setErrorDismissing] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [extendDays, setExtendDays] = useState(1);

  const errorTimerRef = useRef(null);

  const triggerSuccess = useCallback((msg) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  }, []);

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
      if (response.data.isParticipated && response.data.minAllowedBid) {
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

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await api.get(`/participations/${id}`);
      setParticipants(res.data);
    } catch (err) {
      console.error('Failed to load participants', err);
    }
  }, [id]);

  // Use custom countdown hook
  const { timeLeft, isUrgent } = useCountdown(auction?.endDate, auction?.status, fetchAuction);

  // Initial data loading & socket setup
  useEffect(() => {
    fetchAuction();
    fetchBidHistory();
    fetchParticipants();

    const socket = io(SOCKET_URL);
    socket.emit('joinAuction', id);

    socket.on('bidUpdated', (data) => {
      setAuction(prev => prev ? {
        ...prev,
        currentHighestBid: data.currentHighestBid,
        minAllowedBid: data.minAllowedBid,
        endDate: data.endDate || prev.endDate,
        winner: data.winner || prev.winner,
      } : prev);

      fetchBidHistory();

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
      fetchBidHistory();
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
  }, [id, fetchAuction, fetchBidHistory, fetchParticipants]);

  // Actions
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

  const handleJoinToggle = async () => {
    if (!auction) return;
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
        ? `Joining requires an entry fee of ${formatCurrency(auction.entryFee)}. Proceed?` 
        : 'Are you sure you want to join this auction?';
      const confirmed = await showConfirm({
        title: 'Join Auction',
        message: entryFeeMsg,
        confirmText: 'Join Now',
        confirmVariant: 'primary'
      });
      if (!confirmed) return;
    }

    // Optimistic update
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
      message: `Are you sure you want to increase your bid by ${formatCurrency(increment)}?`,
      confirmText: 'Place Higher Bid',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;
    try {
      await api.post('/buyer/increase-bid', { auctionId: id, increment });
      fetchAuction(); 
      triggerSuccess(`Successfully increased your bid by ${formatCurrency(increment)}`);
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
      message: `Are you sure you want to purchase this item immediately for ${formatCurrency(auction.buyNowPrice)}?`,
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
    if (isNaN(amount) || amount < auction.minAllowedBid) {
      setError(`Bid must be at least ${formatCurrency(auction.minAllowedBid)}`);
      return;
    }
    const confirmed = await showConfirm({
      title: 'Confirm Your Bid',
      message: `Are you sure you want to place a bid of ${formatCurrency(amount)}?`,
      confirmText: 'Confirm Bid',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;
    try {
      await api.post('/bid', { auctionId: id, bidAmount: amount });
      triggerSuccess(`Bid of ${formatCurrency(amount)} placed successfully!`);
      setBidAmount('');
      fetchAuction();
      fetchBidHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid');
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <LoadingSpinner message="Loading auction details..." />
      </div>
    );
  }

  if (loadError || !auction) {
    return (
      <div className="page-shell">
        <div className="empty-results-box">
          <AlertCircle size={40} className="empty-icon-svg" />
          <h3>Auction Not Found</h3>
          <p>{loadError || 'The requested auction does not exist.'}</p>
        </div>
      </div>
    );
  }

  const isLive = auction.status === 'ACTIVE';
  const isPremium = auction.listingType === 'PREMIUM';
  const winnerName = auction.winner ? (typeof auction.winner === 'object' ? auction.winner.name : 'Winner') : null;
  const imageSrc = getImageUrl(auction.picture || auction.imageUrl);

  const timeBeforeEnd = new Date(auction.endDate).getTime() - Date.now();
  const disableUnjoin = Boolean(auction.userBid) || (timeBeforeEnd <= 300000);
  let unjoinTitle = '';
  if (auction.userBid) unjoinTitle = 'Cannot unjoin after placing a bid';
  else if (timeBeforeEnd <= 300000) unjoinTitle = 'Cannot unjoin during final 5 minutes';

  return (
    <div className="page-shell auction-detail-shell">
      {/* Success Notification */}
      {successMessage && (
        <div className="success-popup">
          <CheckCircle2 size={20} className="success-popup-icon" />
          <span className="success-popup-text">{successMessage}</span>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className={`error-toast ${errorDismissing ? 'error-toast-exit' : ''}`}>
          <div className="error-toast-accent" />
          <AlertCircle size={22} className="error-toast-icon" />
          <div className="error-toast-body">
            <div className="error-toast-title">Notice</div>
            <div className="error-toast-message">{error}</div>
          </div>
          <button className="error-toast-close" onClick={dismissError} aria-label="Close error notice">
            ✕
          </button>
        </div>
      )}

      <div className="auction-detail-layout">
        {/* Main Content Column */}
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
                        ACTIVE: 'Live',
                        SCHEDULED: 'Scheduled',
                        PENDING_RESOLUTION: 'Resolving',
                        COMPLETED: 'Completed',
                        UNSOLD: 'Unsold',
                        CANCELED: 'Canceled',
                        DRAFT: 'Draft',
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

                {isBuyer && !auction.isOwner && (
                  <button
                    className={`watchlist-btn ${auction.isWatchlisted ? 'watchlisted' : ''}`}
                    onClick={handleToggleWatchlist}
                    title={auction.isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    aria-label="Toggle Watchlist"
                  >
                    <Heart
                      size={18}
                      fill={auction.isWatchlisted ? 'currentColor' : 'none'}
                      stroke="currentColor"
                    />
                    <span>{auction.isWatchlisted ? 'Saved' : 'Save'}</span>
                  </button>
                )}
              </div>
            </header>

            {/* Auction Hero Picture */}
            {imageSrc && (
              <div className="auction-image-frame">
                <img 
                  src={imageSrc} 
                  alt={auction.title} 
                  className="auction-hero-image"
                />
              </div>
            )}

            {/* Status Banners */}
            <AuctionStatusBanner
              status={auction.status}
              buyNowPurchased={auction.buyNowPurchased}
              currentHighestBid={auction.currentHighestBid}
              winnerName={winnerName}
            />

            {/* Description Box */}
            {auction.description && (
              <div className="auction-description-box">
                <h4 className="section-subtitle">Item Details</h4>
                <p className="auction-description-text">{auction.description}</p>
              </div>
            )}

            {/* Financial and Time Metrics Grid */}
            <AuctionInfoGrid
              auction={auction}
              isLive={isLive}
              timeLeft={timeLeft}
              isUrgent={isUrgent}
            />

            {/* Bidding & Buy Now Controls */}
            <AuctionBiddingControls
              auction={auction}
              isLive={isLive}
              isBuyer={isBuyer}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              disableUnjoin={disableUnjoin}
              unjoinTitle={unjoinTitle}
              onJoinToggle={handleJoinToggle}
              onIncreaseBid={handleIncreaseBid}
              onBid={handleBid}
              onBuyNow={handleBuyNow}
            />

            {/* Seller Management Panel */}
            <SellerManagementPanel
              isOwner={auction.isOwner}
              isLive={isLive}
              extendDays={extendDays}
              setExtendDays={setExtendDays}
              onExtend={handleExtend}
            />
          </article>
        </div>

        {/* Sidebar Column: Analytics, Chart & Participants */}
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