/**
 * Mind Dump - Toast notifications
 * Plain DOM (Bootstrap classes only), so it works and is testable without Bootstrap's JS.
 */

const DEFAULT_TIMEOUT = 5000;

export function showToast(message, { variant = 'secondary', actionLabel, onAction, timeout = DEFAULT_TIMEOUT } = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.className = `toast show align-items-center text-bg-${variant} border-0`;
  toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');

  const row = document.createElement('div');
  row.className = 'd-flex';

  const text = document.createElement('div');
  text.className = 'toast-body';
  text.textContent = message;
  row.append(text);

  const dismiss = () => toast.remove();

  if (actionLabel && onAction) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-sm btn-light m-auto me-2';
    action.textContent = actionLabel;
    action.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    row.append(action);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-close btn-close-white m-auto me-2';
  close.setAttribute('aria-label', 'Fechar');
  close.addEventListener('click', dismiss);
  row.append(close);

  toast.append(row);
  container.append(toast);

  if (timeout > 0) setTimeout(dismiss, timeout);
  return toast;
}
