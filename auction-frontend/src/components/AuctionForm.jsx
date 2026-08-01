import React, { useState, useRef } from 'react';
import api from '../services/api';
import { animateAuctionSuccess, animateAuctionError } from '../utils/auctionAnimations';

const AuctionForm = ({ onAuctionCreated }) => {
  const now = new Date();
  const defaultStart = now.toISOString().slice(0, 16);
  const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startingPrice: '',
    buyNowPrice: '',
    category: 'Other',
    condition: 'NEW',
    startDate: '',
    endDate: '',
    maxParticipants: 15,
    bidIncrementOptions: [100, 500, 1000],
    endCondition: 'either',
    listingType: 'STANDARD',
    entryFee: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...formData,
        startingPrice: parseFloat(formData.startingPrice),
        entryFee: parseFloat(formData.entryFee) || 0,
        maxParticipants: formData.endCondition === 'time' ? 9999 : parseInt(formData.maxParticipants),
        endDate: formData.endCondition === 'participants'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : (formData.endDate || defaultEnd),
        buyNowPrice: parseFloat(formData.buyNowPrice) || null,
        category: formData.category,
        condition: formData.condition,
      };
      
      if (!payload.startDate) delete payload.startDate;

      await api.post('/auctions', payload);
      setFormData({
        title: '', description: '', startingPrice: '',
        startDate: '', endDate: '',
        maxParticipants: 15, bidIncrementOptions: [100, 500, 1000],
        endCondition: 'either', listingType: 'STANDARD', entryFee: 0,
        category: 'Other', condition: 'NEW', buyNowPrice: ''
      });
      animateAuctionSuccess(panelRef.current);
      if (onAuctionCreated) onAuctionCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create auction');
      animateAuctionError(panelRef.current);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-card" ref={panelRef}>
      <div className="panel-header">
        <h3>Create New Auction</h3>
      </div>
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={handleSubmit} className="auction-form">

        {/* Listing Type Selection */}
        <div className="form-group">
          <label className="form-label">Listing Tier</label>
          <select 
            name="listingType" 
            value={formData.listingType} 
            onChange={handleChange} 
            className="form-field"
          >
            <option value="STANDARD">Standard (Free Listing, 8% Platform Commission)</option>
            <option value="PREMIUM">⭐ Premium (₹500 Fee, Featured Priority, 5% Reduced Commission, Up to 100 Bidders)</option>
          </select>
        </div>

        {/* Category & Condition Row */}
        <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="form-field"
            >
              <option value="Electronics">Electronics</option>
              <option value="Collectibles">Collectibles</option>
              <option value="Fashion">Fashion</option>
              <option value="Home">Home</option>
              <option value="Motors">Motors</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Condition</label>
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              className="form-field"
            >
              <option value="NEW">New</option>
              <option value="LIKE_NEW">Like New</option>
              <option value="USED">Used</option>
              <option value="REFURBISHED">Refurbished</option>
            </select>
          </div>
        </div>

        <input type="text" name="title" placeholder="Auction Title" value={formData.title}
          onChange={handleChange} required className="form-field" />

        <textarea name="description" placeholder="Description" value={formData.description}
          onChange={handleChange} required className="form-field textarea-field" />

        <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Starting Price (₹)</label>
            <input type="number" name="startingPrice" placeholder="1000" value={formData.startingPrice}
              onChange={handleChange} required className="form-field" min="10" />
          </div>

          <div style={{ flex: 1 }}>
            <label className="form-label">Buyer Entry Fee (₹)</label>
            <input type="number" name="entryFee" placeholder="0" value={formData.entryFee}
              onChange={handleChange} className="form-field" min="0" max="1000" />
            <span className="form-hint" style={{ fontSize: '0.75rem' }}>₹0 = Free Entry</span>
          </div>
        </div>

        {/* Buy Now Price */}
        <div className="form-group">
          <label className="form-label">Buy Now Price (₹)</label>
          <input
            type="number"
            name="buyNowPrice"
            placeholder="Optional"
            value={formData.buyNowPrice}
            onChange={handleChange}
            className="form-field"
            min={formData.startingPrice ? parseFloat(formData.startingPrice) + 1 : 1}
          />
          <span className="form-hint" style={{ fontSize: '0.75rem' }}>Leave blank for no instant purchase</span>
        </div>

        {/* Start date */}
        <div className="form-group">
          <label className="form-label">
            Start Date &amp; Time
            <span className="form-hint"> — Leave blank to go live immediately</span>
          </label>
          <input
            type="datetime-local"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="form-field"
            min={defaultStart}
          />
        </div>

        {/* End condition */}
        <div className="form-group">
          <label className="form-label">End Condition</label>
          <select name="endCondition" value={formData.endCondition}
            onChange={handleChange} className="form-field">
            <option value="time">Time only</option>
            <option value="participants">Participants limit only</option>
            <option value="either">Whichever comes first</option>
          </select>
        </div>

        {/* End Date */}
        {formData.endCondition !== 'participants' && (
          <div className="form-group">
            <label className="form-label">End Date &amp; Time</label>
            <input
              type="datetime-local"
              name="endDate"
              value={formData.endDate || defaultEnd}
              onChange={handleChange}
              required
              className="form-field"
              min={formData.startDate || defaultStart}
            />
          </div>
        )}

        {/* Max Participants */}
        {formData.endCondition !== 'time' && (
          <div className="form-group">
            <label className="form-label">Max Participants</label>
            <input type="number" name="maxParticipants" value={formData.maxParticipants}
              onChange={handleChange} className="form-field" min="2" max={formData.listingType === 'PREMIUM' ? 100 : 15} />
          </div>
        )}

        <button type="submit" disabled={loading} className="primary-button">
          {loading ? 'Creating...' : formData.listingType === 'PREMIUM' ? 'Pay ₹500 & Launch Premium Auction' : 'Launch Auction'}
        </button>
      </form>
    </div>
  );
};

export default AuctionForm;
