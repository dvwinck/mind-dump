/**
 * Mind Dump - Main Application Entry Point
 * SPA + PWA for mental dump notes
 */

import * as ui from './ui.js';
import { CATEGORIES } from './categories.js';

// App initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 Mind Dump initialized');
  console.log('Categories:', CATEGORIES.map(c => c.name).join(', '));
  
  // Initialize UI (includes storage, drag & drop, export/import)
  ui.init();
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker registered:', registration.scope);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Service Worker update found');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('📦 New version available! Refresh to update.');
            showUpdateNotification();
          }
        });
      });
    } catch (error) {
      console.error('❌ SW registration failed:', error);
    }
  });
}

// Show update notification (simple alert for now, can be improved later)
function showUpdateNotification() {
  if (confirm('Nova versão disponível! Deseja atualizar agora?')) {
    window.location.reload();
  }
}
