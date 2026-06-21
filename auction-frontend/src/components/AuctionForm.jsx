import React, { useState, useRef } from 'react';
import api from '../services/api';
import { animateAuctionSuccess, animateAuctionError } from '../utils/auctionAnimations';

const AuctionForm = ({ onAuctionCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startingPrice: '',
    endDate: '',
    maxParticipants: 15,
    bidIncrementOptions: [100, 500, 1000],
    endCondition: 'either',
    autoDelete: false,
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
      await api.post('/auctions', {
        ...formData,
        startingPrice: parseFloat(formData.startingPrice),
        maxParticipants: parseInt(formData.maxParticipants),
      });
      setFormData({
        title: '', description: '', startingPrice: '', endDate: '',
        maxParticipants: 15, bidIncrementOptions: [100, 500, 1000],
        endCondition: 'either', autoDelete: false,
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

  // Set default endDate to 7 days from now
  const defaultEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 16);

  return (
    <div className="panel-card" ref={panelRef}>
      <div className="panel-header">
        <h3>Create New Auction</h3>
      </div>
      {error && <p className="error-text">{error}</p>}
      <form onSubmit={handleSubmit} className="auction-form">
        <input type="text" name="title" placeholder="Auction Title" value={formData.title}
          onChange={handleChange} required className="form-field" />
        <textarea name="description" placeholder="Description" value={formData.description}
          onChange={handleChange} required className="form-field textarea-field" />
        <input type="number" name="startingPrice" placeholder="Starting Price (₹)" value={formData.startingPrice}
          onChange={handleChange} required className="form-field" min="1" />
        <div className="form-group">
          <label className="form-label">End Date & Time</label>
          <input type="datetime-local" name="endDate" value={formData.endDate || defaultEndDate}
            onChange={handleChange} required className="form-field" min={new Date().toISOString().slice(0, 16)} />
        </div>
        <div className="form-group">
          <label className="form-label">Max Participants</label>
          <input type="number" name="maxParticipants" value={formData.maxParticipants}
            onChange={handleChange} className="form-field" min="2" max="100" />
        </div>
        <div className="form-group">
          <label className="form-label">End Condition</label>
          <select name="endCondition" value={formData.endCondition}
            onChange={handleChange} className="form-field">
            <option value="time">Time only</option>
            <option value="participants">Participants limit only</option>
            <option value="either">Whichever comes first</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="primary-button">
          {loading ? 'Creating...' : 'Create Auction'}
        </button>
      </form>
    </div>
  );
};

export default AuctionForm;
