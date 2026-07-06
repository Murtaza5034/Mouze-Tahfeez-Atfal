import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('listener indicated an asynchronous response')) {
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


