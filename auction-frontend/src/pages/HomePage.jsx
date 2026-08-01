import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';

const CATEGORIES = ['Electronics', 'Collectibles', 'Fashion', 'Home', 'Motors', 'Other'];
const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' }
];

const HomePage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  
  // Pending filter inputs (edited by user, applied only when clicking button)
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [listingType, setListingType] = useState('');
  const [entryFeeType, setEntryFeeType] = useState('');
  const [hasBuyNow, setHasBuyNow] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Sidebar mode is active ONLY after user clicks "Apply Filters"
  const [isFilterApplied, setIsFilterApplied] = useState(false);

  // Fetch function accepting explicit filter parameters
  const loadAuctions = useCallback(async (filtersToApply = null, pageNum = 1) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();

      if (filtersToApply) {
        if (filtersToApply.status) params.append('status', filtersToApply.status);
        if (filtersToApply.search) params.append('q', filtersToApply.search);
        if (filtersToApply.category) params.append('category', filtersToApply.category);
        if (filtersToApply.condition) params.append('condition', filtersToApply.condition);
        if (filtersToApply.listingType) params.append('listingType', filtersToApply.listingType);
        if (filtersToApply.entryFeeType) params.append('entryFeeType', filtersToApply.entryFeeType);
        if (filtersToApply.hasBuyNow) params.append('hasBuyNow', 'true');
        if (filtersToApply.minPrice) params.append('minPrice', filtersToApply.minPrice);
        if (filtersToApply.maxPrice) params.append('maxPrice', filtersToApply.maxPrice);
        if (filtersToApply.sort) params.append('sort', filtersToApply.sort);
      } else {
        // Default load: show regular active/live ongoing auctions
        params.append('status', 'active');
      }

      params.append('page', pageNum);
      params.append('limit', 12);

      const res = await api.get(`/auctions?${params}`);
      
      if (res.data && Array.isArray(res.data)) {
        setAuctions(res.data);
        setPagination({ total: res.data.length, page: 1, pages: 1 });
      } else if (res.data && res.data.auctions) {
        setAuctions(res.data.auctions);
        setPagination(res.data.pagination || { total: res.data.auctions.length, page: 1, pages: 1 });
      } else {
        setAuctions([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadAuctions(null, 1);
  }, [loadAuctions]);

  // Handle Apply Filter Button click
  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    const activeFilters = {
      search,
      status,
      category,
      condition,
      listingType,
      entryFeeType,
      hasBuyNow,
      minPrice,
      maxPrice,
      sort,
    };
    setIsFilterApplied(true);
    setPage(1);
    loadAuctions(activeFilters, 1);
  };

  // Handle Reset / Clear Filters
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCategory('');
    setCondition('');
    setListingType('');
    setEntryFeeType('');
    setHasBuyNow(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    setPage(1);
    setIsFilterApplied(false);
    loadAuctions(null, 1);
  };

  // Pagination page change handler
  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (isFilterApplied) {
      loadAuctions({
        search, status, category, condition, listingType, entryFeeType, hasBuyNow, minPrice, maxPrice, sort
      }, newPage);
    } else {
      loadAuctions(null, newPage);
    }
  };

  const handleToggleWatchlist = async (auctionId) => {
    try {
      const res = await api.post(`/watchlist/${auctionId}/toggle`);
      const isWatchlisted = res.data.isWatchlisted;
      
      setAuctions(prev =>
        prev.map(auc =>
          auc._id === auctionId ? { ...auc, isWatchlisted } : auc
        )
      );
    } catch (err) {
      console.error('Watchlist toggle error:', err);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1>Explore Marketplace</h1>
        <p className="page-subtitle">Discover, bid, or buy instantly with verified ledger settlements</p>
      </div>

      <div className={`marketplace-layout ${isFilterApplied ? 'sidebar-active' : 'hero-active'}`}>
        
        {/* Animated Filter Card */}
        <aside className="filter-panel-card panel-card">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{isFilterApplied ? 'Filters Applied' : 'Find Auctions'}</h3>
            {isFilterApplied && (
              <button className="text-button" onClick={clearFilters} style={{ fontSize: '0.85rem' }}>Reset All</button>
            )}
          </div>
          
          <form onSubmit={handleApplyFilters} className="filter-scroll-container">
            <div className="form-group">
              <label className="form-label">Search Query</label>
              <input
                type="text"
                placeholder="Type title or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-field search-input-glow"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-field">
                <option value="">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="form-field">
                <option value="">Any Condition</option>
                {CONDITIONS.map(cond => (
                  <option key={cond.value} value={cond.value}>{cond.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Listing Tier</label>
              <select value={listingType} onChange={(e) => setListingType(e.target.value)} className="form-field">
                <option value="">All Tiers</option>
                <option value="STANDARD">Standard Tier</option>
                <option value="PREMIUM">⭐ Premium Tier</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-field">
                <option value="">All Active / Live</option>
                <option value="closed">Closed / Ended</option>
                <option value="all">All Listings</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Entry Fee Type</label>
              <select value={entryFeeType} onChange={(e) => setEntryFeeType(e.target.value)} className="form-field">
                <option value="">Any Entry Fee</option>
                <option value="FREE">Free Entry</option>
                <option value="PAID">Paid Entry Only</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: '0.5rem 0' }}>
              <input
                type="checkbox"
                id="buyNowCheck"
                checked={hasBuyNow}
                onChange={(e) => setHasBuyNow(e.target.checked)}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
              />
              <label htmlFor="buyNowCheck" style={{ cursor: 'pointer', fontWeight: 'bold' }}>⚡ Has Buy Now Price</label>
            </div>

            <div className="form-group">
              <label className="form-label">Price Range</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="form-field"
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="form-field"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sort By</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-field">
                <option value="newest">Newest Listed</option>
                <option value="ending-soon">Ending Soonest</option>
                <option value="highest-bid">Highest Current Bid</option>
                <option value="buy-now-asc">Buy Now Price: Low to High</option>
                <option value="buy-now-desc">Buy Now Price: High to Low</option>
                <option value="most-participants">Most Participants</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <button
                type="submit"
                className="primary-button"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(90deg, #7c3aed 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: '#fff',
                  transition: 'all 0.2s'
                }}
              >
                <span> Apply Filters </span>
              </button>
            </div>
          </form>
        </aside>

        {/* Dynamic Results Section (RHS) */}
        <section className="results-panel">
          <div className="results-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
              {isFilterApplied ? 'Filtered Results' : 'Ongoing Live Auctions'}
            </h2>
            <span className="live-indicator-tag">🔴 Live Now</span>
          </div>

          {error && <p className="error-text" style={{ marginBottom: '1rem' }}>{error}</p>}
          
          {loading ? (
            <p>Loading auctions...</p>
          ) : auctions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '2.5rem' }}>📦</span>
              <p style={{ marginTop: '1rem', fontSize: '1.1rem', opacity: 0.8 }}>
                {isFilterApplied ? 'No auctions match your filters.' : 'No active ongoing auctions at the moment.'}
              </p>
              {isFilterApplied && (
                <button className="text-button" onClick={clearFilters} style={{ marginTop: '0.5rem' }}>Reset Filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="auction-grid animate-grid">
                {auctions.map((auction) => (
                  <AuctionCard
                    key={auction._id}
                    auction={auction}
                    onToggleWatchlist={handleToggleWatchlist}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', padding: '1rem' }}>
                  <button
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="secondary-button"
                    style={{ padding: '0.5rem 1rem', width: 'auto' }}
                  >
                    ← Previous
                  </button>
                  <span style={{ fontWeight: 'bold' }}>
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="secondary-button"
                    style={{ padding: '0.5rem 1rem', width: 'auto' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
