import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, PackageSearch } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import CustomSelect from '../components/CustomSelect';
import MarketplaceHero from '../components/MarketplaceHero';
import AuctionFilterSidebar from '../components/AuctionFilterSidebar';
import LoadingSpinner from '../components/LoadingSpinner';
import { SORT_OPTIONS } from '../utils/constants';

const HomePage = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  
  // Pending filter inputs
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
        params.append('status', 'active');
      }

      params.append('page', String(pageNum));
      params.append('limit', '12');

      const res = await api.get(`/auctions?${params.toString()}`);
      
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

  const handleToggleWatchlist = useCallback(async (auctionId) => {
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
  }, []);

  const isAnyFilterActive = isFilterApplied || Boolean(
    search || status || category || condition || listingType || entryFeeType || hasBuyNow || minPrice || maxPrice
  );

  return (
    <div className="page-shell marketplace-shell">
      {/* Hero Banner Section */}
      <MarketplaceHero />

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
        <AuctionFilterSidebar
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          condition={condition}
          setCondition={setCondition}
          listingType={listingType}
          setListingType={setListingType}
          status={status}
          setStatus={setStatus}
          entryFeeType={entryFeeType}
          setEntryFeeType={setEntryFeeType}
          hasBuyNow={hasBuyNow}
          setHasBuyNow={setHasBuyNow}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          isAnyFilterActive={isAnyFilterActive}
          showMobileFilters={showMobileFilters}
          setShowMobileFilters={setShowMobileFilters}
          onApplyFilters={handleApplyFilters}
          onClearFilters={clearFilters}
        />

        {/* Results Section */}
        <section className="results-panel">
          <div className="results-header">
            <h2 className="results-title">
              {isFilterApplied ? 'Filtered Results' : 'Ongoing Live Auctions'}
            </h2>

            <div className="results-sort-bar">
              <span className="sort-label">Sort:</span>
              <CustomSelect
                options={SORT_OPTIONS}
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
            <LoadingSpinner message="Loading active auctions..." />
          ) : auctions.length === 0 ? (
            <div className="empty-results-box">
              <PackageSearch size={48} className="empty-icon-svg" />
              <h3>No auctions found</h3>
              <p>Try adjusting your search criteria or resetting filters.</p>
              {isAnyFilterActive && (
                <button type="button" className="btn-secondary-action clear-empty-btn" onClick={clearFilters}>
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
                    type="button"
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
                    type="button"
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
