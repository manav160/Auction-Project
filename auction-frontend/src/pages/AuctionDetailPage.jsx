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
      // Set default bid amount if participated
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

  // Keep a ref so the socket listener always calls the latest version
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

  const [customDate, setCustomDate] = useState('');

  const handleExtend = async () => {
    if (!window.confirm('Extending the auction by 1 day will cost ₹1,000. Continue?')) return;
    try {
      await api.post('/extend', { auctionId: id });
      fetchAuction();
    } catch (err) {
      setError(err.response?.data?.message || 'Extension failed');
    }
  };

  const handleUpdateDate = async () => {
    if (!customDate) return;
    const isExtension = new Date(customDate) > new Date(auction.endDate);
    if (isExtension && !window.confirm('Setting this date will cost ₹1,000 as it extends the auction. Continue?')) return;
    
    try {
      await api.put('/extend/date', { auctionId: id, newEndDate: customDate });
      fetchAuction();
      setCustomDate('');
    } catch (err) {
      setError(err.response?.data?.message || 'Date update failed');
    }
  };

  useEffect(() => {
    fetchAuction();
    fetchBidHistory();
    fetchParticipants();
  }, [fetchAuction, fetchBidHistory, fetchParticipants]);

  // Real-time updates via Socket.io
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
            endDate: data.endDate, // Important for anti-snipe extension
            minAllowedBid: data.currentHighestBid + 100,
            participantsCount: prev.participantsCount
          };
        });
        
        // Add to bid history
        if (data.bid) {
          setBidHistory(prev => [data.bid, ...prev]);
        } else if (data.refreshHistory) {
          // Use the ref so we always have the latest fetchBidHistory (no stale closure)
          fetchBidHistoryRef.current();
        }
      }
    });


    socket.on('auctionExtended', (data) => {
      if (data.auctionId === id) {
        setAuction(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            endDate: data.endDate
          };
        });
      }
    });

    socket.on('participantsUpdated', (data) => {
      if (data.auctionId === id) {
        // Update the count in the auction object
        setAuction(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            participantsCount: data.participantsCount,
            status: data.isClosed ? 'Closed' : prev.status
          };
        });
        // Refresh the actual participants list
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
          fetchAuction(); // Get final winner info
        }
        return true;
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${hours}:${minutes}:${seconds}`);
        
        // Visual Urgency: < 1 hour
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
      if (!window.confirm('Are you sure you want to unjoin this auction?')) return;
    } else {
      if (!window.confirm('Are you sure you want to join this auction?')) return;
    }

    // --- Optimistic Update ---
    // Flip the UI instantly so the user sees the change immediately
    setAuction(prev => ({
      ...prev,
      isParticipated: !wasParticipated,
      participantsCount: wasParticipated
        ? Math.max(0, prev.participantsCount - 1)
        : prev.participantsCount + 1,
    }));

    // (the backend will mark them as cancelled; the socket event will do a proper refresh)
    // We no longer wipe them because we want to show unjoined user data with different styles.

    try {
      if (wasParticipated) {
        await api.delete(`/join/${id}`);
        // Full history refresh after unjoin is handled by the socket 'bidPlaced'
        // event emitted by the backend (refreshHistory: true).
        // We also refresh participants list in background.
        fetchParticipants();
      } else {
        await api.post(`/join`, { auctionId: id });
        // Fetch auction to get the updated minAllowedBid after joining
        fetchAuction();
        fetchParticipants();
      }
    } catch (err) {
      // Revert optimistic update on failure
      setAuction(prev => ({
        ...prev,
        isParticipated: wasParticipated,
        participantsCount: wasParticipated
          ? prev.participantsCount + 1
          : Math.max(0, prev.participantsCount - 1),
      }));
      if (wasParticipated) {
        // Restore bid history since the unjoin actually failed
        fetchBidHistory();
      }
      setError(err.response?.data?.message || 'Action failed');
    }
  };

  const handleIncreaseBid = async (increment) => {
    if (!window.confirm(`Are you sure you want to increase your bid by ₹${increment}?`)) return;
    try {
      await api.post('/buyer/increase-bid', { auctionId: id, increment });
      // We don't necessarily need to fetchAuction here because Socket.io will handle it
      // but it's safe to keep for immediate feedback or if socket fails
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
      fetchAuction(); // Refresh
      fetchBidHistory(); // Refresh
      triggerSuccess(`Congratulations! Your bid of ₹${amount} was placed successfully! 🏆`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bid');
    }
  };

  if (loading) return <div className="page-shell"><p>Loading auction details...</p></div>;
  if (error) return <div className="page-shell"><p className="error-text">{error} <button onClick={() => setError('')} className="text-button">Dismiss</button></p></div>;
  if (!auction) return <div className="page-shell"><p className="error-text">Auction not found</p></div>;

  const isClosed = timeLeft === 'Closed' || auction.status === 'Closed';
  const winnerName = auction.winnerId?.name || (typeof auction.winnerId === 'string' ? 'Loading...' : null);

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
            <h1>{auction.title}</h1>
            <div className="badge-row">
              <span className={`status-pill ${isClosed ? 'status-closed' : 'status-active'}`}>
                {auction.status}
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
          
          {isClosed && (
            <div className="winner-announcement stagger-entry">
              <div className="winner-icon">🏆</div>
              <div className="winner-info">
                <h3>Auction Closed</h3>
                <p>
                  {auction.winnerId 
                    ? <>Winner: <strong>{winnerName}</strong> with ₹{auction.currentHighestBid}</>
                    : "No winner for this auction."
                  }
                </p>
              </div>
            </div>
          )}

          <p className="detail-description">{auction.description}</p>
          <div className="detail-metrics">
            <div>
              <strong>Current Highest Bid</strong>
              <p>₹{auction.currentHighestBid}</p>
            </div>

            {auction.userBid && (
              <div>
                <strong>Your Highest Bid</strong>
                <p className="user-bid-highlight">₹{auction.userBid}</p>
              </div>
            )}
            <div>
              <strong>{isClosed ? 'Ended At' : 'Ends in'}</strong>
              <p className={isClosed ? 'text-danger' : isUrgent ? 'text-urgent' : 'text-timer'}>
                {isClosed ? new Date(auction.endDate).toLocaleString() : timeLeft}
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
            <div>
              <strong>End Condition</strong>
              <p style={{ textTransform: 'capitalize' }}>
                {auction.endCondition === 'either' ? 'Whichever fills first' : auction.endCondition}
              </p>
            </div>
          </div>

          <BidChart bids={bidHistory} />

          {!isClosed && !auction.isOwner && !auction.isParticipated && isBuyer() && (
            <button 
              onClick={handleJoinToggle} 
              className="action-toggle-button join-mode"
            >
              Join Auction
            </button>
          )}

          {!isClosed && auction.isParticipated && !auction.isOwner && isBuyer() && (
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

          {auction.isOwner && !isClosed && (
            <div className="seller-management-panel glass-panel">
              <div className="panel-header">
                <h3>Seller Management</h3>
                <span className="fee-notice">₹1,000 per manual extension</span>
              </div>
              
              <div className="seller-actions">
                <button onClick={handleExtend} className="secondary-button extend-action-btn">
                  Quick Extend (1 Day)
                </button>

                <div className="custom-date-update">
                  <p>Or set custom end date:</p>
                  <div className="date-input-group">
                    <input 
                      type="datetime-local" 
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="form-field date-picker"
                    />
                    <button onClick={handleUpdateDate} className="primary-button update-date-btn">
                      Update Date
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