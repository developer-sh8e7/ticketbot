'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping, seamless playback.
 *
 * On mobile, pausing/resuming on scroll (IntersectionObserver) causes
 * the video decoder to flush, leaving a black frame until the next
 * playable frame loads.  The fix: never pause during scroll — only
 * pause when the browser tab is hidden.  The `autoPlay` + `muted`
 + `playsInline` attributes handle the initial start; we call
 * play() explicitly as a safety net for browsers that block autoplay
 * even when muted.
 *
 * Reduced‑motion users get the static poster instead.
 * Purely visual (aria-hidden).
 */
export function BgVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    let destroyed = false;

    /** Attempt playback — retry once after a short load delay. */
    const playSafe = () => {
      if (destroyed) return;
      video.play().catch(() => {
        if (!destroyed) {
          setTimeout(() => {
            if (!destroyed) video.play().catch(() => {});
          }, 400);
        }
      });
    };

    // Start on mount (autoPlay may be blocked on some mobile browsers)
    playSafe();

    // Pause only when the tab is hidden — never pause during scroll.
    // On mobile, pause/resume during scroll triggers black frames
    // because the browser flushes the video decoder.
    const onVisibility = () => {
      if (destroyed) return;
      if (document.hidden) {
        video.pause();
      } else {
        playSafe();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // React to reduced-motion preference changes
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) video.pause();
      else playSafe();
    };
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="media-panel-video"
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
