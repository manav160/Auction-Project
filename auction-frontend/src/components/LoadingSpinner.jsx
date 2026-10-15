import React from 'react';

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="loading-box">
    <div className="loading-spinner" />
    {message && <p>{message}</p>}
  </div>
);

export default React.memo(LoadingSpinner);
