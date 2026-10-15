/**
 * Formats a number into Indian Rupee currency format
 * @param {number|string} amount 
 * @returns {string} e.g. "₹1,250"
 */
export const formatCurrency = (amount) => {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
};

/**
 * Formats time remaining until an auction ends
 * @param {string|Date} endDateStr 
 * @param {string} status 
 * @returns {{ text: string, urgency: 'normal'|'warning'|'critical'|'ended' } | null}
 */
export const formatTimeLeft = (endDateStr, status) => {
  if (status && status !== 'ACTIVE') return null;
  const diff = new Date(endDateStr).getTime() - Date.now();
  if (diff <= 0) return { text: 'Ended', urgency: 'ended' };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  let text;
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    text = `${days}d ${remHours}h`;
  } else if (hours > 0) {
    text = `${hours}h ${mins}m`;
  } else {
    text = `${mins}m`;
  }
  const urgency = hours === 0 && mins < 10 ? 'critical' : hours === 0 ? 'warning' : 'normal';
  return { text, urgency };
};

/**
 * Formats a date/timestamp to readable locale string
 * @param {string|Date} date 
 * @returns {string}
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};
