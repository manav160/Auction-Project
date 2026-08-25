import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ 
  isOpen, 
  title = 'Confirmation Required', 
  message, 
  confirmText = 'Proceed', 
  cancelText = 'Cancel', 
  confirmVariant = 'primary', 
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen) return null;

  const getVariantStyle = () => {
    switch (confirmVariant) {
      case 'danger':
        return { background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)' };
      case 'warning':
        return { background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)' };
      case 'success':
        return { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)' };
      default:
        return { background: 'var(--accent-gradient)', boxShadow: '0 8px 24px var(--accent-glow)' };
    }
  };

  const getIcon = () => {
    switch (confirmVariant) {
      case 'danger': return '⚠️';
      case 'warning': return '⏱️';
      case 'success': return '⚡';
      default: return '💎';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="glass-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-badge">
          {getIcon()}
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>

        <div className="modal-action-buttons">
          <button className="modal-btn modal-cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className="modal-btn modal-confirm-btn" 
            style={getVariantStyle()} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
