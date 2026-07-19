'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping.
 * Robust playback for desktop AND mobile (iOS Safari + Android Chrome):
 *   - IntersectionObserver retries play() every time the panel scrolls in
 *     (mobile browsers often block autoplay until the element is on screen)
 *   - listens for `loadeddata`/`canplay` and tries to play as soon as data is
 *     available, so a slow `preload="auto"` over cellular data doesn't strand
 *     the poster forever
 *   - retries play() on a short escalating schedule (300ms → 1200ms) and again
 *     on every visibilitychange / intersection event
 *   - pauses when the tab is hidden or the panel is off-screen (saves battery)
 *   - poster overlay disappears the moment `playing` fires
 * Purely visual (aria-hidden).
 */
export function BgVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const posterEl = posterRef.current;
    if (!video || !posterEl) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // ── Poster visibility ──────────────────────────────────────────
    const showPoster = () => posterEl.classList.add('is-visible');
    const hidePoster = () => posterEl.classList.remove('is-visible');
    const onPlaying = () => hidePoster();
    const onPause = () => showPoster();
    const onWaiting = () => showPoster();
    const onError = () => showPoster();
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onError);
    posterEl.classList.add('is-visible');

    if (reducedMotion.matches) {
      // Honour reduced-motion: leave poster visible, don't try to play.
      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('error', onError);
      };
    }

    // ── Play helpers ──────────────────────────────────────────────
    // Many mobile browsers reject play() if it isn't user-driven OR if the
    // element isn't ready. We retry a few times and again on intersection.
    let retryHandle: number | undefined;
    let cancelled = false;

    const attemptPlay = () => {
      if (cancelled) return;
      video
        .play()
        .then(() => hidePoster())
        .catch((err) => {
          if (cancelled) return;
          // NotAllowedError => autoplay blocked; AbortError => play() interrupted
          // by pause(). Either way: schedule another attempt later.
          if (err?.name && err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            // eslint-disable-next-line no-console
            console.debug('[BgVideo] play() failed:', err.name);
          }
        });
    };

    const scheduleRetry = (delay: number) => {
      if (retryHandle) window.clearTimeout(retryHandle);
      retryHandle = window.setTimeout(() => {
        if (!cancelled && !reducedMotion.matches) attemptPlay();
      }, delay);
    };

    const onLoadedData = () => {
      // Data is ready — try to start now (covers the slow-cellular case).
      attemptPlay();
    };
    const onCanPlay = () => attemptPlay();
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);

    // Kick off playback + escalating retries
    attemptPlay();
    scheduleRetry(300);
    scheduleRetry(1200);

    // Pause when tab hidden, resume when visible
    const onVisibility = () => {
      if (cancelled) return;
      if (document.hidden) {
        video.pause();
        showPoster();
      } else {
        attemptPlay();
        scheduleRetry(400);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // React to reduced-motion preference changes
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (cancelled) return;
      if (e.matches) {
        if (retryHandle) window.clearTimeout(retryHandle);
        video.pause();
        showPoster();
      } else {
        attemptPlay();
        scheduleRetry(300);
      }
    };
    reducedMotion.addEventListener('change', onMotionChange);

    // IntersectionObserver: re-attempt play whenever the panel is on screen.
    // This is the main fix for mobile — autoplay is often deferred until the
    // element actually intersects the viewport.
    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (cancelled) return;
            if (entry.isIntersecting) {
              attemptPlay();
              scheduleRetry(250);
            } else {
              // Off-screen: pause to save battery/CPU
              video.pause();
              showPoster();
            }
          }
        },
        { root: null, rootMargin: '200px', threshold: 0.01 },
      );
      intersectionObserver.observe(video);
    }

    return () => {
      cancelled = true;
      if (retryHandle) window.clearTimeout(retryHandle);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
      intersectionObserver?.disconnect();
    };
  }, []);

  return (
    <>
      {/* Poster overlay — above the video, covers black frames on mobile */}
      <div
        ref={posterRef}
        className="media-panel-poster"
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
        aria-hidden="true"
      />
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
    </>
  );
}
