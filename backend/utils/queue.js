

  // Stores active timer references: auctionId -> timeoutId as key and pair and it is faster to access then direct object access
  const activeTimers = new Map();

  /**
   * Schedule a callback to fire at a specific time for a given auction.
   * If a timer already exists for this auction, it is cleared first
   * (idempotent — safe to call multiple times).
   */
  function scheduleAuction(auctionId, endDate, callback) {
    // Cancel any existing timer for this auction
    cancelAuction(auctionId);

    const delay = new Date(endDate).getTime() - Date.now();
    const safeDelay = Math.max(delay, 0); // If past due, fire immediately

    const timerId = setTimeout(async () => {
      activeTimers.delete(auctionId);
      try {
        await callback(auctionId);
      } catch (err) {
        console.error(`[Scheduler] Error resolving auction ${auctionId}:`, err);
      }
    }, safeDelay);

    activeTimers.set(auctionId, timerId);

  }

  /**
   * Cancel a scheduled timer for an auction (e.g., when canceled by seller).
   */
  function cancelAuction(auctionId) {
    if (activeTimers.has(auctionId)) {
      clearTimeout(activeTimers.get(auctionId));
      activeTimers.delete(auctionId);

    }
  }

  /**
   * Returns the number of currently scheduled timers (useful for debugging).
   */
  function getActiveTimerCount() {
    return activeTimers.size;
  }

  module.exports = {
    scheduleAuction,
    cancelAuction,
    getActiveTimerCount,
  };
