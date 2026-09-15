import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

// ===== SAFE STORAGE & QUOTA DEFENSE SYSTEM =====
// Protect against QuotaExceededError crashes from Firestore multi-tab state or oversized caches
(function initStorageProtection() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const storage = window.localStorage;

  // 1. Initial cleanup of stale or oversized keys to guarantee free quota for Firestore
  try {
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k) continue;
      // Stale Firestore zombie/orphan targets from crashed sessions
      if (k.startsWith('firestore_zombie_')) {
        keysToRemove.push(k);
      } else if (k.startsWith('mauze_photo_') || k.startsWith('mauze_student_photo_') || k === 'activeChildPhoto') {
        const val = storage.getItem(k);
        if (val && (val.startsWith('data:image/') || val.length > 100000)) {
          keysToRemove.push(k);
        }
      } else if (k === 'mauze_portal_cache') {
        const val = storage.getItem(k);
        if (val && val.length > 200000) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch (_) {}

  // 2. Wrap setItem to safely handle QuotaExceededError and avoid crashing Firestore
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = function safeSetItem(key, value) {
    // Avoid storing massive string payloads (> 200 KB) in localStorage (which has a 5 MB hard limit)
    if (typeof value === 'string' && value.length > 200000) {
      if (key === 'mauze_portal_cache' || key.startsWith('mauze_photo_') || key === 'activeChildPhoto') {
        return;
      }
    }

    try {
      originalSetItem(key, value);
    } catch (err) {
      const isQuota =
        err &&
        (err.name === 'QuotaExceededError' ||
          err.code === 22 ||
          err.number === -2147024882 ||
          String(err).includes('QuotaExceededError') ||
          String(err).includes('quota'));

      if (isQuota) {
        // Automatically evict non-essential caches to make room
        try {
          storage.removeItem('mauze_portal_cache');
          for (let i = storage.length - 1; i >= 0; i--) {
            const k = storage.key(i);
            if (
              k &&
              (k.startsWith('mauze_photo_') ||
                k.startsWith('mauze_student_photo_') ||
                k === 'activeChildPhoto' ||
                k.startsWith('firestore_zombie_') ||
                k.startsWith('firestore_targets_'))
            ) {
              storage.removeItem(k);
            }
          }
          // Retry setting the item after eviction
          originalSetItem(key, value);
          return;
        } catch (_) {
          // If Firestore's internal WebStorageSharedClientState is the caller, suppressing
          // the error prevents FIRESTORE (12.13.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)
          if (key && (key.startsWith('firestore_') || key.startsWith('__PRIVATE_'))) {
            return;
          }
          return;
        }
      }
      throw err;
    }
  };
})();

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (
    msg.includes('message channel closed') ||
    msg.includes('listener indicated an asynchronous response') ||
    msg.includes('unload is not allowed') ||
    msg.includes('INTERNAL ASSERTION FAILED') ||
    msg.includes('QuotaExceededError')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const filename = event.filename || '';
  if (
    filename.includes('logsListener.bundle.js') ||
    msg.includes('message channel closed') ||
    msg.includes('listener indicated an asynchronous response') ||
    msg.includes('unload is not allowed') ||
    msg.includes('INTERNAL ASSERTION FAILED') ||
    msg.includes('QuotaExceededError')
  ) {
    event.preventDefault();
  }
});

// ===== PREMIUM SCROLL REVEAL SYSTEM =====
(function initScrollReveal() {
  if (typeof window === 'undefined' || !window.IntersectionObserver) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;

        if (el.classList.contains('stagger-children')) {
          el.classList.add('revealed');
          const items = el.querySelectorAll('.stagger-item');
          items.forEach((item, i) => {
            item.style.transitionDelay = `${i * 0.06}s`;
            requestAnimationFrame(() => item.classList.add('revealed'));
          });
        } else {
          el.classList.add('revealed');
        }

        observer.unobserve(el);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px',
  });

  const init = () => {
    document.querySelectorAll(
      '.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .stagger-children'
    ).forEach((el) => observer.observe(el));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-observe when DOM changes (for dynamically loaded content)
  const mo = new MutationObserver(() => init());
  mo.observe(document.body, { childList: true, subtree: true });
})();

// ===== IMAGE LOAD HANDLER =====
(function initImageLoader() {
  document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG') {
      e.target.classList.add('loaded');
    }
  }, true);
})();

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);


