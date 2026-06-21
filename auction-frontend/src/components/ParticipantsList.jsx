import React from 'react';

const ParticipantsList = ({ participants }) => {
  if (!participants || participants.length === 0) {
    return (
      <div className="history-card">
        <h3>Participants</h3>
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No participants yet</p>
      </div>
    );
  }

  return (
    <div className="history-card">
      <h3>Participants ({participants.length})</h3>
      <ul className="participants-list">
        {participants.map((p, index) => (
          <li key={p._id || index} className="participant-item">
            <span className="participant-avatar">
              {(p.userId?.name || p.email || 'U')[0].toUpperCase()}
            </span>
            <div className="participant-info">
              <span className="participant-name">{p.userId?.name || 'User'}</span>
              <span className="participant-email">{p.email}</span>
            </div>
            <span className="participant-joined">
              {new Date(p.joinedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantsList;
