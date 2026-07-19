'use client';

import { useEffect, useRef } from 'react';

/**
 * Decorative background video: muted, looping, lazy — plays only while near
 * the viewport and pauses off-screen or when the tab is hidden, so it never
 * competes with page performance. Purely visual (aria-hidden); the poster
 * paints instantly before the video is ready.
 */
export function BgVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion.matches) video.play().catch(() => {});
      else video.pause();
    }, { rootMargin: '160px' });
    observer.observe(video);

    const onVisibility = () => {
      if (document.hidden) video.pause();
      else if (!reducedMotion.matches && video.getBoundingClientRect().top < window.innerHeight) video.play().catch(() => {});
    };
    const onMotionPreference = () => {
      if (reducedMotion.matches) video.pause();
      else onVisibility();
    };
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onMotionPreference);

    if (reducedMotion.matches) video.pause();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionPreference);
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
      preload="metadata"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
