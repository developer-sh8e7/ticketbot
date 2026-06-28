'use client';

import { useEffect } from 'react';

const SESSION_KEY = 'opus_visit_logged';

/**
 * Fires ONE Discord webhook per browser session (tab).
 * Uses sessionStorage so it only sends once even with React StrictMode double-mount.
 * Silent — no UI.
 */
export function VisitLogger() {
  useEffect(() => {
    // Only fire once per session
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // sessionStorage not available
    }

    const path = window.location.pathname;

    // Mark before sending so even if the request fails, we don't retry
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore
    }

    fetch('/api/log/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => {
      // Best-effort, silently ignore
    });
  }, []);

  return null;
}
