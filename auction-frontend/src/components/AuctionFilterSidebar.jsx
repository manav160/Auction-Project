import React, { memo } from 'react';
import { Search, SlidersHorizontal, RotateCcw, Zap, X } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { CATEGORIES, CONDITIONS, LISTING_TIERS, ENTRY_FEE_OPTIONS } from '../utils/constants';

const AuctionFilterSidebar = ({
  search,
  setSearch,
  category,
  setCategory,
  condition,
  setCondition,
  listingType,
  setListingType,
  status,
  setStatus,
  entryFeeType,
  setEntryFeeType,
  hasBuyNow,
  setHasBuyNow,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  isAnyFilterActive,
  showMobileFilters,
  setShowMobileFilters,
  onApplyFilters,
  onClearFilters
}) => {
  return (
    <aside className={`filter-panel-card panel-card ${showMobileFilters ? 'mobile-filters-open' : ''}`}>
      <div className="panel-header">
        <h3>
          <SlidersHorizontal size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Find Auctions
        </h3>
        {showMobileFilters && (
          <button
            type="button"
            className="mobile-filter-close"
            onClick={() => setShowMobileFilters(false)}
            aria-label="Close filters"
          >
            <X size={18} />
          </button>
        )}
        {isAnyFilterActive && (
          <button type="button" className="text-button reset-link" onClick={onClearFilters}>
            <RotateCcw size={13} style={{ marginRight: '4px' }} /> Reset
          </button>
        )}
      </div>

      <form onSubmit={onApplyFilters} className="filter-scroll-container">
        {/* Search Input */}
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

        {/* Category Filter Chips */}
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
            {CATEGORIES.map((cat) => (
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

        {/* Condition Dropdown */}
        <div className="form-group">
          <label className="form-label">Condition</label>
          <CustomSelect
            options={[
              { value: '', label: 'Any Condition' },
              ...CONDITIONS.map((cond) => ({ value: cond.value, label: cond.label }))
            ]}
            value={condition}
            onChange={(val) => setCondition(val)}
            placeholder="Any Condition"
          />
        </div>

        {/* Listing Tier Dropdown */}
        <div className="form-group">
          <label className="form-label">Listing Tier</label>
          <CustomSelect
            options={LISTING_TIERS}
            value={listingType}
            onChange={(val) => setListingType(val)}
            placeholder="All Tiers"
          />
        </div>

        {/* Status Segmented Control */}
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

        {/* Entry Fee Filter */}
        <div className="form-group">
          <label className="form-label">Entry Fee Type</label>
          <CustomSelect
            options={ENTRY_FEE_OPTIONS}
            value={entryFeeType}
            onChange={(val) => setEntryFeeType(val)}
            placeholder="Any Entry Fee"
          />
        </div>

        {/* Buy Now Checkbox */}
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

        {/* Price Range Filter */}
        <div className="form-group">
          <label className="form-label">Price Range</label>
          <div className="price-input-row">
            <input
              type="number"
              placeholder="Min ₹"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="form-field"
              min="0"
            />
            <input
              type="number"
              placeholder="Max ₹"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="form-field"
              min="0"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="filter-actions-group">
          <button type="submit" className="btn-primary-action apply-filters-btn">
            Apply Filters
          </button>

          {isAnyFilterActive && (
            <button type="button" className="btn-secondary-action reset-filters-btn" onClick={onClearFilters}>
              Reset Filters
            </button>
          )}
        </div>
      </form>
    </aside>
  );
};

export default memo(AuctionFilterSidebar);
