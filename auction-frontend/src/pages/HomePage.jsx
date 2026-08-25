import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Sparkles, RotateCcw, PackageSearch, Zap, ShieldCheck, TrendingUp, X } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import CustomSelect from '../components/CustomSelect';

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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
    setShowMobileFilters(false);
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
    setShowMobileFilters(false);
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

  const isAnyFilterActive = isFilterApplied || Boolean(search || status || category || condition || listingType || entryFeeType || hasBuyNow || minPrice || maxPrice);

  return (
    <div className="page-shell marketplace-shell">
      {/* Hero Marketplace Banner */}
      <div className="hero-marketplace-banner">
        <div className="hero-banner-content">
          <div className="hero-badge">
            <Sparkles size={14} className="hero-badge-icon" />
            <span>Next-Gen Auction Ledger</span>
          </div>
          <h1>Discover & Bid on Exclusive Auctions</h1>
          <p className="hero-subtitle">
            Real-time anti-snipe bidding, instant settlements, and verified marketplace listings.
          </p>

          <div className="hero-stats-row">
            <div className="hero-stat-item">
              <span className="hero-stat-val">
                <span className="pulse-dot" /> Live
              </span>
              <span className="hero-stat-lbl">Real-time Bidding</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-val">
                <ShieldCheck size={16} style={{ color: '#10b981', display: 'inline', marginRight: '4px' }} /> Verified
              </span>
              <span className="hero-stat-lbl">Ledger Escrow</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-val">
                <Zap size={16} style={{ color: '#8b5cf6', display: 'inline', marginRight: '4px' }} /> Instant
              </span>
              <span className="hero-stat-lbl">Buy Now Option</span>
            </div>
          </div>
        </div>
      </div>

      <div className="marketplace-layout">
        {/* Mobile Filter Drawer Toggle Button */}
        <div className="mobile-filter-bar">
          <button
            type="button"
            className="mobile-filter-btn"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <SlidersHorizontal size={18} />
            <span>{isAnyFilterActive ? 'Filters Active' : 'Filter Auctions'}</span>
          </button>
        </div>

        {/* Sticky Filter Sidebar */}
        <aside className={`filter-panel-card panel-card ${showMobileFilters ? 'mobile-filters-open' : ''}`}>
          <div className="panel-header">
            <h3>
              <SlidersHorizontal size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Find Auctions
            </h3>
            {showMobileFilters && (
              <button type="button" className="mobile-filter-close" onClick={() => setShowMobileFilters(false)}>
                <X size={18} />
              </button>
            )}
            {isAnyFilterActive && (
              <button type="button" className="text-button reset-link" onClick={clearFilters}>
                <RotateCcw size={13} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
          
          <form onSubmit={handleApplyFilters} className="filter-scroll-container">
            <div className="form-group">
              <label className="form-label">Search Query</label>
              <div className="input-with-icon">
                <Search size={16} className="field-icon" />
                <input
                  type="text"
                  placeholder="Title or keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-field search-input-glow"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <div className="category-filter-rail">
                <button
                  type="button"
                  className={`category-chip ${category === '' ? 'active' : ''}`}
                  onClick={() => setCategory('')}
                >
                  All
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`category-chip ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Condition</label>
              <CustomSelect
                options={[
                  { value: '', label: 'Any Condition' },
                  ...CONDITIONS.map(cond => ({ value: cond.value, label: cond.label }))
                ]}
                value={condition}
                onChange={(val) => setCondition(val)}
                placeholder="Any Condition"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Listing Tier</label>
              <CustomSelect
                options={[
                  { value: '', label: 'All Tiers' },
                  { value: 'STANDARD', label: 'Standard Tier' },
                  { value: 'PREMIUM', label: 'Premium Tier' }
                ]}
                value={listingType}
                onChange={(val) => setListingType(val)}
                placeholder="All Tiers"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="status-segmented-control">
                <button
                  type="button"
                  className={`segment-btn ${status === '' ? 'active' : ''}`}
                  onClick={() => setStatus('')}
                >
                  Live
                </button>
                <button
                  type="button"
                  className={`segment-btn ${status === 'closed' ? 'active' : ''}`}
                  onClick={() => setStatus('closed')}
                >
                  Ended
                </button>
                <button
                  type="button"
                  className={`segment-btn ${status === 'all' ? 'active' : ''}`}
                  onClick={() => setStatus('all')}
                >
                  All
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Entry Fee Type</label>
              <CustomSelect
                options={[
                  { value: '', label: 'Any Entry Fee' },
                  { value: 'FREE', label: 'Free Entry' },
                  { value: 'PAID', label: 'Paid Entry Only' }
                ]}
                value={entryFeeType}
                onChange={(val) => setEntryFeeType(val)}
                placeholder="Any Entry Fee"
              />
            </div>

            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="buyNowCheck"
                checked={hasBuyNow}
                onChange={(e) => setHasBuyNow(e.target.checked)}
              />
              <label htmlFor="buyNowCheck" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: '#8b5cf6' }} /> Has Buy Now Price
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Price Range</label>
              <div className="price-input-row">
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="form-field"
                />
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="form-field"
                />
              </div>
            </div>

            <div className="filter-actions-group">
              <button type="submit" className="btn-primary-action apply-filters-btn">
                Apply Filters
              </button>

              {isAnyFilterActive && (
                <button type="button" className="btn-secondary-action reset-filters-btn" onClick={clearFilters}>
                  Reset Filters
                </button>
              )}
            </div>
          </form>
        </aside>

        {/* Dynamic Results Section */}
        <section className="results-panel">
          <div className="results-header">
            <h2 className="results-title">
              {isFilterApplied ? 'Filtered Results' : 'Ongoing Live Auctions'}
            </h2>

            <div className="results-sort-bar">
              <span className="sort-label">Sort:</span>
              <CustomSelect
                options={[
                  { value: 'newest', label: 'Newly Listed' },
                  { value: 'ending-soon', label: 'Ending Soon' },
                  { value: 'highest-bid', label: 'Highest Current Bid' },
                  { value: 'buy-now-asc', label: 'Buy Now: Low to High' },
                  { value: 'buy-now-desc', label: 'Buy Now: High to Low' },
                  { value: 'most-participants', label: 'Most Participants' }
                ]}
                value={sort}
                onChange={(val) => {
                  setSort(val);
                  if (isFilterApplied) {
                    loadAuctions({ search, status, category, condition, listingType, entryFeeType, hasBuyNow, minPrice, maxPrice, sort: val }, page);
                  } else {
                    loadAuctions({ sort: val }, page);
                  }
                }}
                className="sort-dropdown"
              />
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}
          
          {loading ? (
            <div className="loading-box">
              <div className="loading-spinner" />
              <p>Loading active auctions...</p>
            </div>
          ) : auctions.length === 0 ? (
            <div className="empty-results-box">
              <PackageSearch size={48} className="empty-icon-svg" />
              <h3>No auctions found</h3>
              <p>Try adjusting your search criteria or resetting filters.</p>
              {isAnyFilterActive && (
                <button className="btn-secondary-action clear-empty-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
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
                <div className="pagination-bar">
                  <button
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="pagination-btn"
                  >
                    ← Previous
                  </button>
                  <span className="page-indicator">
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="pagination-btn"
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

