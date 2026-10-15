import { Clock, Clock3, CheckCircle2 } from 'lucide-react';

export const CATEGORIES = [
  'Electronics',
  'Collectibles',
  'Fashion',
  'Home',
  'Motors',
  'Other'
];

export const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' }
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newly Listed' },
  { value: 'ending-soon', label: 'Ending Soon' },
  { value: 'highest-bid', label: 'Highest Current Bid' },
  { value: 'buy-now-asc', label: 'Buy Now: Low to High' },
  { value: 'buy-now-desc', label: 'Buy Now: High to Low' },
  { value: 'most-participants', label: 'Most Participants' }
];

export const LISTING_TIERS = [
  { value: '', label: 'All Tiers' },
  { value: 'STANDARD', label: 'Standard Tier' },
  { value: 'PREMIUM', label: 'Premium Tier' }
];

export const ENTRY_FEE_OPTIONS = [
  { value: '', label: 'Any Entry Fee' },
  { value: 'FREE', label: 'Free Entry' },
  { value: 'PAID', label: 'Paid Entry Only' }
];

export const STATUS_META = {
  DRAFT: { label: 'Draft', css: 'status-draft', icon: null },
  SCHEDULED: { label: 'Scheduled', css: 'status-scheduled', icon: Clock },
  ACTIVE: { label: 'Live', css: 'status-active', isLive: true },
  PENDING_RESOLUTION: { label: 'Resolving', css: 'status-pending', icon: Clock3 },
  COMPLETED: { label: 'Completed', css: 'status-completed', icon: CheckCircle2 },
  UNSOLD: { label: 'Unsold', css: 'status-unsold', icon: null },
  CANCELED: { label: 'Canceled', css: 'status-closed', icon: null },
};

export const STATUS_GROUPS = [
  { key: 'SCHEDULED',          label: 'Scheduled Auctions', emptyMsg: 'No scheduled auctions.' },
  { key: 'ACTIVE',             label: 'Live Auctions',      emptyMsg: 'No live auctions.', isLive: true },
  { key: 'PENDING_RESOLUTION', label: 'Resolving Settlement', emptyMsg: null },
  { key: 'COMPLETED',          label: 'Completed Auctions', emptyMsg: null },
  { key: 'UNSOLD',             label: 'Unsold Auctions',    emptyMsg: null },
  { key: 'CANCELED',           label: 'Canceled Auctions',  emptyMsg: null },
];

export const normalizeAuctionStatus = (status) => {
  if (!status) return 'CANCELED';
  const upper = String(status).toUpperCase();
  if (upper === 'CLOSED') return 'COMPLETED';
  return upper;
};
