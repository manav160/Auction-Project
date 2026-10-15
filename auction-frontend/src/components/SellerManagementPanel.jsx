import React, { memo } from 'react';

const EXTENSION_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

const SellerManagementPanel = ({
  isOwner,
  isLive,
  extendDays,
  setExtendDays,
  onExtend
}) => {
  if (!isOwner || !isLive) return null;

  return (
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
            {EXTENSION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
            ))}
          </select>
          <button onClick={onExtend} className="btn-primary-action extend-confirm-btn">
            Extend ({extendDays}d — ₹{extendDays * 100})
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(SellerManagementPanel);
