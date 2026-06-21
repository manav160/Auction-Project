// Animation helpers for AuctionForm
export function animateAuctionSuccess(element) {
  if (!element) return;
  element.classList.remove('auction-shake', 'auction-error-flash');
  element.classList.add('auction-success-bounce', 'auction-success-flash');
  setTimeout(() => {
    element.classList.remove('auction-success-bounce', 'auction-success-flash');
  }, 900);
}

export function animateAuctionError(element) {
  if (!element) return;
  element.classList.remove('auction-success-bounce', 'auction-success-flash');
  element.classList.add('auction-shake', 'auction-error-flash');
  setTimeout(() => {
    element.classList.remove('auction-shake', 'auction-error-flash');
  }, 600);
}
