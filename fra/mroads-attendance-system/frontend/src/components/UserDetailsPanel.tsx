import React from 'react';
import './UserDetailsPanel.css';

export const UserDetailsPanel: React.FC<{user: any, transaction: any}> = ({ user, transaction }) => {
  return (
    <div className="details-container">
      <div className="details-header">
        <h2>User & Transaction Details</h2>
      </div>

      <div className="details-grid">
        {/* Transaction Information Section */}
        <div className="details-section transaction-section">
          <h3>Transaction Information</h3>
          <div className="info-row">
            <span className="label">Transaction ID:</span>
            <span className="value">{transaction?.transaction_id || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Status:</span>
            <span className={`value status-${transaction?.status || 'unknown'}`}>
              {transaction?.status ? transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) : 'N/A'}
            </span>
          </div>
          <div className="info-row">
            <span className="label">Timestamp:</span>
            <span className="value">{transaction?.timestamp || 'N/A'}</span>
          </div>
        </div>

        {/* User Information Section */}
        <div className="details-section user-section">
          <h3>User Information</h3>
          <div className="info-row">
            <span className="label">Name:</span>
            <span className="value">{user?.name || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Email:</span>
            <span className="value">{user?.email || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Person ID:</span>
            <span className="value">{user?.person_id || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">User ID:</span>
            <span className="value mono">{user?.user_id || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Available Models:</span>
            <span className="value">{user?.models ? user.models.join(', ') : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
