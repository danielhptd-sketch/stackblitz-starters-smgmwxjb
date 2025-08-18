import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import './styles.css';

const MOUNT_ID = 'hptd-configurator';

function mountNow() {
  const el = document.getElementById(MOUNT_ID);
  if (!el) {
    // Soft fail (don’t throw) so the page continues; log once.
    if (!document.documentElement.hasAttribute('data-hptd-mount-miss')) {
      document.documentElement.setAttribute('data-hptd-mount-miss', '1');
      console.warn('[HPTD] mount element not found:', `#${MOUNT_ID}`);
    }
    return;
  }
  const root = createRoot(el);
  root.render(<App />);
}

// Run after DOM is ready (covers head/async/edge cases)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountNow);
} else {
  mountNow();
}
