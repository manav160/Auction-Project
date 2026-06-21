import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const BidChart = ({ bids }) => {
  if (!bids || bids.length < 2) return null;

  const sorted = [...bids].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const data = {
    labels: sorted.map((b) => new Date(b.createdAt).toLocaleTimeString()),
    datasets: [
      {
        label: 'Bid Amount (₹)',
        data: sorted.map((b) => b.amount),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Bid Progression', color: '#0f172a', font: { size: 14 } },
    },
    scales: {
      y: {
        ticks: { callback: (v) => `₹${v.toLocaleString()}` },
      },
    },
  };

  return (
    <div className="bid-chart-container">
      <Line data={data} options={options} />
    </div>
  );
};

export default BidChart;
