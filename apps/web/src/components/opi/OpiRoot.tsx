'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Client-only + code-split: Opi never blocks the initial page load.
const OpiWidget = dynamic(() => import('./OpiWidget').then((m) => m.OpiWidget), { ssr: false });

export function OpiRoot() {
  const [ready, setReady] = useState(false);

  // Mount after the browser is idle (or 2.5s fallback) so the rest of the site paints first.
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return ready ? <OpiWidget /> : null;
}
