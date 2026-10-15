import React, { useState, memo, useMemo } from 'react';
import { List, TrendingUp, BarChart3, PieChart, Gavel } from 'lucide-react';
import 'chart.js/auto';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { formatCurrency } from '../utils/formatters';

const TABS = [
  { id: 'list', Icon: List, label: 'Activity Feed' },
  { id: 'line', Icon: TrendingUp, label: 'Price Progression' },
  { id: 'bar', Icon: BarChart3, label: 'Highest Bid per User' },
  { id: 'doughnut', Icon: PieChart, label: 'Bid Share' }
];

const PALETTE = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316'];

const commonScaleOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => ` ₹${ctx.raw?.toLocaleString()}` } }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: (v) => `₹${v.toLocaleString()}` } }
  }
};

const BidHistory = ({ bids = [] }) => {
  const [activeTab, setActiveTab] = useState('list');

  // Aggregated metrics & user map
  const { totalBids, highestBid, userCounts, userHighs, topBidder } = useMemo(() => {
    const counts = {};
    const highs = {};
    let maxBid = 0;

    bids.forEach((b) => {
      const name = b.userId?.name || 'Anonymous';
      const amount = b.amount || 0;
      counts[name] = (counts[name] || 0) + 1;
      highs[name] = Math.max(highs[name] || 0, amount);
      if (amount > maxBid) maxBid = amount;
    });

    const top = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'N/A');
    return { totalBids: bids.length, highestBid: maxBid, userCounts: counts, userHighs: highs, topBidder: top };
  }, [bids]);

  // Chronological bids for line chart
  const chronBids = useMemo(() => [...bids].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)), [bids]);

  // Chart datasets
  const lineData = useMemo(() => ({
    labels: chronBids.map((b, i) => b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `#${i + 1}`),
    datasets: [{
      label: 'Bid Amount',
      data: chronBids.map((b) => b.amount),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      tension: 0.35,
      fill: true,
      pointRadius: 4
    }]
  }), [chronBids]);

  const barData = useMemo(() => ({
    labels: Object.keys(userHighs),
    datasets: [{ label: 'Highest Bid', data: Object.values(userHighs), backgroundColor: '#6366f1', borderRadius: 6 }]
  }), [userHighs]);

  const doughnutData = useMemo(() => ({
    labels: Object.keys(userCounts),
    datasets: [{ data: Object.values(userCounts), backgroundColor: PALETTE.slice(0, Object.keys(userCounts).length), borderWidth: 2 }]
  }), [userCounts]);

  if (!bids.length) {
    return (
      <div className="history-card">
        <div className="history-card-header"><h3>Bid History</h3></div>
        <div className="empty-activity-box" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <Gavel size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>No bids placed yet</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bid activity will appear here once bidding begins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-card">
      <div className="history-card-header">
        <h3>Bid Analytics &amp; Ledger</h3>
        <div className="bid-history-tabs">
          {TABS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`tab-icon-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Metric summary */}
      <div className="bid-metrics-quick-bar">
        <div className="quick-metric"><span className="q-label">Total Bids</span><span className="q-val">{totalBids}</span></div>
        <div className="quick-metric"><span className="q-label">Highest</span><span className="q-val" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(highestBid)}</span></div>
        <div className="quick-metric"><span className="q-label">Top Bidder</span><span className="q-val" style={{ maxWidth: '90px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{topBidder}</span></div>
      </div>

      {/* Tab Panels */}
      <div className="bid-tab-content">
        {activeTab === 'list' && (
          <div className="bid-scroll-view">
            <ul className="bid-list">
              {bids.map((bid, i) => (
                <li key={bid._id || i} className={`bid-item ${i === 0 ? 'leading-bid' : ''}`}>
                  <div className="bid-item-left">
                    <div className="bid-avatar">{(bid.userId?.name || 'U').charAt(0).toUpperCase()}</div>
                    <div className="bid-item-info">
                      <span className="bid-user">
                        {bid.userId?.name || 'Anonymous User'}
                        {i === 0 && <span className="leader-badge">Top Bid</span>}
                      </span>
                      <span className="bid-time">
                        {bid.createdAt ? new Date(bid.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  </div>
                  <div className="bid-amount-wrap"><span className="bid-amount">{formatCurrency(bid.amount)}</span></div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'line' && (
          <div className="chart-wrapper-box" style={{ height: '250px' }}><Line data={lineData} options={commonScaleOptions} /></div>
        )}

        {activeTab === 'bar' && (
          <div className="chart-wrapper-box" style={{ height: '250px' }}><Bar data={barData} options={commonScaleOptions} /></div>
        )}

        {activeTab === 'doughnut' && (
          <div className="chart-wrapper-box" style={{ height: '250px' }}>
            <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: 10 } } } }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(BidHistory);
