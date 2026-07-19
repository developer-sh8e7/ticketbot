'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping.
 * Only pauses when the browser tab is hidden.
 * Purely visual (aria-hidden); the poster paints before the video loads.
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
    video.addEventListener('playing', hidePoster);
    video.addEventListener('pause', showPoster);
    video.addEventListener('waiting', showPoster);
    video.addEventListener('error', showPoster);
    posterEl.classList.add('is-visible');

    if (reducedMotion.matches) return;

    // Play on mount — retry once after a short load delay
    const playVideo = () => {
      video.play().catch(() => {
        setTimeout(() => video.play().catch(() => {}), 300);
      });
    };
    playVideo();

    // Pause when tab hidden, resume when visible
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else playVideo();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // React to reduced-motion preference changes
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        video.pause();
        showPoster();
      } else {
        playVideo();
      }
    };
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      video.removeEventListener('playing', hidePoster);
      video.removeEventListener('pause', showPoster);
      video.removeEventListener('waiting', showPoster);
      video.removeEventListener('error', showPoster);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
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
