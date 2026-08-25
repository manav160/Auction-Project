import React, { useState } from 'react';
import { List, TrendingUp, BarChart3, PieChart, Gavel } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BidHistory = ({ bids = [] }) => {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'line', 'bar', 'doughnut'

  if (!bids || bids.length === 0) {
    return (
      <div className="history-card">
        <div className="history-card-header">
          <h3>Bid History</h3>
        </div>
        <div className="empty-activity-box" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ marginBottom: '8px', opacity: 0.8 }}>
            <Gavel size={32} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '700' }}>No bids placed yet</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bid activity will appear here once bidding begins.</p>
        </div>
      </div>
    );
  }

  // Calculate summary metrics
  const totalBidsCount = bids.length;
  const highestBidAmount = Math.max(...bids.map((b) => b.amount || 0));

  // User bid aggregation
  const userBidCounts = {};
  const userHighestBids = {};

  bids.forEach((bid) => {
    const userName = bid.userId?.name || 'Anonymous';
    userBidCounts[userName] = (userBidCounts[userName] || 0) + 1;
    if (!userHighestBids[userName] || bid.amount > userHighestBids[userName]) {
      userHighestBids[userName] = bid.amount;
    }
  });

  const topBidder = Object.keys(userBidCounts).reduce((a, b) =>
    userBidCounts[a] > userBidCounts[b] ? a : b,
    Object.keys(userBidCounts)[0] || 'N/A'
  );

  // Chronological bids for Line Chart (from earliest to latest)
  const chronologicalBids = [...bids].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );

  // Line Chart Data (Price Trend)
  const lineChartData = {
    labels: chronologicalBids.map((b, idx) => {
      if (b.createdAt) {
        return new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return `#${idx + 1}`;
    }),
    datasets: [
      {
        label: 'Bid Amount (₹)',
        data: chronologicalBids.map((b) => b.amount),
        borderColor: '#3b82f6',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
          return gradient;
        },
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Bid: ₹${context.raw?.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (value) => `₹${value.toLocaleString()}`,
        },
      },
    },
  };

  // Bar Chart Data (Bids Count per User)
  const userNames = Object.keys(userBidCounts);
  const barChartData = {
    labels: userNames,
    datasets: [
      {
        label: 'Number of Bids',
        data: userNames.map((name) => userBidCounts[name]),
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(236, 72, 153, 0.85)',
          'rgba(14, 165, 233, 0.85)',
        ],
        borderRadius: 8,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.raw} bid(s)`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: '#64748b',
          font: { size: 11 },
        },
      },
    },
  };

  // Doughnut Chart Data (Bid Share distribution)
  const doughnutChartData = {
    labels: userNames,
    datasets: [
      {
        data: userNames.map((name) => userBidCounts[name]),
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#8b5cf6',
          '#ec4899',
          '#0ea5e9',
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: '#475569' },
      },
    },
  };

  return (
    <div className="history-card">
      <div className="history-card-header">
        <h3>Bid History</h3>
        <div className="bid-history-tabs">
          <button
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
            title="List View"
          >
            <List size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> List
          </button>
          <button
            className={`tab-btn ${activeTab === 'line' ? 'active' : ''}`}
            onClick={() => setActiveTab('line')}
            title="Price Progression Graph"
          >
            <TrendingUp size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Trend
          </button>
          <button
            className={`tab-btn ${activeTab === 'bar' ? 'active' : ''}`}
            onClick={() => setActiveTab('bar')}
            title="Bids per Participant Bar Chart"
          >
            <BarChart3 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Bids
          </button>
          <button
            className={`tab-btn ${activeTab === 'doughnut' ? 'active' : ''}`}
            onClick={() => setActiveTab('doughnut')}
            title="Share Distribution Doughnut Chart"
          >
            <PieChart size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Share
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="history-summary-metrics">
        <div className="metric-pill">
          <span className="metric-label">Total Bids</span>
          <span className="metric-value">{totalBidsCount}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Peak Bid</span>
          <span className="metric-value">₹{highestBidAmount.toLocaleString()}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-label">Top Bidder</span>
          <span className="metric-value" title={topBidder}>
            {topBidder}
          </span>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'list' && (
        <ul className="bid-list">
          {bids.map((bid, index) => (
            <li key={bid._id || index} className="bid-item">
              <div className="bid-item-info">
                <span className="bid-user">{bid.userId?.name || 'Anonymous'}</span>
                {bid.createdAt && (
                  <span className="bid-time">
                    {new Date(bid.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <span className="bid-amount">₹{bid.amount?.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      {activeTab === 'line' && (
        <div className="history-chart-wrapper">
          {chronologicalBids.length < 2 ? (
            <p className="chart-notice">Place at least 2 bids to view the price trend graph.</p>
          ) : (
            <div style={{ height: '220px', position: 'relative' }}>
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'bar' && (
        <div className="history-chart-wrapper">
          <div style={{ height: '220px', position: 'relative' }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      )}

      {activeTab === 'doughnut' && (
        <div className="history-chart-wrapper">
          <div style={{ height: '230px', position: 'relative' }}>
            <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};

export default BidHistory;

