'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping, seamless playback.
 *
 * On real mobile devices, the browser video decoder releases GPU
 * resources when a <video> scrolls off-screen.  When it re-enters
 * the viewport the decoder needs time to produce a valid frame,
 * so the <video> shows black during that gap.
 *
 * The fix: a poster <div> at z‑index 1 sits *above* the video and
 * toggles visible when the video is paused/waiting (showing black)
 * and hidden when actively playing.  The poster image always covers
 * any black frame.
 *
 * Reduced‑motion users get the static poster permanently.
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
    if (reducedMotion.matches) {
      posterEl.classList.add('is-visible');
      return;
    }

    let destroyed = false;

    // ── Poster visibility ──────────────────────────────────────────
    // Show poster when the video is NOT actively delivering frames
    // (paused, waiting for data, or errored).  Hide it when playing.
    const showPoster = () => {
      if (!destroyed) posterEl.classList.add('is-visible');
    };
    const hidePoster = () => {
      if (!destroyed) posterEl.classList.remove('is-visible');
    };
    video.addEventListener('playing', hidePoster);
    video.addEventListener('pause', showPoster);
    video.addEventListener('waiting', showPoster);
    video.addEventListener('error', showPoster);

    // Show poster initially until the first frame renders
    posterEl.classList.add('is-visible');

    // ── Playback ────────────────────────────────────────────────────
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
    playSafe();

    // ── Tab visibility ──────────────────────────────────────────────
    const onVisibility = () => {
      if (destroyed) return;
      if (document.hidden) {
        video.pause();
      } else {
        playSafe();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ── Reduced-motion preference change ────────────────────────────
    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        video.pause();
        showPoster();
      } else {
        playSafe();
      }
    };
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      destroyed = true;
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
      {/* Poster overlay — always above the video, covers black frames */}
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
