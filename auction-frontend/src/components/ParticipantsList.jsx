import React, { memo } from 'react';
import { Users } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

const ParticipantsList = ({ participants = [] }) => {
  if (!participants || participants.length === 0) {
    return (
      <div className="history-card">
        <h3 style={{ margin: '0 0 16px' }}>Participants</h3>
        <div className="empty-activity-box" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ marginBottom: '6px', opacity: 0.8 }}>
            <Users size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '700' }}>
            No participants yet
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Registered bidders will be listed here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-card">
      <div className="history-card-header">
        <h3>Participants ({participants.length})</h3>
      </div>
      <ul className="participants-list">
        {participants.map((p, index) => {
          const initial = (p.userId?.name || p.email || 'U').charAt(0).toUpperCase();
          return (
            <li key={p._id || index} className="participant-item">
              <span className="participant-avatar">
                {initial}
              </span>
              <div className="participant-info">
                <span className="participant-name">{p.userId?.name || 'User'}</span>
                <span className="participant-email">{p.email || ''}</span>
              </div>
              <span className="participant-joined">
                {formatDateTime(p.joinedAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default memo(ParticipantsList);
