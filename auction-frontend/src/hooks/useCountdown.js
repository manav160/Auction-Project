import { useState, useEffect } from 'react';

/**
 * Custom hook for live ticking countdown on auction detail page
 * @param {string|Date} endDate 
 * @param {string} status 
 * @param {Function} onEndedCallback 
 * @returns {{ timeLeft: string, isUrgent: boolean, isEnded: boolean }}
 */
export const useCountdown = (endDate, status, onEndedCallback) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    if (!endDate) return;

    const calculate = () => {
      if (status && status !== 'ACTIVE') {
        setTimeLeft(status);
        setIsUrgent(false);
        setIsEnded(true);
        return true;
      }

      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Auction Ended');
        setIsUrgent(false);
        setIsEnded(true);
        if (onEndedCallback) onEndedCallback();
        return true;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let formatted = '';
      if (days > 0) {
        formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      } else if (hours > 0) {
        formatted = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        formatted = `${minutes}m ${seconds}s`;
      }

      setTimeLeft(formatted);
      setIsUrgent(diff < 3600000); // under 1 hour is urgent
      setIsEnded(false);
      return false;
    };

    calculate();
    const interval = setInterval(() => {
      if (calculate()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate, status, onEndedCallback]);

  return { timeLeft, isUrgent, isEnded };
};
