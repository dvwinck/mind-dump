import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast } from '../src/toast.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-container"></div>';
});
afterEach(() => vi.useRealTimers());

describe('showToast', () => {
  it('returns null when there is no container', () => {
    document.body.innerHTML = '';
    expect(showToast('x')).toBeNull();
  });

  it('shows the message as text, never as HTML', () => {
    showToast('<img src=x onerror=alert(1)>');
    const container = document.getElementById('toast-container');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.toast-body').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('uses role=alert for danger and role=status otherwise', () => {
    expect(showToast('a', { variant: 'danger' }).getAttribute('role')).toBe('alert');
    expect(showToast('b').getAttribute('role')).toBe('status');
  });

  it('disappears after the timeout', () => {
    vi.useFakeTimers();
    showToast('bye', { timeout: 1000 });
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('stays while timeout is 0', () => {
    vi.useFakeTimers();
    showToast('sticky', { timeout: 0 });
    vi.advanceTimersByTime(60000);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
  });

  it('runs the action callback and dismisses', () => {
    const onAction = vi.fn();
    showToast('update', { actionLabel: 'Atualizar', onAction, timeout: 0 });
    document.querySelector('.toast .btn-light').click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('closes with the close button', () => {
    showToast('x', { timeout: 0 });
    document.querySelector('.toast .btn-close').click();
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });
});
