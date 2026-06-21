// Simple animation helpers for AuthPage
export function animateSuccess(element) {
  if (!element) return;
  element.classList.remove('shake', 'error-flash');
  element.classList.add('success-bounce', 'success-flash');
  setTimeout(() => {
    element.classList.remove('success-bounce', 'success-flash');
  }, 900);
}

export function animateError(element) {
  if (!element) return;
  element.classList.remove('success-bounce', 'success-flash');
  element.classList.add('shake', 'error-flash');
  setTimeout(() => {
    element.classList.remove('shake', 'error-flash');
  }, 600);
}
