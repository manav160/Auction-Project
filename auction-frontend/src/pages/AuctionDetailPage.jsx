import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import { isBuyer } from '../services/auth';
import BidHistory from '../components/BidHistory';
import ParticipantsList from '../components/ParticipantsList';
import BidChart from '../components/BidChart';

const AuctionDetailPage = () => {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  const triggerSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  const fetchAuction = useCallback(async () => {
    try {
      const response = await api.get(`/auctions/${id}`);
      setAuction(response.data);
      if (response.data.isParticipated) {
        setBidAmount(response.data.minAllowedBid);
      }
    } catch (err) {
      setError('Failed to load auction');
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
    if (!window.confirm(`Extending the auction by ${extendDays} day(s) will cost ₹100 extension fee. Proceed?`)) return;
    try {
      const response = await api.post(`/auctions/${id}/extend`);
      triggerSuccess(`${response.data.message}. Fee paid: ₹${response.data.auction.feePaid}`);
      fetchAuction();
    } catch (err) {
      setError(err.response?.data?.message || 'Extension failed');
    }
  };

  useEffect(() => {
    fetchAuction();
    fetchBidHistory();
    fetchParticipants();
  }, [fetchAuction, fetchBidHistory, fetchParticipants]);

  useEffect(() => {
    const socket = io('http://localhost:3001');

    socket.on('bidPlaced', (data) => {
      if (data.auctionId === id) {
        setAuction(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            currentHighestBid: data.currentHighestBid,
            winnerId: data.winnerId,
            endDate: data.endDate,
            minAllowedBid: data.currentHighestBid + 100,
            participantsCount: prev.participantsCount
          };
        });
        if (data.bid) {
          setBidHistory(prev => [data.bid, ...prev]);
        } else if (data.refreshHistory) {
          fetchBidHistoryRef.current();
        }
      }
    });

    socket.on('auctionExtended', (data) => {
      if (data.auctionId === id) {
        setAuction(prev => {
          if (!prev) return prev;
          return { ...prev, endDate: data.endDate };
        });
      }
    });

    socket.on('participantsUpdated', (data) => {
      if (data.auctionId === id) {
        setAuction(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participantsCount: data.participantsCount,
            status: data.isClosed ? 'Closed' : prev.status
          };
        });
        fetchParticipants();
      }
    });

    return () => socket.disconnect();
  }, [id, fetchParticipants]);

  useEffect(() => {
    if (!auction) return;
    const calculateTime = () => {
      const now = new Date();
      const end = new Date(auction.endDate);
      const diff = end - now;
      
      if (diff <= 0) {
        if (timeLeft !== 'Closed') {
          setTimeLeft('Closed');
          setIsUrgent(false);
          fetchAuction();
        }
        return true;
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${hours}:${minutes}:${seconds}`);
        setIsUrgent(diff < 3600000);
        return false;
      }
    };
    calculateTime();
    const timer = setInterval(() => {
      if (calculateTime()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [auction?.endDate, timeLeft, fetchAuction, auction]);

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
      if (!window.confirm('Are you sure you want to unjoin this auction? Your entry fee will be refunded.')) return;
    } else {
      const entryFeeMsg = auction.entryFee > 0 
        ? `Joining requires an entry fee of ₹${auction.entryFee}. Proceed?` 
        : 'Are you sure you want to join this auction?';
      if (!window.confirm(entryFeeMsg)) return;
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
        fetchParticipants();
        triggerSuccess('You unjoined the auction. Entry fee refunded.');
      } else {
        await api.post(`/join`, { auctionId: id });
        fetchAuction();
        fetchParticipants();
        triggerSuccess('Successfully joined the auction!');
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
    if (!window.confirm(`Are you sure you want to increase your bid by ₹${increment}?`)) return;
    try {
      await api.post('/buyer/increase-bid', { auctionId: id, increment });
      fetchAuction(); 
      triggerSuccess(`Congratulations! You successfully increased your bid by ₹${increment} 🎉`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to increase bid');
    }
  };

  const handleBid = async () => {
    const amount = parseFloat(bidAmount);
    if (amount < auction.minAllowedBid) {
      setError(`Bid must be at least ₹${auction.minAllowedBid}`);
      return;
    }
    if (!window.confirm(`Are you sure you want to place a bid of ₹${amount}?`)) return;
    try {
      await api.post('/bid', { auctionId: id, amount });
      setBidAmount('');
      fetchAuction();
      fetchBidHistory();
      triggerSuccess(`Congratulations! Your bid of ₹${amount} was placed successfully! 🏆`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid');
    }
  };

  if (loading) return <div className="page-shell"><p>Loading auction details...</p></div>;
  if (error) return <div className="page-shell"><p className="error-text">{error} <button onClick={() => setError('')} className="text-button">Dismiss</button></p></div>;
  if (!auction) return <div className="page-shell"><p className="error-text">Auction not found</p></div>;

  const isLive   = auction.status === 'ACTIVE';
  const winnerName = auction.winnerId?.name || (typeof auction.winnerId === 'string' ? 'Loading...' : null);
  const isPremium  = auction.listingType === 'PREMIUM';

  const isFinalPhase = new Date(auction.endDate).getTime() - Date.now() <= 300000;
  const disableUnjoin = !!auction.userBid || isFinalPhase;
  const unjoinTitle = auction.userBid 
    ? "Cannot unjoin after placing a bid" 
    : isFinalPhase 
      ? "Cannot unjoin in final phase (last 5 mins)" 
      : "Unjoin Auction";

  return (
    <div className="page-shell">
      {successMessage && (
        <div className="success-popup">
          <div className="success-popup-icon">✨</div>
          <div className="success-popup-text">{successMessage}</div>
        </div>
      )}
      <div className="detail-grid">
        <section className="detail-card">
          <div className="detail-header">
            <h1>
              {isPremium && <span className="premium-star">⭐ </span>}
              {auction.title}
            </h1>
            <div className="badge-row">
              {isPremium && <span className="status-pill premium-badge" style={{ backgroundColor: '#ffd700', color: '#000', fontWeight: 'bold' }}>PREMIUM</span>}
              <span className={`status-pill status-${auction.status?.toLowerCase()}`}>
                {{
                  ACTIVE:             '🔴 Live',
                  SCHEDULED:          '🗓 Scheduled',
                  PENDING_RESOLUTION: '⏳ Resolving…',
                  COMPLETED:          '✅ Completed',
                  UNSOLD:             '📦 Unsold',
                  CANCELED:           '🚫 Canceled',
                  DRAFT:              '📝 Draft',
                }[auction.status] || auction.status}
              </span>
              {auction.isOwner && <span className="nav-role-badge owner-badge">Your Auction</span>}
              {auction.isParticipated && <span className="nav-role-badge participation-badge">Participated</span>}
            </div>
          </div>
          
          {auction.picture && (
            <div className="detail-image-container">
              <img 
                src={`http://localhost:3001${auction.picture}`} 
                alt={auction.title} 
                className="detail-product-image"
              />
            </div>
          )}
          
          {auction.status === 'COMPLETED' && (
            <div className="winner-announcement stagger-entry">
              <div className="winner-icon">🏆</div>
              <div className="winner-info">
                <h3>Auction Completed</h3>
                <p>Winner: <strong>{winnerName || 'Unknown'}</strong> with ₹{auction.currentHighestBid?.toLocaleString()}</p>
              </div>
            </div>
          )}

          {auction.status === 'UNSOLD' && (
            <div className="winner-announcement stagger-entry" style={{ background: 'rgba(100,116,139,0.15)' }}>
              <div className="winner-icon">📦</div>
              <div className="winner-info">
                <h3>Auction Ended — No Bids</h3>
                <p>This auction closed without any bids.</p>
              </div>
            </div>
          )}

          {auction.status === 'PENDING_RESOLUTION' && (
            <div className="winner-announcement stagger-entry" style={{ background: 'rgba(234,179,8,0.15)' }}>
              <div className="winner-icon">⏳</div>
              <div className="winner-info">
                <h3>Resolving Auction…</h3>
                <p>Bidding has closed. The winner is being determined.</p>
              </div>
            </div>
          )}

          {auction.status === 'CANCELED' && (
            <div className="winner-announcement stagger-entry" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <div className="winner-icon">🚫</div>
              <div className="winner-info">
                <h3>Auction Canceled</h3>
                <p>This auction was canceled by the seller.</p>
              </div>
            </div>
          )}

          <p className="detail-description">{auction.description}</p>
          <div className="detail-metrics">
            <div>
              <strong>Current Highest Bid</strong>
              <p>₹{auction.currentHighestBid}</p>
            </div>

            <div>
              <strong>Entry Fee</strong>
              <p style={{ color: auction.entryFee > 0 ? '#d97706' : '#16a34a', fontWeight: 'bold' }}>
                {auction.entryFee > 0 ? `₹${auction.entryFee}` : 'Free'}
              </p>
            </div>

            {auction.userBid && (
              <div>
                <strong>Your Highest Bid</strong>
                <p className="user-bid-highlight">₹{auction.userBid}</p>
              </div>
            )}
            <div>
              <strong>{isLive ? 'Ends in' : 'Ended At'}</strong>
              <p className={!isLive ? 'text-danger' : isUrgent ? 'text-urgent' : 'text-timer'}>
                {isLive ? timeLeft : new Date(auction.endDate).toLocaleString()}
              </p>
            </div>

            <div>
              <strong>Participants</strong>
              <p>
                {auction.endCondition === 'time' 
                  ? auction.participantsCount 
                  : `${auction.participantsCount} / ${auction.maxParticipants || 15}`
                }
              </p>
            </div>
          </div>

          <BidChart bids={bidHistory} />

          {isLive && !auction.isOwner && !auction.isParticipated && isBuyer() && (
            <button
              onClick={handleJoinToggle}
              className="action-toggle-button join-mode"
            >
              {auction.entryFee > 0 ? `Pay ₹${auction.entryFee} Entry Fee & Join` : 'Join Auction'}
            </button>
          )}

          {isLive && auction.isParticipated && !auction.isOwner && isBuyer() && (
            <div className="bid-panel">
              <div className="bid-panel-header">
                <h3>Bidding Dashboard</h3>
                <button 
                  onClick={handleJoinToggle} 
                  className="text-button unjoin-text-button"
                  disabled={disableUnjoin}
                  title={unjoinTitle}
                  style={disableUnjoin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  Unjoin Auction
                </button>
              </div>

              <div className="increment-options">
                <p>Quick Increase:</p>
                <div className="increment-buttons">
                  {(auction.bidIncrementOptions || [100, 500, 1000]).map(opt => (
                    <button key={opt} onClick={() => handleIncreaseBid(opt)} className="increment-button">
                      +₹{opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-bid">
                <p className="min-bid-hint">Custom bid (Min: ₹{auction.minAllowedBid})</p>
                <div className="bid-input-group">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={`e.g. ${auction.minAllowedBid}`}
                    className="form-field"
                    min={auction.minAllowedBid}
                  />
                  <button onClick={handleBid} className="primary-button">Place Custom Bid</button>
                </div>
              </div>
            </div>
          )}

          {auction.isOwner && isLive && (
            <div className="seller-management-panel glass-panel">
              <div className="panel-header">
                <h3>Seller Management</h3>
                <span className="fee-notice">Extension fee: ₹100 / day</span>
              </div>
              
              <div className="seller-actions">
                <div className="custom-date-update">
                  <p>Select days to extend (1-7):</p>
                  <div className="date-input-group">
                    <select 
                      value={extendDays}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                      className="form-field date-picker"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <button onClick={handleExtend} className="primary-button update-date-btn">
                      Confirm &amp; Extend (₹{extendDays * 100})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="sidebar-panels">
          <BidHistory bids={bidHistory} />
          <ParticipantsList participants={participants} />
        </aside>
      </div>
    </div>
  );
};

export default AuctionDetailPage;