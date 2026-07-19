'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping, plays while visible,
 * pauses when off-screen or when the tab is hidden.
 * Purely visual (aria-hidden); the poster paints before the video loads.
 */
export function BgVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    let destroyed = false;

    /** Attempt playback with one retry after a short load delay. */
    const tryPlay = () => {
      if (destroyed) return;
      video.play().catch(() => {
        if (!destroyed) {
          setTimeout(() => {
            if (!destroyed) video.play().catch(() => {});
          }, 400);
        }
      });
    };

    // Play on mount (autoPlay may be blocked on mobile)
    tryPlay();

    // Pause when off-screen, resume when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (destroyed) return;
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          video.pause();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(video);

    // Pause when tab hidden, resume when visible
    const onVisibility = () => {
      if (destroyed) return;
      if (document.hidden) {
        video.pause();
      } else {
        tryPlay();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // React to reduced-motion preference changes
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) video.pause();
      else tryPlay();
    };
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      destroyed = true;
      observer.disconnect();
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
