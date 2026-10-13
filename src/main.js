/**
 * Mind Dump - Main Application Entry Point
 * SPA + PWA for mental dump notes
 */

import * as ui from './ui.js';
import { CATEGORIES } from './categories.js';
import { showToast } from './toast.js';

// App initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 Mind Dump initialized');
  console.log('Categories:', CATEGORIES.map(c => c.name).join(', '));

  // Ask the browser not to evict our data under storage pressure (best effort, may be a no-op)
  navigator.storage?.persist?.();

  // Initialize UI (includes storage, drag & drop, export/import)
  ui.init();
});

// Service Worker registration and update flow
if ('serviceWorker' in navigator) {
  // On the very first visit the SW claims the page; that must not trigger a reload,
  // unless the user asked for an update (a first-visit tab can still be offered one later).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let updateRequested = false;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if ((!hadController && !updateRequested) || reloading) return;
    reloading = true;
    window.location.reload();
  });

  const offerUpdate = (worker) => {
    showToast('Nova versão disponível.', {
      actionLabel: 'Atualizar',
      timeout: 0,
      onAction: () => {
        updateRequested = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      console.log('✅ Service Worker registered:', registration.scope);

      // An update may already be waiting from an earlier visit (toast dismissed, tab closed)
      if (registration.waiting && navigator.serviceWorker.controller) {
        offerUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            offerUpdate(newWorker);
          }
        });
      });
    } catch (error) {
      console.error('❌ SW registration failed:', error);
    }
  });
}
